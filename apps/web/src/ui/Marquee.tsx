import type { ReactNode } from 'react';
import styles from './Marquee.module.css';

/**
 * Full-screen TV frame with a ring of light bulbs: a dotted SVG stroke
 * (zero-length dashes with round caps), with a wider, fainter copy underneath
 * as the glow. The bulbs stay lit and still: a chasing or flashing ring round
 * the whole screen was distracting all game long.
 */
export function Marquee({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <div className={styles.inner}>{children}</div>
      <svg className={styles.bulbs} aria-hidden="true">
        <rect className={styles.glow} width="100%" height="100%" pathLength={1000} />
        <rect className={styles.lit} width="100%" height="100%" pathLength={1000} />
      </svg>
    </div>
  );
}
