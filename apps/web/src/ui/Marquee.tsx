import type { ReactNode } from 'react';
import styles from './Marquee.module.css';

export type MarqueeMode = 'idle' | 'fast' | 'flash' | 'still';

/**
 * Full-screen TV frame with a ring of light bulbs. The bulbs are a dotted SVG
 * stroke (zero-length dashes with round caps), so "chasing" is just animating
 * the dash offset of a second, brighter ring. Its glow is a wider, fainter
 * copy of that ring underneath, not a filter: a filter would be recomputed
 * over the whole screen on every step, which weak TVs can't afford.
 */
export function Marquee({ children, mode = 'idle' }: { children: ReactNode; mode?: MarqueeMode }) {
  return (
    <div className={styles.frame} data-mode={mode}>
      <div className={styles.inner}>{children}</div>
      <svg className={styles.bulbs} aria-hidden="true">
        <rect className={styles.dim} width="100%" height="100%" pathLength={1000} />
        <rect className={styles.glow} width="100%" height="100%" pathLength={1000} />
        <rect className={styles.lit} width="100%" height="100%" pathLength={1000} />
      </svg>
    </div>
  );
}
