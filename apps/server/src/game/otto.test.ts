import { ottoText } from '@trivia/shared';
import { describe, expect, it } from 'vitest';
import { seededRng } from '../testing.ts';
import { finalLine, revealLine, scoreboardLine, voteLine, welcomeLine, type RevealFact, type StandingFact } from './otto.ts';

const rng = seededRng(11);
const fact = (name: string, correct: boolean, responseMs: number | null = 5_000, streak = correct ? 1 : 0): RevealFact => ({
  name,
  correct,
  responseMs,
  streak,
});
const st = (name: string, score: number, rank: number, prevRank = rank): StandingFact => ({ name, score, rank, prevRank });

describe('revealLine', () => {
  it('prefers a streak over everyone being right', () => {
    const l = revealLine([fact('Anna', true, 5_000, 3), fact('Béla', true)], 0, rng);
    expect(l).toMatchObject({ key: 'streak', vars: { name: 'Anna', n: '3' } });
    expect(ottoText(l)).toMatch(/Anna/);
  });

  it('notices nobody being right twice in a row', () => {
    expect(revealLine([fact('A', false), fact('B', false)], 1, rng).key).toBe('noneCorrect');
    expect(revealLine([fact('A', false), fact('B', false)], 2, rng).key).toBe('noneCorrectAgain');
  });

  it('calls out a lightning-fast answer', () => {
    expect(revealLine([fact('A', true, 1_200), fact('B', false)], 0, rng)).toMatchObject({ key: 'lightning', vars: { name: 'A' } });
  });

  it('otherwise names the fastest or comments generally', () => {
    const key = revealLine([fact('A', true, 8_000), fact('B', true, 6_000), fact('C', false)], 0, rng).key;
    expect(['fastest', 'someCorrect']).toContain(key);
  });

  it('uses solo wording for one player', () => {
    expect(revealLine([fact('A', true, 500, 5)], 0, rng).key).toBe('soloCorrect');
    expect(revealLine([fact('A', false)], 3, rng).key).toBe('soloWrong');
  });
});

describe('scoreboardLine', () => {
  it('announces a new leader first', () => {
    expect(scoreboardLine([st('B', 1500, 1, 2), st('A', 1400, 2, 1)], 3, rng)).toMatchObject({ key: 'newLeader', vars: { name: 'B' } });
  });

  it('spots a comeback of two or more places', () => {
    const l = scoreboardLine([st('A', 5000, 1), st('C', 3000, 2, 4), st('B', 2900, 3, 2), st('D', 100, 4, 3)], 5, rng);
    expect(l).toMatchObject({ key: 'comeback', vars: { name: 'C' } });
  });

  it('calls a blowout and a close race', () => {
    expect(scoreboardLine([st('A', 6000, 1), st('B', 3000, 2)], 5, rng).key).toBe('blowout');
    expect(scoreboardLine([st('A', 3100, 1), st('B', 3000, 2)], 5, rng)).toMatchObject({ key: 'closeRace', vars: { a: 'A', b: 'B' } });
  });

  it('reports a solo score', () => {
    expect(scoreboardLine([st('A', 2950, 1)], 3, rng)).toMatchObject({ key: 'soloScore', vars: { score: '2950' } });
  });
});

describe('other lines', () => {
  it('flags the last round and greets solo players differently', () => {
    expect(voteLine(10, 10, rng).key).toBe('lastRound');
    expect(voteLine(3, 10, rng).key).toBe('pickCategory');
    expect(welcomeLine(1, rng).key).toBe('welcomeSolo');
    expect(welcomeLine(4, rng)).toMatchObject({ key: 'welcome', vars: { n: '4' } });
  });

  it('crowns a winner, a tie, or rates a solo game', () => {
    expect(finalLine([st('A', 9000, 1), st('B', 5000, 2)], rng)).toMatchObject({ key: 'winner', vars: { name: 'A' } });
    expect(finalLine([st('A', 5000, 1), st('B', 5000, 1)], rng)).toMatchObject({ key: 'tie', vars: { name: 'A és B' } });
    expect(finalLine([st('A', 9000, 1)], rng)?.key).toBe('soloFinalHigh');
    expect(finalLine([st('A', 2000, 1)], rng)?.key).toBe('soloFinalLow');
  });
});
