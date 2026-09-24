import type { HostView, PlayerSummary, PlayerView } from '@trivia/shared';
import type { Player, Room } from '../rooms/Room.ts';

// Builds the snapshots each screen receives. Only public information may pass
// through here; tests assert on these to guarantee secrecy.

function summarize(room: Room, p: Player): PlayerSummary {
  return {
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    connected: p.connected,
    isVip: room.vipId === p.id,
    score: p.score,
  };
}

function base(room: Room, now: number) {
  return {
    roomCode: room.code,
    lang: room.lang,
    phase: room.phase,
    serverNow: now,
    phaseEndsAt: null,
    players: [...room.players.values()].map((p) => summarize(room, p)),
  };
}

export function toHostView(room: Room, now: number): HostView {
  return { role: 'host', ...base(room, now) };
}

export function toPlayerView(room: Room, playerId: string, now: number): PlayerView | null {
  const player = room.players.get(playerId);
  if (!player) return null;
  return { role: 'player', ...base(room, now), me: summarize(room, player) };
}
