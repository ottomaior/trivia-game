import { describe, expect, it } from 'vitest';
import {
  bluffRevealMs,
  closestGuesses,
  difficultyForRound,
  isInputPhase,
  questionKindFor,
  roundsFor,
  scoreBluff,
  scoreGuess,
  scoreTimeline,
  slotsRight,
  TIMINGS,
  isValidRoomCode,
  NAME_MAX_LENGTH,
  normalizeName,
  pointsMultiplier,
  scoreAnswer,
} from './rules.ts';
import { ottoText, ottoVoiceId } from './strings.ts';

describe('normalizeName', () => {
  it('trims, collapses whitespace and clamps length', () => {
    expect(normalizeName('  Otto   the   Great  ')).toBe('Otto the Gre');
    expect(normalizeName('x'.repeat(40))).toHaveLength(NAME_MAX_LENGTH);
  });

  it('keeps Hungarian characters', () => {
    expect(normalizeName('Győző')).toBe('Győző');
  });
});

describe('isValidRoomCode', () => {
  it('accepts consonant-only 4-letter codes', () => {
    expect(isValidRoomCode('BCDF')).toBe(true);
  });

  it('rejects vowels, wrong length and lowercase', () => {
    expect(isValidRoomCode('BACD')).toBe(false);
    expect(isValidRoomCode('BCD')).toBe(false);
    expect(isValidRoomCode('bcdf')).toBe(false);
  });
});

describe('scoreAnswer', () => {
  it('gives 1000 for an instant answer and 500 at the buzzer', () => {
    expect(scoreAnswer(true, 0, 20_000)).toBe(1000);
    expect(scoreAnswer(true, 20_000, 20_000)).toBe(500);
    expect(scoreAnswer(true, 10_000, 20_000)).toBe(750);
  });

  it('gives nothing for a wrong answer and clamps odd timings', () => {
    expect(scoreAnswer(false, 0, 20_000)).toBe(0);
    expect(scoreAnswer(true, -50, 20_000)).toBe(1000);
    expect(scoreAnswer(true, 99_999, 20_000)).toBe(500);
  });
});

describe('difficultyForRound', () => {
  it('ramps easy -> medium -> hard over 10 rounds', () => {
    const curve = Array.from({ length: 10 }, (_, i) => difficultyForRound(i + 1));
    expect(curve).toEqual([1, 1, 1, 2, 2, 2, 2, 3, 3, 3]);
  });
});

describe('pointsMultiplier', () => {
  it('doubles only the last round', () => {
    expect(pointsMultiplier(1, 10)).toBe(1);
    expect(pointsMultiplier(9, 10)).toBe(1);
    expect(pointsMultiplier(10, 10)).toBe(2);
  });
});

describe('ottoText', () => {
  it('picks the variant and wraps around', () => {
    expect(ottoText({ key: 'winner', variant: 1 })).toBe('Íme, a műsor győztese! Meghajlás!');
    expect(ottoText({ key: 'paused', variant: 3 })).toBe('Rövid reklámszünet következik…');
  });

  it('names voice clips after the key and wrapped variant', () => {
    expect(ottoVoiceId({ key: 'paused', variant: 3 })).toBe('paused-0');
  });
});

describe('party modes', () => {
  it('plays its own kind of question for its own number of rounds', () => {
    expect(questionKindFor('classic')).toBe('mc');
    expect(questionKindFor('ladder')).toBe('mc');
    expect(questionKindFor('bluff')).toBe('bluff');
    expect(questionKindFor('timeline')).toBe('timeline');
    expect(questionKindFor('guess')).toBe('number');
    expect(roundsFor('classic', 4)).toBe(4);
    expect(roundsFor('ladder')).toBe(15);
    expect(roundsFor('guess')).toBe(8);
  });

  it('knows which phases take input against the clock', () => {
    expect(isInputPhase('question_open')).toBe(true);
    expect(isInputPhase('guess_bet')).toBe(true);
    expect(isInputPhase('question_read')).toBe(false);
    expect(isInputPhase('reveal')).toBe(false);
  });

  it('scores Blöffölő and gives every extra option its moment in the reveal', () => {
    expect(scoreBluff(true, 0)).toBe(1000);
    expect(scoreBluff(false, 3)).toBe(1500);
    expect(scoreBluff(true, 2)).toBe(2000);
    expect(bluffRevealMs(3)).toBe(TIMINGS.bluffReveal);
    expect(bluffRevealMs(6)).toBe(TIMINGS.bluffReveal + 4_000);
  });

  it('scores Időrend per item, with a speed bonus only for a perfect order', () => {
    expect(slotsRight([2, 0, 1, 3, 4], [2, 1, 0, 3, 4])).toBe(3);
    expect(scoreTimeline(3, 5, 0, 10_000)).toBe(600);
    expect(scoreTimeline(5, 5, 0, 10_000)).toBe(1500);
    expect(scoreTimeline(5, 5, 10_000, 10_000)).toBe(1000);
  });

  it('scores Tippelj!: the closest guesses share, and chips pay', () => {
    expect(closestGuesses([{ playerId: 'a', value: 90 }, { playerId: 'b', value: 110 }, { playerId: 'c', value: 50 }], 100)).toEqual(['a', 'b']);
    expect(closestGuesses([], 100)).toEqual([]);
    expect(scoreGuess(true, true, 2)).toBe(2500);
    expect(scoreGuess(false, false, 1)).toBe(500);
  });
});
