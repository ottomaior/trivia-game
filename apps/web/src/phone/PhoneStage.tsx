import { t, type PlayerView } from '@trivia/shared';
import type { GameSocket } from '../net/socket.ts';
import { Blob } from '../ui/Blob.tsx';
import styles from './Phone.module.css';
import { FinalScreen } from './screens/FinalScreen.tsx';
import { LobbyScreen } from './screens/LobbyScreen.tsx';
import { QuestionScreen } from './screens/QuestionScreen.tsx';
import { RevealScreen } from './screens/RevealScreen.tsx';
import { StandingScreen } from './screens/StandingScreen.tsx';
import { VoteScreen } from './screens/VoteScreen.tsx';

/** Picks the phone controller screen for the current phase. */
export function PhoneStage({ view, socket }: { view: PlayerView; socket: GameSocket }) {
  const { stage, me } = view;
  return (
    <div className={styles.stage}>
      {stage.phase !== 'lobby' && (
        <header className={styles.meBar}>
          <Blob avatar={me.avatar} size="2.4rem" />
          <span className={styles.meName}>{me.name}</span>
          <span className={styles.meScore}>{t.points(me.score)}</span>
        </header>
      )}
      {view.paused ? (
        <p className={styles.message}>{t.tvDisconnected}</p>
      ) : (
        <>
          {stage.phase === 'lobby' && <LobbyScreen view={view} stage={stage} socket={socket} />}
          {stage.phase === 'intro' && <p className={styles.bigNote}>{t.lookAtTv}</p>}
          {stage.phase === 'vote' && <VoteScreen view={view} stage={stage} socket={socket} />}
          {stage.phase === 'vote_result' && (
            <div className={styles.column}>
              <p className={styles.hint}>{t.chosenCategory}</p>
              <h2 className={styles.rankBig}>{stage.options[stage.chosen]?.name}</h2>
            </div>
          )}
          {(stage.phase === 'question_read' || stage.phase === 'question_open') && (
            <QuestionScreen view={view} stage={stage} socket={socket} />
          )}
          {stage.phase === 'reveal' && <RevealScreen view={view} stage={stage} socket={socket} />}
          {stage.phase === 'scoreboard' && <StandingScreen view={view} standings={stage.standings} />}
          {stage.phase === 'final' && <FinalScreen view={view} standings={stage.standings} socket={socket} />}
        </>
      )}
    </div>
  );
}
