// Measures how smoothly the TV renders the studio. On weak smart-TV browsers
// we fall back to the lighter modes automatically (full → lite → flat).
//
// Two samples per mode and session: one while the studio idles (the lobby or
// a question), which also tells the browser's own frame-rate ceiling, and one
// in the first reveal, the busiest moment (sparks, points flying, faces
// changing, Ottó talking), judged against that ceiling.

export const MIN_FPS = 40;
export const SAMPLE_MS = 3_000;
/** A steady rate at or above this is taken for a display capped at 30 Hz, not a struggling page. */
export const CAP_FLOOR_FPS = 26;
/** Frames longer than this many typical frames count as stutter. */
const JANK_FACTOR = 2;

export type SampleKind = 'idle' | 'reveal';

export interface FpsSample {
  fps: number;
  /** Share of frames that took over twice the typical frame time: 0 is perfectly steady. */
  jank: number;
}

/** Average frames per second from requestAnimationFrame timestamps. */
export function averageFps(timestamps: number[]): number {
  if (timestamps.length < 2) return 0;
  const span = timestamps[timestamps.length - 1]! - timestamps[0]!;
  return span > 0 ? ((timestamps.length - 1) * 1000) / span : 0;
}

/** Share of frame intervals longer than twice the median one. */
export function jankShare(timestamps: number[]): number {
  if (timestamps.length < 3) return 0;
  const gaps = timestamps.slice(1).map((t, i) => t - timestamps[i]!);
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  return gaps.filter((g) => g > median * JANK_FACTOR).length / gaps.length;
}

export function analyse(timestamps: number[]): FpsSample {
  return { fps: averageFps(timestamps), jank: jankShare(timestamps) };
}

/**
 * Whether a sample means the current mode is too much for this TV. Without
 * `base` it is the idle sample itself: a low but steady rate then means a
 * capped display rather than an overloaded page. With `base` (the idle
 * sample), a busy sample is judged against that ceiling.
 */
export function tooSlow(sample: FpsSample, base?: FpsSample): boolean {
  const limit = base ? Math.min(MIN_FPS, base.fps * 0.8) : MIN_FPS;
  if (sample.fps >= limit) return false;
  if (!base && sample.fps >= CAP_FLOOR_FPS && sample.jank < 0.05) return false;
  return true;
}

type FakeFps = number | ((kind: SampleKind, mode: string) => number);

/**
 * Samples frame timing for SAMPLE_MS and resolves with the analysis.
 * Tests can force a rate with `window.__fakeFps` (a number, or a function of
 * the sample kind and mode); a forced rate under MIN_FPS counts as stutter.
 */
export function measureFps(kind: SampleKind = 'idle', mode = 'full'): { result: Promise<FpsSample>; cancel: () => void } {
  const fake = (window as unknown as { __fakeFps?: FakeFps }).__fakeFps;
  if (fake !== undefined) {
    const fps = typeof fake === 'function' ? fake(kind, mode) : fake;
    return { result: Promise.resolve({ fps, jank: fps < MIN_FPS ? 1 : 0 }), cancel: () => {} };
  }
  let frame = 0;
  let cancelled = false;
  const stamps: number[] = [];
  const result = new Promise<FpsSample>((resolve) => {
    const tick = (now: number) => {
      if (cancelled) return;
      stamps.push(now);
      if (now - stamps[0]! >= SAMPLE_MS) resolve(analyse(stamps));
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
