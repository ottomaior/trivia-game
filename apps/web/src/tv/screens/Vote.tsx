import { t, TIMINGS, type HostView, type Stage } from '@trivia/shared';
import type { CSSProperties } from 'react';
import { Blob } from '../../ui/Blob.tsx';
import { Otto } from '../../ui/Otto.tsx';
import { TimerBar } from '../../ui/TimerBar.tsx';
import { TILE } from '../../ui/answers.ts';
import styles from '../Tv.module.css';
import { RoundLabel } from './common.tsx';

type VoteStage = Extract<Stage, { phase: 'vote' | 'vote_result' }>;

export function Vote({ view, stage }: { view: HostView; stage: VoteStage }) {
  return (
    <div className={styles.game}>
      <header className={styles.gameHeader}>
        <RoundLabel view={view} />
        <h2 className={styles.gameTitle}>{t.pickCategory}</h2>
        <span className={styles.hint}>{t.voteOnPhone}</span>
      </header>
      <ul className={styles.voteOptions}>
        {stage.options.map((o, i) => {
          const voters = view.players.filter((p) => stage.votes[p.id] === i);
          return (
            <li
              key={o.id}
              className={`${styles.voteCard} ${
                stage.phase === 'vote_result' ? (i === stage.chosen ? styles.voteChosen : styles.voteLost) : ''
              }`}
              data-testid={stage.phase === 'vote_result' && i === stage.chosen ? 'chosen-category' : undefined}
              style={{ background: TILE[i]!.bg, color: TILE[i]!.fg, '--i': i } as CSSProperties}
            >
              <span className={styles.voteName}>{o.name}</span>
              <span className={styles.voters}>
                {voters.map((p) => (
                  <Blob key={p.id} avatar={p.avatar} size="3.2em" />
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      <footer className={styles.gameFooter}>
        <Otto line={view.otto} players={view.players} size="9em" />
        <div className={styles.footerTimer}>
          {stage.phase === 'vote' && <TimerBar endsAt={view.phaseEndsAt} totalMs={TIMINGS.vote} />}
        </div>
      </footer>
    </div>
  );
}
