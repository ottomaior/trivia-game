import { timingSafeEqual } from 'node:crypto';
import {
  AVATAR_COLORS,
  AVATAR_FACES,
  MAX_PLAYERS,
  normalizeName,
  type Avatar,
  type ErrorCode,
  type Lang,
  type Phase,
} from '@trivia/shared';
import { randomId, randomToken } from './ids.ts';

export interface Player {
  id: string;
  sessionToken: string;
  name: string;
  avatar: Avatar;
  score: number;
  connected: boolean;
  /** When the player's last socket dropped; null while connected. */
  disconnectedAt: number | null;
}

type JoinResult = { ok: true; player: Player } | { ok: false; error: ErrorCode };

/**
 * One game room. Holds all live state and enforces the rules; knows nothing
 * about sockets. Every mutating method returns whether anything changed so the
 * caller knows when to broadcast new views.
 */
export class Room {
  readonly hostToken = randomToken();
  phase: Phase = 'lobby';
  /** Join order is preserved; the first player is VIP by default. */
  readonly players = new Map<string, Player>();
  vipId: string | null = null;
  hostConnected = false;
  hostDisconnectedAt: number | null = null;

  constructor(
    readonly code: string,
    readonly householdId: string,
    readonly lang: Lang,
    readonly createdAt: number,
  ) {}

  join(rawName: string): JoinResult {
    if (this.phase !== 'lobby') return { ok: false, error: 'IN_PROGRESS' };
    if (this.players.size >= MAX_PLAYERS) return { ok: false, error: 'ROOM_FULL' };
    const name = normalizeName(rawName);
    if (!name) return { ok: false, error: 'BAD_REQUEST' };
    const key = name.toLocaleLowerCase();
    for (const p of this.players.values()) {
      if (p.name.toLocaleLowerCase() === key) return { ok: false, error: 'NAME_TAKEN' };
    }

    const player: Player = {
      id: randomId(),
      sessionToken: randomToken(),
      name,
      avatar: this.pickAvatar(),
      score: 0,
      connected: true,
      disconnectedAt: null,
    };
    this.players.set(player.id, player);
    if (!this.vipId) this.vipId = player.id;
    return { ok: true, player };
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
