import { useEffect, useState } from 'react';

export interface SpinStep {
  index: number;
  /** Milliseconds after the spin starts. */
  at: number;
}

/**
 * A slot-machine run over `count` cards that slows down and lands on
 * `chosen`: each step lights the next card, with growing gaps.
 */
export function spinSequence(chosen: number, count: number, steps = 11, totalMs = 1_150): SpinStep[] {
  // Gaps grow quadratically; scale them so the last step lands at totalMs.
  const gaps = Array.from({ length: steps }, (_, i) => 1 + (i / (steps - 1)) ** 2 * 5);
  const scale = totalMs / gaps.reduce((a, b) => a + b, 0);
  const start = (((chosen - (steps - 1)) % count) + count) % count;
  let at = 0;
  return gaps.map((gap, i) => {
    at += gap * scale;
    return { index: (start + i) % count, at: Math.round(at) };
  });
}

/** spinSequence over only the cards in `pool` (a tie's leaders), landing on `chosen`. */
export function spinAmong(chosen: number, pool: readonly number[]): SpinStep[] {
  return spinSequence(Math.max(0, pool.indexOf(chosen)), pool.length).map((s) => ({ ...s, index: pool[s.index]! }));
}

/**
 * Runs the spin while `active`; returns the lit card and whether it landed.
 * `among` limits it to some cards (default all). `onStep` fires per step
 * (for a tick sound), `onLand` once at the end.
 */
export function useSlotSpin(
  active: boolean,
  chosen: number,
  count: number,
  {
    instant = false,
    among,
    onStep,
    onLand,
  }: { instant?: boolean; among?: readonly number[]; onStep?: () => void; onLand?: () => void } = {},
): { lit: number | null; landed: boolean } {
  const pool = among ?? Array.from({ length: count }, (_, i) => i);
  const poolKey = pool.join(',');
  const [lit, setLit] = useState<number | null>(null);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!active) {
      setLit(null);
      setLanded(false);
      return;
    }
    if (instant) {
      setLit(chosen);
      setLanded(true);
      return;
    }
    const seq = spinAmong(chosen, pool);
    const timers = seq.map((step, i) =>
      setTimeout(() => {
        setLit(step.index);
        if (i === seq.length - 1) {
          setLanded(true);
          onLand?.();
        } else onStep?.();
      }, step.at),
    );
    return () => timers.forEach(clearTimeout);
  }, [active, chosen, poolKey, instant]); // callbacks are fire-and-forget; not dependencies
  return { lit, landed };
}

/** The options sharing the most votes, when two or more do and anyone voted; otherwise null. */
export function tiedLeaders(votes: Record<string, number>, count: number): number[] | null {
  const tally = Array.from({ length: count }, () => 0);
  for (const v of Object.values(votes)) if (v >= 0 && v < count) tally[v]! += 1;
  const best = Math.max(...tally);
  const leaders = tally.flatMap((n, i) => (n === best ? [i] : []));
  return best > 0 && leaders.length > 1 ? leaders : null;
}
