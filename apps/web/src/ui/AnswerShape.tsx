import { SHAPE_NAMES } from './answers.ts';

/** The four answers' shapes (▲ ◆ ● ■), as drawn on the TV's paper tiles (apps/motion/art/build.mjs). */
const PATHS = [
  <path key="a" d="M0 -15 L15 11 L-15 11 Z" />,
  <path key="b" d="M0 -16 L16 0 L0 16 L-16 0 Z" />,
  <circle key="c" r="14" />,
  <rect key="d" x="-13" y="-13" width="26" height="26" rx="2" />,
];

/** Answer `index`'s shape, in the current text colour (or `color`). */
export function AnswerShape({ index, size = '1em', color = 'currentColor' }: { index: number; size?: string; color?: string }) {
  return (
    <svg viewBox="-18 -18 36 36" width={size} height={size} fill={color} role="img" aria-label={SHAPE_NAMES[index]} style={{ flex: 'none', verticalAlign: '-0.12em' }}>
      {PATHS[index]}
    </svg>
  );
}
