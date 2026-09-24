import type { CSSProperties } from 'react';
import styles from './Phone.module.css';

const COLORS = ['var(--mustard)', 'var(--teal)', 'var(--cream)', 'var(--ice)', 'var(--rust)', 'var(--plum)'];

/** A small confetti pop from the middle of its parent (CSS only, light enough for any phone). */
export function Burst({ count = 18 }: { count?: number }) {
  return (
    <span className={styles.burst} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360 + (i % 3) * 7;
        const dist = 5 + (i % 4) * 1.6;
        return (
          <span
            key={i}
            style={
              {
                background: COLORS[i % COLORS.length],
                '--a': `${angle}deg`,
                '--r': `${dist}em`,
                '--spin': `${(i % 2 ? 1 : -1) * (180 + i * 25)}deg`,
              } as CSSProperties
            }
          />
        );
      })}
    </span>
  );
}
