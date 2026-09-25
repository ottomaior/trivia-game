import type { CSSProperties, ReactNode } from 'react';
import styles from './Marquee.module.css';

export type MarqueeMode = 'idle' | 'fast' | 'flash' | 'still';

/**
 * Full-screen TV frame with a ring of light bulbs. The bulbs are a dotted SVG
 * stroke (zero-length dashes with round caps). The lit bulbs are three rings,
 * each holding every third bulb one position further on, and "chasing" lights
 * them in turn by opacity: an opacity animation runs on the compositor, where
 * moving the dashes would redraw the frame on the main thread every refresh.
 * The glow is a wider, fainter copy of each ring underneath, not a filter.
 */
export function Marquee({ children, mode = 'idle' }: { children: ReactNode; mode?: MarqueeMode }) {
  return (
    <div className={styles.frame} data-mode={mode}>
      <div className={styles.inner}>{children}</div>
      <svg className={styles.bulbs} aria-hidden="true">
        <rect className={styles.dim} width="100%" height="100%" pathLength={1000} />
      </svg>
      {[0, 1, 2].map((k) => (
        <svg key={k} className={`${styles.bulbs} ${styles.ring}`} style={{ '--k': k } as CSSProperties} aria-hidden="true">
          <rect className={styles.glow} width="100%" height="100%" pathLength={1000} strokeDashoffset={-8 * k} />
          <rect className={styles.lit} width="100%" height="100%" pathLength={1000} strokeDashoffset={-8 * k} />
        </svg>
      ))}
    </div>
  );
}
