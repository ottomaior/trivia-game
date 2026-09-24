import type { HostView } from '@trivia/shared';
import { Final } from './screens/Final.tsx';
import { Intro } from './screens/Intro.tsx';
import { LadderBoard } from './screens/LadderBoard.tsx';
import { Lobby } from './screens/Lobby.tsx';
import { Question } from './screens/Question.tsx';
import { Reveal } from './screens/Reveal.tsx';
import { Scoreboard } from './screens/Scoreboard.tsx';
import { Vote } from './screens/Vote.tsx';
import styles from './Tv.module.css';
import { t } from '@trivia/shared';

/** Picks the TV screen for the current phase. */
export function TvStage({ view }: { view: HostView }) {
  const { stage } = view;
  return (
    <>
      {stage.phase === 'lobby' && <Lobby view={view} />}
      {stage.phase === 'intro' && <Intro view={view} />}
      {(stage.phase === 'vote' || stage.phase === 'vote_result') && <Vote view={view} stage={stage} />}
      {stage.phase === 'ladder_step' && <LadderBoard view={view} stage={stage} />}
      {(stage.phase === 'question_read' || stage.phase === 'question_open') && <Question view={view} stage={stage} />}
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
