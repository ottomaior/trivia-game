import { t, type HostView } from '@trivia/shared';
import styles from '../Tv.module.css';

/** Round counter shown at the top of in-game screens. */
export function RoundLabel({ view }: { view: HostView }) {
  return <span className={styles.roundLabel}>{t.round(view.round, view.totalRounds)}</span>;
}
