// Measures how smoothly the TV renders the studio. On weak smart-TV browsers
// we fall back to the flat, low-motion screens automatically.

export const MIN_FPS = 40;
export const SAMPLE_MS = 3_000;

/** Average frames per second from requestAnimationFrame timestamps. */
export function averageFps(timestamps: number[]): number {
  if (timestamps.length < 2) return 0;
  const span = timestamps[timestamps.length - 1]! - timestamps[0]!;
  return span > 0 ? ((timestamps.length - 1) * 1000) / span : 0;
}

/**
 * Samples frame timing for SAMPLE_MS and resolves with the average fps.
 * Tests can force a value with `window.__fakeFps`.
 */
export function measureFps(): { result: Promise<number>; cancel: () => void } {
  const fake = (window as unknown as { __fakeFps?: number }).__fakeFps;
  if (typeof fake === 'number') return { result: Promise.resolve(fake), cancel: () => {} };
  let frame = 0;
  let cancelled = false;
  const stamps: number[] = [];
  const result = new Promise<number>((resolve) => {
    const tick = (now: number) => {
      if (cancelled) return;
      stamps.push(now);
      if (now - stamps[0]! >= SAMPLE_MS) resolve(averageFps(stamps));
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  });
  return {
    result,
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    },
  };
}
