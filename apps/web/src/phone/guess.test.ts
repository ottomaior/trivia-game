import { describe, expect, it } from 'vitest';
import { parseGuess } from './guess.ts';

describe('parseGuess', () => {
  it('reads Hungarian-style numbers', () => {
    expect(parseGuess('364')).toBe(364);
    expect(parseGuess(' 1 234 ')).toBe(1234);
    expect(parseGuess('1 234,5')).toBe(1234.5);
    expect(parseGuess('3,14')).toBe(3.14);
    expect(parseGuess('1.234.567')).toBe(1234567);
    expect(parseGuess('1.234,5')).toBe(1234.5);
    expect(parseGuess('-12')).toBe(-12);
  });

  it('still takes a decimal dot when it can’t be thousands', () => {
    expect(parseGuess('2.5')).toBe(2.5);
    expect(parseGuess('12.75')).toBe(12.75);
  });

  it('refuses what isn’t a number', () => {
    expect(parseGuess('')).toBeNull();
    expect(parseGuess('sok')).toBeNull();
    expect(parseGuess('12km')).toBeNull();
    expect(parseGuess('1,2,3')).toBeNull();
  });
});
