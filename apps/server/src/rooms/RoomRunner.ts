import { difficultyForRound, TIMINGS, VOTE_OPTIONS, type ErrorCode, type FlagReason, type TimingKey } from '@trivia/shared';
import type { Clock } from '../clock.ts';
import { shuffleChoices, type Rng } from '../content/select.ts';
import type { Store } from '../db/store.ts';
import type { Room, VoteOption } from './Room.ts';

type Result = { ok: true } | { ok: false; error: ErrorCode };

export interface RunnerDeps {
  store: Store;
  clock: Clock;
  rng: Rng;
  /** Multiplies every phase length (tests and E2E run faster). */
  timingScale: number;
  onChange: (room: Room) => void;
  log: { warn: (obj: object, msg: string) => void };
}

/**
 * Drives one Room through the game: owns its single phase timer, talks to the
 * store at phase boundaries, and ends phases early when everyone has acted.
 * All store writes are fire-and-forget; a database hiccup never stalls a game.
 */
export class RoomRunner {
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped on every flow change so late async results are discarded. */
  private epoch = 0;
  private pausedAt: number | null = null;
  private pausedRemaining: number | null = null;
  private matchId: Promise<string | null> = Promise.resolve(null);

  constructor(
    readonly room: Room,
    private readonly deps: RunnerDeps,
  ) {}

  // -------------------------------------------------------------------------
  // Commands (from sockets)

  start(byId: string): Result {
    const check = this.room.canStart(byId);
    if (!check.ok) return check;
    this.beginGame();
    return { ok: true };
  }

  newLobby(byId: string): Result {
    if (byId !== this.room.vipId) return { ok: false, error: 'NOT_ALLOWED' };
    if (this.room.phase !== 'final') return { ok: false, error: 'IN_PROGRESS' };
    this.stopTimer();
    this.epoch++;
    this.room.enterLobby();
    this.changed();
    return { ok: true };
  }

  vote(playerId: string, option: number): Result {
    const res = this.room.castVote(playerId, option);
    if (res.ok) this.afterAction();
    return res;
  }

  answer(playerId: string, questionId: string, choice: number): Result {
    const res = this.room.submitAnswer(playerId, questionId, choice, this.deps.clock());
    if (res.ok) this.afterAction();
    return res;
  }

  flag(playerId: string, questionId: string, reason: FlagReason): Result {
    const res = this.room.flag(playerId, questionId);
    if (!res.ok) return res;
    void this.matchId
      .then((matchId) =>
        this.deps.store.flagQuestion({ questionId, matchId, playerName: res.playerName, reason }),
      )
      .catch((err: unknown) => this.deps.log.warn({ err }, 'flagQuestion failed'));
    this.changed();
    return { ok: true };
  }

  playerLeft(playerId: string): void {
    if (this.room.playerDisconnected(playerId, this.deps.clock())) {
      this.afterAction();
      this.changed();
    }
  }

  /** The TV dropped: freeze the game so nobody plays blind. */
  hostLeft(): void {
    const now = this.deps.clock();
    this.room.hostDisconnectedNow(now);
    const phase = this.room.phase;
    if (phase === 'lobby' || phase === 'final' || this.room.paused) return;
    this.pausedAt = now;
    this.pausedRemaining = this.room.phaseEndsAt === null ? null : Math.max(0, this.room.phaseEndsAt - now);
    this.stopTimer();
    this.room.paused = true;
    this.room.phaseEndsAt = null;
    this.changed();
  }

  hostBack(): void {
    this.room.hostConnectedNow();
    if (this.room.paused) {
      const now = this.deps.clock();
      this.room.paused = false;
      if (this.pausedAt !== null) this.room.shiftAnswerClock(now - this.pausedAt);
      const remaining = this.pausedRemaining;
      this.pausedAt = null;
      this.pausedRemaining = null;
      if (remaining !== null) this.scheduleMs(remaining);
      if (this.room.allActed()) this.advanceNow();
    }
    this.changed();
  }

  dispose(): void {
    this.stopTimer();
    this.epoch++;
  }

  // -------------------------------------------------------------------------
  // Flow

  private beginGame(): void {
    this.stopTimer();
    this.epoch++;
    this.room.enterIntro();
    const players = [...this.room.players.values()].map((p) => ({ seat: p.seat, name: p.name, avatar: p.avatar }));
    this.matchId = this.deps.store
      .startMatch({ householdId: this.room.householdId, roomCode: this.room.code, players })
      .catch((err: unknown) => {
        this.deps.log.warn({ err }, 'startMatch failed');
        return null;
      });
    this.schedule('intro');
    this.changed();
  }

  /** Called when a phase timer fires (or everyone acted early). */
  private advance(): void {
    this.timer = null;
    const now = this.deps.clock();
    switch (this.room.phase) {
      case 'intro':
      case 'scoreboard':
        void this.beginRound();
        return;
      case 'vote':
        this.finishVote();
        return;
      case 'vote_result':
        this.startQuestion();
        return;
      case 'question_read':
        this.room.openAnswers(now);
        this.schedule('questionOpen');
        this.changed();
        return;
      case 'question_open':
        this.finishQuestion();
        return;
      case 'reveal':
        if (this.room.round >= this.room.totalRounds) this.finishGame();
        else {
          this.room.enterScoreboard();
          this.schedule('scoreboard');
          this.changed();
        }
        return;
      case 'lobby':
      case 'final':
        return;
    }
  }

  private async beginRound(): Promise<void> {
    const epoch = ++this.epoch;
    this.room.phaseEndsAt = null;
    let options: VoteOption[] = [];
    try {
      options = await this.prepareOptions();
    } catch (err) {
      this.deps.log.warn({ err }, 'preparing a round failed');
    }
    if (epoch !== this.epoch) return;
    if (options.length === 0) {
      // Out of questions (or the DB is down): end the show gracefully.
      this.finishGame();
      return;
    }
    this.room.enterVote(options);
    this.schedule('vote');
    this.changed();
  }

  private async prepareOptions(): Promise<VoteOption[]> {
    const { store } = this.deps;
    const { room } = this;
    const difficulty = difficultyForRound(room.round + 1, room.totalRounds);
    const exclude = room.lastCategoryId === null ? [] : [room.lastCategoryId];
    const categories = await store.pickCategories(room.householdId, VOTE_OPTIONS, exclude);
    const asked = [...room.askedQuestionIds];
    const options = await Promise.all(
      categories.map(async (category) => {
        const q = await store.pickQuestion(room.householdId, category.id, difficulty, asked);
        return q ? { category, question: shuffleChoices(q, this.deps.rng) } : null;
      }),
    );
    return options.filter((o): o is VoteOption => o !== null);
  }

  private finishVote(): void {
    this.room.enterVoteResult(this.room.resolveVote());
    this.schedule('voteResult');
    this.changed();
  }

  private startQuestion(): void {
    const { question } = this.room.voteOptions[this.room.chosenOption]!;
    this.room.enterQuestionRead(question);
    this.deps.store
      .markSeen(this.room.householdId, question.id)
      .catch((err: unknown) => this.deps.log.warn({ err }, 'markSeen failed'));
    this.schedule('questionRead');
    this.changed();
  }

  private finishQuestion(): void {
    const { room } = this;
    room.enterReveal(this.duration('questionOpen'));
    const question = room.question!;
    const round = room.round;
    const answers = room.picks.map((p) => ({
      seat: room.players.get(p.playerId)!.seat,
      choice: p.choice,
      correct: p.correct,
      responseMs: p.responseMs,
      points: p.points,
    }));
    void this.matchId
      .then(async (matchId) => {
        if (matchId) await this.deps.store.recordRound({ matchId, round, questionId: question.id, answers });
      })
      .catch((err: unknown) => this.deps.log.warn({ err }, 'recordRound failed'));
    this.schedule('reveal');
    this.changed();
  }

  private finishGame(): void {
    this.stopTimer();
    this.room.enterFinal();
    this.room.phaseEndsAt = null;
    const results = this.room.standings.map((s) => ({
      seat: this.room.players.get(s.playerId)!.seat,
      finalScore: s.score,
      rank: s.rank,
    }));
    void this.matchId
      .then(async (matchId) => {
        if (matchId) await this.deps.store.finishMatch(matchId, results);
      })
      .catch((err: unknown) => this.deps.log.warn({ err }, 'finishMatch failed'));
    this.changed();
  }

  // -------------------------------------------------------------------------

  private afterAction(): void {
    if (!this.room.paused && this.room.allActed()) this.advanceNow();
    else this.changed();
  }

  private advanceNow(): void {
    this.stopTimer();
    this.advance();
  }

  private duration(key: TimingKey): number {
    return Math.round(TIMINGS[key] * this.deps.timingScale);
  }

  private schedule(key: TimingKey): void {
    this.scheduleMs(this.duration(key));
  }

  private scheduleMs(ms: number): void {
    this.stopTimer();
    if (this.room.paused) {
      this.room.phaseEndsAt = null;
      this.pausedRemaining = ms;
      return;
    }
    this.room.phaseEndsAt = this.deps.clock() + ms;
    this.timer = setTimeout(() => this.advance(), ms);
  }

  private stopTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private changed(): void {
    this.deps.onChange(this.room);
  }
}
