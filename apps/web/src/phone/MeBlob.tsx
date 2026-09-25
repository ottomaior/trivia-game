import type { Expression, PlayerView } from '@trivia/shared';
import { Character } from '../ui/Character.tsx';
import { Burst } from './Burst.tsx';
import styles from './Phone.module.css';

/** The player's own character, hopping in; leaders get a crown and a confetti pop. */
export function MeBlob({ view, leader, expression }: { view: PlayerView; leader: boolean; expression?: Expression }) {
  return (
    <div className={styles.meBlob}>
      {leader && <Burst />}
      {leader && (
        <svg className={styles.meCrown} viewBox="0 0 40 24" aria-hidden="true">
          <path d="M2 22 L6 4 L14 14 L20 2 L26 14 L34 4 L38 22 Z" fill="var(--mustard)" stroke="var(--burgundy-deep)" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      )}
      <Character id={view.me.avatar.character} size="96px" expression={expression ?? (leader ? 'correct' : undefined)} />
    </div>
  );
}
