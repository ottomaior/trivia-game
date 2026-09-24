import { describe, expect, it, vi } from 'vitest';
import { MemoryStore } from '../db/store.ts';
import { HOUSEHOLD } from '../testing.ts';
import { RoomManager } from './RoomManager.ts';

function setup(codes: string[] = []) {
  let now = 0;
  const onChange = vi.fn();
  const onClose = vi.fn();
  const queue = [...codes];
  const manager = new RoomManager({
    clock: () => now,
    store: new MemoryStore(),
    lobbyGraceMs: 60_000,
    hostAbsentTtlMs: 600_000,
    onChange,
    onClose,
    log: { warn: () => {} },
    generateCode: queue.length ? () => queue.shift()! : undefined,
  });
  return { manager, onChange, onClose, advance: (ms: number) => (now += ms), at: () => now };
}

describe('RoomManager', () => {
  it('never hands out a code that is already in use', () => {
    const { manager } = setup(['BCDF', 'BCDF', 'GHJK']);
    expect(manager.create(HOUSEHOLD).room.code).toBe('BCDF');
    expect(manager.create(HOUSEHOLD).room.code).toBe('GHJK');
  });

  it('closes a room once its TV has been gone past the TTL', () => {
    const { manager, onClose, advance, at } = setup();
    const { room } = manager.create(HOUSEHOLD);
    room.hostConnectedNow();
    room.hostDisconnectedNow(at());
    advance(599_999);
    manager.sweep();
    expect(onClose).not.toHaveBeenCalled();
    advance(1);
    manager.sweep();
    expect(onClose).toHaveBeenCalledWith(room);
    expect(manager.get(room.code)).toBeUndefined();
  });

  it('keeps a room alive when the TV comes back in time', () => {
    const { manager, onClose, advance, at } = setup();
    const { room } = manager.create(HOUSEHOLD);
    room.hostDisconnectedNow(at());
    advance(300_000);
    room.hostConnectedNow();
    advance(600_000);
    manager.sweep();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('broadcasts after dropping stale lobby players', () => {
    const { manager, onChange, advance, at } = setup();
    const { room } = manager.create(HOUSEHOLD);
    room.hostConnectedNow();
    const res = room.join('Anna');
    if (!res.ok) throw new Error();
    room.playerDisconnected(res.player.id, at());
    advance(60_000);
    manager.sweep();
    expect(onChange).toHaveBeenCalledWith(room);
    expect(room.players.size).toBe(0);
  });
});
