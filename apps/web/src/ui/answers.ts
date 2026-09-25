export const LETTERS = ['A', 'B', 'C', 'D'] as const;

/** Tile colors A–D, and the text color that reads on each. */
export const TILE = [
  { bg: 'var(--answer-a)', fg: 'var(--cream)' },
  { bg: 'var(--answer-b)', fg: 'var(--cream)' },
  { bg: 'var(--answer-c)', fg: 'var(--cream)' },
  { bg: 'var(--answer-d)', fg: 'var(--burgundy)' },
] as const;

/** Colors for longer option lists (Blöffölő, Időrend): the four answer colors, then four more. */
export const OPTION_TILE = [
  ...TILE,
  { bg: 'var(--ice)', fg: 'var(--burgundy)' },
  { bg: 'var(--cream)', fg: 'var(--burgundy)' },
  { bg: 'var(--slime-deep)', fg: 'var(--cream)' },
  { bg: 'var(--burgundy-deep)', fg: 'var(--cream)' },
] as const;

/** The tile for option `i` of a long list; colors repeat after eight. */
export function optionTile(i: number): (typeof OPTION_TILE)[number] {
  return OPTION_TILE[i % OPTION_TILE.length]!;
}

/** Option letters beyond D: A, B, … Z. */
export function letterOf(i: number): string {
  return String.fromCharCode(65 + (i % 26));
}
