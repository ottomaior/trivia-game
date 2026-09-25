import type { Avatar } from './rules.ts';
import type {
  AnswerPayload,
  BetPayload,
  BluffPickPayload,
  BluffWritePayload,
  GuessSubmitPayload,
  OrderSubmitPayload,
  FlagPayload,
  HostCreatePayload,
  HostResumePayload,
  KickPayload,
  LadderWalkPayload,
  LifelinePayload,
  PackVotePayload,
  PickModePayload,
  PlayerJoinPayload,
  PlayerResumePayload,
  PowerChoosePayload,
  PowerClearPayload,
  SetAvatarPayload,
  SetCategoryPayload,
  TimePingPayload,
  VotePayload,
} from './schemas.ts';
import type { HostView, PlayerView } from './views.ts';

// Socket.IO event maps shared by server and clients. Adding an event here makes
// both ends fail to compile until they handle it.

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'ROOM_FULL'
  | 'NAME_TAKEN'
  | 'IN_PROGRESS'
  | 'NOT_ALLOWED'
  | 'TOO_FEW_PLAYERS'
  | 'NO_QUESTIONS'
  | 'TOO_FEW_QUESTIONS'
  | 'CHARACTER_TAKEN'
  /** Blöffölő: the lie is (nearly) the truth itself. */
  | 'TOO_CLOSE';

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
  'player:setAvatar': (payload: SetAvatarPayload, ack: Ack) => void;
  /** Lobby, first step: the VIP picks a game mode; a mode with a single pack is locked at once. */
  'vip:pickMode': (payload: PickModePayload, ack: Ack) => void;
  'pack:vote': (payload: PackVotePayload, ack: Ack) => void;
  'vip:lockPack': (payload: object, ack: Ack) => void;
  'vip:setCategory': (payload: SetCategoryPayload, ack: Ack) => void;
  /** From the setup back one step: the pack vote, or the mode step when the mode has a single pack. */
  'vip:backToPacks': (payload: object, ack: Ack) => void;
  /** From the pack vote back to the mode step; votes are kept. */
  'vip:backToModes': (payload: object, ack: Ack) => void;
  'vip:start': (payload: object, ack: Ack) => void;
  'vip:kick': (payload: KickPayload, ack: Ack) => void;
  'vip:playAgain': (payload: object, ack: Ack) => void;
  'vip:newLobby': (payload: object, ack: Ack) => void;
  'vote:cast': (payload: VotePayload, ack: Ack) => void;
  'answer:submit': (payload: AnswerPayload, ack: Ack) => void;
  'ladder:walk': (payload: LadderWalkPayload, ack: Ack) => void;
  'ladder:lifeline': (payload: LifelinePayload, ack: Ack) => void;
  'question:flag': (payload: FlagPayload, ack: Ack) => void;
  /** During the vote: throw your power play at someone… */
  'power:choose': (payload: PowerChoosePayload, ack: Ack) => void;
  /** …or keep it for a later round. */
  'power:pass': (payload: object, ack: Ack) => void;
  /** During the question: you broke the ice or wiped the slime off. */
  'power:clear': (payload: PowerClearPayload, ack: Ack) => void;
  /** Blöffölő: send your lie… */
  'bluff:write': (payload: BluffWritePayload, ack: Ack) => void;
  /** …then pick the option you think is true. */
  'bluff:pick': (payload: BluffPickPayload, ack: Ack) => void;
  /** Időrend: the order you think is right (display indices, earliest first). */
  'order:submit': (payload: OrderSubmitPayload, ack: Ack) => void;
  /** Tippelj!: your guess… */
  'guess:submit': (payload: GuessSubmitPayload, ack: Ack) => void;
  /** …and your chips on the guesses you think are closest. */
  'guess:bet': (payload: BetPayload, ack: Ack) => void;
  'time:ping': (payload: TimePingPayload, ack: (res: { t: number; serverNow: number }) => void) => void;
}

export type RoomClosedReason = 'host_gone' | 'kicked' | 'expired';

export interface ServerToClientEvents {
  'view:host': (view: HostView) => void;
  'view:player': (view: PlayerView) => void;
  'room:closed': (payload: { reason: RoomClosedReason }) => void;
  /** Server-initiated round trip; the server measures each phone's latency itself. */
  'latency:probe': (payload: object, ack: (ok: boolean) => void) => void;
}
