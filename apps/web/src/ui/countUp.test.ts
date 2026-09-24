import { describe, expect, it } from 'vitest';
import { countUpValue } from './countUp.ts';

describe('countUpValue', () => {
  it('starts at from, ends exactly at to, and eases out in between', () => {
    expect(countUpValue(1000, 2000, -50, 900)).toBe(1000);
    expect(countUpValue(1000, 2000, 900, 900)).toBe(2000);
    expect(countUpValue(1000, 2000, 5000, 900)).toBe(2000);
    const half = countUpValue(1000, 2000, 450, 900);
    expect(half).toBeGreaterThan(1500); // ease-out: past halfway at half time
    expect(half).toBeLessThan(2000);
  });
});
