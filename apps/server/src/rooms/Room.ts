import { timingSafeEqual } from 'node:crypto';
import {
  AVATAR_COLORS,
  AVATAR_FACES,
  MAX_LATENCY_CREDIT_MS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  normalizeName,
  ottoVariants,
  scoreAnswer,
  TOTAL_ROUNDS,
  type Avatar,
  type ErrorCode,
  type OttoLine,
  type OttoLineKey,
  type Phase,
  type Pick,
  type Standing,
} from '@trivia/shared';
import type { Category, Question } from '../content/types.ts';
import type { Rng } from '../content/select.ts';
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
  readonly votes = new Map<string, number>();
  question: Question | null = null;
  answersOpenedAt: number | null = null;
  readonly answers = new Map<string, Answer>();
  picks: Pick[] = [];
  standings: Standing[] = [];
  otto: OttoLine | null = null;

  /** Questions asked this game, so none repeats and flags can be checked. */
  readonly askedQuestionIds = new Set<string>();
  lastCategoryId: number | null = null;
  /** `${playerId}:${questionId}` for flags already sent. */
  readonly flags = new Set<string>();

  constructor(
    readonly code: string,
    readonly householdId: string,
    readonly createdAt: number,
    private readonly rng: Rng = Math.random,
    totalRounds = TOTAL_ROUNDS,
  ) {
    this.totalRounds = totalRounds;
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
    this.phase = 'intro';
    this.say('welcome', { n: String(this.players.size) });
  }

  enterVote(options: VoteOption[]): void {
    this.round += 1;
    this.voteOptions = options;
    this.votes.clear();
    this.question = null;
    this.answers.clear();
    this.phase = 'vote';
    this.say('pickCategory');
  }

  castVote(playerId: string, option: number): Result {
    if (this.phase !== 'vote') return { ok: false, error: 'NOT_ALLOWED' };
    if (!this.players.has(playerId)) return { ok: false, error: 'NOT_FOUND' };
    if (option < 0 || option >= this.voteOptions.length) return { ok: false, error: 'BAD_REQUEST' };
    this.votes.set(playerId, option);
    return { ok: true };
  }

  /** Most votes wins; ties and no-votes are settled randomly. */
  resolveVote(): VoteOption {
    const tally = this.voteOptions.map(() => 0);
    for (const v of this.votes.values()) tally[v]! += 1;
    const best = Math.max(...tally);
    const leaders = tally.flatMap((n, i) => (n === best ? [i] : []));
    return this.voteOptions[leaders[Math.floor(this.rng() * leaders.length)]!]!;
  }

  enterQuestionRead(question: Question): void {
    this.question = question;
    this.askedQuestionIds.add(question.id);
    this.lastCategoryId = question.categoryId;
    this.answers.clear();
    this.answersOpenedAt = null;
    this.phase = 'question_read';
    this.say('question', { category: question.category });
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
      const points = a ? scoreAnswer(correct, a.responseMs, openMs) : 0;
      p.score += points;
      return { playerId: p.id, choice: a?.choice ?? null, correct, points, responseMs: a?.responseMs ?? null };
    });
    this.standings = this.rankedStandings(prevRanks);
    this.phase = 'reveal';

    const right = this.picks.filter((p) => p.correct);
    if (right.length === 0) this.say('noneCorrect');
    else if (right.length === this.picks.length) this.say('allCorrect');
    else {
      const fastest = right.reduce((a, b) => ((a.responseMs ?? 0) <= (b.responseMs ?? 0) ? a : b));
      this.say(this.rng() < 0.6 ? 'fastest' : 'someCorrect', { name: this.nameOf(fastest.playerId) });
    }
  }

  enterScoreboard(): void {
    this.phase = 'scoreboard';
    const leaders = this.standings.filter((s) => s.rank === 1);
    const leader = leaders.length === 1 ? leaders[0]! : null;
    if (leader && leader.prevRank !== 1 && this.round > 1) this.say('newLeader', { name: this.nameOf(leader.playerId) });
    else if (leader) this.say('standings', { name: this.nameOf(leader.playerId) });
    else this.say('standings', { name: leaders.map((s) => this.nameOf(s.playerId)).join(' és ') });
  }

  enterFinal(): void {
    this.phase = 'final';
    this.standings = this.rankedStandings(new Map(this.standings.map((s) => [s.playerId, s.rank])));
    const winners = this.standings.filter((s) => s.rank === 1).map((s) => this.nameOf(s.playerId));
    if (winners.length === 1) this.say('winner', { name: winners[0]! });
    else if (winners.length > 1) this.say('tie', { name: winners.join(' és ') });
  }

  enterLobby(): void {
    for (const p of this.players.values()) p.score = 0;
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
    if (this.phase === 'vote') return connected.every((p) => this.votes.has(p.id));
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

  private say(key: OttoLineKey, vars: Record<string, string> = {}): void {
    this.otto = { key, variant: Math.floor(this.rng() * ottoVariants(key)), vars };
  }

  private nameOf(playerId: string): string {
    return this.players.get(playerId)?.name ?? '';
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
