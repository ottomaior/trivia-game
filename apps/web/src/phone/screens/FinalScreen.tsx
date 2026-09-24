import { t, type PlayerView, type Standing } from '@trivia/shared';
import { send } from '../../net/send.ts';
import type { GameSocket } from '../../net/socket.ts';
import { MeBlob } from '../MeBlob.tsx';
import styles from '../Phone.module.css';

export function FinalScreen({ view, standings, socket }: { view: PlayerView; standings: Standing[]; socket: GameSocket }) {
  const mine = standings.find((s) => s.playerId === view.me.id);
  return (
    <div className={styles.column}>
      <h2 className={styles.screenTitle}>{t.finalResults}</h2>
      {mine && <MeBlob view={view} leader={mine.rank === 1} />}
      {mine && <p className={styles.rankBig}>{t.yourRank(mine.rank)}</p>}
      {mine && <p className={styles.answerText}>{t.points(mine.score)}</p>}
      {view.me.isVip ? (
        <>
          <button className={styles.primary} onClick={() => void send(socket, 'vip:playAgain', {})}>
            {t.playAgain}
          </button>
          <button className={styles.secondary} onClick={() => void send(socket, 'vip:newLobby', {})}>
            {t.newLobby}
          </button>
        </>
      ) : (
        <p className={styles.hint}>{t.waitForVipNext}</p>
      )}
    </div>
  );
}
