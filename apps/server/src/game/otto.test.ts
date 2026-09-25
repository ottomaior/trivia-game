import { allOttoLines, ottoMaxChars, ottoText, ottoVariants, type OttoLineKey } from '@trivia/shared';
import { describe, expect, it } from 'vitest';
import { seededRng } from '../testing.ts';
import {
  bluffRevealLine,
  finalLine,
  guessRevealLine,
  ladderRevealLine,
  ladderStepLine,
  LinePicker,
  powerLine,
  revealLine,
  scoreboardLine,
  timelineRevealLine,
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

describe('ladder lines', () => {
  it('marks the first rung, the safe rungs and the last one before they are played', () => {
    const pick = new LinePicker(seededRng());
    expect(ladderStepLine(1, pick)?.key).toBe('ladderFirst');
    expect(ladderStepLine(2, pick)).toBeNull();
    expect(ladderStepLine(5, pick)?.key).toBe('ladderSafeAhead');
    expect(ladderStepLine(10, pick)?.key).toBe('ladderSafeAhead');
    expect(ladderStepLine(15, pick)?.key).toBe('ladderLastRung');
  });

  it('reacts to falls first, then to safe rungs and the top', () => {
    const pick = new LinePicker(seededRng());
    const up = (id: string) => ({ playerId: id, correct: true, status: 'in' as const });
    const down = (id: string) => ({ playerId: id, correct: false, status: 'out' as const });
    expect(ladderRevealLine([up('a'), down('b')], 7, pick)).toMatchObject({ key: 'ladderFell', focus: ['b'] });
    expect(ladderRevealLine([down('a'), down('b')], 7, pick)?.key).toBe('ladderAllFell');
    expect(ladderRevealLine([up('a'), up('b')], 5, pick)?.key).toBe('ladderSafe');
    expect(ladderRevealLine([up('a')], 7, pick)).toBeNull(); // a plain climb: Otto stays quiet
    expect(ladderRevealLine([{ playerId: 'a', correct: true, status: 'top' }, down('b')], 15, pick)).toMatchObject({
      key: 'ladderTop',
      focus: ['a'],
    });
    // A phone that dropped walked away quietly: nothing to say.
    expect(ladderRevealLine([{ playerId: 'a', correct: false, status: 'walked' }], 7, pick)).toBeNull();
  });
});

describe('party-mode lines', () => {
  const opt = (truth: boolean, authors: string[], pickers: string[]) => ({ truth, authors, pickers });

  it('Blöffölő: a lie several fell for always, nobody finding the truth always, the rest only after a quiet round', () => {
    const pick = new LinePicker(seededRng());
    expect(bluffRevealLine([opt(true, [], []), opt(false, ['a'], ['b', 'c'])], 3, pick, false)).toMatchObject({ key: 'bluffBigLie', focus: ['a'] });
    expect(bluffRevealLine([opt(true, [], []), opt(false, ['a'], ['b']), opt(false, [], ['a'])], 2, pick, false)?.key).toBe('bluffAllFooled');
    const allTruth = [opt(true, [], ['a', 'b', 'c']), opt(false, ['a'], [])];
    expect(bluffRevealLine(allTruth, 3, pick, false)).toBeNull();
    expect(bluffRevealLine(allTruth, 3, pick, true)?.key).toBe('bluffAllTruth');
    expect(bluffRevealLine([opt(true, [], ['a']), opt(false, [], ['b'])], 2, pick, true)?.key).toBe('bluffNobodyFooled');
    expect(bluffRevealLine([opt(true, [], []), opt(false, [], ['a'])], 1, pick, true)).toBeNull(); // solo: quiet
  });

  it('Időrend: all perfect or a lone perfect order always, chaos only after a quiet round', () => {
    const pick = new LinePicker(seededRng());
    const o = (playerId: string, rightSlots: number) => ({ playerId, order: [0, 1, 2, 3, 4], rightSlots, allRight: rightSlots === 5 });
    expect(timelineRevealLine([o('a', 5), o('b', 5)], pick, false)?.key).toBe('timelineAllPerfect');
    expect(timelineRevealLine([o('a', 5), o('b', 2)], pick, false)).toMatchObject({ key: 'timelinePerfect', focus: ['a'] });
    expect(timelineRevealLine([o('a', 1), o('b', 0)], pick, false)).toBeNull();
    expect(timelineRevealLine([o('a', 1), o('b', 0)], pick, true)?.key).toBe('timelineChaos');
    expect(timelineRevealLine([o('a', 5)], pick, false)).toBeNull();
  });

  it('Tippelj!: a spot-on guess always, winning chips or wild guesses after a quiet round', () => {
    const pick = new LinePicker(seededRng());
    const out = (playerId: string, closest: boolean, exact = false, chipsOnClosest = 0) => ({ playerId, closest, exact, chipsOnClosest });
    const result = (distances: number[]) => ({ answer: 100, guesses: distances.map((distance, i) => ({ playerId: `p${i}`, distance })) });
    expect(guessRevealLine(result([0, 40]), [out('a', true, true), out('b', false)], pick, false)).toMatchObject({ key: 'guessExact', focus: ['a'] });
    expect(guessRevealLine(result([5, 40]), [out('a', true), out('b', false, false, 2)], pick, false)).toBeNull();
    expect(guessRevealLine(result([5, 40]), [out('a', true), out('b', false, false, 2)], pick, true)).toMatchObject({ key: 'guessBetsWin', focus: ['b'] });
    expect(guessRevealLine(result([60, 80]), [out('a', true), out('b', false)], pick, true)?.key).toBe('guessWayOff');
    expect(guessRevealLine(result([20, 80]), [out('a', true), out('b', false)], pick, true)).toBeNull();
  });
});
