import { t, type HostView, type Stage } from '@trivia/shared';
import type { CSSProperties } from 'react';
import { Blob } from '../../ui/Blob.tsx';
import { useInStudio } from '../../stage/StudioContext.ts';
import { Otto } from '../../ui/Otto.tsx';
import { LETTERS, TILE } from '../../ui/answers.ts';
import styles from '../Tv.module.css';
import { RoundLabel } from './common.tsx';

type RevealStage = Extract<Stage, { phase: 'reveal' }>;

export function Reveal({ view, stage }: { view: HostView; stage: RevealStage }) {
  const inStudio = useInStudio();
  const { question, correct, picks } = stage;
  const byId = new Map(view.players.map((p) => [p.id, p]));
  const noAnswer = picks.filter((p) => p.choice === null);
  return (
    <div className={styles.game}>
      <header className={styles.gameHeader}>
        <RoundLabel view={view} />
        <span className={styles.categoryChip}>{question.category}</span>
        <span />
      </header>
      <h2 className={`${styles.prompt} ${styles.promptSmall}`}>{question.prompt}</h2>
      <ol className={styles.tiles}>
        {question.choices.map((c, i) => {
          const isCorrect = i === correct;
          return (
            <li
              key={i}
              className={`${styles.tile} ${isCorrect ? styles.tileCorrect : styles.tileWrong}`}
              style={{ background: TILE[i]!.bg, color: TILE[i]!.fg, '--i': i } as CSSProperties}
              data-testid={isCorrect ? 'correct-tile' : undefined}
            >
              <span className={styles.tileLetter}>{LETTERS[i]}</span>
              <span className={styles.tileText}>{c}</span>
              <span className={styles.pickers}>
                {picks
                  .filter((p) => p.choice === i)
                  .map((p, j) => {
                    const player = byId.get(p.playerId);
                    if (!player) return null;
                    return (
                      <span key={p.playerId} className={styles.picker} style={{ '--j': j } as CSSProperties}>
                        <Blob avatar={player.avatar} size="2.8em" />
                        {view.mode === 'classic' && p.points > 0 && <span className={styles.pickerPoints}>{t.plusPoints(p.points)}</span>}
                      </span>
                    );
                  })}
              </span>
            </li>
          );
        })}
      </ol>
      <footer className={styles.gameFooter}>
        {!inStudio && <Otto line={view.otto} players={view.players} size="9em" bubbleDelay="3.2s" />}
        <div className={styles.revealNotes}>
          {stage.explanation && <p className={styles.explanation}>{stage.explanation}</p>}
          {noAnswer.length > 0 && (
            <p className={styles.noAnswer}>
              {t.noAnswer}: {noAnswer.map((p) => byId.get(p.playerId)?.name).join(', ')}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
