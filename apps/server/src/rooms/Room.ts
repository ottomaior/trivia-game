import { timingSafeEqual } from 'node:crypto';
import {
  CHARACTERS,
  grantsPowerPlay,
  isInputPhase,
  MAX_LATENCY_CREDIT_MS,
  MAX_PLAYERS,
  MIN_GAME_QUESTIONS,
  MIN_PLAYERS,
  normalizeName,
  pointsMultiplier,
  roundsFor,
  scoreAnswer,
  scoreBluff,
  TOTAL_ROUNDS,
  type Avatar,
  type ErrorCode,
  type GameMode,
  type Lifeline,
  type OttoLine,
  type Phase,
  type Pick,
  type PowerHit,
  type PowerPlay,
  type PowerState,
  type RevealResult,
  type Standing,
} from '@trivia/shared';
import type { PackOffer } from '../content/packs.ts';
import type { Category, McQuestion, Question } from '../content/types.ts';
import type { Rng } from '../content/select.ts';
import {
  bluffRevealLine,
  finalLine,
  guessRevealLine,
  ladderRevealLine,
  ladderStepLine,
  line,
  LinePicker,
  powerLine,
  revealLine,
  scoreboardLine,
  SOLO_LADDER_HIGH,
  timelineRevealLine,
  voteLine,
  welcomeLine,
} from '../game/otto.ts';
import { randomId, randomToken } from './ids.ts';
import { BluffGame } from './Bluff.ts';
import { GuessGame } from './Guess.ts';
import { LadderGame } from './Ladder.ts';
import { TimelineGame } from './Timeline.ts';

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

  /** Lobby: players vote for a pack, then the VIP trims its categories. */
  lobbyStep: 'packs' | 'setup' = 'packs';
  /** Packs with enough questions to play; null while they load. */
  packOffers: PackOffer[] | null = null;
  /** Player id to pack slug. */
  readonly packVotes = new Map<string, string>();
  /** The locked pack; kept for "play again". */
  pack: PackOffer | null = null;
  readonly enabledCategories = new Set<number>();

  round = 0;
  phaseEndsAt: number | null = null;
  paused = false;

  voteOptions: VoteOption[] = [];
  chosenOption = 0;
  readonly votes = new Map<string, number>();
  question: Question | null = null;
  answersOpenedAt: number | null = null;
  readonly answers = new Map<string, Answer>();
  picks: Pick[] = [];
  /** The answer as this round's kind reveals it; set when the reveal starts. */
  revealResult: RevealResult | null = null;
  standings: Standing[] = [];
  otto: OttoLine | null = null;
  /** Deals Otto's line variants so none repeats before all were said. */
  private readonly lines: LinePicker;
  /** Consecutive correct answers per player, for Otto's commentary. */
  readonly streaks = new Map<string, number>();
  /** Rounds in a row that nobody answered correctly. */
  noneCorrectRun = 0;
  /** Last round Otto commented on (power plays, reveal or scoreboard): he doesn't chatter every round. */
  lastCommentRound = -1;
  /** Otto commented on this round already. */
  private spokeThisRound = false;
  private blowoutCalled = false;
  /** Power plays get explained the first time they are handed out in this room. */
  private powersExplained = false;

  /** Milliomos-létra state for this game; null in the classic game. */
  ladder: LadderGame | null = null;
  /** The party modes' round state; each is null unless its mode is being played. */
  bluff: BluffGame | null = null;
  timeline: TimelineGame | null = null;
  guess: GuessGame | null = null;

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
    /** Rounds of the classic game (tests shorten it); other modes have their own length. */
    private readonly classicRounds = TOTAL_ROUNDS,
  ) {
    this.lines = new LinePicker(rng);
  }

  /** Rounds in this game: ten in the classic, fifteen rungs on the ladder, eight in the party modes. */
  get totalRounds(): number {
    return roundsFor(this.mode, this.classicRounds);
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
      if (p.id !== playerId && p.avatar.character === avatar.character) return { ok: false, error: 'CHARACTER_TAKEN' };
    }
    player.avatar = avatar;
    return { ok: true };
  }

  kick(byId: string, targetId: string): Result {
    if (byId !== this.vipId || byId === targetId) return { ok: false, error: 'NOT_ALLOWED' };
    if (this.phase !== 'lobby') return { ok: false, error: 'IN_PROGRESS' };
    if (!this.players.delete(targetId)) return { ok: false, error: 'NOT_FOUND' };
    this.packVotes.delete(targetId);
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
  // Question packs

  setPackOffers(offers: PackOffer[] | null): void {
    this.packOffers = offers;
    const slugs = new Set(offers?.map((o) => o.slug));
    for (const [id, slug] of this.packVotes) if (!slugs.has(slug)) this.packVotes.delete(id);
  }

  /** Any player may vote, and change their vote, while the lobby is on the pack step. */
  votePack(playerId: string, slug: string): Result {
    if (!this.players.has(playerId)) return { ok: false, error: 'NOT_FOUND' };
    if (this.phase !== 'lobby' || this.lobbyStep !== 'packs') return { ok: false, error: 'NOT_ALLOWED' };
    if (!this.packOffers?.some((o) => o.slug === slug)) return { ok: false, error: 'BAD_REQUEST' };
    this.packVotes.set(playerId, slug);
    return { ok: true };
  }

  /** Votes of players still in the room, by pack slug. */
  currentPackVotes(): Map<string, string> {
    return new Map([...this.packVotes].filter(([id]) => this.players.has(id)));
  }

  /** The VIP closes the pack vote. Most votes wins, ties are random, and with no votes the first pack plays. */
  lockPack(byId: string): Result {
    if (byId !== this.vipId) return { ok: false, error: 'NOT_ALLOWED' };
    if (this.phase !== 'lobby') return { ok: false, error: 'IN_PROGRESS' };
    if (this.lobbyStep !== 'packs') return { ok: false, error: 'BAD_REQUEST' };
    if (this.connectedPlayers().length < MIN_PLAYERS) return { ok: false, error: 'TOO_FEW_PLAYERS' };
    const offers = this.packOffers;
    if (!offers?.length) return { ok: false, error: 'NO_QUESTIONS' };
    const votes = [...this.currentPackVotes().values()];
    const tally = offers.map((o) => votes.filter((slug) => slug === o.slug).length);
    const index = votes.length > 0 ? mostVoted(tally, this.rng) : 0;
    this.pack = offers[index]!;
    this.enabledCategories.clear();
    for (const c of this.pack.categories) this.enabledCategories.add(c.id);
    this.lobbyStep = 'setup';
    return { ok: true };
  }

  /** The VIP switches a category of the locked pack on or off. */
  setCategory(byId: string, categoryId: number, enabled: boolean): Result {
    if (byId !== this.vipId) return { ok: false, error: 'NOT_ALLOWED' };
    if (this.phase !== 'lobby') return { ok: false, error: 'IN_PROGRESS' };
    if (this.lobbyStep !== 'setup' || !this.pack) return { ok: false, error: 'BAD_REQUEST' };
    if (!this.pack.categories.some((c) => c.id === categoryId)) return { ok: false, error: 'BAD_REQUEST' };
    if (enabled) {
      this.enabledCategories.add(categoryId);
      return { ok: true };
    }
    const remaining = this.pack.categories
      .filter((c) => c.id !== categoryId && this.enabledCategories.has(c.id))
      .reduce((n, c) => n + c.questions, 0);
    if (remaining < MIN_GAME_QUESTIONS) return { ok: false, error: 'TOO_FEW_QUESTIONS' };
    this.enabledCategories.delete(categoryId);
    return { ok: true };
  }

  /** Reopens the pack vote; the votes are kept. */
  backToPacks(byId: string): Result {
    if (byId !== this.vipId) return { ok: false, error: 'NOT_ALLOWED' };
    if (this.phase !== 'lobby') return { ok: false, error: 'IN_PROGRESS' };
    if (this.lobbyStep !== 'setup') return { ok: false, error: 'BAD_REQUEST' };
    this.lobbyStep = 'packs';
    this.pack = null;
    this.enabledCategories.clear();
    return { ok: true };
  }

  get mode(): GameMode {
    return this.pack?.mode ?? 'classic';
  }

  /** What this game plays, as recorded with the match. */
  settings(): { mode: GameMode; pack: string; categories: string[] } | undefined {
    if (!this.pack) return undefined;
    const categories = this.pack.categories.filter((c) => this.enabledCategories.has(c.id)).map((c) => c.slug);
    return { mode: this.mode, pack: this.pack.slug, categories };
  }

  // -------------------------------------------------------------------------
  // Game flow. Each enter*() switches phase; the runner owns the timing.

  canStart(byId: string): Result {
    if (byId !== this.vipId) return { ok: false, error: 'NOT_ALLOWED' };
    if (this.phase !== 'lobby' && this.phase !== 'final') return { ok: false, error: 'IN_PROGRESS' };
    if (!this.pack || (this.phase === 'lobby' && this.lobbyStep !== 'setup')) return { ok: false, error: 'NO_QUESTIONS' };
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
    this.revealResult = null;
    this.question = null;
    this.streaks.clear();
    this.noneCorrectRun = 0;
    this.lastCommentRound = -1;
    this.blowoutCalled = false;
    this.powers.clear();
    this.powerPasses.clear();
    this.hits = [];
    this.phase = 'intro';
    this.ladder = this.mode === 'ladder' ? new LadderGame([...this.players.keys()], this.rng) : null;
    this.bluff = this.mode === 'bluff' ? new BluffGame(this.rng) : null;
    this.timeline = this.mode === 'timeline' ? new TimelineGame(this.rng) : null;
    this.guess = this.mode === 'guess' ? new GuessGame() : null;
    this.otto = this.welcome();
  }

  private welcome(): OttoLine {
    switch (this.mode) {
      case 'classic':
        return welcomeLine(this.players.size, this.lines);
      case 'ladder':
        return line('ladderWelcome', this.lines);
      case 'bluff':
        return line('bluffWelcome', this.lines);
      case 'timeline':
        return line('timelineWelcome', this.lines);
      case 'guess':
        return line('guessWelcome', this.lines);
    }
  }

  enterVote(options: VoteOption[]): void {
    this.round += 1;
    this.voteOptions = options;
    this.votes.clear();
    this.question = null;
    this.answers.clear();
    this.hits = [];
    this.powerPasses.clear();
    // Power plays need someone to throw them at (none in a solo game), and
    // buttons to cover: only the classic quiz has them.
    const granted = this.mode === 'classic' && grantsPowerPlay(this.round) && this.players.size > 1;
    if (granted) for (const id of this.players.keys()) this.powers.add(id);
    this.phase = 'vote';
    this.otto = voteLine(this.round, this.totalRounds, this.lines, granted && !this.powersExplained);
    // An announcement fills this round's talking; it doesn't make the next one quieter.
    this.spokeThisRound = this.otto !== null;
    if (granted) this.powersExplained = true;
  }

  /** A comment on this round: remembered so the next round's small moments pass quietly. */
  private comment(line: OttoLine | null): OttoLine | null {
    if (line) {
      this.spokeThisRound = true;
      this.lastCommentRound = this.round;
    }
    return line;
  }

  /** Otto kept quiet in the previous round (and hasn't spoken in this one yet). */
  private get quietBefore(): boolean {
    return !this.spokeThisRound && this.lastCommentRound < this.round - 1;
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
    return mostVoted(tally, this.rng);
  }

  /** Shows the decided category for a moment (the TV spins to it). */
  enterVoteResult(chosen: number): void {
    this.chosenOption = chosen;
    this.phase = 'vote_result';
    // The category speaks for itself (the question is read next); thrown power plays get a word.
    this.otto = this.hits.length > 0 ? this.comment(powerLine(this.hits, this.lines, this.quietBefore)) : null;
  }

  // --- Milliomos-létra ------------------------------------------------------

  /** Shows the next rung and its (pre-fetched) question's category; climbers may choose to stop. */
  enterLadderStep(option: VoteOption): void {
    const ladder = this.ladder!;
    this.round = ladder.nextRung();
    this.voteOptions = [option];
    this.chosenOption = 0;
    this.votes.clear();
    this.question = null;
    this.answers.clear();
    this.phase = 'ladder_step';
    this.otto = ladderStepLine(this.round, this.lines);
  }

  decideWalk(playerId: string, walk: boolean): Result {
    if (this.phase !== 'ladder_step' || !this.ladder) return { ok: false, error: 'NOT_ALLOWED' };
    return this.ladder.decide(playerId, walk);
  }

  /** Ends the step: those who chose to stop leave the ladder. */
  finishLadderStep(): void {
    this.ladder?.applyWalks();
  }

  useLifeline(playerId: string, kind: Lifeline, friendId?: string): Result {
    const q = this.question;
    if (this.phase !== 'question_open' || !this.ladder || q?.kind !== 'mc') return { ok: false, error: 'NOT_ALLOWED' };
    return this.ladder.useLifeline(playerId, kind, {
      answered: this.answers.has(playerId),
      correct: q.correct,
      choices: q.choices.length,
      friendId,
      players: [...this.players.keys()],
    });
  }

  /** Settles the rung: scores become the rungs everyone holds. */
  enterLadderReveal(): void {
    const q = this.mcQuestion();
    const ladder = this.ladder;
    if (!ladder) throw new Error('ladder reveal without a ladder');
    const prevRanks = new Map(this.rankedStandings().map((s) => [s.playerId, s.rank]));
    const connected = new Set(this.connectedPlayers().map((p) => p.id));
    const outcomes = ladder.settle(this.answers, q.correct, connected);
    this.picks = outcomes.map((o) => ({
      playerId: o.playerId,
      choice: o.choice,
      correct: o.correct,
      points: o.delta,
      responseMs: o.responseMs,
    }));
    for (const p of this.players.values()) p.score = ladder.rungOf(p.id);
    this.standings = this.rankedStandings(prevRanks);
    this.revealResult = { kind: 'mc', correct: q.correct };
    this.phase = 'reveal';
    this.otto = ladderRevealLine(outcomes, ladder.rung, this.lines);
  }

  enterQuestionRead(question: Question): void {
    this.question = question;
    this.askedQuestionIds.add(question.id);
    this.lastCategoryId = question.categoryId;
    this.answers.clear();
    this.answersOpenedAt = null;
    this.revealResult = null;
    this.phase = 'question_read';
    // The TV reads the question out; Otto's bubble makes way for it.
    this.otto = null;
    if (question.kind === 'bluff') this.bluff?.startRound(question);
    if (question.kind === 'timeline') this.timeline?.startRound(question);
    if (question.kind === 'number') this.guess?.startRound(question);
  }

  openAnswers(now: number): void {
    this.phase = 'question_open';
    this.answersOpenedAt = now;
  }

  /** Answer time is measured here, on the server, minus the phone's latency. */
  submitAnswer(playerId: string, questionId: string, choice: number, now: number): Result {
    const player = this.players.get(playerId);
    if (!player) return { ok: false, error: 'NOT_FOUND' };
    if (this.phase !== 'question_open' || this.question?.kind !== 'mc' || this.question.id !== questionId) {
      return { ok: false, error: 'NOT_ALLOWED' };
    }
    if (this.answers.has(playerId)) return { ok: false, error: 'NOT_ALLOWED' }; // no changing
    if (this.blocked(playerId)) return { ok: false, error: 'NOT_ALLOWED' }; // clear the obstacle first
    if (choice < 0 || choice >= this.question.choices.length) return { ok: false, error: 'BAD_REQUEST' };
    // 50:50 took these choices away from this player.
    if (this.ladder?.hiddenFor(playerId).includes(choice)) return { ok: false, error: 'BAD_REQUEST' };
    const elapsed = now - (this.answersOpenedAt ?? now) - player.latencyMs;
    this.answers.set(playerId, { choice, responseMs: Math.max(0, Math.round(elapsed)) });
    return { ok: true };
  }

  // --- Party modes: Blöffölő, Időrend, Tippelj! -------------------------------

  /** Blöffölő: everyone writes a lie. */
  enterBluffWrite(now: number): void {
    this.openInput('bluff_write', now);
  }

  submitLie(playerId: string, questionId: string, lie: string): Result {
    const player = this.inputPlayer(playerId, questionId, 'bluff_write');
    if (typeof player === 'string') return { ok: false, error: player };
    return this.bluff!.write(playerId, lie);
  }

  /** Blöffölő: the lies are in; everyone looks for the truth among them. */
  enterBluffPick(now: number): void {
    this.bluff!.buildOptions();
    this.openInput('bluff_pick', now);
  }

  pickBluff(playerId: string, questionId: string, option: number, now: number): Result {
    const player = this.inputPlayer(playerId, questionId, 'bluff_pick');
    if (typeof player === 'string') return { ok: false, error: player };
    return this.bluff!.pick(playerId, option, this.elapsed(player, now));
  }

  enterBluffReveal(): void {
    const { options, outcomes } = this.bluff!.settle([...this.players.keys()]);
    const double = pointsMultiplier(this.round, this.totalRounds);
    this.finishRound(
      outcomes.map((o) => ({
        playerId: o.playerId,
        choice: o.choice,
        correct: o.foundTruth,
        points: scoreBluff(o.foundTruth, o.fooled) * double,
        responseMs: o.responseMs,
      })),
      { kind: 'bluff', options },
    );
    this.otto = this.comment(bluffRevealLine(options, this.players.size, this.lines, this.quietBefore));
  }

  /** Időrend: everyone puts the items in order. */
  enterOrderOpen(now: number): void {
    this.openInput('order_open', now);
  }

  submitOrder(playerId: string, questionId: string, order: number[], now: number): Result {
    const player = this.inputPlayer(playerId, questionId, 'order_open');
    if (typeof player === 'string') return { ok: false, error: player };
    return this.timeline!.submit(playerId, order, this.elapsed(player, now));
  }

  enterTimelineReveal(openMs: number): void {
    const timeline = this.timeline!;
    const outcomes = timeline.settle([...this.players.keys()], openMs);
    const double = pointsMultiplier(this.round, this.totalRounds);
    this.finishRound(
      outcomes.map((o) => ({
        playerId: o.playerId,
        choice: null,
        correct: o.allRight,
        points: o.points * double,
        responseMs: o.responseMs,
      })),
      {
        kind: 'timeline',
        order: timeline.correctOrder(),
        years: timeline.years(),
        orders: Object.fromEntries(outcomes.map((o) => [o.playerId, o.order])),
      },
    );
    this.otto = this.comment(timelineRevealLine(outcomes, this.lines, this.quietBefore));
  }

  /** Tippelj!: everyone types a number. */
  enterGuessOpen(now: number): void {
    this.openInput('guess_open', now);
  }

  submitGuess(playerId: string, questionId: string, value: number, now: number): Result {
    const player = this.inputPlayer(playerId, questionId, 'guess_open');
    if (typeof player === 'string') return { ok: false, error: player };
    return this.guess!.submit(playerId, value, this.elapsed(player, now));
  }

  /** Tippelj!: the guesses are on the TV, sorted; everyone with a guess bets on the closest. */
  enterGuessBet(now: number): void {
    this.openInput('guess_bet', now);
  }

  placeBets(playerId: string, questionId: string, chips: number[]): Result {
    const player = this.inputPlayer(playerId, questionId, 'guess_bet');
    if (typeof player === 'string') return { ok: false, error: player };
    return this.guess!.bet(playerId, chips);
  }

  enterGuessReveal(): void {
    const q = this.question;
    if (q?.kind !== 'number') throw new Error('guess reveal without a number question');
    const settled = this.guess!.settle([...this.players.keys()]);
    const double = pointsMultiplier(this.round, this.totalRounds);
    this.finishRound(
      settled.outcomes.map((o) => ({
        playerId: o.playerId,
        choice: o.choice,
        correct: o.closest,
        points: o.points * double,
        responseMs: o.responseMs,
      })),
      { kind: 'number', answer: q.answer, unit: q.unit, guesses: settled.guesses, bets: settled.bets, closest: settled.closest },
    );
    this.otto = this.comment(guessRevealLine({ answer: q.answer, guesses: settled.guesses }, settled.outcomes, this.lines, this.quietBefore));
  }

  /** Starts a phase in which players act against the clock. */
  private openInput(phase: Phase, now: number): void {
    this.phase = phase;
    this.answersOpenedAt = now;
    this.otto = null;
  }

  /** The player acting on the live question in `phase`, or why they can't. */
  private inputPlayer(playerId: string, questionId: string, phase: Phase): Player | ErrorCode {
    const player = this.players.get(playerId);
    if (!player) return 'NOT_FOUND';
    if (this.phase !== phase || this.question?.id !== questionId) return 'NOT_ALLOWED';
    return player;
  }

  /** Time since the phase opened, minus the phone's latency: measured here, never by the phone. */
  private elapsed(player: Player, now: number): number {
    return Math.max(0, Math.round(now - (this.answersOpenedAt ?? now) - player.latencyMs));
  }

  /** Scores the round (`picks` carry the final points), ranks everyone and opens the reveal. */
  private finishRound(picks: Pick[], result: RevealResult): void {
    const prevRanks = new Map(this.rankedStandings().map((s) => [s.playerId, s.rank]));
    this.picks = picks;
    for (const pick of picks) {
      const p = this.players.get(pick.playerId);
      if (p) p.score += pick.points;
    }
    this.standings = this.rankedStandings(prevRanks);
    this.revealResult = result;
    this.phase = 'reveal';
    for (const p of picks) this.streaks.set(p.playerId, p.correct ? (this.streaks.get(p.playerId) ?? 0) + 1 : 0);
    this.noneCorrectRun = picks.some((p) => p.correct) ? 0 : this.noneCorrectRun + 1;
  }

  /** The current question, which must be multiple choice (the classic game and the ladder). */
  private mcQuestion(): McQuestion {
    const q = this.question;
    if (q?.kind !== 'mc') throw new Error('expected a multiple-choice question');
    return q;
  }

  /** Shifts the answer clock after a pause so frozen time doesn't count. */
  shiftAnswerClock(pausedMs: number): void {
    if (this.answersOpenedAt !== null) this.answersOpenedAt += pausedMs;
  }

  enterReveal(openMs: number): void {
    const q = this.mcQuestion();
    const prevRanks = new Map(this.rankedStandings().map((s) => [s.playerId, s.rank]));

    this.picks = [...this.players.values()].map((p) => {
      const a = this.answers.get(p.id);
      const correct = a?.choice === q.correct;
      const points = a ? scoreAnswer(correct, a.responseMs, openMs) * pointsMultiplier(this.round, this.totalRounds) : 0;
      p.score += points;
      return { playerId: p.id, choice: a?.choice ?? null, correct, points, responseMs: a?.responseMs ?? null };
    });
    this.standings = this.rankedStandings(prevRanks);
    this.revealResult = { kind: 'mc', correct: q.correct };
    this.phase = 'reveal';

    for (const p of this.picks) this.streaks.set(p.playerId, p.correct ? (this.streaks.get(p.playerId) ?? 0) + 1 : 0);
    this.noneCorrectRun = this.picks.some((p) => p.correct) ? 0 : this.noneCorrectRun + 1;
    const facts = this.picks.map((p) => ({
      id: p.playerId,
      correct: p.correct,
      responseMs: p.responseMs,
      streak: this.streaks.get(p.playerId) ?? 0,
    }));
    this.otto = this.comment(revealLine(facts, this.noneCorrectRun, this.lines, this.quietBefore));
  }

  enterScoreboard(): void {
    this.phase = 'scoreboard';
    const line = scoreboardLine(
      this.standingFacts(),
      {
        round: this.round,
        totalRounds: this.totalRounds,
        spokeThisRound: this.otto !== null,
        quietBefore: this.quietBefore,
        blowoutCalled: this.blowoutCalled,
      },
      this.lines,
    );
    if (line?.key === 'blowout') this.blowoutCalled = true;
    this.otto = this.comment(line);
  }

  enterFinal(): void {
    this.phase = 'final';
    this.standings = this.rankedStandings(new Map(this.standings.map((s) => [s.playerId, s.rank])));
    this.otto = finalLine(this.standingFacts(), this.lines, this.ladder ? SOLO_LADDER_HIGH : undefined);
  }

  /** Back to the lobby for a new game: the pack vote starts over. */
  enterLobby(): void {
    for (const p of this.players.values()) p.score = 0;
    this.powers.clear();
    this.hits = [];
    this.phase = 'lobby';
    this.lobbyStep = 'packs';
    this.packVotes.clear();
    this.pack = null;
    this.enabledCategories.clear();
    this.ladder = null;
    this.bluff = null;
    this.timeline = null;
    this.guess = null;
    this.round = 0;
    this.standings = [];
    this.picks = [];
    this.revealResult = null;
    this.question = null;
    this.otto = null;
  }

  /**
   * True when every connected player has voted/answered (phases end early).
   * On the ladder only the climbers count: the audience's answers are optional.
   */
  allActed(): boolean {
    const connected = this.connectedPlayers();
    if (connected.length === 0) return false;
    if (this.phase === 'vote') return connected.every((p) => this.votes.has(p.id) && !this.powerPending(p.id));
    if (this.phase === 'ladder_step') return this.ladder?.allDecided(connected.map((p) => p.id)) ?? false;
    if (this.phase === 'question_open') {
      const ladder = this.ladder;
      const waitFor = ladder ? connected.filter((p) => ladder.status(p.id) === 'in') : connected;
      return waitFor.every((p) => this.answers.has(p.id));
    }
    if (this.phase === 'bluff_write') return connected.every((p) => this.bluff?.lieOf(p.id) != null);
    if (this.phase === 'bluff_pick') return connected.every((p) => this.bluff?.pickOf(p.id) != null);
    if (this.phase === 'order_open') return connected.every((p) => this.timeline?.orderOf(p.id) != null);
    if (this.phase === 'guess_open') return connected.every((p) => this.guess?.guessOf(p.id) != null);
    if (this.phase === 'guess_bet') {
      // No guess, no chips: only those who guessed are waited for.
      return connected.filter((p) => this.guess?.guessOf(p.id) != null).every((p) => this.guess?.betsOf(p.id) != null);
    }
    return false;
  }

  /** Flags are allowed once per player for any question asked this game. */
  flag(playerId: string, questionId: string): Result<{ playerName: string }> {
    const player = this.players.get(playerId);
    if (!player) return { ok: false, error: 'NOT_FOUND' };
    if (!this.askedQuestionIds.has(questionId)) return { ok: false, error: 'NOT_FOUND' };
    // No flagging the live question: the reveal is where it can be judged.
    if (this.phase === 'question_read' || isInputPhase(this.phase)) {
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
    // On the ladder, equal rungs go to whoever climbed faster.
    const ladder = this.ladder;
    const tieBreak = (a: Player, b: Player) => (ladder ? ladder.totalMs(a.id) - ladder.totalMs(b.id) : 0);
    const ahead = (o: Player, p: Player) => o.score > p.score || (o.score === p.score && tieBreak(o, p) < 0);
    const sorted = [...this.players.values()].sort((a, b) => b.score - a.score || tieBreak(a, b) || a.seat - b.seat);
    return sorted.map((p) => {
      const rank = 1 + sorted.filter((o) => ahead(o, p)).length;
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
    const used = new Set([...this.players.values()].map((p) => p.avatar.character));
    return { character: CHARACTERS.find((c) => !used.has(c)) ?? CHARACTERS[0] };
  }
}

/** Index of the highest count; ties are settled randomly. */
function mostVoted(tally: number[], rng: Rng): number {
  const best = Math.max(...tally);
  const leaders = tally.flatMap((n, i) => (n === best ? [i] : []));
  return leaders[Math.floor(rng() * leaders.length)]!;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
