import type { Avatar } from './rules.ts';
import type {
  HostCreatePayload,
  HostResumePayload,
  PlayerJoinPayload,
  PlayerResumePayload,
  TimePingPayload,
} from './schemas.ts';
import type { HostView, PlayerView } from './views.ts';

// Socket.IO event maps shared by server and clients. Adding an event here makes
// both ends fail to compile until they handle it.

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'ROOM_FULL'
  | 'NAME_TAKEN'
  | 'IN_PROGRESS';

export type Result<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: ErrorCode };

type Ack<T extends object = object> = (result: Result<T>) => void;

export interface HostSession {
  roomCode: string;
  hostToken: string;
}

export interface PlayerSession {
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface ClientToServerEvents {
  'host:create': (payload: HostCreatePayload, ack: Ack<HostSession>) => void;
  'host:resume': (payload: HostResumePayload, ack: Ack) => void;
  'player:join': (payload: PlayerJoinPayload, ack: Ack<PlayerSession & { avatar: Avatar }>) => void;
  'player:resume': (payload: PlayerResumePayload, ack: Ack) => void;
  'time:ping': (payload: TimePingPayload, ack: (res: { t: number; serverNow: number }) => void) => void;
}

export type RoomClosedReason = 'host_gone' | 'kicked' | 'expired';

export interface ServerToClientEvents {
  'view:host': (view: HostView) => void;
  'view:player': (view: PlayerView) => void;
  'room:closed': (payload: { reason: RoomClosedReason }) => void;
}
