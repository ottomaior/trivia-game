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
