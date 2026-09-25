import { CHARACTERS, EXPRESSIONS, type CharacterId, type Expression } from '@trivia/shared';

// The paper cast. Each drawing is its own SVG file in /art (generated from
// apps/motion/art by the build), shown as an <img>: the browser rasterises
// the paper filters once and caches them, so even a slow TV can afford them.

/** The drawing for a character, idle or with an expression. */
export function artUrl(id: CharacterId, expression?: Expression): string {
  return expression ? `/art/${id}-${expression}.svg` : `/art/${id}.svg`;
}

/** The character's main colour, for chips, bars and swatches. */
export function characterColor(id: CharacterId): string {
  return `var(--char-${id})`;
}

/**
 * A player's character. `size` (a CSS length) is the space it takes in the
 * layout; the drawing is a little bigger and overhangs it, because the art
 * leaves room around the body for the paper edge and shadow.
 */
export function Character({
  id,
  size = '4em',
  dimmed = false,
  expression,
}: {
  id: CharacterId;
  size?: string;
  dimmed?: boolean;
  expression?: Expression;
}) {
  return (
    <img
      src={artUrl(id, expression)}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        width: `calc(${size} * 1.2)`,
        height: `calc(${size} * 1.2)`,
        margin: `calc(${size} * -0.1)`,
        opacity: dimmed ? 0.35 : 1,
        display: 'inline-block',
        verticalAlign: 'middle',
        pointerEvents: 'none',
      }}
    />
  );
}

const preloaded: HTMLImageElement[] = [];

/** Fetches the cast (and optionally every expression) ahead of time, so faces don't pop in. */
export function preloadCharacters(withExpressions = false): void {
  const want = CHARACTERS.flatMap((id) => [artUrl(id), ...(withExpressions ? EXPRESSIONS.map((e) => artUrl(id, e)) : [])]);
  const have = new Set(preloaded.map((img) => img.getAttribute('src')));
  for (const url of want) {
    if (have.has(url)) continue;
    const img = new Image();
    img.src = url;
    preloaded.push(img);
  }
}
