import { LADDER_RUNGS, LADDER_SAFE_RUNGS, t, TIMINGS, type HostView, type LadderSeat, type Stage } from '@trivia/shared';
import type { CSSProperties } from 'react';
import { useInStudio } from '../../stage/StudioContext.ts';
import { Character } from '../../ui/Character.tsx';
import { Otto } from '../../ui/Otto.tsx';
import { TimerBar } from '../../ui/TimerBar.tsx';
import styles from '../Tv.module.css';
import { RoundLabel } from './common.tsx';

type StepStage = Extract<Stage, { phase: 'ladder_step' }>;

/** Start plus one step per rung, left to right, each a little higher. */
const STEPS = Array.from({ length: LADDER_RUNGS + 1 }, (_, i) => i);

/**
 * Milliomos-létra between questions: a staircase with every player standing
 * on the rung they hold, the next rung lit, and who stays or stops.
 */
export function LadderBoard({ view, stage }: { view: HostView; stage: StepStage }) {
  const inStudio = useInStudio();
  const seats = view.ladder?.seats ?? [];
  const byId = new Map(view.players.map((p) => [p.id, p]));
  return (
    <div className={`${styles.game} ${inStudio ? styles.gameStudio : ''}`} data-testid="ladder-board">
      <header className={styles.gameHeader}>
        <RoundLabel view={view} pack={false} />
        <h2 className={styles.gameTitle}>{t.ladderTitle}</h2>
        <span className={styles.categoryChip}>
          {stage.category.name} · {t.difficulty[stage.difficulty]}
        </span>
      </header>

      <ol className={styles.stairs} aria-label={t.ladderTitle}>
        {STEPS.map((rung) => {
          const safe = LADDER_SAFE_RUNGS.includes(rung);
          const here = seats.filter((s) => s.rung === rung);
          const cls = [
            styles.step,
            rung === stage.rung ? styles.stepNext : '',
            safe ? styles.stepSafe : '',
            rung > stage.rung ? styles.stepAhead : '',
          ].join(' ');
          return (
            <li key={rung} className={cls} style={{ '--h': rung } as CSSProperties}>
              <span className={styles.stepPlayers}>
                {here.map((s) => {
                  const p = byId.get(s.playerId);
                  return p ? <Character key={s.playerId} id={p.avatar.character} size="2.6em" dimmed={s.status === 'out' || s.status === 'walked'} /> : null;
                })}
              </span>
              <span className={styles.stepFace}>
                <span className={styles.stepNumber}>{rung === 0 ? t.rung(0) : rung}</span>
                {safe && <span className={styles.stepSafeTag}>{t.safeRung}</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <ul className={styles.answerRow}>
        {seats.map((s) => {
          const p = byId.get(s.playerId);
          if (!p) return null;
          return (
            <li key={s.playerId} className={`${styles.answerRowItem} ${styles.climber}`} data-status={s.status}>
              <Character id={p.avatar.character} size="3.2em" dimmed={!p.connected} />
              <span>{p.name}</span>
              <span className={styles.climberState}>{climberState(s, stage)}</span>
            </li>
          );
        })}
      </ul>

      <footer className={styles.gameFooter}>
        {!inStudio && <Otto line={view.otto} players={view.players} size="8em" />}
        <div className={styles.footerTimer}>
          <TimerBar endsAt={view.phaseEndsAt} totalMs={TIMINGS.ladderStep} />
        </div>
      </footer>
    </div>
  );
}

/** Off the ladder: why. Still climbing: their choice for this rung, once made. */
function climberState(s: LadderSeat, stage: StepStage): string {
  if (s.status !== 'in') return t.seatStatus[s.status]!;
  const choice = stage.walking[s.playerId];
  if (choice === undefined) return stage.rung === 1 ? t.seatStatus.in! : '…';
  return choice ? t.walking : t.staying;
}
