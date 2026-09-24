import { describe, expect, it } from 'vitest';
import {
  difficultyForRound,
  isValidRoomCode,
  NAME_MAX_LENGTH,
  normalizeName,
  scoreAnswer,
} from './rules.ts';
import { ottoText } from './strings.ts';

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

describe('ottoText', () => {
  it('fills placeholders and wraps variants', () => {
    expect(ottoText({ key: 'winner', variant: 0, vars: { name: 'Győző' } })).toBe(
      'Győző nyeri a műsort! Meghajlás!',
    );
    expect(ottoText({ key: 'paused', variant: 5, vars: {} })).toBe('Rövid reklámszünet következik…');
  });
});
