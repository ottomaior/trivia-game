// The paper drawings are generated as SVGs by apps/motion/art and rendered to
// WebP bitmaps by scripts/art.mjs at build time, so the browser never runs
// their filters. `__ART_VERSION__` (vite.config.ts) changes whenever any
// drawing does, and the server caches the bitmaps for a year.

/** URL of a paper drawing, by its file name without extension (`gomboc-correct`, `otto-head`). */
export function art(name: string): string {
  return `/art/${name}.webp?v=${__ART_VERSION__}`;
}
