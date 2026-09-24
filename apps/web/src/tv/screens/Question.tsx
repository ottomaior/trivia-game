import { t, TIMINGS, type HostView, type Stage } from '@trivia/shared';
import type { CSSProperties } from 'react';
import { Blob } from '../../ui/Blob.tsx';
import { OttoFace } from '../../ui/Otto.tsx';
import { TimerBar } from '../../ui/TimerBar.tsx';
import { LETTERS, TILE } from '../../ui/answers.ts';
import styles from '../Tv.module.css';
import { RoundLabel } from './common.tsx';

type QuestionStage = Extract<Stage, { phase: 'question_read' | 'question_open' }>;

export function Question({ view, stage }: { view: HostView; stage: QuestionStage }) {
  const { question } = stage;
  const open = stage.phase === 'question_open';
  const answered = new Set(open ? stage.answered : []);
  return (
    <div className={styles.game}>
      <header className={styles.gameHeader}>
        <RoundLabel view={view} />
        <span className={styles.categoryChip}>
          {question.category} · {t.difficulty[question.difficulty]}
        </span>
        <span className={styles.hint}>{open ? t.answerOnPhone : t.getReady}</span>
      </header>
      <h2 className={styles.prompt} data-testid="prompt">
        {question.prompt}
      </h2>
      <ol className={`${styles.tiles} ${open ? styles.tilesOpen : styles.tilesWaiting}`}>
        {question.choices.map((c, i) => (
          <li key={i} className={styles.tile} style={{ background: TILE[i]!.bg, color: TILE[i]!.fg, '--i': i } as CSSProperties}>
            <span className={styles.tileLetter}>{LETTERS[i]}</span>
            <span className={styles.tileText}>{c}</span>
          </li>
        ))}
      </ol>
      <footer className={styles.gameFooter}>
        <OttoFace size="7em" />
        <ul className={styles.answerRow}>
          {view.players.map((p) => (
            <li key={p.id} className={`${styles.answerRowItem} ${answered.has(p.id) ? styles.lockedIn : ''}`}>
              <Blob avatar={p.avatar} size="3.6em" dimmed={!p.connected} />
              <span>{p.name}</span>
            </li>
          ))}
        </ul>
        <div className={styles.footerTimer}>
          <TimerBar endsAt={view.phaseEndsAt} totalMs={open ? TIMINGS.questionOpen : TIMINGS.questionRead} />
        </div>
      </footer>
    </div>
  );
}
