import { GUESS_CHIP_POINTS, GUESS_CLOSEST_POINTS, GUESS_EXACT_BONUS } from '@trivia/shared';
import { describe, expect, it } from 'vitest';
import type { NumberQuestion } from '../content/types.ts';
import { GuessGame } from './Guess.ts';

const question: NumberQuestion = {
  kind: 'number',
  id: 'n1',
  categoryId: 1,
  category: 'Budapest',
  difficulty: 2,
  prompt: 'Hány lépcsőfok vezet fel a Szent István-bazilika kupolájához?',
  answer: 364,
  unit: 'lépcsőfok',
  explanation: null,
};

function game() {
  const g = new GuessGame();
  g.startRound(question);
  return g;
}

describe('GuessGame', () => {
  it('takes one guess each and sorts them, equal values in arrival order', () => {
    const g = game();
    expect(g.submit('a', 500, 1000)).toEqual({ ok: true });
    expect(g.submit('a', 400, 1000)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(g.submit('b', Number.NaN, 1000)).toEqual({ ok: false, error: 'BAD_REQUEST' });
    g.submit('b', 200, 1000);
    g.submit('c', 500, 1000);
    expect(g.sortedGuesses()).toEqual([
      { playerId: 'b', value: 200 },
      { playerId: 'a', value: 500 },
      { playerId: 'c', value: 500 },
    ]);
  });

  it('only lets players who guessed bet, once, with both chips on real guesses', () => {
    const g = game();
    g.submit('a', 300, 1000);
    g.submit('b', 400, 1000);
    expect(g.bet('c', [0, 1])).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(g.bet('a', [0])).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(g.bet('a', [0, 2])).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(g.bet('a', [1, 1])).toEqual({ ok: true });
    expect(g.bet('a', [0, 0])).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(g.betted()).toEqual(['a']);
  });

  it('pays the closest guess (ties share), an exact hit extra, and every chip on a closest guess', () => {
    const g = game();
    g.submit('a', 354, 1000); // 10 off
    g.submit('b', 374, 1000); // 10 off: a tie
    g.submit('c', 100, 1000);
    g.bet('a', [0, 2]); // sorted: c 100, a 354, b 374 → one chip on c, one on b
    g.bet('c', [1, 1]);
    const s = g.settle(['a', 'b', 'c', 'd']);
    expect(s.closest.sort()).toEqual(['a', 'b']);
    const by = Object.fromEntries(s.outcomes.map((o) => [o.playerId, o]));
    expect(by.a).toMatchObject({ closest: true, exact: false, chipsOnClosest: 1, choice: 1, points: GUESS_CLOSEST_POINTS + GUESS_CHIP_POINTS });
    expect(by.b).toMatchObject({ closest: true, chipsOnClosest: 0, points: GUESS_CLOSEST_POINTS });
    expect(by.c).toMatchObject({ closest: false, chipsOnClosest: 2, points: 2 * GUESS_CHIP_POINTS });
    expect(by.d).toMatchObject({ choice: null, points: 0 });
    expect(s.guesses.map((x) => x.distance)).toEqual([264, 10, 10]);
  });

  it('adds the bonus for a spot-on guess', () => {
    const g = game();
    g.submit('a', 364, 1000);
    const [a] = g.settle(['a']).outcomes;
    expect(a).toMatchObject({ exact: true, points: GUESS_CLOSEST_POINTS + GUESS_EXACT_BONUS });
  });
});
