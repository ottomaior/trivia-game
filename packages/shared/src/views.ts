import type { Avatar, Difficulty, GameMode, Lifeline, PowerPlay } from './rules.ts';

// Views are complete, role-specific snapshots. The server sends a fresh one on
// every change, so a reconnecting client resyncs just by receiving the next one.
// Nothing secret (a correct answer before the reveal) may ever appear here.

export type Phase =
  | 'lobby'
  | 'intro'
  | 'vote'
  | 'vote_result'
  /** Milliomos-létra: the next rung's category shows, and players may walk away. */
  | 'ladder_step'
  | 'question_read'
  | 'question_open'
  | 'reveal'
  | 'scoreboard'
  | 'final';

export interface PlayerSummary {
  id: string;
  name: string;
  avatar: Avatar;
  connected: boolean;
  isVip: boolean;
  score: number;
  /** Holds an unused power play. */
  hasPower: boolean;
}

/** A question pack as the lobby offers it. */
export interface PackOption {
  slug: string;
  name: string;
  description: string;
  categories: number;
  questions: number;
}

/** One category of the locked pack, which the VIP can switch off. */
export interface PackCategory {
  id: number;
  name: string;
  questions: number;
  enabled: boolean;
}

export interface CategoryOption {
  id: number;
  name: string;
}

/**
 * Milliomos-létra, per player: `in` is still climbing, `out` answered wrong
 * and fell back to a safe rung, `walked` stopped and kept their rung, `top`
 * reached the last rung. `rung` is the highest rung they have banked.
 */
export type LadderStatus = 'in' | 'out' | 'walked' | 'top';

export interface LadderSeat {
  playerId: string;
  status: LadderStatus;
  rung: number;
  /** Lifelines already used this game. */
  used: Lifeline[];
}

/** A question as screens may see it before the reveal: no answer key. */
export interface PublicQuestion {
  id: string;
  category: string;
  difficulty: Difficulty;
  prompt: string;
  choices: string[];
  /** Name of the recorded read-aloud of the prompt (public/voice/q/), if one was made. */
  voice: string;
}

/** A power play thrown this round: `target` has to clear it before answering. */
export interface PowerHit {
  by: string;
  target: string;
  power: PowerPlay;
  cleared: boolean;
}

/**
 * This player's power play: `ready` while they can throw it now (in the vote,
 * with someone to target), `passed` when they are keeping it for later,
 * `held` outside the vote, `used` once thrown this round.
 */
export type PowerState = 'none' | 'held' | 'ready' | 'passed' | 'used';

export interface Pick {
  playerId: string;
  choice: number | null;
  correct: boolean;
  points: number;
  responseMs: number | null;
}

export interface Standing {
  playerId: string;
  score: number;
  /** Points gained in the last round. */
  delta: number;
  /** 1-based; tied scores share a rank. */
  rank: number;
  prevRank: number;
}

export type Stage =
  /** Players vote for a pack; `packs` is null while the offers load. `votes` maps player id to pack slug. */
  | { phase: 'lobby'; step: 'packs'; packs: PackOption[] | null; votes: Record<string, string> }
  /** The pack is locked; the VIP may switch categories off before starting. */
  | { phase: 'lobby'; step: 'setup'; pack: PackOption; categories: PackCategory[]; minQuestions: number }
  | { phase: 'intro' }
  /** `powerVote`: someone can throw a power play, so the vote runs longer (TIMINGS.votePower). */
  | { phase: 'vote'; options: CategoryOption[]; votes: Record<string, number>; hits: PowerHit[]; powerVote: boolean }
  /** The vote is decided; the TV spins to `chosen` before the question. */
  | { phase: 'vote_result'; options: CategoryOption[]; votes: Record<string, number>; chosen: number; hits: PowerHit[] }
  /** `rung` is about to be played; `walking` maps player id to their choice so far (true: stop here). */
  | { phase: 'ladder_step'; rung: number; category: CategoryOption; difficulty: Difficulty; walking: Record<string, boolean> }
  | { phase: 'question_read'; question: PublicQuestion; hits: PowerHit[] }
  | { phase: 'question_open'; question: PublicQuestion; answered: string[]; hits: PowerHit[] }
  | {
      phase: 'reveal';
      question: PublicQuestion;
      correct: number;
      explanation: string | null;
      picks: Pick[];
    }
  | { phase: 'scoreboard'; standings: Standing[] }
  | { phase: 'final'; standings: Standing[] };

/**
 * A line for Otto: the key picks the text, the variant one of its versions.
 * Lines never contain names or numbers, so each can be pre-recorded as a voice
 * clip (`${key}-${variant}`); `focus` names the players the line is about, and
 * the TV points the spotlight at them instead.
 */
export interface OttoLine {
  key: OttoLineKey;
  variant: number;
  focus: string[];
}

export type OttoLineKey =
  | 'welcome'
  | 'welcomeSolo'
  | 'lastRound'
  | 'powerGranted'
  | 'powerFreeze'
  | 'powerSlime'
  | 'powerMany'
  | 'powerGangUp'
  | 'allCorrect'
  | 'noneCorrect'
  | 'noneCorrectAgain'
  | 'onlyOne'
  | 'streak'
  | 'lightning'
  | 'soloCorrect'
  | 'soloWrong'
  | 'newLeader'
  | 'comeback'
  | 'blowout'
  | 'closeRace'
  | 'winner'
  | 'tie'
  | 'soloFinalHigh'
  | 'soloFinalLow'
  | 'paused'
  | LadderLineKey;

/** Otto's lines for Milliomos-létra. */
export type LadderLineKey =
  | 'ladderWelcome'
  | 'ladderFirst'
  | 'ladderSafeAhead'
  | 'ladderLastRung'
  | 'ladderSafe'
  | 'ladderFell'
  | 'ladderAllFell'
  | 'ladderTop';

interface BaseView {
  roomCode: string;
  stage: Stage;
  round: number;
  totalRounds: number;
  /** Server clock when this view was built (ms since epoch). */
  serverNow: number;
  /** Server time the current phase ends, or null when it waits on something else. */
  phaseEndsAt: number | null;
  /** True while the TV is disconnected mid-game: timers are frozen. */
  paused: boolean;
  players: PlayerSummary[];
  /** Name of the locked question pack, once there is one. */
  pack: string | null;
  mode: GameMode;
  /** Milliomos-létra: where everyone stands. Null in the classic game. */
  ladder: { seats: LadderSeat[] } | null;
}

export interface HostView extends BaseView {
  role: 'host';
  otto: OttoLine | null;
}

export interface PlayerView extends BaseView {
  role: 'player';
  me: PlayerSummary;
  /** This player's own actions in the current phase. */
  mine: {
    vote: number | null;
    choice: number | null;
    flagged: boolean;
    /** Milliomos-létra: what this player's lifelines show on the current question. */
    ladder: LadderHelp | null;
    power: PowerState;
  };
}

/** Lifeline results, only on the phone of the player who used them. */
export interface LadderHelp {
  /** 50:50: the two wrong choices taken away. */
  hidden: number[];
  /** Ask the audience: how many of the players already off the ladder picked each choice so far. */
  audience: number[] | null;
  /** Phone a friend: whom you asked, and their pick once they have made it. */
  friend: { playerId: string; choice: number | null } | null;
}
