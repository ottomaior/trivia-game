import type { ReactNode } from 'react';
import styles from './Marquee.module.css';

export type MarqueeMode = 'idle' | 'fast' | 'flash' | 'still';

/**
 * Full-screen TV frame with a ring of light bulbs. The bulbs are a dotted SVG
 * stroke (zero-length dashes with round caps), so "chasing" is just animating
 * the dash offset of a second, brighter ring.
 */
export function Marquee({ children, mode = 'idle' }: { children: ReactNode; mode?: MarqueeMode }) {
  return (
    <div className={styles.frame} data-mode={mode}>
      <div className={styles.inner}>{children}</div>
      <svg className={styles.bulbs} aria-hidden="true">
        <rect className={styles.dim} width="100%" height="100%" pathLength={1000} />
        <rect className={styles.lit} width="100%" height="100%" pathLength={1000} />
      </svg>
    </div>
  );
}
