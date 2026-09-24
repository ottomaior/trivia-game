import { useEffect, useState } from 'react';
import { useLowFx } from './lowfx.ts';

/** Value shown `elapsed` ms into a count from `from` to `to` (ease-out cubic). */
export function countUpValue(from: number, to: number, elapsed: number, ms: number): number {
  if (elapsed <= 0) return from;
  if (elapsed >= ms) return to;
  const t = elapsed / ms;
  return Math.round(from + (to - from) * (1 - (1 - t) ** 3));
}

/** Animates a number from `from` to `to` after `delayMs`; jumps straight there in low-motion mode. */
export function useCountUp(to: number, from: number, ms = 900, delayMs = 0): number {
  const lowFx = useLowFx();
  const [value, setValue] = useState(lowFx ? to : from);
  useEffect(() => {
    if (lowFx || from === to) {
      setValue(to);
      return;
    }
    const start = performance.now() + delayMs;
    let frame = 0;
    const step = (now: number) => {
      setValue(countUpValue(from, to, now - start, ms));
      if (now - start < ms) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [from, to, ms, delayMs, lowFx]);
  return value;
}
