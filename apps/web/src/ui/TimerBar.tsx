import { useEffect, useRef } from 'react';
import { serverNow, useCountdown } from '../net/clock.ts';
import styles from './TimerBar.module.css';

/**
 * Shrinking bar plus seconds left. `totalMs` is the phase's full length. The
 * bar drains in one animation per phase, which the browser runs on its
 * compositor; the seconds re-render once a second.
 */
export function TimerBar({ endsAt, totalMs }: { endsAt: number | null; totalMs: number }) {
  const left = useCountdown(endsAt);
  const fill = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = fill.current;
    if (!el || endsAt === null) return;
    const remaining = Math.max(0, endsAt - serverNow());
    const from = Math.min(1, remaining / totalMs);
    const anim = el.animate([{ transform: `scaleX(${from})` }, { transform: 'scaleX(0)' }], {
      duration: remaining,
      easing: 'linear',
      fill: 'forwards',
    });
    return () => anim.cancel();
  }, [endsAt, totalMs]);
  if (left === null) return <div className={styles.timer} aria-hidden="true" />;
  const fraction = Math.min(1, left / totalMs);
  const urgent = left <= 5_000;
  return (
    <div className={`${styles.timer} ${urgent ? styles.urgent : ''}`} role="timer" aria-label={`${Math.ceil(left / 1000)}`}>
      <div className={styles.track}>
        <div className={styles.fill} ref={fill} style={{ transform: `scaleX(${fraction})` }} />
      </div>
      <span className={styles.seconds}>{Math.ceil(left / 1000)}</span>
    </div>
  );
}
