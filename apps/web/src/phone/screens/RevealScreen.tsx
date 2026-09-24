import { FLAG_REASONS, t, type FlagReason, type PlayerView, type Stage } from '@trivia/shared';
import { useEffect, useState } from 'react';
import { send } from '../../net/send.ts';
import type { GameSocket } from '../../net/socket.ts';
import { LETTERS } from '../../ui/answers.ts';
import { Burst } from '../Burst.tsx';
import styles from '../Phone.module.css';

type RevealStage = Extract<Stage, { phase: 'reveal' }>;

export function RevealScreen({ view, stage, socket }: { view: PlayerView; stage: RevealStage; socket: GameSocket }) {
  const pick = stage.picks.find((p) => p.playerId === view.me.id);
  const correct = pick?.correct ?? false;
  // One buzz per reveal: two short taps for right, one long for wrong.
  useEffect(() => {
    navigator.vibrate?.(correct ? [60, 50, 60] : [250]);
  }, [stage.question.id, correct]);
  const verdict = pick?.correct ? t.correct : pick?.choice === null ? t.tooSlow : t.wrong;
  return (
    <div className={styles.column}>
      <div className={`${styles.verdict} ${pick?.correct ? styles.verdictGood : styles.verdictBad}`} data-testid="verdict">
        {pick?.correct && <Burst count={22} />}
        <span className={styles.verdictText}>{verdict}</span>
        {pick && pick.points > 0 && <span className={styles.verdictPoints}>{t.plusPoints(pick.points)}</span>}
      </div>
      <p className={styles.hint}>{t.theAnswerWas}</p>
      <p className={styles.answerText}>
        {LETTERS[stage.correct]}: {stage.question.choices[stage.correct]}
      </p>
      <FlagButton questionId={stage.question.id} flagged={view.mine.flagged} socket={socket} />
    </div>
  );
}

/** "Something wrong with this question?" → reason list → thanks. */
function FlagButton({ questionId, flagged, socket }: { questionId: string; flagged: boolean; socket: GameSocket }) {
  const [open, setOpen] = useState(false);
  if (flagged) return <p className={styles.flagThanks}>{t.flagThanks}</p>;
  if (!open) {
    return (
      <button className={styles.textButton} onClick={() => setOpen(true)}>
        {t.flagQuestion}
      </button>
    );
  }
  const flag = (reason: FlagReason) => {
    setOpen(false);
    void send(socket, 'question:flag', { questionId, reason });
  };
  return (
    <div className={styles.flagSheet}>
      {FLAG_REASONS.map((r) => (
        <button key={r} className={styles.secondary} onClick={() => flag(r)}>
          {t.flagReasons[r]}
        </button>
      ))}
      <button className={styles.textButton} onClick={() => setOpen(false)}>
        {t.cancel}
      </button>
    </div>
  );
}
