import { actedIds, t, TIMINGS, type HostView, type PublicQuestion, type Stage, type TimingKey } from '@trivia/shared';
import { useRef, type CSSProperties } from 'react';
import { useInStudio } from '../../stage/StudioContext.ts';
import { Character } from '../../ui/Character.tsx';
import { FlipClock } from '../../ui/FlipClock.tsx';
import { OttoFace } from '../../ui/Otto.tsx';
import { TimerBar } from '../../ui/TimerBar.tsx';
import { letterOf, optionTile, tileStyle } from '../../ui/answers.ts';
import styles from '../Tv.module.css';
import { RoundLabel } from './common.tsx';
import { Clothesline, Tape } from './PartyProps.tsx';
import { RoundCard, usePromptWordsIn } from './Question.tsx';

/** A party-mode round on the TV, from the read-out question to the last input. */
export type PartyStage =
  | Extract<Stage, { phase: 'question_read' }>
  | Extract<Stage, { phase: 'bluff_write' | 'bluff_pick' | 'order_open' | 'guess_open' | 'guess_bet' }>;

const TIMING: Record<PartyStage['phase'], TimingKey> = {
  question_read: 'questionRead',
  bluff_write: 'bluffWrite',
  bluff_pick: 'bluffPick',
  order_open: 'orderOpen',
  guess_open: 'guessOpen',
  guess_bet: 'guessBet',
};

const HINT: Record<PartyStage['phase'], string> = {
  question_read: t.getReady,
  bluff_write: t.bluffWriting,
  bluff_pick: t.bluffPicking,
  order_open: t.orderOnPhone,
  guess_open: t.guessOnPhone,
  guess_bet: t.betOnPhone,
};

const TEST_ID: Record<PublicQuestion['kind'], string> = {
  mc: 'question-board',
  bluff: 'bluff-board',
  timeline: 'order-board',
  number: 'guess-board',
};

/**
 * Blöffölő, Időrend and Tippelj! on the TV: the same frame as a quiz
 * question (round, category, clock, the prompt, who has acted), with each
 * mode's board in the middle.
 */
export function PartyBoard({ view, stage }: { view: HostView; stage: PartyStage }) {
  const { question } = stage;
  const reading = stage.phase === 'question_read';
  const inStudio = useInStudio();
  const promptRef = useRef<HTMLHeadingElement>(null);
  usePromptWordsIn(promptRef, question.id, reading);
  const acted = new Set(actedIds(stage));
  // Only players with a guess bet on the guesses.
  const waitingFor = stage.phase === 'guess_bet' ? view.players.filter((p) => stage.guesses.some((g) => g.playerId === p.id)) : view.players;

  return (
    <div className={`${styles.game} ${inStudio ? styles.gameStudio : ''}`} data-testid={TEST_ID[question.kind]}>
      <header className={styles.gameHeader}>
        <RoundLabel view={view} />
        <span className={styles.categoryChip}>
          {question.category} · {t.difficulty[question.difficulty]}
        </span>
        {inStudio && !reading ? <FlipClock endsAt={view.phaseEndsAt} /> : <span className={styles.hint}>{HINT[stage.phase]}</span>}
      </header>
      <h2 className={`${styles.prompt} ${question.kind === 'timeline' || stage.phase === 'bluff_pick' ? styles.promptSmall : ''}`} data-testid="prompt" ref={promptRef}>
        {question.prompt}
      </h2>
      <div className={styles.partyBody}>
        <Body view={view} stage={stage} />
      </div>
      {inStudio && reading && <RoundCard view={view} question={question} />}
      {!inStudio && (
        <footer className={styles.gameFooter}>
          <OttoFace size="7em" />
          <ul className={styles.answerRow}>
            {waitingFor.map((p) => (
              <li key={p.id} className={`${styles.answerRowItem} ${acted.has(p.id) ? styles.lockedIn : ''}`}>
                <Character id={p.avatar.character} size="3.6em" dimmed={!p.connected} />
                <span>{p.name}</span>
              </li>
            ))}
          </ul>
          <div className={styles.footerTimer}>
            <TimerBar endsAt={view.phaseEndsAt} totalMs={TIMINGS[TIMING[stage.phase]]} />
          </div>
        </footer>
      )}
    </div>
  );
}

function Body({ view, stage }: { view: HostView; stage: PartyStage }) {
  const { question } = stage;
  if (stage.phase === 'bluff_pick') return <OptionGrid options={stage.options} />;
  if (question.kind === 'timeline') {
    return <Clothesline cards={question.items.map((text, item) => ({ item, text }))} open={stage.phase === 'order_open'} />;
  }
  if (stage.phase === 'guess_bet') {
    const unit = question.kind === 'number' ? question.unit : null;
    return <Tape guesses={stage.guesses} unit={unit} byId={new Map(view.players.map((p) => [p.id, p]))} />;
  }
  if (question.kind === 'number' && question.unit) {
    return (
      <p className={styles.partyNote}>
        <span className={styles.unitMystery}>? {question.unit}</span>
      </p>
    );
  }
  if (question.kind === 'bluff') return <p className={styles.partyNote}>{stage.phase === 'bluff_write' ? t.bluffWriteTitle : ''}</p>;
  return null;
}

/** Blöffölő: the lies and the truth, lettered, as the phones show them. */
function OptionGrid({ options }: { options: string[] }) {
  return (
    <ol className={`${styles.tiles} ${styles.tilesOpen} ${options.length > 4 ? styles.tilesMany : ''}`}>
      {options.map((text, i) => (
        <li key={i} className={styles.tile} style={tileStyle(optionTile(i), i)}>
          <span className={styles.tileLetter}>{letterOf(i)}</span>
          <span className={styles.tileText}>{text}</span>
        </li>
      ))}
    </ol>
  );
}
