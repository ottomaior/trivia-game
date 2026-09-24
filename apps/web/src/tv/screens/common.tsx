import { pointsMultiplier, t, type HostView } from '@trivia/shared';
import styles from '../Tv.module.css';

/** Pack and round counter shown at the top of in-game screens, with a badge when the round scores double. */
export function RoundLabel({ view }: { view: HostView }) {
  return (
    <span className={styles.roundLabel}>
      {view.pack && <span className={styles.packTag}>{view.pack}</span>}
      {t.round(view.round, view.totalRounds)}
      {pointsMultiplier(view.round, view.totalRounds) > 1 && <span className={styles.doubleBadge}>{t.doublePoints}</span>}
    </span>
  );
}
