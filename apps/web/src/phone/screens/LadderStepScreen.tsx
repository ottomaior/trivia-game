import { t, type PlayerView, type Stage } from '@trivia/shared';
import { send } from '../../net/send.ts';
import type { GameSocket } from '../../net/socket.ts';
import { MeBlob } from '../MeBlob.tsx';
import styles from '../Phone.module.css';

type StepStage = Extract<Stage, { phase: 'ladder_step' }>;

/** Before each rung: climbers choose to keep going or stop with what they hold. */
export function LadderStepScreen({ view, stage, socket }: { view: PlayerView; stage: StepStage; socket: GameSocket }) {
  const seat = view.ladder?.seats.find((s) => s.playerId === view.me.id);
  const header = (
    <>
      <p className={styles.hint}>{t.rungOf(stage.rung, view.totalRounds)}</p>
      <h2 className={styles.screenTitle}>{stage.category.name}</h2>
      <p className={styles.hint}>{t.difficulty[stage.difficulty]}</p>
    </>
  );

  if (!seat || seat.status !== 'in') {
    return (
      <div className={styles.column}>
        {header}
        <MeBlob view={view} leader={false} />
        <p className={styles.rankBig}>{seat ? t.seatStatus[seat.status] : t.lookAtTv}</p>
        {seat && <p className={styles.answerText}>{t.youKeep(seat.rung)}</p>}
        <p className={styles.hint}>{t.audienceMode}</p>
      </div>
    );
  }

  if (stage.rung === 1) {
    return (
      <div className={styles.column}>
        {header}
        <p className={styles.bigNote}>{t.firstRung}</p>
      </div>
    );
  }

  const mine = stage.walking[view.me.id];
  const choose = (walk: boolean) => {
    navigator.vibrate?.(30);
    void send(socket, 'ladder:walk', { walk });
  };
  return (
    <div className={styles.column}>
      {header}
      <p className={styles.phonePrompt}>{t.walkQuestion}</p>
      <button
        className={`${styles.choice} ${styles.stayButton} ${mine === false ? styles.choiceMine : ''} ${mine === true ? styles.choiceDim : ''}`}
        aria-pressed={mine === false}
        onClick={() => choose(false)}
      >
        <span className={styles.choiceText}>{t.stay}</span>
      </button>
      <button
        className={`${styles.choice} ${styles.walkButton} ${mine === true ? styles.choiceMine : ''} ${mine === false ? styles.choiceDim : ''}`}
        aria-pressed={mine === true}
        onClick={() => choose(true)}
      >
        <span className={styles.choiceText}>{t.walk}</span>
      </button>
      <p className={styles.hint}>{t.walkKeeps(seat.rung)}</p>
    </div>
  );
}
