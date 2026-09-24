import { describe, expect, it } from 'vitest';
import { seededRng } from '../testing.ts';
import { LadderGame } from './Ladder.ts';

/** Answers by player id; every answer took a second. */
const answers = (picks: Record<string, number>) =>
  new Map(Object.entries(picks).map(([id, choice]) => [id, { choice, responseMs: 1_000 }]));
const everyone = new Set(['a', 'b', 'c']);

/** Plays rungs where everyone listed answers right (choice 0 is correct). */
function climb(g: LadderGame, rungs: number, ids = ['a', 'b', 'c']) {
  for (let i = 0; i < rungs; i++) {
    g.nextRung();
    g.settle(answers(Object.fromEntries(ids.map((id) => [id, 0]))), 0, everyone);
  }
}

describe('LadderGame', () => {
  it('banks a rung per right answer; a wrong one falls back to the last safe rung', () => {
    const g = new LadderGame(['a', 'b', 'c'], seededRng());
    climb(g, 5);
    g.nextRung();
    const outcomes = g.settle(answers({ a: 0, b: 2, c: 0 }), 0, everyone);
    expect(g.rungOf('a')).toBe(6);
    expect(g.status('b')).toBe('out');
    expect(g.rungOf('b')).toBe(5);
    expect(outcomes.find((o) => o.playerId === 'b')).toMatchObject({ correct: false, delta: 0, status: 'out' });
    expect(outcomes.find((o) => o.playerId === 'a')).toMatchObject({ correct: true, delta: 1, status: 'in' });
  });

  it('keeps nothing when falling before the first safe rung, and counts silence as wrong', () => {
    const g = new LadderGame(['a', 'b', 'c'], seededRng());
    climb(g, 3);
    g.nextRung();
    g.settle(answers({ a: 1 }), 0, everyone);
    expect([g.status('a'), g.rungOf('a')]).toEqual(['out', 0]);
    expect([g.status('b'), g.rungOf('b')]).toEqual(['out', 0]);
  });

  it('lets a phone that dropped without answering walk away with its rung', () => {
    const g = new LadderGame(['a', 'b', 'c'], seededRng());
    climb(g, 7);
    g.nextRung();
    g.settle(answers({ a: 0, b: 0 }), 0, new Set(['a', 'b']));
    expect([g.status('c'), g.rungOf('c')]).toEqual(['walked', 7]);
  });

  it('allows walking away from the second rung, keeping what is banked', () => {
    const g = new LadderGame(['a', 'b', 'c'], seededRng());
    g.nextRung();
    expect(g.canWalk()).toBe(false);
    expect(g.decide('a', true)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(g.allDecided(['a', 'b', 'c'])).toBe(false);
    g.settle(answers({ a: 0, b: 0, c: 0 }), 0, everyone);

    g.nextRung();
    expect(g.decide('a', true)).toEqual({ ok: true });
    expect(g.decide('b', false)).toEqual({ ok: true });
    expect(g.decisions()).toEqual({ a: true, b: false });
    expect(g.allDecided(['a', 'b', 'c'])).toBe(false);
    expect(g.allDecided(['a', 'b'])).toBe(true); // c is offline: nobody waits for them
    expect(g.decide('a', false)).toEqual({ ok: true }); // a changes their mind…
    expect(g.decide('a', true)).toEqual({ ok: true }); // …and back
    expect(g.applyWalks()).toEqual(['a']);
    expect([g.status('a'), g.rungOf('a')]).toEqual(['walked', 1]);
    expect(g.climbing()).toEqual(['b', 'c']);
  });

  it('tops out on the last rung, which ends the climb', () => {
    const g = new LadderGame(['a', 'b', 'c'], seededRng());
    climb(g, 14);
    g.nextRung();
    g.settle(answers({ a: 0, b: 1, c: 0 }), 0, everyone);
    expect([g.status('a'), g.rungOf('a')]).toEqual(['top', 15]);
    expect([g.status('b'), g.rungOf('b')]).toEqual(['out', 10]);
    expect(g.isOver()).toBe(true);
  });

  it('50:50 takes the same two wrong choices away from everyone who asks, once per game', () => {
    const g = new LadderGame(['a', 'b', 'c'], seededRng());
    climb(g, 1);
    g.nextRung();
    const q = { answered: false, correct: 2, choices: 4, players: ['a', 'b', 'c'] };
    expect(g.useLifeline('a', 'fifty', q)).toEqual({ ok: true });
    expect(g.useLifeline('b', 'fifty', q)).toEqual({ ok: true });
    const hidden = g.hiddenFor('a');
    expect(hidden).toHaveLength(2);
    expect(hidden).not.toContain(2);
    expect(g.hiddenFor('b')).toEqual(hidden);
    expect(g.hiddenFor('c')).toEqual([]);
    expect(g.useLifeline('a', 'fifty', q)).toEqual({ ok: false, error: 'NOT_ALLOWED' });

    g.settle(answers({ a: 2, b: 2, c: 2 }), 2, everyone);
    g.nextRung();
    expect(g.hiddenFor('a')).toEqual([]);
    expect(g.useLifeline('a', 'fifty', q)).toEqual({ ok: false, error: 'NOT_ALLOWED' }); // used up
  });

  it('asks the audience only once someone is off the ladder, counting just their answers', () => {
    const g = new LadderGame(['a', 'b', 'c'], seededRng());
    g.nextRung();
    const q = { answered: false, correct: 0, choices: 4, players: ['a', 'b', 'c'] };
    expect(g.useLifeline('a', 'audience', q)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    g.settle(answers({ a: 0, b: 0, c: 3 }), 0, everyone); // c falls: now the audience

    g.nextRung();
    expect(g.useLifeline('a', 'audience', q)).toEqual({ ok: true });
    const live = answers({ b: 1, c: 2 });
    expect(g.help('a', live, 4)?.audience).toEqual([0, 0, 1, 0]);
    expect(g.help('b', live, 4)?.audience).toBeNull();
  });

  it('phones a friend, whose pick shows once they have made it', () => {
    const g = new LadderGame(['a', 'b', 'c'], seededRng());
    g.nextRung();
    const q = { answered: false, correct: 0, choices: 4, players: ['a', 'b', 'c'] };
    expect(g.useLifeline('a', 'phone', { ...q, friendId: 'a' })).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(g.useLifeline('a', 'phone', { ...q, friendId: 'x' })).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(g.useLifeline('a', 'phone', { ...q, friendId: 'b' })).toEqual({ ok: true });
    expect(g.help('a', answers({}), 4)?.friend).toEqual({ playerId: 'b', choice: null });
    expect(g.help('a', answers({ b: 3 }), 4)?.friend).toEqual({ playerId: 'b', choice: 3 });
  });

  it('refuses help after answering, or off the ladder', () => {
    const g = new LadderGame(['a', 'b', 'c'], seededRng());
    g.nextRung();
    g.settle(answers({ a: 0, b: 0, c: 1 }), 0, everyone);
    g.nextRung();
    const q = { answered: true, correct: 0, choices: 4, players: ['a', 'b', 'c'] };
    expect(g.useLifeline('a', 'fifty', q)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(g.useLifeline('c', 'fifty', { ...q, answered: false })).toEqual({ ok: false, error: 'NOT_ALLOWED' });
  });
});
