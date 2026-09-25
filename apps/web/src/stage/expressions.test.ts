import type { HostView, Pick, RevealResult, Stage } from '@trivia/shared';
import { describe, expect, it } from 'vitest';
import { heldExpression, revealExpression } from './expressions.ts';

const player = (id: string) => ({ id, name: id, avatar: { character: 'bab' as const }, connected: true, isVip: false, score: 0, hasPower: false });

function view(stage: Stage, extra: Partial<HostView> = {}): HostView {
  return {
    role: 'host',
    roomCode: 'BCDF',
    stage,
    round: 2,
    totalRounds: 10,
    serverNow: 0,
    phaseEndsAt: null,
    paused: false,
    players: [player('a'), player('b'), player('c')],
    pack: null,
    mode: 'classic',
    ladder: null,
    otto: null,
    ...extra,
  };
}

const mc = { kind: 'mc' as const, id: 'q', category: 'Zene', difficulty: 1 as const, prompt: 'p', choices: ['a', 'b', 'c', 'd'], voice: 'v' };
const pick = (playerId: string, choice: number | null, correct: boolean, points = correct ? 900 : 0): Pick => ({ playerId, choice, correct, points, responseMs: 1000 });
const reveal = (picks: Pick[], result: RevealResult) => ({ phase: 'reveal' as const, question: mc, explanation: null, picks, result });

describe('revealExpression', () => {
  it('shows right and wrong answers, and no answer as wrong', () => {
    const stage = reveal([pick('a', 0, true), pick('b', 1, false), pick('c', null, false)], { kind: 'mc', correct: 0 });
    expect(revealExpression(stage, 'a')).toBe('correct');
    expect(revealExpression(stage, 'b')).toBe('wrong');
    expect(revealExpression(stage, 'c')).toBe('wrong');
    expect(revealExpression(stage, 'nobody')).toBeUndefined();
  });

  it('leaves a partly right answer alone', () => {
    const stage = reveal([pick('a', 0, false, 400)], { kind: 'timeline', order: [0, 1, 2, 3, 4], years: [1, 2, 3, 4, 5], orders: {} });
    expect(revealExpression(stage, 'a')).toBeUndefined();
  });

  it('Blöffölő: fooled beats sneaky, sneaky beats finding the truth', () => {
    const stage = reveal([pick('a', 0, false), pick('b', 1, true), pick('c', 2, false)], {
      kind: 'bluff',
      options: [
        { text: 'lie of b', truth: false, authors: ['b'], pickers: ['a'] },
        { text: 'truth', truth: true, authors: [], pickers: ['b'] },
        { text: 'lie of a', truth: false, authors: ['a'], pickers: ['c'] },
      ],
    });
    expect(revealExpression(stage, 'a')).toBe('fooled'); // fooled c too, but fell for b's lie
    expect(revealExpression(stage, 'b')).toBe('sneaky'); // found the truth and fooled a
    expect(revealExpression(stage, 'c')).toBe('fooled');
  });

  it('Blöffölő: finding the truth with nobody fooled is correct; a lie nobody picked is wrong', () => {
    const stage = reveal([pick('a', 1, true), pick('b', null, false)], {
      kind: 'bluff',
      options: [
        { text: 'lie of a', truth: false, authors: ['a'], pickers: [] },
        { text: 'truth', truth: true, authors: [], pickers: ['a'] },
      ],
    });
    expect(revealExpression(stage, 'a')).toBe('correct');
    expect(revealExpression(stage, 'b')).toBe('wrong');
  });
});

describe('heldExpression', () => {
  const open = (hits: { target: string; power: 'freeze' | 'slime'; cleared: boolean }[]): Stage => ({
    phase: 'question_open',
    question: mc,
    answered: [],
    hits: hits.map((h) => ({ by: 'x', ...h })),
  });

  it('shows a power play until it is cleared, slime before ice', () => {
    expect(heldExpression(view(open([{ target: 'a', power: 'freeze', cleared: false }])), 'a')).toBe('frozen');
    expect(heldExpression(view(open([{ target: 'a', power: 'freeze', cleared: true }])), 'a')).toBeUndefined();
    const both = open([
      { target: 'a', power: 'freeze', cleared: false },
      { target: 'a', power: 'slime', cleared: false },
    ]);
    expect(heldExpression(view(both), 'a')).toBe('slimed');
    expect(heldExpression(view(both), 'b')).toBeUndefined();
  });

  it('keeps a player who fell off the ladder looking out', () => {
    const ladder = {
      seats: [
        { playerId: 'a', status: 'out' as const, rung: 3, used: [] },
        { playerId: 'b', status: 'walked' as const, rung: 5, used: [] },
      ],
    };
    const v = view({ phase: 'scoreboard', standings: [] }, { mode: 'ladder', ladder });
    expect(heldExpression(v, 'a')).toBe('out');
    expect(heldExpression(v, 'b')).toBeUndefined();
  });
});
