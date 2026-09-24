import { describe, expect, it } from 'vitest';
import { isValidRoomCode, normalizeName, NAME_MAX_LENGTH } from './rules.ts';

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
