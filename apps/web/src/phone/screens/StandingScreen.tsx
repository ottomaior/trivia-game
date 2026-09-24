import { t, type PlayerView, type Standing } from '@trivia/shared';
import { MeBlob } from '../MeBlob.tsx';
import styles from '../Phone.module.css';

export function StandingScreen({ view, standings }: { view: PlayerView; standings: Standing[] }) {
  const mine = standings.find((s) => s.playerId === view.me.id);
  return (
    <div className={styles.column}>
      {mine && <MeBlob view={view} leader={mine.rank === 1 && mine.score > 0} />}
      {mine && <h2 className={styles.rankBig}>{t.yourRank(mine.rank)}</h2>}
      {mine && <p className={styles.answerText}>{t.points(mine.score)}</p>}
      <p className={styles.hint}>{t.lookAtTv}</p>
    </div>
  );
}
