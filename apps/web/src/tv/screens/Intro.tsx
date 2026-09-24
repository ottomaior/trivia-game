import { t, type HostView } from '@trivia/shared';
import { Blob } from '../../ui/Blob.tsx';
import { Logo } from '../../ui/Logo.tsx';
import { useInStudio } from '../../stage/StudioContext.ts';
import { Otto } from '../../ui/Otto.tsx';
import styles from '../Tv.module.css';

export function Intro({ view }: { view: HostView }) {
  const inStudio = useInStudio();
  return (
    <div className={styles.intro}>
      <Logo />
      {!inStudio && <Otto line={view.otto} players={view.players} size="18em" />}
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
