import { allOttoLines, ottoMaxChars, ottoText, ottoVariants, type OttoLineKey } from '@trivia/shared';
import { describe, expect, it } from 'vitest';
import { seededRng } from '../testing.ts';
import {
  finalLine,
  LinePicker,
  powerLine,
  revealLine,
  scoreboardLine,
  voteLine,
  welcomeLine,
  type RevealFact,
  type ScoreboardContext,
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
const board = (extra: Partial<ScoreboardContext> = {}): ScoreboardContext => ({
  round: 5,
  totalRounds: 10,
  spokeThisRound: false,
  quietBefore: true,
  blowoutCalled: false,
  ...extra,
});

describe('revealLine', () => {
  it('always calls out a streak (at three, then every other one), focusing on the streaker', () => {
    expect(revealLine([fact('anna', true, 5_000, 3), fact('bela', true)], 0, rng, false)).toMatchObject({
      key: 'streak',
      focus: ['anna'],
    });
    expect(revealLine([fact('anna', true, 5_000, 4), fact('bela', false)], 0, rng, false)).toBeNull();
    expect(revealLine([fact('anna', true, 5_000, 5), fact('bela', false)], 0, rng, false)?.key).toBe('streak');
  });

  it('notices nobody being right, and always the second time in a row', () => {
    expect(revealLine([fact('A', false), fact('B', false)], 1, rng)?.key).toBe('noneCorrect');
    expect(revealLine([fact('A', false), fact('B', false)], 1, rng, false)).toBeNull();
    expect(revealLine([fact('A', false), fact('B', false)], 2, rng, false)?.key).toBe('noneCorrectAgain');
    expect(revealLine([fact('A', false), fact('B', false)], 3, rng)).toBeNull();
  });

  it('singles out the only one who knew it, given a crowd', () => {
    const facts = [fact('A', true), fact('B', false), fact('C', false)];
    expect(revealLine(facts, 0, rng, false)).toMatchObject({ key: 'onlyOne', focus: ['A'] });
  });

  it('mentions small moments only after a quiet round', () => {
    const everyone = [fact('A', true), fact('B', true), fact('C', true)];
    expect(revealLine(everyone, 0, rng)?.key).toBe('allCorrect');
    expect(revealLine(everyone, 0, rng, false)).toBeNull();
    const quick = [fact('A', true, 1_200), fact('B', false)];
    expect(revealLine(quick, 0, rng)).toMatchObject({ key: 'lightning', focus: ['A'] });
    expect(revealLine(quick, 0, rng, false)).toBeNull();
  });

  it('stays quiet about an ordinary round', () => {
    expect(revealLine([fact('A', true), fact('B', false)], 0, rng)).toBeNull();
    expect(revealLine([fact('A', true), fact('B', true)], 0, rng)).toBeNull(); // two right of two is no news
  });

  it('comments on a solo player sparingly', () => {
    expect(revealLine([fact('A', true)], 0, rng)).toBeNull();
    expect(revealLine([fact('A', true, 5_000, 3)], 0, rng, false)?.key).toBe('soloCorrect');
    expect(revealLine([fact('A', false)], 1, rng)).toBeNull();
    expect(revealLine([fact('A', false)], 2, rng, false)?.key).toBe('soloWrong');
  });
});

describe('scoreboardLine', () => {
  it('announces a new leader or a comeback, even right after another comment', () => {
    expect(scoreboardLine([st('B', 900, 1, 2), st('A', 500, 2, 1)], board({ quietBefore: false }), rng)).toMatchObject({
      key: 'newLeader',
      focus: ['B'],
    });
    const climb = [st('A', 3000, 1), st('C', 2000, 2, 4), st('B', 1500, 3, 2), st('D', 900, 4, 3)];
    expect(scoreboardLine(climb, board({ quietBefore: false }), rng)).toMatchObject({ key: 'comeback', focus: ['C'] });
  });

  it('never talks twice in a round', () => {
    expect(scoreboardLine([st('B', 900, 1, 2), st('A', 500, 2, 1)], board({ spokeThisRound: true }), rng)).toBeNull();
  });

  it('calls a blowout once a game, and a close race only near the end', () => {
    const far = [st('A', 5000, 1), st('B', 1000, 2)];
    expect(scoreboardLine(far, board(), rng)?.key).toBe('blowout');
    expect(scoreboardLine(far, board({ blowoutCalled: true }), rng)).toBeNull();
    const close = [st('A', 3100, 1), st('B', 3000, 2)];
    expect(scoreboardLine(close, board({ round: 4 }), rng)).toBeNull();
    expect(scoreboardLine(close, board({ round: 8 }), rng)?.key).toBe('closeRace');
  });

  it('leaves a solo player alone', () => {
    expect(scoreboardLine([st('A', 3000, 1)], board(), rng)).toBeNull();
  });
});

describe('other lines', () => {
  it('greets solo players differently', () => {
    expect(welcomeLine(1, rng).key).toBe('welcomeSolo');
    expect(welcomeLine(4, rng).key).toBe('welcome');
  });

  it('only speaks in the vote for the double-points finale and to explain power plays', () => {
    expect(voteLine(1, 10, rng)).toBeNull();
    expect(voteLine(6, 10, rng)).toBeNull();
    expect(voteLine(2, 10, rng, true)?.key).toBe('powerGranted');
    expect(voteLine(10, 10, rng, true)?.key).toBe('lastRound');
  });

  it('crowns a winner, a tie, or rates a solo game', () => {
    expect(finalLine([st('A', 9000, 1), st('B', 5000, 2)], rng)).toMatchObject({ key: 'winner', focus: ['A'] });
    expect(finalLine([st('A', 5000, 1), st('B', 5000, 1)], rng)).toMatchObject({ key: 'tie', focus: ['A', 'B'] });
    expect(finalLine([st('A', 9000, 1)], rng)?.key).toBe('soloFinalHigh');
    expect(finalLine([st('A', 2000, 1)], rng)?.key).toBe('soloFinalLow');
  });
});

describe('powerLine', () => {
  const hit = (by: string, target: string, power: 'freeze' | 'slime' = 'freeze') => ({ by, target, power, cleared: false });

  it('names the kind of a single hit', () => {
    expect(powerLine([hit('A', 'B')], rng)).toMatchObject({ key: 'powerFreeze', focus: ['B'] });
    expect(powerLine([hit('A', 'B', 'slime')], rng)).toMatchObject({ key: 'powerSlime', focus: ['B'] });
  });

  it('notices a gang-up before a plain free-for-all', () => {
    expect(powerLine([hit('A', 'C'), hit('B', 'C', 'slime')], rng)).toMatchObject({ key: 'powerGangUp', focus: ['C'] });
    expect(powerLine([hit('A', 'B'), hit('B', 'A')], rng)).toMatchObject({ key: 'powerMany', focus: ['B', 'A'] });
  });

  it('lets ordinary hits pass without a word right after another comment, but never a gang-up', () => {
    expect(powerLine([hit('A', 'B')], rng, false)).toBeNull();
    expect(powerLine([hit('A', 'C'), hit('B', 'C')], rng, false)?.key).toBe('powerGangUp');
  });
});

describe('LinePicker', () => {
  it('says every variant once before repeating, never twice in a row', () => {
    const pick = new LinePicker(seededRng(3));
    const n = ottoVariants('allCorrect');
    const said = Array.from({ length: n * 6 }, () => pick.next('allCorrect'));
    for (let i = 0; i < said.length; i += n) expect(new Set(said.slice(i, i + n)).size).toBe(n);
    for (let i = 1; i < said.length; i++) expect(said[i]).not.toBe(said[i - 1]);
  });
});

describe('voiceable lines', () => {
  it('have no placeholders, names or digits, and a cue on every line', () => {
    const lines = allOttoLines();
    for (const { id, text } of lines) {
      expect(text, id).not.toMatch(/[{}0-9]/);
      expect(text, id).toMatch(/^\[[^\]]+\] /);
    }
    expect(new Set(lines.map((l) => l.id)).size).toBe(lines.length);
    expect(ottoText({ key: 'winner', variant: 0 })).toBe('És a bajnok nem más, mint…');
  });

  it('stay within their length budget, so Otto never rambles', () => {
    for (const { id } of allOttoLines()) {
      const key = id.replace(/-\d+$/, '') as OttoLineKey;
      if (key === 'paused') continue; // shown on screen only, never spoken
      const variant = Number(id.slice(key.length + 1));
      expect(ottoText({ key, variant }).length, id).toBeLessThanOrEqual(ottoMaxChars(key));
    }
  });
});
