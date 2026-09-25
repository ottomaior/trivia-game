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
  /** Blöffölő: everyone types a believable lie. */
  | 'bluff_write'
  /** Blöffölő: the lies and the truth, mixed; everyone picks one. */
  | 'bluff_pick'
  /** Időrend: everyone puts the five items in order. */
  | 'order_open'
  /** Tippelj!: everyone types a number. */
  | 'guess_open'
  /** Tippelj!: everyone bets chips on the guesses they think are closest. */
  | 'guess_bet'
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

interface PublicQuestionBase {
  id: string;
  category: string;
  difficulty: Difficulty;
  prompt: string;
  /** Name of the recorded read-aloud of the prompt (public/voice/q/), if one was made. */
  voice: string;
}

/** A question as screens may see it before the reveal: no answer key. */
export type PublicQuestion =
  | (PublicQuestionBase & { kind: 'mc'; choices: string[] })
  /** Blöffölő: the prompt only; the options appear once the lies are in. */
  | (PublicQuestionBase & { kind: 'bluff' })
  /** Időrend: the items in the order shown (shuffled), without their years. */
  | (PublicQuestionBase & { kind: 'timeline'; items: string[] })
  /** Tippelj!: the unit the answer is counted in ("km", "év"), if any. */
  | (PublicQuestionBase & { kind: 'number'; unit: string | null });

export type McQuestionView = Extract<PublicQuestion, { kind: 'mc' }>;

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

/**
 * What one player did in a round. `choice` indexes the kind's option list:
 * the answer tile, the Blöffölő option picked, or the player's own guess in
 * the sorted guesses (null for Időrend and for no answer). `correct` means
 * right answer / found the truth / perfect order / closest guess.
 */
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
  | { phase: 'question_open'; question: McQuestionView; answered: string[]; hits: PowerHit[] }
  /** `written`: who has sent a lie. */
  | { phase: 'bluff_write'; question: PublicQuestion; written: string[] }
  /** `options`: the lies and the truth, shuffled, with nothing about who wrote what. */
  | { phase: 'bluff_pick'; question: PublicQuestion; options: string[]; picked: string[] }
  | { phase: 'order_open'; question: PublicQuestion; answered: string[] }
  | { phase: 'guess_open'; question: PublicQuestion; answered: string[] }
  /** `guesses` ascending; a chip names a guess by its index here. `bet`: who has placed their chips. */
  | { phase: 'guess_bet'; question: PublicQuestion; guesses: Guess[]; bet: string[] }
  | {
      phase: 'reveal';
      question: PublicQuestion;
      explanation: string | null;
      picks: Pick[];
      result: RevealResult;
    }
  | { phase: 'scoreboard'; standings: Standing[] }
  | { phase: 'final'; standings: Standing[] };

export interface Guess {
  playerId: string;
  value: number;
}

/** One Blöffölő option at the reveal: whose lie it was (none for the truth or the house's own) and who fell for it. */
export interface BluffOption {
  text: string;
  truth: boolean;
  authors: string[];
  pickers: string[];
}

/** The answer, as each kind reveals it. */
export type RevealResult =
  | { kind: 'mc'; correct: number }
  | { kind: 'bluff'; options: BluffOption[] }
  /**
   * `order`: the display indices of the items in chronological order, with
   * their `years`; `orders`: each player's submitted order (null: none).
   */
  | { kind: 'timeline'; order: number[]; years: number[]; orders: Record<string, number[] | null> }
  /**
   * `guesses` ascending (the indices chips point at), `bets` each player's
   * chips, `closest` whose guesses were nearest.
   */
  | {
      kind: 'number';
      answer: number;
      unit: string | null;
      guesses: (Guess & { distance: number })[];
      bets: Record<string, number[]>;
      closest: string[];
    };

/** The quiz's question stages (classic and ladder): the question is multiple choice. */
export type McQuestionStage =
  | Extract<Stage, { phase: 'question_open' }>
  | (Extract<Stage, { phase: 'question_read' }> & { question: McQuestionView });

/** The stage as a multiple-choice question being read or answered, or null. */
export function mcQuestionStage(stage: Stage): McQuestionStage | null {
  if (stage.phase === 'question_open') return stage;
  if (stage.phase === 'question_read' && stage.question.kind === 'mc') return { ...stage, question: stage.question };
  return null;
}

/** Players who have acted in the current phase (answered, written, picked, ordered, guessed or bet). */
export function actedIds(stage: Stage): string[] {
  switch (stage.phase) {
    case 'question_open':
    case 'order_open':
    case 'guess_open':
      return stage.answered;
    case 'bluff_write':
      return stage.written;
    case 'bluff_pick':
      return stage.picked;
    case 'guess_bet':
      return stage.bet;
    default:
      return [];
  }
}

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
  | LadderLineKey
  | BluffLineKey
  | TimelineLineKey
  | GuessLineKey;

/** Otto's lines for Blöffölő. */
export type BluffLineKey = 'bluffWelcome' | 'bluffNobodyFooled' | 'bluffAllFooled' | 'bluffBigLie' | 'bluffAllTruth';

/** Otto's lines for Időrend. */
export type TimelineLineKey = 'timelineWelcome' | 'timelinePerfect' | 'timelineChaos' | 'timelineAllPerfect';

/** Otto's lines for Tippelj!. */
export type GuessLineKey = 'guessWelcome' | 'guessExact' | 'guessWayOff' | 'guessBetsWin';

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
    /** Blöffölő: the lie this player wrote this round. */
    lie: string | null;
    /** Időrend: the order this player sent (display indices). */
    order: number[] | null;
    /** Tippelj!: this player's guess, and their chips (indices into the sorted guesses). */
    guess: number | null;
    bets: number[] | null;
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
