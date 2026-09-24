import type { Avatar, Difficulty } from './rules.ts';

// Views are complete, role-specific snapshots. The server sends a fresh one on
// every change, so a reconnecting client resyncs just by receiving the next one.
// Nothing secret (a correct answer before the reveal) may ever appear here.

export type Phase =
  | 'lobby'
  | 'intro'
  | 'vote'
  | 'vote_result'
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
}

export interface CategoryOption {
  id: number;
  name: string;
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
  | { phase: 'lobby' }
  | { phase: 'intro' }
  | { phase: 'vote'; options: CategoryOption[]; votes: Record<string, number> }
  /** The vote is decided; the TV spins to `chosen` before the question. */
  | { phase: 'vote_result'; options: CategoryOption[]; votes: Record<string, number>; chosen: number }
  | { phase: 'question_read'; question: PublicQuestion }
  | { phase: 'question_open'; question: PublicQuestion; answered: string[] }
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

/** Otto's reaction to a chosen category, by the category's slug. */
export const CATEGORY_LINES = {
  tortenelem: 'catTortenelem',
  foldrajz: 'catFoldrajz',
  tudomany: 'catTudomany',
  film: 'catFilm',
  zene: 'catZene',
  sport: 'catSport',
  gasztro: 'catGasztro',
  magyarorszag: 'catMagyarorszag',
} as const;
export type CategoryLineKey = (typeof CATEGORY_LINES)[keyof typeof CATEGORY_LINES];

export type OttoLineKey =
  | 'welcome'
  | 'welcomeSolo'
  | 'firstRound'
  | 'pickCategory'
  | 'halfway'
  | 'lastRound'
  | 'categoryPicked'
  | CategoryLineKey
  | 'allCorrect'
  | 'noneCorrect'
  | 'noneCorrectAgain'
  | 'onlyOne'
  | 'streak'
  | 'lightning'
  | 'fastest'
  | 'someCorrect'
  | 'soloCorrect'
  | 'soloWrong'
  | 'newLeader'
  | 'comeback'
  | 'blowout'
  | 'closeRace'
  | 'standings'
  | 'soloScore'
  | 'winner'
  | 'tie'
  | 'soloFinalHigh'
  | 'soloFinalLow'
  | 'paused';

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
  };
}
