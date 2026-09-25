import type { Phase } from './views.ts';

// Single source of truth for game limits and timings. Server and clients both
// import from here so the numbers can never drift apart.

/** One is enough: solo games are handy for testing and practice. */
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 6;
export const NAME_MAX_LENGTH = 12;

// Consonants only, so a random code can't spell a real word.
export const ROOM_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';
export const ROOM_CODE_LENGTH = 4;

/** A lobby player who has been disconnected this long loses their seat. */
export const LOBBY_DISCONNECT_GRACE_MS = 60_000;
/** A room whose TV has been gone this long is closed. */
export const HOST_ABSENT_ROOM_TTL_MS = 10 * 60_000;

export const AVATAR_COLORS = ['mustard', 'teal', 'ice', 'rust', 'plum', 'cream'] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const AVATAR_FACES = ['grin', 'wink', 'shades', 'shock', 'sleepy', 'smug'] as const;
export type AvatarFace = (typeof AVATAR_FACES)[number];

export interface Avatar {
  color: AvatarColor;
  face: AvatarFace;
}

/** Trim, collapse inner whitespace, clamp length. */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX_LENGTH);
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Game flow

export const TOTAL_ROUNDS = 10;
/** A question pack is offered only with at least this many active questions. */
export const PACK_MIN_QUESTIONS = 60;
/** Switching categories off must leave at least this many questions on. */
export const MIN_GAME_QUESTIONS = 30;

/**
 * `classic`: ten rounds with a category vote; `ladder`: Milliomos-létra;
 * `bluff`: Blöffölő (write a lie, find the truth); `timeline`: Időrend (put
 * five things in order); `guess`: Tippelj! (guess a number, bet on the closest).
 */
export const GAME_MODES = ['classic', 'ladder', 'bluff', 'timeline', 'guess'] as const;
export type GameMode = (typeof GAME_MODES)[number];

/** What a question asks for: four choices, a lie to write, an order, or a number. */
export const QUESTION_KINDS = ['mc', 'bluff', 'timeline', 'number'] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

/** The kind of question each mode plays. */
export function questionKindFor(mode: GameMode): QuestionKind {
  switch (mode) {
    case 'classic':
    case 'ladder':
      return 'mc';
    case 'bluff':
      return 'bluff';
    case 'timeline':
      return 'timeline';
    case 'guess':
      return 'number';
  }
}

/** Rounds in the party modes (Blöffölő, Időrend, Tippelj!): their rounds run longer than a quiz round. */
export const PARTY_ROUNDS = 8;
export const VOTE_OPTIONS = 3;
export const CHOICES_PER_QUESTION = 4;

/** Phase lengths in ms. Phases waiting on players end early once all acted. */
export const TIMINGS = {
  intro: 4_000,
  vote: 8_000,
  /** A vote where someone can still use a power play: picking a target takes a moment. */
  votePower: 12_000,
  /** The TV spins to the winning category, and Otto reacts to it. */
  voteResult: 2_600,
  questionRead: 2_000,
  questionOpen: 20_000,
  reveal: 7_000,
  scoreboard: 4_000,
  /** Ladder: the next rung's category shows, and players may walk away. */
  ladderStep: 7_000,
  /** Ladder answers get longer: there are lifelines to use. */
  ladderOpen: 30_000,
  /** Blöffölő: everyone types a believable lie… */
  bluffWrite: 45_000,
  /** …then picks the answer they think is true. */
  bluffPick: 20_000,
  /** The options are unmasked one by one (longer with more options, see bluffRevealMs). */
  bluffReveal: 12_000,
  /** Időrend: put the five items in order. */
  orderOpen: 35_000,
  /** Tippelj!: type a number… */
  guessOpen: 25_000,
  /** …then bet chips on the guesses you think are closest. */
  guessBet: 15_000,
} as const;
export type TimingKey = keyof typeof TIMINGS;

// Otto's voice. The show never talks over him: a phase in which he speaks
// lasts until he has finished (see the server's RoomRunner), and screens start
// his lines at these offsets.

/** Otto comments on the reveal this long into it, after the drumroll and the pan to the desks. */
export const OTTO_REVEAL_DELAY_MS = 3_200;
/** The question card lands before Otto starts reading it. */
export const QUESTION_VOICE_DELAY_MS = 400;
/** A breath after Otto finishes before the show moves on. */
export const SPEECH_TAIL_MS = 500;
/** Otto's speaking rate, for estimating lines that haven't been recorded yet. */
export const SPEECH_CHARS_PER_SECOND = 13;

/** Phases in which players act on their phones against the clock. */
export const INPUT_PHASES: readonly Phase[] = ['question_open', 'bluff_write', 'bluff_pick', 'order_open', 'guess_open', 'guess_bet'];

export function isInputPhase(phase: Phase): boolean {
  return INPUT_PHASES.includes(phase);
}

/** Milliseconds into a phase at which Otto's line for that phase starts. */
export function ottoLineOffsetMs(phase: Phase): number {
  return phase === 'reveal' ? OTTO_REVEAL_DELAY_MS : 0;
}

export type Difficulty = 1 | 2 | 3;

/** Easy rounds 1–3, medium 4–7, hard 8–10. */
export function difficultyForRound(round: number, totalRounds = TOTAL_ROUNDS): Difficulty {
  const f = round / totalRounds;
  if (f <= 0.3) return 1;
  if (f <= 0.7) return 2;
  return 3;
}

/** The last round is worth double, so nobody is out of it until the end. */
export function pointsMultiplier(round: number, totalRounds = TOTAL_ROUNDS): number {
  return round === totalRounds ? 2 : 1;
}

export const POINTS_BASE = 500;
export const POINTS_SPEED_BONUS = 500;

/** 500–1000 for a correct answer, scaled by how much time was left. */
export function scoreAnswer(correct: boolean, responseMs: number, openMs: number): number {
  if (!correct) return 0;
  const used = Math.min(1, Math.max(0, responseMs / openMs));
  return Math.round(POINTS_BASE + POINTS_SPEED_BONUS * (1 - used));
}

// ---------------------------------------------------------------------------
// Power plays: after voting, a player can throw one at another player, whose
// answer buttons are then covered until they clear it. The clock keeps
// running, which is the whole penalty.

export const POWER_PLAYS = ['freeze', 'slime'] as const;
export type PowerPlay = (typeof POWER_PLAYS)[number];

/** Everyone gets a power play every this many rounds (holding at most one)… */
export const POWER_PLAY_EVERY = 3;
/** …starting from this round, so the first round is just the quiz. */
export const POWER_PLAY_FIRST_ROUND = 2;

/** True for rounds whose vote hands everyone a power play (2, 5, 8 in a 10-round game). */
export function grantsPowerPlay(round: number): boolean {
  return round >= POWER_PLAY_FIRST_ROUND && (round - POWER_PLAY_FIRST_ROUND) % POWER_PLAY_EVERY === 0;
}

/** Taps it takes to break the ice. */
export const FREEZE_TAPS = 15;
/** Share of the slime that has to be wiped off. */
export const SLIME_CLEAR_SHARE = 0.7;

/** Upper bound on the latency credit a slow phone gets (one-way, ms). */
export const MAX_LATENCY_CREDIT_MS = 150;

export const FLAG_REASONS = ['wrong_answer', 'ambiguous', 'typo', 'offensive', 'other'] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

/** A question is retired once flags come from this many different matches. */
export const FLAG_RETIRE_MATCHES = 2;

// ---------------------------------------------------------------------------
// Milliomos-létra: everyone climbs the same ladder, one question per rung.

export const LADDER_RUNGS = 15;
/** Reaching these rungs banks them: a later wrong answer falls back here, not to zero. */
export const LADDER_SAFE_RUNGS: readonly number[] = [5, 10];
/** Walking away needs something to keep, so it opens from this rung on. */
export const LADDER_WALK_FROM = 2;

/** 50:50, ask the audience, phone a friend: each once per game. */
export const LIFELINES = ['fifty', 'audience', 'phone'] as const;
export type Lifeline = (typeof LIFELINES)[number];

/** Easy for rungs 1–5, medium for 6–10, hard for 11–15. */
export function ladderDifficulty(rung: number): Difficulty {
  if (rung <= 5) return 1;
  if (rung <= 10) return 2;
  return 3;
}

/** What a wrong answer on `rung` leaves you with: the highest safe rung below it. */
export function fallbackRung(rung: number): number {
  return Math.max(0, ...LADDER_SAFE_RUNGS.filter((r) => r < rung));
}

/** Rounds a game of this mode has; `classicRounds` can be shortened for tests. */
export function roundsFor(mode: GameMode, classicRounds = TOTAL_ROUNDS): number {
  if (mode === 'classic') return classicRounds;
  if (mode === 'ladder') return LADDER_RUNGS;
  return PARTY_ROUNDS;
}

/** Share of the answer time still left when the player answered, 0–1 (the same curve as a quiz answer). */
function timeLeftShare(responseMs: number, openMs: number): number {
  return 1 - Math.min(1, Math.max(0, responseMs / openMs));
}

// ---------------------------------------------------------------------------
// Blöffölő: everyone writes a lie; the TV mixes the lies with the truth.

export const BLUFF_LIE_MAX_CHARS = 40;
/** Too few lies (a small group, or someone asleep) get padded with the house's own. */
export const BLUFF_MIN_OPTIONS = 4;
/** A lie this similar to the truth (trigram similarity) is refused: write something else. */
export const BLUFF_TOO_CLOSE = 0.8;
export const BLUFF_TRUTH_POINTS = 1000;
export const BLUFF_FOOL_POINTS = 500;
/** Each option beyond four adds this much to the reveal, so every one gets its moment. */
export const BLUFF_REVEAL_PER_EXTRA_OPTION_MS = 2_000;

export function scoreBluff(foundTruth: boolean, fooled: number): number {
  return (foundTruth ? BLUFF_TRUTH_POINTS : 0) + fooled * BLUFF_FOOL_POINTS;
}

export function bluffRevealMs(options: number): number {
  return TIMINGS.bluffReveal + Math.max(0, options - BLUFF_MIN_OPTIONS) * BLUFF_REVEAL_PER_EXTRA_OPTION_MS;
}

// ---------------------------------------------------------------------------
// Időrend: five items to put in chronological order.

export const TIMELINE_ITEMS = 5;
export const TIMELINE_ITEM_POINTS = 200;
/** Only a perfect order earns the speed bonus. */
export const TIMELINE_SPEED_BONUS = 500;

/** How many positions of `order` match `correct`. */
export function slotsRight(order: readonly number[], correct: readonly number[]): number {
  return correct.reduce((n, item, i) => n + (order[i] === item ? 1 : 0), 0);
}

export function scoreTimeline(right: number, total: number, responseMs: number, openMs: number): number {
  const bonus = right === total ? Math.round(TIMELINE_SPEED_BONUS * timeLeftShare(responseMs, openMs)) : 0;
  return right * TIMELINE_ITEM_POINTS + bonus;
}

// ---------------------------------------------------------------------------
// Tippelj!: guess a number, then bet chips on whose guess is closest.

export const GUESS_CHIPS = 2;
export const GUESS_CLOSEST_POINTS = 1000;
export const GUESS_EXACT_BONUS = 500;
export const GUESS_CHIP_POINTS = 500;

/** Players whose guess is nearest the answer; ties share. */
export function closestGuesses(guesses: readonly { playerId: string; value: number }[], answer: number): string[] {
  if (guesses.length === 0) return [];
  const best = Math.min(...guesses.map((g) => Math.abs(g.value - answer)));
  return guesses.filter((g) => Math.abs(g.value - answer) === best).map((g) => g.playerId);
}

export function scoreGuess(closest: boolean, exact: boolean, chipsOnClosest: number): number {
  return (closest ? GUESS_CLOSEST_POINTS : 0) + (exact ? GUESS_EXACT_BONUS : 0) + chipsOnClosest * GUESS_CHIP_POINTS;
}
