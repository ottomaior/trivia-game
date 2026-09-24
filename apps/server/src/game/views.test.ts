import { describe, expect, it } from 'vitest';
import { Room } from '../rooms/Room.ts';
import { toHostView, toPlayerView } from './views.ts';

describe('views', () => {
  it('never leak session tokens or the host token', () => {
    const room = new Room('BCDF', '00000000-0000-4000-8000-000000000000', 'en', 0);
    const res = room.join('Anna');
    if (!res.ok) throw new Error();
    const serialized = JSON.stringify([toHostView(room, 1), toPlayerView(room, res.player.id, 1)]);
    expect(serialized).not.toContain(res.player.sessionToken);
    expect(serialized).not.toContain(room.hostToken);
  });

  it('marks the VIP and personalizes the player view', () => {
    const room = new Room('BCDF', '00000000-0000-4000-8000-000000000000', 'hu', 0);
    const a = room.join('Anna');
    const b = room.join('Béla');
    if (!a.ok || !b.ok) throw new Error();
    const view = toPlayerView(room, b.player.id, 5)!;
    expect(view.me.name).toBe('Béla');
    expect(view.me.isVip).toBe(false);
    expect(view.players.find((p) => p.isVip)?.name).toBe('Anna');
    expect(view.lang).toBe('hu');
  });
});
