import {
  bluffRevealMs,
  difficultyForRound,
  ladderDifficulty,
  ottoLineOffsetMs,
  questionKindFor,
  QUESTION_VOICE_DELAY_MS,
  SPEECH_TAIL_MS,
  TIMINGS,
  VOTE_OPTIONS,
  type ErrorCode,
  type FlagReason,
  type GameMode,
  type Lifeline,
  type PowerPlay,
  type TimingKey,
} from '@trivia/shared';
import type { Clock } from '../clock.ts';
import { buildOffers, packKinds, type KindCounts, type PackDef } from '../content/packs.ts';
import { shuffleChoices, type Rng } from '../content/select.ts';
import type { Question } from '../content/types.ts';
import type { Store } from '../db/store.ts';
import { questionVoiceId } from '../content/normalize.ts';
import type { SpeechLengths } from '../game/speech.ts';
import type { Room, VoteOption } from './Room.ts';

type Result = { ok: true } | { ok: false; error: ErrorCode };

export interface RunnerDeps {
  store: Store;
  clock: Clock;
  rng: Rng;
  /** Question packs the lobby can offer. */
  packs: PackDef[];
  /** A pack is offered only with at least this many questions. */
  minPackQuestions: number;
  /** Multiplies every phase length (tests and E2E run faster). */
  timingScale: number;
  /** How long Otto talks: a phase never ends while he is still speaking. */
  speech: SpeechLengths;
  onChange: (room: Room) => void;
  log: { warn: (obj: object, msg: string) => void };
}

/**
 * Drives one Room through the game: owns its single phase timer, talks to the
 * store at phase boundaries, and ends phases early when everyone has acted,
 * but never while Otto is still talking. All store writes are fire-and-forget;
 * a database hiccup never stalls a game.
 */
export class RoomRunner {
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped on every flow change so late async results are discarded. */
  private epoch = 0;
  private pausedAt: number | null = null;
  private pausedRemaining: number | null = null;
  private matchId: Promise<string | null> = Promise.resolve(null);
  /** Bumped on every pack-offer load so only the latest result lands. */
  private offersLoad = 0;
  /** Server time Otto finishes the current phase's line (plus a breath); 0 when he's quiet. */
  private speechUntil = 0;

  constructor(
    readonly room: Room,
    private readonly deps: RunnerDeps,
  ) {
    this.loadOffers();
  }

  // -------------------------------------------------------------------------
  // Commands (from sockets)

  pickMode(byId: string, mode: GameMode): Result {
    if (this.room.packOffers === null) this.loadOffers();
    const res = this.room.pickMode(byId, mode);
    if (res.ok) this.changed();
    return res;
  }

  votePack(playerId: string, slug: string): Result {
    if (this.room.packOffers === null) this.loadOffers();
    const res = this.room.votePack(playerId, slug);
    if (res.ok) this.changed();
    return res;
  }

  lockPack(byId: string): Result {
    if (this.room.packOffers === null) this.loadOffers();
    const res = this.room.lockPack(byId);
    if (res.ok) this.changed();
    return res;
  }

  setCategory(byId: string, categoryId: number, enabled: boolean): Result {
    const res = this.room.setCategory(byId, categoryId, enabled);
    if (res.ok) this.changed();
    return res;
  }

  backToPacks(byId: string): Result {
    const res = this.room.backToPacks(byId);
    if (res.ok) this.changed();
    return res;
  }

  backToModes(byId: string): Result {
    const res = this.room.backToModes(byId);
    if (res.ok) this.changed();
    return res;
  }

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
    this.loadOffers();
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

  writeLie(playerId: string, questionId: string, lie: string): Result {
    const res = this.room.submitLie(playerId, questionId, lie);
    if (res.ok) this.afterAction();
    return res;
  }

  pickBluff(playerId: string, questionId: string, option: number): Result {
    const res = this.room.pickBluff(playerId, questionId, option, this.deps.clock());
    if (res.ok) this.afterAction();
    return res;
  }

  submitOrder(playerId: string, questionId: string, order: number[]): Result {
    const res = this.room.submitOrder(playerId, questionId, order, this.deps.clock());
    if (res.ok) this.afterAction();
    return res;
  }

  submitGuess(playerId: string, questionId: string, value: number): Result {
    const res = this.room.submitGuess(playerId, questionId, value, this.deps.clock());
    if (res.ok) this.afterAction();
    return res;
  }

  placeBets(playerId: string, questionId: string, chips: number[]): Result {
    const res = this.room.placeBets(playerId, questionId, chips);
    if (res.ok) this.afterAction();
    return res;
  }

  /** Milliomos-létra: stop before the next rung, or keep climbing. */
  walk(playerId: string, walk: boolean): Result {
    const res = this.room.decideWalk(playerId, walk);
    if (res.ok) this.afterAction();
    return res;
  }

  choosePower(playerId: string, power: PowerPlay, targetId: string): Result {
    const res = this.room.choosePower(playerId, power, targetId);
    if (res.ok) this.afterAction();
    return res;
  }

  lifeline(playerId: string, kind: Lifeline, friendId?: string): Result {
    const res = this.room.useLifeline(playerId, kind, friendId);
    if (res.ok) this.changed();
    return res;
  }

  passPower(playerId: string): Result {
    const res = this.room.passPower(playerId);
    if (res.ok) this.afterAction();
    return res;
  }

  /** Clearing an obstacle only unlocks the buttons; it never ends the question. */
  clearPower(playerId: string, power: PowerPlay): Result {
    const res = this.room.clearPower(playerId, power);
    if (res.ok) this.changed();
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
      if (this.pausedAt !== null) {
        this.room.shiftAnswerClock(now - this.pausedAt);
        if (this.speechUntil > this.pausedAt) this.speechUntil += now - this.pausedAt;
      }
      const remaining = this.pausedRemaining;
      this.pausedAt = null;
      this.pausedRemaining = null;
      if (remaining !== null) this.scheduleMs(remaining);
      if (this.room.allActed()) this.advanceWhenQuiet();
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
      .startMatch({ householdId: this.room.householdId, roomCode: this.room.code, players, settings: this.room.settings() })
      .catch((err: unknown) => {
        this.deps.log.warn({ err }, 'startMatch failed');
        return null;
      });
    this.schedule('intro');
    this.changed();
  }

  /**
   * Called when a phase timer fires (or everyone acted early). Every mode but
   * the ladder shares the round loop (vote → question → … → reveal →
   * scoreboard); what happens between the question and the reveal is the mode's.
   */
  private advance(): void {
    this.timer = null;
    if (this.room.ladder) {
      this.advanceLadder();
      return;
    }
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
      case 'reveal':
        if (this.room.round >= this.room.totalRounds) this.finishGame();
        else {
          this.room.enterScoreboard();
          this.schedule('scoreboard');
          this.changed();
        }
        return;
      case 'lobby':
      case 'ladder_step':
      case 'final':
        return;
      default:
        this.advanceQuestion();
    }
  }

  /** From the read-out question to the reveal: each mode's own phases. */
  private advanceQuestion(): void {
    switch (this.room.mode) {
      case 'classic':
      case 'ladder':
        this.advanceClassic();
        return;
      case 'bluff':
        this.advanceBluff();
        return;
      case 'timeline':
        this.advanceTimeline();
        return;
      case 'guess':
        this.advanceGuess();
        return;
    }
  }

  /** Blöffölő: write a lie → pick the truth → the options unmasked one by one. */
  private advanceBluff(): void {
    const { room } = this;
    const now = this.deps.clock();
    switch (room.phase) {
      case 'question_read':
        room.enterBluffWrite(now);
        this.schedule('bluffWrite');
        break;
      case 'bluff_write':
        room.enterBluffPick(now);
        this.schedule('bluffPick');
        break;
      case 'bluff_pick':
        room.enterBluffReveal();
        this.recordRound();
        this.scheduleDuration(bluffRevealMs(room.bluff!.options().length));
        break;
      default:
        return;
    }
    this.changed();
  }

  /** Időrend: put the items in order → the reveal. */
  private advanceTimeline(): void {
    const { room } = this;
    switch (room.phase) {
      case 'question_read':
        room.enterOrderOpen(this.deps.clock());
        this.schedule('orderOpen');
        break;
      case 'order_open':
        room.enterTimelineReveal(this.duration('orderOpen'));
        this.recordRound();
        this.schedule('reveal');
        break;
      default:
        return;
    }
    this.changed();
  }

  /** Tippelj!: guess → bet on the closest (skipped with fewer than two guesses) → the reveal. */
  private advanceGuess(): void {
    const { room } = this;
    switch (room.phase) {
      case 'question_read':
        room.enterGuessOpen(this.deps.clock());
        this.schedule('guessOpen');
        break;
      case 'guess_open':
        if (room.guess!.guessed().length >= 2) {
          room.enterGuessBet(this.deps.clock());
          this.schedule('guessBet');
          break;
        }
        room.enterGuessReveal();
        this.recordRound();
        this.schedule('reveal');
        break;
      case 'guess_bet':
        room.enterGuessReveal();
        this.recordRound();
        this.schedule('reveal');
        break;
      default:
        return;
    }
    this.changed();
  }

  /** The quiz: the answers open once the question is read, then the reveal. */
  private advanceClassic(): void {
    switch (this.room.phase) {
      case 'question_read':
        this.room.openAnswers(this.deps.clock());
        this.schedule('questionOpen');
        this.changed();
        return;
      case 'question_open':
        this.finishQuestion();
        return;
      default:
        return;
    }
  }

  /**
   * Milliomos-létra: step (walk away?) → read → answer → reveal, one rung at a
   * time, until nobody is left climbing or the questions run out.
   */
  private advanceLadder(): void {
    const { room } = this;
    const ladder = room.ladder!;
    switch (room.phase) {
      case 'intro':
      case 'reveal':
        if (ladder.isOver()) this.finishGame();
        else void this.beginRung();
        return;
      case 'ladder_step':
        room.finishLadderStep();
        if (ladder.isOver()) this.finishGame();
        else this.startQuestion();
        return;
      case 'question_read':
        room.openAnswers(this.deps.clock());
        this.schedule('ladderOpen');
        this.changed();
        return;
      case 'question_open':
        room.enterLadderReveal();
        this.recordRound();
        this.schedule('reveal');
        this.changed();
        return;
      default:
        return;
    }
  }

  private async beginRung(): Promise<void> {
    const epoch = ++this.epoch;
    this.room.phaseEndsAt = null;
    let option: VoteOption | null = null;
    try {
      option = await this.prepareRung();
    } catch (err) {
      this.deps.log.warn({ err }, 'preparing a rung failed');
    }
    if (epoch !== this.epoch) return;
    if (!option) {
      // Out of questions (or the DB is down): everyone keeps what they hold.
      this.finishGame();
      return;
    }
    this.room.enterLadderStep(option);
    this.schedule('ladderStep');
    this.changed();
  }

  /** The next rung's question: a fresh category from the pack, as hard as the rung. */
  private async prepareRung(): Promise<VoteOption | null> {
    const { store } = this.deps;
    const { room } = this;
    const difficulty = ladderDifficulty(room.ladder!.rung + 1);
    const exclude = room.lastCategoryId === null ? [] : [room.lastCategoryId];
    const [category] = await store.pickCategories(room.householdId, 1, exclude, 'mc', [...room.enabledCategories]);
    if (!category) return null;
    const q = await store.pickQuestion(room.householdId, category.id, difficulty, [...room.askedQuestionIds], 'mc');
    return q ? { category, question: this.shuffled(q) } : null;
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
    // One category left in the pack: nothing to vote on, go straight to it.
    if (options.length === 1 && !this.room.powerVote()) {
      this.finishVote();
      return;
    }
    this.schedule(this.room.powerVote() ? 'votePower' : 'vote');
    this.changed();
  }

  private async prepareOptions(): Promise<VoteOption[]> {
    const { store } = this.deps;
    const { room } = this;
    const difficulty = difficultyForRound(room.round + 1, room.totalRounds);
    const exclude = room.lastCategoryId === null ? [] : [room.lastCategoryId];
    const kind = questionKindFor(room.mode);
    const categories = await store.pickCategories(room.householdId, VOTE_OPTIONS, exclude, kind, [...room.enabledCategories]);
    const asked = [...room.askedQuestionIds];
    const options = await Promise.all(
      categories.map(async (category) => {
        const q = await store.pickQuestion(room.householdId, category.id, difficulty, asked, kind);
        return q ? { category, question: this.shuffled(q) } : null;
      }),
    );
    return options.filter((o): o is VoteOption => o !== null);
  }

  /** Multiple-choice answers in a fresh order, so position carries no information; other kinds as they are. */
  private shuffled(q: Question): Question {
    return q.kind === 'mc' ? shuffleChoices(q, this.deps.rng) : q;
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
    this.room.enterReveal(this.duration('questionOpen'));
    this.recordRound();
    this.schedule('reveal');
    this.changed();
  }

  /** Saves the revealed round's answers with the match (fire-and-forget). */
  private recordRound(): void {
    const { room } = this;
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

  /** Sizes the packs from the current question counts (of each kind the packs play); a stale or late result is dropped. */
  private loadOffers(): void {
    const load = ++this.offersLoad;
    const kinds = packKinds(this.deps.packs);
    Promise.all(kinds.map((kind) => this.deps.store.countQuestions(kind)))
      .then((lists) => {
        if (load !== this.offersLoad || this.room.phase !== 'lobby') return;
        const counts: KindCounts = Object.fromEntries(kinds.map((kind, i) => [kind, lists[i]]));
        this.room.setPackOffers(buildOffers(this.deps.packs, counts, this.deps.minPackQuestions));
        this.changed();
      })
      .catch((err: unknown) => this.deps.log.warn({ err }, 'countQuestions failed'));
  }

  private afterAction(): void {
    if (!this.room.paused && this.room.allActed()) this.advanceWhenQuiet();
    else this.changed();
  }

  /** Everyone has acted: move on now, or as soon as Otto has finished his line. */
  private advanceWhenQuiet(): void {
    const left = this.speechUntil - this.deps.clock();
    if (left <= 0) return this.advanceNow();
    this.scheduleMs(left);
    this.changed();
  }

  /**
   * Notes how long Otto talks in the phase just entered: his line (at its
   * offset into the phase) or, while the question is read, its read-aloud.
   */
  private noteSpeech(): void {
    const { room, deps } = this;
    let ms = 0;
    if (room.phase === 'question_read' && room.question) {
      const read = deps.speech.question(questionVoiceId(room.question.prompt));
      if (read > 0) ms = QUESTION_VOICE_DELAY_MS + read;
    } else if (room.otto) {
      ms = ottoLineOffsetMs(room.phase) + deps.speech.line(room.otto);
    }
    this.speechUntil = ms > 0 ? deps.clock() + Math.round((ms + SPEECH_TAIL_MS) * deps.timingScale) : 0;
  }

  private advanceNow(): void {
    this.stopTimer();
    this.advance();
  }

  private duration(key: TimingKey): number {
    return Math.round(TIMINGS[key] * this.deps.timingScale);
  }

  /** Schedules the end of the phase just entered: its usual length, or longer if Otto needs it. */
  private schedule(key: TimingKey): void {
    this.scheduleDuration(TIMINGS[key]);
  }

  /** Like schedule(), for a phase whose length (at full speed) depends on the round. */
  private scheduleDuration(ms: number): void {
    this.noteSpeech();
    this.scheduleMs(Math.max(Math.round(ms * this.deps.timingScale), this.speechUntil - this.deps.clock()));
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
