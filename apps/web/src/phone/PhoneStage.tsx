import { mcQuestionStage, scoreText, t, type PlayerView } from '@trivia/shared';
import type { GameSocket } from '../net/socket.ts';
import { Character } from '../ui/Character.tsx';
import styles from './Phone.module.css';
import { BluffPickScreen, BluffWriteScreen, ReadingScreen } from './screens/BluffScreens.tsx';
import { FinalScreen } from './screens/FinalScreen.tsx';
import { BetScreen, GuessScreen } from './screens/GuessScreens.tsx';
import { LadderStepScreen } from './screens/LadderStepScreen.tsx';
import { LobbyScreen } from './screens/LobbyScreen.tsx';
import { OrderScreen } from './screens/OrderScreen.tsx';
import { QuestionScreen } from './screens/QuestionScreen.tsx';
import { RevealScreen } from './screens/RevealScreen.tsx';
import { StandingScreen } from './screens/StandingScreen.tsx';
import { PowerNotes, VoteScreen } from './screens/VoteScreen.tsx';

/** Picks the phone controller screen for the current phase. */
export function PhoneStage({ view, socket }: { view: PlayerView; socket: GameSocket }) {
  const { stage, me } = view;
  const quiz = mcQuestionStage(stage);
  return (
    <div className={styles.stage}>
      {stage.phase !== 'lobby' && (
        <header className={styles.meBar}>
          <Character id={me.avatar.character} size="2.4rem" />
          <span className={styles.meName}>{me.name}</span>
          <span className={styles.meScore}>{scoreText(view.mode, me.score)}</span>
        </header>
      )}
      {view.paused ? (
        <p className={styles.message}>{t.tvDisconnected}</p>
      ) : (
        <>
          {stage.phase === 'lobby' && <LobbyScreen view={view} stage={stage} socket={socket} />}
          {stage.phase === 'intro' && <p className={styles.bigNote}>{t.lookAtTv}</p>}
          {stage.phase === 'vote' && <VoteScreen view={view} stage={stage} socket={socket} />}
          {stage.phase === 'ladder_step' && <LadderStepScreen view={view} stage={stage} socket={socket} />}
          {stage.phase === 'vote_result' && (
            <div className={styles.column}>
              <p className={styles.hint}>{t.chosenCategory}</p>
              <h2 className={styles.rankBig}>{stage.options[stage.chosen]?.name}</h2>
              <PowerNotes view={view} stage={stage} />
            </div>
          )}
          {quiz && <QuestionScreen view={view} stage={quiz} socket={socket} />}
          {!quiz && stage.phase === 'question_read' && <ReadingScreen prompt={stage.question.prompt} />}
          {/* Keyed by question, so nothing typed or ordered carries over into the next round. */}
          {stage.phase === 'bluff_write' && <BluffWriteScreen key={stage.question.id} view={view} stage={stage} socket={socket} />}
          {stage.phase === 'bluff_pick' && <BluffPickScreen key={stage.question.id} view={view} stage={stage} socket={socket} />}
          {stage.phase === 'order_open' && <OrderScreen key={stage.question.id} view={view} stage={stage} socket={socket} />}
          {stage.phase === 'guess_open' && <GuessScreen key={stage.question.id} view={view} stage={stage} socket={socket} />}
          {stage.phase === 'guess_bet' && <BetScreen key={stage.question.id} view={view} stage={stage} socket={socket} />}
          {stage.phase === 'reveal' && <RevealScreen view={view} stage={stage} socket={socket} />}
          {stage.phase === 'scoreboard' && <StandingScreen view={view} standings={stage.standings} />}
          {stage.phase === 'final' && <FinalScreen view={view} standings={stage.standings} socket={socket} />}
        </>
      )}
    </div>
  );
}
