import type { CSSProperties } from 'react';

/** Spoken names of the four answer shapes (for screen readers). */
export const SHAPE_NAMES = ['háromszög', 'rombusz', 'kör', 'négyzet'] as const;

/**
 * The eight option colours, in order, and the text colour that reads on each.
 * Each has a paper tile (`art`, wide, with an empty badge for a letter) and a
 * paper card (`panel`), drawn by apps/motion/art/stage.mjs.
 */
export const OPTION_TILE = [
  { bg: 'var(--rust)', fg: 'var(--paper)' },
  { bg: 'var(--teal)', fg: 'var(--paper)' },
  { bg: 'var(--plum)', fg: 'var(--paper)' },
  { bg: 'var(--mustard)', fg: 'var(--ink)' },
  { bg: 'var(--ice)', fg: 'var(--ink)' },
  { bg: 'var(--cream)', fg: 'var(--ink)' },
  { bg: 'var(--char-szellem)', fg: 'var(--ink)' },
  { bg: 'var(--char-bogyo)', fg: 'var(--ink)' },
].map((o, n) => ({ ...o, art: `/art/opt-${n}.svg`, panel: `/art/panel-${n}.svg` }));

export type Tile = (typeof OPTION_TILE)[number];

/** The four quiz answers: the first four colours; each answer also has a shape (▲ ◆ ● ■, `AnswerShape`). */
export const TILE: readonly Tile[] = OPTION_TILE.slice(0, 4);

/** The tile for option `i` of a long list; colors repeat after eight. */
export function optionTile(i: number): Tile {
  return OPTION_TILE[i % OPTION_TILE.length]!;
}

/** Option letters: A, B, … Z. */
export function letterOf(i: number): string {
  return String.fromCharCode(65 + (i % 26));
}

/** Inline style for a paper tile on the TV (`--i` staggers its animations). */
export function tileStyle(tile: Tile, i: number, panel = false): CSSProperties {
  return { '--tile-art': `url(${panel ? tile.panel : tile.art})`, '--tile-bg': tile.bg, color: tile.fg, '--i': i } as CSSProperties;
}

/** A quiz answer's paper button on the phone (its colour; the shape sits on a cream disc). */
export function phoneAnswerStyle(i: number): CSSProperties {
  const tile = TILE[i]!;
  return { '--tile-art': `url(/art/ph-tile-${'abcd'[i]}.svg)`, color: tile.fg, '--disc-fg': tile.bg, '--i': i } as CSSProperties;
}

/** A party option on the phone: a cream paper row, the option's colour on its letter disc. */
export function phoneOptionStyle(tile: Tile, i = 0): CSSProperties {
  return { '--tile-art': 'url(/art/ph-row.svg)', color: 'var(--ink)', '--disc-bg': tile.bg, '--disc-fg': tile.fg, '--i': i } as CSSProperties;
}

/** A paper card in one of the option colours (your locked-in answer, lie or guess). */
export function phoneCardStyle(tile: Tile): CSSProperties {
  return { '--tile-art': `url(${tile.panel})`, color: tile.fg } as CSSProperties;
}
