import { t, type PlayerView, type Stage } from '@trivia/shared';
import { send } from '../../net/send.ts';
import type { GameSocket } from '../../net/socket.ts';
import { TILE } from '../../ui/answers.ts';
import styles from '../Phone.module.css';

type VoteStage = Extract<Stage, { phase: 'vote' }>;

export function VoteScreen({ view, stage, socket }: { view: PlayerView; stage: VoteStage; socket: GameSocket }) {
  const mine = view.mine.vote;
  return (
    <div className={styles.column}>
      <h2 className={styles.screenTitle}>{mine === null ? t.voteTitle : t.voted}</h2>
      {stage.options.map((o, i) => (
        <button
          key={o.id}
          className={`${styles.choice} ${mine === i ? styles.choiceMine : ''} ${mine !== null && mine !== i ? styles.choiceDim : ''}`}
          style={{ background: TILE[i]!.bg, color: TILE[i]!.fg }}
          onClick={() => {
            navigator.vibrate?.(30);
            void send(socket, 'vote:cast', { option: i });
          }}
        >
          <span className={styles.choiceText}>{o.name}</span>
        </button>
      ))}
    </div>
  );
}
