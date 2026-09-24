import type { Avatar, Lang } from './rules.ts';

// Views are complete, role-specific snapshots. The server sends a fresh one on
// every change, so a reconnecting client resyncs just by receiving the next one.
// Nothing secret (e.g. a correct answer before reveal) may ever appear here.

export type Phase = 'lobby';

export interface PlayerSummary {
  id: string;
  name: string;
  avatar: Avatar;
  connected: boolean;
  isVip: boolean;
  score: number;
}

interface BaseView {
  roomCode: string;
  lang: Lang;
  phase: Phase;
  /** Server clock when this view was built (ms since epoch). */
  serverNow: number;
  /** Server time the current phase ends, or null when it waits on players. */
  phaseEndsAt: number | null;
  players: PlayerSummary[];
}

export interface HostView extends BaseView {
  role: 'host';
}

export interface PlayerView extends BaseView {
  role: 'player';
  me: PlayerSummary;
}
