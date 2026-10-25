import { fallbackRung, LADDER_RUNGS, LADDER_SAFE_RUNGS, LIFELINES, t, TIMINGS, type HostView, type LadderSeat, type Stage } from '@trivia/shared';
import type { CSSProperties } from 'react';
import { useInStudio } from '../../stage/StudioContext.ts';
import { Character } from '../../ui/Character.tsx';
import { Otto } from '../../ui/Otto.tsx';
import { art } from '../../ui/art.ts';
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
        <h2 className={styles.gameTitle}>{stage.rung === 1 ? t.ladderTitle : t.walkQuestion}</h2>
        <span className={styles.categoryChip}>
          {stage.category.name} · {t.difficulty[stage.difficulty]}
        </span>
      </header>

      {stage.rung === 1 && <LadderRules />}
      <ol className={`${styles.stairs} ${stage.rung === 1 ? styles.stairsBehind : ''}`} aria-label={t.ladderTitle}>
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
                  return p ? (
                    <Character key={s.playerId} id={p.avatar.character} size="2.6em" dimmed={s.status === 'walked'} expression={s.status === 'out' ? 'out' : undefined} />
                  ) : null;
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
              <Character id={p.avatar.character} size="3.2em" dimmed={!p.connected} expression={s.status === 'out' ? 'out' : undefined} />
              <span>{p.name}</span>
              <span className={styles.climberState}>{climberState(s, stage)}</span>
              {s.status === 'in' && stage.rung > 1 && <span className={styles.stakes}>{t.stakes(s.rung, fallbackRung(stage.rung))}</span>}
              <span className={styles.lifeBadges}>
                {LIFELINES.map((l) => {
                  const used = s.used.includes(l);
                  return (
                    <img
                      key={l}
                      src={art(`life-${l}${used ? '-used' : ''}`)}
                      alt={t.lifelines[l]}
                      title={t.lifelines[l]}
                      className={styles.lifeBadge}
                      data-used={used}
                      draggable={false}
                    />
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>

      <footer className={styles.gameFooter}>
        {!inStudio && <Otto line={view.otto} players={view.players} size="8em" />}
        <div className={styles.footerTimer}>
          <TimerBar endsAt={view.phaseEndsAt} totalMs={stage.rung === 1 ? TIMINGS.ladderRules : TIMINGS.ladderStep} />
        </div>
      </footer>
    </div>
  );
}

/** Before the first rung: how the ladder works, and what each lifeline does. */
function LadderRules() {
  return (
    <section className={styles.ladderRules} data-testid="ladder-rules">
      <h3 className={styles.ladderRulesTitle}>{t.ladderRulesTitle}</h3>
      <ul className={styles.ladderRulesList}>
        {t.ladderRules(LADDER_SAFE_RUNGS).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <ul className={styles.ladderRulesLifelines}>
        {LIFELINES.map((l) => (
          <li key={l}>
            <img src={art(`life-${l}`)} alt="" className={styles.lifeBadge} draggable={false} />
            <span>
              <b>{t.lifelines[l]}</b>: {t.lifelineHelp[l]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Off the ladder: why. Still climbing: their choice for this rung, once made. */
function climberState(s: LadderSeat, stage: StepStage): string {
  if (s.status !== 'in') return t.seatStatus[s.status]!;
  const choice = stage.walking[s.playerId];
  if (choice === undefined) return stage.rung === 1 ? t.seatStatus.in! : '…';
  return choice ? t.walking : t.staying;
}
