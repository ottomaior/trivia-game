import { strings, type PlayerView } from '@trivia/shared';
import { Blob } from '../ui/Blob.tsx';
import styles from './Phone.module.css';

export function PhoneLobby({ view }: { view: PlayerView }) {
  const t = strings(view.lang);
  const { me } = view;
  return (
    <div className={styles.lobby}>
      <Blob avatar={me.avatar} size="9rem" />
      <p className={styles.name} data-testid="my-name">
        {me.name}
      </p>
      {me.isVip && <span className={styles.vip}>{t.vip}</span>}
      <h2 className={styles.youreIn}>{t.youreIn}</h2>
      <p className={styles.hint}>{me.isVip ? t.vipHint : t.waitForVip}</p>
      <p className={styles.hint}>{t.lookAtTv}</p>
    </div>
  );
}
