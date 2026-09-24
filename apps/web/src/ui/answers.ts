export const LETTERS = ['A', 'B', 'C', 'D'] as const;

/** Tile colors A–D, and the text color that reads on each. */
export const TILE = [
  { bg: 'var(--answer-a)', fg: 'var(--cream)' },
  { bg: 'var(--answer-b)', fg: 'var(--cream)' },
  { bg: 'var(--answer-c)', fg: 'var(--cream)' },
  { bg: 'var(--answer-d)', fg: 'var(--burgundy)' },
] as const;
