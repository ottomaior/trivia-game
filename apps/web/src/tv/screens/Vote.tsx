import { t, TIMINGS, type HostView, type Stage } from '@trivia/shared';
import type { CSSProperties } from 'react';
import { Character } from '../../ui/Character.tsx';
import { useInStudio } from '../../stage/StudioContext.ts';
import { Otto } from '../../ui/Otto.tsx';
import { TimerBar } from '../../ui/TimerBar.tsx';
import { TILE, tileStyle } from '../../ui/answers.ts';
import { audio } from '../../audio/engine.ts';
import { useLowFx } from '../../ui/lowfx.ts';
import { useSlotSpin } from '../../ui/slotSpin.ts';
import styles from '../Tv.module.css';
import { PowerHits } from '../PowerHits.tsx';
import { RoundLabel } from './common.tsx';

type VoteStage = Extract<Stage, { phase: 'vote' | 'vote_result' }>;

export function Vote({ view, stage }: { view: HostView; stage: VoteStage }) {
  const inStudio = useInStudio();
  const lowFx = useLowFx();
  const result = stage.phase === 'vote_result';
  const chosen = result ? stage.chosen : 0;
  // The decided category is revealed like a slot machine (instantly in low-motion mode).
  const spin = useSlotSpin(result, chosen, stage.options.length, {
    instant: lowFx,
    onStep: () => audio.play('spinTick'),
    onLand: () => audio.play('spinLand'),
  });
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
                result
                  ? spin.landed
                    ? i === chosen
                      ? styles.voteChosen
                      : styles.voteLost
                    : spin.lit === i
                      ? styles.voteLit
                      : styles.voteDim
                  : ''
              }`}
              data-testid={result && spin.landed && i === chosen ? 'chosen-category' : undefined}
              style={tileStyle(TILE[i]!, i, true)}
            >
              <span className={styles.voteName}>{o.name}</span>
              <span className={styles.voters}>
                {voters.map((p) => (
                  <Character key={p.id} id={p.avatar.character} size="3.2em" />
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      <PowerHits hits={stage.hits} players={view.players} waiting={stage.phase === 'vote' && stage.powerVote} />
      <footer className={styles.gameFooter}>
        {!inStudio && <Otto line={view.otto} players={view.players} size="9em" />}
        <div className={styles.footerTimer}>
          {stage.phase === 'vote' && (
            <TimerBar endsAt={view.phaseEndsAt} totalMs={stage.powerVote ? TIMINGS.votePower : TIMINGS.vote} />
          )}
        </div>
      </footer>
    </div>
  );
}
