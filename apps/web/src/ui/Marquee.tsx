import type { ReactNode } from 'react';
import styles from './Marquee.module.css';

/** Full-screen TV frame with a row of "bulbs" around the edge. */
export function Marquee({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <div className={styles.inner}>{children}</div>
    </div>
  );
}
