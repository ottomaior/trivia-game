import { pointsMultiplier, roundText, t, type HostView } from '@trivia/shared';
import styles from '../Tv.module.css';

/**
 * Pack and round counter shown at the top of in-game screens, with a badge
 * when the round scores double. `pack={false}` when the screen names it already.
 */
export function RoundLabel({ view, pack = true }: { view: HostView; pack?: boolean }) {
  return (
    <span className={styles.roundLabel}>
      {pack && view.pack && <span className={styles.packTag}>{view.pack}</span>}
      {roundText(view.mode, view.round, view.totalRounds)}
      {view.mode === 'classic' && pointsMultiplier(view.round, view.totalRounds) > 1 && (
        <span className={styles.doubleBadge}>{t.doublePoints}</span>
      )}
    </span>
  );
}
