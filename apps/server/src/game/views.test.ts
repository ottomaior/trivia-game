import { describe, expect, it } from 'vitest';
import { Room } from '../rooms/Room.ts';
import { HOUSEHOLD, seededRng } from '../testing.ts';
import { toHostView, toPlayerView } from './views.ts';

describe('views', () => {
  it('never leak session tokens or the host token', () => {
    const room = new Room('BCDF', HOUSEHOLD, 0, seededRng());
    const res = room.join('Anna');
    if (!res.ok) throw new Error();
    const serialized = JSON.stringify([toHostView(room, 1), toPlayerView(room, res.player.id, 1)]);
    expect(serialized).not.toContain(res.player.sessionToken);
    expect(serialized).not.toContain(room.hostToken);
  });

  it('marks the VIP and personalizes the player view', () => {
    const room = new Room('BCDF', HOUSEHOLD, 0, seededRng());
    const a = room.join('Anna');
    const b = room.join('Béla');
    if (!a.ok || !b.ok) throw new Error();
    const view = toPlayerView(room, b.player.id, 5)!;
    expect(view.me.name).toBe('Béla');
    expect(view.me.isVip).toBe(false);
    expect(view.players.find((p) => p.isVip)?.name).toBe('Anna');
    expect(view.stage).toEqual({ phase: 'lobby', step: 'mode', modes: null });
    expect(view.pack).toBeNull();
  });

  it('lists only the picked mode\'s packs and votes on the pack step', () => {
    const room = new Room('BCDF', HOUSEHOLD, 0, seededRng());
    const a = room.join('Anna');
    if (!a.ok) throw new Error();
    const cats = [{ id: 1, slug: 'c1', name: 'Egy', questions: 40 }];
    const pack = (slug: string, mode: 'classic' | 'ladder') => ({ slug, name: slug, description: '', mode, categories: cats, questions: 40 });
    room.setPackOffers([pack('alap', 'classic'), pack('pop', 'classic'), pack('letra', 'ladder')]);
    room.pickMode(a.player.id, 'classic');
    room.votePack(a.player.id, 'pop');
    const stage = toHostView(room, 5).stage;
    if (stage.phase !== 'lobby' || stage.step !== 'packs') throw new Error();
    expect(stage.mode).toBe('classic');
    expect(stage.modes).toEqual([
      { mode: 'classic', packs: 2 },
      { mode: 'ladder', packs: 1 },
    ]);
    expect(stage.packs.map((p) => [p.slug, p.mode])).toEqual([
      ['alap', 'classic'],
      ['pop', 'classic'],
    ]);
    expect(stage.votes).toEqual({ [a.player.id]: 'pop' });
  });
});
