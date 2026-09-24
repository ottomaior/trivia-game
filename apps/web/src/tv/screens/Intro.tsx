import { t, type HostView } from '@trivia/shared';
import { Blob } from '../../ui/Blob.tsx';
import { Logo } from '../../ui/Logo.tsx';
import { Otto } from '../../ui/Otto.tsx';
import styles from '../Tv.module.css';

export function Intro({ view }: { view: HostView }) {
  return (
    <div className={styles.intro}>
      <Logo />
      <Otto line={view.otto} size="18em" />
      <ul className={styles.blobRow}>
        {view.players.map((p) => (
          <li key={p.id} className={styles.blobRowItem}>
            <Blob avatar={p.avatar} size="4.5em" dimmed={!p.connected} />
            <span>{p.name}</span>
          </li>
        ))}
      </ul>
      <p className={styles.status}>{t.round(1, view.totalRounds)}</p>
    </div>
  );
}
