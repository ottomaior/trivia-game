import { t, type PlayerView, type PowerPlay, type Stage } from '@trivia/shared';
import { useState, type CSSProperties } from 'react';
import { send } from '../../net/send.ts';
import type { GameSocket } from '../../net/socket.ts';
import { LETTERS, TILE } from '../../ui/answers.ts';
import { FreezeCover, SlimeCover } from '../Obstacles.tsx';
import styles from '../Phone.module.css';

type QuestionStage = Extract<Stage, { phase: 'question_read' | 'question_open' }>;

/** With both on you, the slime comes off first, then the ice underneath. */
const COVER_ORDER: PowerPlay[] = ['slime', 'freeze'];

export function QuestionScreen({ view, stage, socket }: { view: PlayerView; stage: QuestionStage; socket: GameSocket }) {
  const { question } = stage;
  const open = stage.phase === 'question_open';
  // Show the tap instantly; the server's view confirms it a moment later.
  const [pending, setPending] = useState<{ questionId: string; choice: number } | null>(null);
  const localChoice = pending?.questionId === question.id ? pending.choice : null;
  const mine = view.mine.choice ?? localChoice;

  // Power plays thrown at me this round; a cleared one goes at once, before the server confirms.
  const [clearedHere, setClearedHere] = useState<string[]>([]);
  const onMe = stage.hits.filter((h) => h.target === view.me.id);
  const cover = COVER_ORDER.find(
    (power) => onMe.some((h) => h.power === power && !h.cleared) && !clearedHere.includes(`${question.id}:${power}`),
  );

  async function answer(choice: number) {
    if (!open || mine !== null || cover) return;
    setPending({ questionId: question.id, choice });
    navigator.vibrate?.(40);
    const res = await send(socket, 'answer:submit', { questionId: question.id, choice });
    if (!res.ok) setPending(null);
  }

  function cleared(power: PowerPlay) {
    setClearedHere((keys) => [...keys, `${question.id}:${power}`]);
    void send(socket, 'power:clear', { power });
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

  const byline = cover ? throwers(view, onMe.filter((h) => h.power === cover).map((h) => h.by), cover) : '';
  return (
    <div className={styles.column}>
      <p className={styles.phonePrompt}>{question.prompt}</p>
      {!open && <p className={styles.hint}>{t.getReady}</p>}
      <div className={styles.choices}>
        {question.choices.map((c, i) => (
          <button
            key={i}
            className={styles.choice}
            style={{ background: TILE[i]!.bg, color: TILE[i]!.fg, '--i': i } as CSSProperties}
            disabled={!open || cover !== undefined}
            onClick={() => answer(i)}
            data-testid={`choice-${i}`}
          >
            <span className={styles.choiceLetter}>{LETTERS[i]}</span>
            <span className={styles.choiceText}>{c}</span>
          </button>
        ))}
        {cover === 'freeze' && (
          <FreezeCover key={`${question.id}-freeze`} active={open} byline={byline} onCleared={() => cleared('freeze')} />
        )}
        {cover === 'slime' && (
          <SlimeCover key={`${question.id}-slime`} active={open} byline={byline} onCleared={() => cleared('slime')} />
        )}
      </div>
    </div>
  );
}

/** "Anna sent you an ice trap!" (with every thrower's name when several teamed up). */
function throwers(view: PlayerView, ids: string[], power: PowerPlay): string {
  const names = ids.map((id) => view.players.find((p) => p.id === id)?.name ?? '?');
  return t.powerHitYou(names.join(', '), power);
}
