import { timingSafeEqual } from 'node:crypto';
import {
  AVATAR_COLORS,
  AVATAR_FACES,
  grantsPowerPlay,
  MAX_LATENCY_CREDIT_MS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  normalizeName,
  pointsMultiplier,
  scoreAnswer,
  TOTAL_ROUNDS,
  type Avatar,
  type ErrorCode,
  type OttoLine,
  type Phase,
  type Pick,
  type PowerHit,
  type PowerPlay,
  type PowerState,
  type Standing,
} from '@trivia/shared';
import type { Category, Question } from '../content/types.ts';
import type { Rng } from '../content/select.ts';
import {
  categoryLine,
  finalLine,
  LinePicker,
  powerLine,
  revealLine,
  scoreboardLine,
  voteLine,
  welcomeLine,
} from '../game/otto.ts';
import { randomId, randomToken } from './ids.ts';

export interface Player {
  id: string;
  /** Stable 0-based seat number, used in match history. */
  seat: number;
  sessionToken: string;
  name: string;
  avatar: Avatar;
  score: number;
  connected: boolean;
  /** When the player's last socket dropped; null while connected. */
  disconnectedAt: number | null;
  /** Smoothed one-way latency estimate, measured by the server. */
  latencyMs: number;
}

export interface VoteOption {
  category: Category;
  /** Pre-fetched so the round starts instantly when voting ends. */
  question: Question;
}

export interface Answer {
  choice: number;
  responseMs: number;
}

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: ErrorCode };

/**
 * One game room: all live state and every rule, with time passed in. It knows
 * nothing about sockets, timers or the database (see RoomRunner), which keeps
 * it deterministic and easy to test.
 */
export class Room {
  readonly hostToken = randomToken();
  phase: Phase = 'lobby';
  /** Join order is preserved; the first player is VIP by default. */
  readonly players = new Map<string, Player>();
  vipId: string | null = null;
  hostConnected = false;
  hostDisconnectedAt: number | null = null;

  round = 0;
  readonly totalRounds: number;
  phaseEndsAt: number | null = null;
  paused = false;

  voteOptions: VoteOption[] = [];
  chosenOption = 0;
  readonly votes = new Map<string, number>();
  question: Question | null = null;
  answersOpenedAt: number | null = null;
  readonly answers = new Map<string, Answer>();
  picks: Pick[] = [];
  standings: Standing[] = [];
  otto: OttoLine | null = null;
  /** Deals Otto's line variants so none repeats before all were said. */
  private readonly lines: LinePicker;
  /** Consecutive correct answers per player, for Otto's commentary. */
  readonly streaks = new Map<string, number>();
  /** Rounds in a row that nobody answered correctly. */
  noneCorrectRun = 0;

  /** Questions asked this game, so none repeats and flags can be checked. */
  readonly askedQuestionIds = new Set<string>();
  lastCategoryId: number | null = null;
  /** `${playerId}:${questionId}` for flags already sent. */
  readonly flags = new Set<string>();

  /** Players holding an unused power play. */
  readonly powers = new Set<string>();
  /** Holders who chose to keep theirs this vote. */
  readonly powerPasses = new Set<string>();
  /** Power plays thrown this round. */
  hits: PowerHit[] = [];

  constructor(
    readonly code: string,
    readonly householdId: string,
    readonly createdAt: number,
    private readonly rng: Rng = Math.random,
    totalRounds = TOTAL_ROUNDS,
  ) {
    this.totalRounds = totalRounds;
    this.lines = new LinePicker(rng);
  }

  // -------------------------------------------------------------------------
  // Lobby

  join(rawName: string): Result<{ player: Player }> {
    if (this.phase !== 'lobby') return { ok: false, error: 'IN_PROGRESS' };
    if (this.players.size >= MAX_PLAYERS) return { ok: false, error: 'ROOM_FULL' };
    const name = normalizeName(rawName);
    if (!name) return { ok: false, error: 'BAD_REQUEST' };
    const key = name.toLocaleLowerCase('hu');
    for (const p of this.players.values()) {
      if (p.name.toLocaleLowerCase('hu') === key) return { ok: false, error: 'NAME_TAKEN' };
    }

    const player: Player = {
      id: randomId(),
      seat: this.freeSeat(),
      sessionToken: randomToken(),
      name,
      avatar: this.pickAvatar(),
      score: 0,
      connected: true,
      disconnectedAt: null,
      latencyMs: 0,
    };
    this.players.set(player.id, player);
    if (!this.vipId) this.vipId = player.id;
    return { ok: true, player };
  }

  setAvatar(playerId: string, avatar: Avatar): Result {
    const player = this.players.get(playerId);
    if (!player) return { ok: false, error: 'NOT_FOUND' };
    if (this.phase !== 'lobby') return { ok: false, error: 'IN_PROGRESS' };
    for (const p of this.players.values()) {
      if (p.id !== playerId && p.avatar.color === avatar.color) return { ok: false, error: 'COLOR_TAKEN' };
    }
    player.avatar = avatar;
    return { ok: true };
  }

  kick(byId: string, targetId: string): Result {
    if (byId !== this.vipId || byId === targetId) return { ok: false, error: 'NOT_ALLOWED' };
    if (this.phase !== 'lobby') return { ok: false, error: 'IN_PROGRESS' };
    if (!this.players.delete(targetId)) return { ok: false, error: 'NOT_FOUND' };
    return { ok: true };
  }

  /** Returns the player if the token matches, and marks them connected. */
  resumePlayer(playerId: string, sessionToken: string): Player | null {
    const player = this.players.get(playerId);
    if (!player || !safeEqual(player.sessionToken, sessionToken)) return null;
    player.connected = true;
    player.disconnectedAt = null;
    if (!this.vipId || !this.players.get(this.vipId)?.connected) this.vipId = player.id;
    return player;
  }

  playerDisconnected(playerId: string, now: number): boolean {
    const player = this.players.get(playerId);
    if (!player || !player.connected) return false;
    player.connected = false;
    player.disconnectedAt = now;
    if (this.vipId === playerId) this.handOffVip();
    return true;
  }

  /** Feeds a measured round trip into the player's smoothed latency. */
  recordLatency(playerId: string, rttMs: number): void {
    const player = this.players.get(playerId);
    if (!player) return;
    const oneWay = Math.min(MAX_LATENCY_CREDIT_MS, Math.max(0, rttMs / 2));
    player.latencyMs = player.latencyMs === 0 ? oneWay : 0.7 * player.latencyMs + 0.3 * oneWay;
  }

  checkHostToken(token: string): boolean {
    return safeEqual(this.hostToken, token);
  }

  hostConnectedNow(): void {
    this.hostConnected = true;
    this.hostDisconnectedAt = null;
  }

  hostDisconnectedNow(now: number): void {
    this.hostConnected = false;
    this.hostDisconnectedAt = now;
  }

  /** Drops lobby players who have been gone longer than the grace period. */
  removeStalePlayers(now: number, graceMs: number): boolean {
    if (this.phase !== 'lobby') return false;
    let changed = false;
    for (const [id, p] of this.players) {
      if (!p.connected && p.disconnectedAt !== null && now - p.disconnectedAt >= graceMs) {
        this.players.delete(id);
        changed = true;
      }
    }
    if (changed && (!this.vipId || !this.players.has(this.vipId))) this.handOffVip();
    return changed;
  }

  // -------------------------------------------------------------------------
  // Game flow. Each enter*() switches phase; the runner owns the timing.

  canStart(byId: string): Result {
    if (byId !== this.vipId) return { ok: false, error: 'NOT_ALLOWED' };
    if (this.phase !== 'lobby' && this.phase !== 'final') return { ok: false, error: 'IN_PROGRESS' };
    if (this.connectedPlayers().length < MIN_PLAYERS) return { ok: false, error: 'TOO_FEW_PLAYERS' };
    return { ok: true };
  }

  enterIntro(): void {
    for (const p of this.players.values()) p.score = 0;
    this.round = 0;
    this.askedQuestionIds.clear();
    this.flags.clear();
    this.lastCategoryId = null;
    this.standings = [];
    this.picks = [];
    this.question = null;
    this.streaks.clear();
    this.noneCorrectRun = 0;
    this.powers.clear();
    this.powerPasses.clear();
    this.hits = [];
    this.phase = 'intro';
    this.otto = welcomeLine(this.players.size, this.lines);
  }

  enterVote(options: VoteOption[]): void {
    this.round += 1;
    this.voteOptions = options;
    this.votes.clear();
    this.question = null;
    this.answers.clear();
    this.hits = [];
    this.powerPasses.clear();
    // Power plays need someone to throw them at: none in a solo game.
    const granted = grantsPowerPlay(this.round) && this.players.size > 1;
    if (granted) for (const id of this.players.keys()) this.powers.add(id);
    this.phase = 'vote';
    this.otto = voteLine(this.round, this.totalRounds, this.lines, granted);
  }

  /** True while the vote should wait for someone to decide on their power play. */
  powerVote(): boolean {
    return this.connectedPlayers().some((p) => this.powerPending(p.id));
  }

  /** Throws `playerId`'s power play at `targetId`. Only in the vote, once per round. */
  choosePower(playerId: string, power: PowerPlay, targetId: string): Result {
    if (this.phase !== 'vote') return { ok: false, error: 'NOT_ALLOWED' };
    if (!this.players.has(playerId)) return { ok: false, error: 'NOT_FOUND' };
    if (!this.powers.has(playerId)) return { ok: false, error: 'NOT_ALLOWED' };
    if (targetId === playerId) return { ok: false, error: 'NOT_ALLOWED' };
    const target = this.players.get(targetId);
    if (!target) return { ok: false, error: 'NOT_FOUND' };
    if (!target.connected) return { ok: false, error: 'NOT_ALLOWED' };
    this.powers.delete(playerId);
    this.powerPasses.delete(playerId);
    this.hits.push({ by: playerId, target: targetId, power, cleared: false });
    return { ok: true };
  }

  /** Keeps the power play for a later round. */
  passPower(playerId: string): Result {
    if (this.phase !== 'vote') return { ok: false, error: 'NOT_ALLOWED' };
    if (!this.powers.has(playerId)) return { ok: false, error: 'NOT_ALLOWED' };
    this.powerPasses.add(playerId);
    return { ok: true };
  }

  /** The target broke the ice or wiped the slime off (every hit of that kind on them). */
  clearPower(playerId: string, power: PowerPlay): Result {
    if (this.phase !== 'question_open') return { ok: false, error: 'NOT_ALLOWED' };
    const mine = this.hits.filter((h) => h.target === playerId && h.power === power && !h.cleared);
    if (mine.length === 0) return { ok: false, error: 'NOT_FOUND' };
    for (const h of mine) h.cleared = true;
    return { ok: true };
  }

  /** Whether an obstacle still covers this player's answer buttons. */
  blocked(playerId: string): boolean {
    return this.hits.some((h) => h.target === playerId && !h.cleared);
  }

  powerState(playerId: string): PowerState {
    if (this.hits.some((h) => h.by === playerId)) return 'used';
    if (!this.powers.has(playerId)) return 'none';
    if (this.phase !== 'vote') return 'held';
    if (this.powerPasses.has(playerId)) return 'passed';
    return this.hasTarget(playerId) ? 'ready' : 'held';
  }

  /** Holds a power play, hasn't decided on it this vote, and has someone to aim at. */
  private powerPending(playerId: string): boolean {
    return this.powers.has(playerId) && !this.powerPasses.has(playerId) && this.hasTarget(playerId);
  }

  private hasTarget(playerId: string): boolean {
    return this.connectedPlayers().some((p) => p.id !== playerId);
  }

  castVote(playerId: string, option: number): Result {
    if (this.phase !== 'vote') return { ok: false, error: 'NOT_ALLOWED' };
    if (!this.players.has(playerId)) return { ok: false, error: 'NOT_FOUND' };
    if (option < 0 || option >= this.voteOptions.length) return { ok: false, error: 'BAD_REQUEST' };
    this.votes.set(playerId, option);
    return { ok: true };
  }

  /** Most votes wins; ties and no-votes are settled randomly. Returns the option's index. */
  resolveVote(): number {
    const tally = this.voteOptions.map(() => 0);
    for (const v of this.votes.values()) tally[v]! += 1;
    const best = Math.max(...tally);
    const leaders = tally.flatMap((n, i) => (n === best ? [i] : []));
    return leaders[Math.floor(this.rng() * leaders.length)]!;
  }

  /** Shows the decided category for a moment (the TV spins to it). */
  enterVoteResult(chosen: number): void {
    this.chosenOption = chosen;
    this.phase = 'vote_result';
    // Thrown power plays upstage the category: Otto comments on the carnage.
    this.otto =
      this.hits.length > 0
        ? powerLine(this.hits, this.lines)
        : categoryLine(this.voteOptions[chosen]!.category.slug, this.lines);
  }

  enterQuestionRead(question: Question): void {
    this.question = question;
    this.askedQuestionIds.add(question.id);
    this.lastCategoryId = question.categoryId;
    this.answers.clear();
    this.answersOpenedAt = null;
    this.phase = 'question_read';
    // The TV reads the question out; Otto's bubble makes way for it.
    this.otto = null;
  }

  openAnswers(now: number): void {
    this.phase = 'question_open';
    this.answersOpenedAt = now;
  }

  /** Answer time is measured here, on the server, minus the phone's latency. */
  submitAnswer(playerId: string, questionId: string, choice: number, now: number): Result {
    const player = this.players.get(playerId);
    if (!player) return { ok: false, error: 'NOT_FOUND' };
    if (this.phase !== 'question_open' || !this.question || this.question.id !== questionId) {
      return { ok: false, error: 'NOT_ALLOWED' };
    }
    if (this.answers.has(playerId)) return { ok: false, error: 'NOT_ALLOWED' }; // no changing
    if (this.blocked(playerId)) return { ok: false, error: 'NOT_ALLOWED' }; // clear the obstacle first
    if (choice < 0 || choice >= this.question.choices.length) return { ok: false, error: 'BAD_REQUEST' };
    const elapsed = now - (this.answersOpenedAt ?? now) - player.latencyMs;
    this.answers.set(playerId, { choice, responseMs: Math.max(0, Math.round(elapsed)) });
    return { ok: true };
  }

  /** Shifts the answer clock after a pause so frozen time doesn't count. */
  shiftAnswerClock(pausedMs: number): void {
    if (this.answersOpenedAt !== null) this.answersOpenedAt += pausedMs;
  }

  enterReveal(openMs: number): void {
    const q = this.question;
    if (!q) throw new Error('reveal without a question');
    const prevRanks = new Map(this.rankedStandings().map((s) => [s.playerId, s.rank]));

    this.picks = [...this.players.values()].map((p) => {
      const a = this.answers.get(p.id);
      const correct = a?.choice === q.correct;
      const points = a ? scoreAnswer(correct, a.responseMs, openMs) * pointsMultiplier(this.round, this.totalRounds) : 0;
      p.score += points;
      return { playerId: p.id, choice: a?.choice ?? null, correct, points, responseMs: a?.responseMs ?? null };
    });
    this.standings = this.rankedStandings(prevRanks);
    this.phase = 'reveal';

    for (const p of this.picks) this.streaks.set(p.playerId, p.correct ? (this.streaks.get(p.playerId) ?? 0) + 1 : 0);
    this.noneCorrectRun = this.picks.some((p) => p.correct) ? 0 : this.noneCorrectRun + 1;
    const facts = this.picks.map((p) => ({
      id: p.playerId,
      correct: p.correct,
      responseMs: p.responseMs,
      streak: this.streaks.get(p.playerId) ?? 0,
    }));
    this.otto = revealLine(facts, this.noneCorrectRun, this.lines);
  }

  enterScoreboard(): void {
    this.phase = 'scoreboard';
    this.otto = scoreboardLine(this.standingFacts(), this.round, this.lines);
  }

  enterFinal(): void {
    this.phase = 'final';
    this.standings = this.rankedStandings(new Map(this.standings.map((s) => [s.playerId, s.rank])));
    this.otto = finalLine(this.standingFacts(), this.lines);
  }

  enterLobby(): void {
    for (const p of this.players.values()) p.score = 0;
    this.powers.clear();
    this.hits = [];
    this.phase = 'lobby';
    this.round = 0;
    this.standings = [];
    this.picks = [];
    this.question = null;
    this.otto = null;
  }

  /** True when every connected player has voted/answered (phases end early). */
  allActed(): boolean {
    const connected = this.connectedPlayers();
    if (connected.length === 0) return false;
    if (this.phase === 'vote') return connected.every((p) => this.votes.has(p.id) && !this.powerPending(p.id));
    if (this.phase === 'question_open') return connected.every((p) => this.answers.has(p.id));
    return false;
  }

  /** Flags are allowed once per player for any question asked this game. */
  flag(playerId: string, questionId: string): Result<{ playerName: string }> {
    const player = this.players.get(playerId);
    if (!player) return { ok: false, error: 'NOT_FOUND' };
    if (!this.askedQuestionIds.has(questionId)) return { ok: false, error: 'NOT_FOUND' };
    if (this.phase === 'question_read' || this.phase === 'question_open') {
      if (this.question?.id === questionId) return { ok: false, error: 'NOT_ALLOWED' };
    }
    const key = `${playerId}:${questionId}`;
    if (this.flags.has(key)) return { ok: false, error: 'NOT_ALLOWED' };
    this.flags.add(key);
    return { ok: true, playerName: player.name };
  }

  hasFlagged(playerId: string, questionId: string): boolean {
    return this.flags.has(`${playerId}:${questionId}`);
  }

  connectedPlayers(): Player[] {
    return [...this.players.values()].filter((p) => p.connected);
  }

  // -------------------------------------------------------------------------

  private rankedStandings(prevRanks = new Map<string, number>()): Standing[] {
    const deltas = new Map(this.picks.map((p) => [p.playerId, p.points]));
    const sorted = [...this.players.values()].sort((a, b) => b.score - a.score || a.seat - b.seat);
    return sorted.map((p) => {
      const rank = 1 + sorted.filter((o) => o.score > p.score).length;
      return {
        playerId: p.id,
        score: p.score,
        delta: deltas.get(p.id) ?? 0,
        rank,
        prevRank: prevRanks.get(p.id) ?? rank,
      };
    });
  }

  private standingFacts() {
    return this.standings.map((s) => ({ id: s.playerId, score: s.score, rank: s.rank, prevRank: s.prevRank }));
  }

  private freeSeat(): number {
    const taken = new Set([...this.players.values()].map((p) => p.seat));
    let seat = 0;
    while (taken.has(seat)) seat++;
    return seat;
  }

  private handOffVip(): void {
    const next = [...this.players.values()].find((p) => p.connected);
    // With nobody connected, keep the seat's VIP (if it still exists) so a
    // lone reconnecting VIP gets their role back.
    if (next) this.vipId = next.id;
    else if (this.vipId && !this.players.has(this.vipId)) this.vipId = null;
  }

  private pickAvatar(): Avatar {
    const used = new Set([...this.players.values()].map((p) => p.avatar.color));
    const color = AVATAR_COLORS.find((c) => !used.has(c)) ?? AVATAR_COLORS[0];
    const face = AVATAR_FACES[this.players.size % AVATAR_FACES.length]!;
    return { color, face };
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
