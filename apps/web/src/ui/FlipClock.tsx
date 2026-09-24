import { useCountdown } from '../net/clock.ts';
import styles from './FlipClock.module.css';

/** Big split-flap seconds display; each digit flips over when it changes. */
export function FlipClock({ endsAt }: { endsAt: number | null }) {
  const left = useCountdown(endsAt);
  const secs = left === null ? 0 : Math.ceil(left / 1000);
  const digits = String(Math.min(99, secs)).padStart(2, '0').split('');
  return (
    <div className={`${styles.clock} ${left !== null && left <= 5_000 ? styles.urgent : ''}`} role="timer" aria-label={String(secs)}>
      {digits.map((d, i) => (
        <span key={`${i}-${d}`} className={styles.card}>
          {d}
        </span>
      ))}
    </div>
  );
}
