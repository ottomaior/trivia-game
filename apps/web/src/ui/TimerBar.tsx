import { useCountdown } from '../net/clock.ts';
import styles from './TimerBar.module.css';

/** Shrinking bar plus seconds left. `totalMs` is the phase's full length. */
export function TimerBar({ endsAt, totalMs }: { endsAt: number | null; totalMs: number }) {
  const left = useCountdown(endsAt);
  if (left === null) return <div className={styles.timer} aria-hidden="true" />;
  const fraction = Math.min(1, left / totalMs);
  const urgent = left <= 5_000;
  return (
    <div className={`${styles.timer} ${urgent ? styles.urgent : ''}`} role="timer" aria-label={`${Math.ceil(left / 1000)}`}>
      <div className={styles.track}>
        <div className={styles.fill} style={{ transform: `scaleX(${fraction})` }} />
      </div>
      <span className={styles.seconds}>{Math.ceil(left / 1000)}</span>
    </div>
  );
}
