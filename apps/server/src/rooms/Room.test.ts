import { MAX_PLAYERS } from '@trivia/shared';
import { describe, expect, it } from 'vitest';
import { Room } from './Room.ts';

const newRoom = () => new Room('BCDF', '00000000-0000-4000-8000-000000000000', 'en', 0);

function joinOk(room: Room, name: string) {
  const res = room.join(name);
  if (!res.ok) throw new Error(`join failed: ${res.error}`);
  return res.player;
}

describe('Room.join', () => {
  it('makes the first player VIP and gives each player a distinct color', () => {
    const room = newRoom();
    const a = joinOk(room, 'Anna');
    const b = joinOk(room, 'Béla');
    expect(room.vipId).toBe(a.id);
    expect(a.avatar.color).not.toBe(b.avatar.color);
  });

  it('rejects duplicate names case-insensitively', () => {
    const room = newRoom();
    joinOk(room, 'Otto');
    expect(room.join('  otto ')).toEqual({ ok: false, error: 'NAME_TAKEN' });
  });

  it('rejects blank names', () => {
    expect(newRoom().join('   ')).toEqual({ ok: false, error: 'BAD_REQUEST' });
  });

  it('caps the room at MAX_PLAYERS', () => {
    const room = newRoom();
    for (let i = 0; i < MAX_PLAYERS; i++) joinOk(room, `P${i}`);
    expect(room.join('Late')).toEqual({ ok: false, error: 'ROOM_FULL' });
  });
});

describe('reconnection', () => {
  it('resumes a seat only with the right token', () => {
    const room = newRoom();
    const p = joinOk(room, 'Anna');
    room.playerDisconnected(p.id, 1000);
    expect(room.resumePlayer(p.id, 'x'.repeat(32))).toBeNull();
    expect(room.resumePlayer(p.id, p.sessionToken)?.connected).toBe(true);
  });

  it('hands VIP to the next connected player when the VIP drops', () => {
    const room = newRoom();
    const a = joinOk(room, 'Anna');
    const b = joinOk(room, 'Béla');
    room.playerDisconnected(a.id, 1000);
    expect(room.vipId).toBe(b.id);
  });

  it('keeps VIP on a lone disconnected player so they get it back', () => {
    const room = newRoom();
    const a = joinOk(room, 'Anna');
    room.playerDisconnected(a.id, 1000);
    expect(room.vipId).toBe(a.id);
    room.resumePlayer(a.id, a.sessionToken);
    expect(room.vipId).toBe(a.id);
  });

  it('removes lobby players only after the grace period', () => {
    const room = newRoom();
    const a = joinOk(room, 'Anna');
    const b = joinOk(room, 'Béla');
    room.playerDisconnected(a.id, 1000);
    expect(room.removeStalePlayers(1000 + 59_999, 60_000)).toBe(false);
    expect(room.removeStalePlayers(1000 + 60_000, 60_000)).toBe(true);
    expect([...room.players.keys()]).toEqual([b.id]);
    expect(room.vipId).toBe(b.id);
  });
});
