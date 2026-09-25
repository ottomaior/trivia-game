import { mcQuestionStage, t, type HostView } from '@trivia/shared';
import { Final } from './screens/Final.tsx';
import { Intro } from './screens/Intro.tsx';
import { LadderBoard } from './screens/LadderBoard.tsx';
import { Lobby } from './screens/Lobby.tsx';
import { PartyBoard } from './screens/Party.tsx';
import { Question } from './screens/Question.tsx';
import { Reveal } from './screens/Reveal.tsx';
import { Scoreboard } from './screens/Scoreboard.tsx';
import { Vote } from './screens/Vote.tsx';
import styles from './Tv.module.css';

/** Picks the TV screen for the current phase. */
export function TvStage({ view }: { view: HostView }) {
  const { stage } = view;
  const quiz = mcQuestionStage(stage);
  return (
    <>
      {stage.phase === 'lobby' && <Lobby view={view} />}
      {stage.phase === 'intro' && <Intro view={view} />}
      {(stage.phase === 'vote' || stage.phase === 'vote_result') && <Vote view={view} stage={stage} />}
      {stage.phase === 'ladder_step' && <LadderBoard view={view} stage={stage} />}
      {quiz && <Question view={view} stage={quiz} />}
      {!quiz &&
        (stage.phase === 'question_read' ||
          stage.phase === 'bluff_write' ||
          stage.phase === 'bluff_pick' ||
          stage.phase === 'order_open' ||
          stage.phase === 'guess_open' ||
          stage.phase === 'guess_bet') && <PartyBoard view={view} stage={stage} />}
      {stage.phase === 'reveal' && <Reveal view={view} stage={stage} />}
      {stage.phase === 'scoreboard' && <Scoreboard view={view} standings={stage.standings} />}
      {stage.phase === 'final' && <Final view={view} standings={stage.standings} />}
      {view.paused && (
        <div className={styles.pausedOverlay} role="status">
          {t.otto.paused[0]}
        </div>
      )}
    </>
  );
}
