import { t, type PlayerView, type Stage } from '@trivia/shared';
import { useState } from 'react';
import { send } from '../../net/send.ts';
import type { GameSocket } from '../../net/socket.ts';
import { LETTERS, TILE } from '../../ui/answers.ts';
import styles from '../Phone.module.css';

type QuestionStage = Extract<Stage, { phase: 'question_read' | 'question_open' }>;

export function QuestionScreen({ view, stage, socket }: { view: PlayerView; stage: QuestionStage; socket: GameSocket }) {
  const { question } = stage;
  const open = stage.phase === 'question_open';
  // Show the tap instantly; the server's view confirms it a moment later.
  const [pending, setPending] = useState<{ questionId: string; choice: number } | null>(null);
  const localChoice = pending?.questionId === question.id ? pending.choice : null;
  const mine = view.mine.choice ?? localChoice;

  async function answer(choice: number) {
    if (!open || mine !== null) return;
    setPending({ questionId: question.id, choice });
    navigator.vibrate?.(40);
    const res = await send(socket, 'answer:submit', { questionId: question.id, choice });
    if (!res.ok) setPending(null);
  }

  if (mine !== null) {
    return (
      <div className={styles.column}>
        <div className={styles.lockedCard} style={{ background: TILE[mine]!.bg, color: TILE[mine]!.fg }}>
          <span className={styles.lockedLetter}>{LETTERS[mine]}</span>
          <span>{question.choices[mine]}</span>
        </div>
        <h2 className={styles.screenTitle}>{t.lockedIn}</h2>
        <p className={styles.hint}>{t.waitForOthers}</p>
      </div>
    );
  }

  return (
    <div className={styles.column}>
      <p className={styles.phonePrompt}>{question.prompt}</p>
      {!open && <p className={styles.hint}>{t.getReady}</p>}
      {question.choices.map((c, i) => (
        <button
          key={i}
          className={styles.choice}
          style={{ background: TILE[i]!.bg, color: TILE[i]!.fg }}
          disabled={!open}
          onClick={() => answer(i)}
          data-testid={`choice-${i}`}
        >
          <span className={styles.choiceLetter}>{LETTERS[i]}</span>
          <span className={styles.choiceText}>{c}</span>
        </button>
      ))}
    </div>
  );
}
