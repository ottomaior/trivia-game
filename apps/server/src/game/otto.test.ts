import { allOttoLines, ottoText, ottoVariants } from '@trivia/shared';
import { describe, expect, it } from 'vitest';
import { seededRng } from '../testing.ts';
import {
  categoryLine,
  finalLine,
  LinePicker,
  revealLine,
  scoreboardLine,
  voteLine,
  welcomeLine,
  type RevealFact,
  type StandingFact,
} from './otto.ts';

const rng = new LinePicker(seededRng(11));
const fact = (id: string, correct: boolean, responseMs: number | null = 5_000, streak = correct ? 1 : 0): RevealFact => ({
  id,
  correct,
  responseMs,
  streak,
});
const st = (id: string, score: number, rank: number, prevRank = rank): StandingFact => ({ id, score, rank, prevRank });

describe('revealLine', () => {
  it('prefers a streak over everyone being right, and focuses on the streaker', () => {
    const l = revealLine([fact('anna', true, 5_000, 3), fact('bela', true)], 0, rng);
    expect(l).toMatchObject({ key: 'streak', focus: ['anna'] });
  });

  it('notices nobody being right twice in a row', () => {
    expect(revealLine([fact('A', false), fact('B', false)], 1, rng).key).toBe('noneCorrect');
    expect(revealLine([fact('A', false), fact('B', false)], 2, rng).key).toBe('noneCorrectAgain');
  });

  it('calls out a lightning-fast answer', () => {
    expect(revealLine([fact('A', true, 1_200), fact('B', false)], 0, rng)).toMatchObject({ key: 'lightning', focus: ['A'] });
  });

  it('otherwise points at the fastest, or at everyone who was right', () => {
    const l = revealLine([fact('A', true, 8_000), fact('B', true, 6_000), fact('C', false)], 0, rng);
    if (l.key === 'fastest') expect(l.focus).toEqual(['B']);
    else expect(l).toMatchObject({ key: 'someCorrect', focus: ['A', 'B'] });
  });

  it('singles out the only one who knew it, given a crowd', () => {
    expect(revealLine([fact('A', true), fact('B', false), fact('C', false)], 0, rng)).toMatchObject({ key: 'onlyOne', focus: ['A'] });
    expect(revealLine([fact('A', true), fact('B', false)], 0, rng).key).not.toBe('onlyOne');
  });

  it('uses solo wording for one player', () => {
    expect(revealLine([fact('A', true, 500, 5)], 0, rng).key).toBe('soloCorrect');
    expect(revealLine([fact('A', false)], 3, rng).key).toBe('soloWrong');
  });
});

describe('scoreboardLine', () => {
  it('announces a new leader first', () => {
    expect(scoreboardLine([st('B', 1500, 1, 2), st('A', 1400, 2, 1)], 3, rng)).toMatchObject({ key: 'newLeader', focus: ['B'] });
  });

  it('spots a comeback of two or more places', () => {
    const l = scoreboardLine([st('A', 5000, 1), st('C', 3000, 2, 4), st('B', 2900, 3, 2), st('D', 100, 4, 3)], 5, rng);
    expect(l).toMatchObject({ key: 'comeback', focus: ['C'] });
  });

  it('calls a blowout and a close race', () => {
    expect(scoreboardLine([st('A', 6000, 1), st('B', 3000, 2)], 5, rng)).toMatchObject({ key: 'blowout', focus: ['A'] });
    expect(scoreboardLine([st('A', 3100, 1), st('B', 3000, 2)], 5, rng)).toMatchObject({ key: 'closeRace', focus: ['A', 'B'] });
  });

  it('cheers on a solo player', () => {
    expect(scoreboardLine([st('A', 2950, 1)], 3, rng)).toMatchObject({ key: 'soloScore', focus: ['A'] });
  });
});

describe('other lines', () => {
  it('marks the first, halfway and last rounds, and greets solo players differently', () => {
    expect(voteLine(1, 10, rng).key).toBe('firstRound');
    expect(voteLine(3, 10, rng).key).toBe('pickCategory');
    expect(voteLine(6, 10, rng).key).toBe('halfway');
    expect(voteLine(10, 10, rng).key).toBe('lastRound');
    expect(welcomeLine(1, rng).key).toBe('welcomeSolo');
    expect(welcomeLine(4, rng).key).toBe('welcome');
  });

  it('crowns a winner, a tie, or rates a solo game', () => {
    expect(finalLine([st('A', 9000, 1), st('B', 5000, 2)], rng)).toMatchObject({ key: 'winner', focus: ['A'] });
    expect(finalLine([st('A', 5000, 1), st('B', 5000, 1)], rng)).toMatchObject({ key: 'tie', focus: ['A', 'B'] });
    expect(finalLine([st('A', 9000, 1)], rng)?.key).toBe('soloFinalHigh');
    expect(finalLine([st('A', 2000, 1)], rng)?.key).toBe('soloFinalLow');
  });
});

describe('categoryLine', () => {
  it('reacts to each known category and falls back for new ones', () => {
    expect(categoryLine('zene', rng).key).toBe('catZene');
    expect(categoryLine('magyarorszag', rng).key).toBe('catMagyarorszag');
    expect(categoryLine('csillagaszat', rng).key).toBe('categoryPicked');
  });
});

describe('LinePicker', () => {
  it('says every variant once before repeating, never twice in a row', () => {
    const pick = new LinePicker(seededRng(3));
    const n = ottoVariants('standings');
    const said = Array.from({ length: n * 6 }, () => pick.next('standings'));
    for (let i = 0; i < said.length; i += n) expect(new Set(said.slice(i, i + n)).size).toBe(n);
    for (let i = 1; i < said.length; i++) expect(said[i]).not.toBe(said[i - 1]);
  });
});

describe('voiceable lines', () => {
  it('have no placeholders, names or digits, and at least two variants where it matters', () => {
    const lines = allOttoLines();
    for (const { id, text } of lines) {
      expect(text, id).not.toMatch(/[{}0-9]/);
      expect(text.length, id).toBeGreaterThan(3);
    }
    expect(new Set(lines.map((l) => l.id)).size).toBe(lines.length);
    expect(ottoText({ key: 'winner', variant: 0 })).toBe('És a bajnok nem más, mint…');
  });
});
