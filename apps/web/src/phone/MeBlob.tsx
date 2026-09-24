import type { PlayerView } from '@trivia/shared';
import { Blob, type Expression } from '../ui/Blob.tsx';
import { Burst } from './Burst.tsx';
import styles from './Phone.module.css';

/** The player's own blob, hopping in; leaders get a crown and a confetti pop. */
export function MeBlob({ view, leader, expression }: { view: PlayerView; leader: boolean; expression?: Expression }) {
  return (
    <div className={styles.meBlob}>
      {leader && <Burst />}
      {leader && (
        <svg className={styles.meCrown} viewBox="0 0 40 24" aria-hidden="true">
          <path d="M2 22 L6 4 L14 14 L20 2 L26 14 L34 4 L38 22 Z" fill="var(--mustard)" stroke="var(--burgundy-deep)" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      )}
      <Blob avatar={view.me.avatar} size="96px" expression={expression ?? (leader ? 'happy' : undefined)} />
    </div>
  );
}
