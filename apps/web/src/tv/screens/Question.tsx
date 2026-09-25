import { pointsMultiplier, t, TIMINGS, type HostView, type McQuestionStage, type PublicQuestion } from '@trivia/shared';
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useLayoutEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { useInStudio } from '../../stage/StudioContext.ts';
import { Character } from '../../ui/Character.tsx';
import { FlipClock } from '../../ui/FlipClock.tsx';
import { OttoFace } from '../../ui/Otto.tsx';
import { PowerIcon } from '../../ui/PowerIcon.tsx';
import { TimerBar } from '../../ui/TimerBar.tsx';
import { LETTERS, TILE } from '../../ui/answers.ts';
import styles from '../Tv.module.css';
import { RoundLabel } from './common.tsx';

gsap.registerPlugin(SplitText);

/** Seconds into the read when the round card flips away (matches .roundCard in Tv.module.css)… */
const CARD_OUT = 0.7;
/** …and when the question's words start landing, once the card is gone. */
const WORDS_IN = CARD_OUT + 0.28;

/** The ladder gives more time to answer: there are lifelines to use. */
function openMs(view: HostView): number {
  return view.mode === 'ladder' ? TIMINGS.ladderOpen : TIMINGS.questionOpen;
}

/** In the studio the question lands word by word after the round card, once per question. */
export function usePromptWordsIn(ref: RefObject<HTMLElement | null>, questionId: string, reading: boolean): void {
  const inStudio = useInStudio();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!inStudio || !el || !reading) return;
    const split = SplitText.create(el, { type: 'words' });
    const tween = gsap.from(split.words, {
      y: '0.7em',
      rotationX: -70,
      opacity: 0,
      duration: 0.45,
      stagger: 0.04,
      delay: WORDS_IN,
      ease: 'back.out(2)',
    });
    return () => {
      tween.kill();
      split.revert();
    };
  }, [inStudio, questionId]); // once per question: the prompt stays when answers open
}

/** The split-flap card before each question in the studio: round, category, and the double-points badge. */
export function RoundCard({ view, question }: { view: HostView; question: PublicQuestion }) {
  return (
    <div className={styles.roundCard} aria-hidden="true">
      <span className={styles.roundCardNumber}>{view.mode === 'ladder' ? t.rung(view.round) : t.roundCard(view.round)}</span>
      <span className={styles.roundCardMeta}>
        {question.category} · {t.difficulty[question.difficulty]}
      </span>
      {view.mode !== 'ladder' && pointsMultiplier(view.round, view.totalRounds) > 1 && (
        <span className={styles.doubleBadge}>{t.doublePoints}</span>
      )}
    </div>
  );
}

export function Question({ view, stage }: { view: HostView; stage: McQuestionStage }) {
  const { question } = stage;
  const open = stage.phase === 'question_open';
  const answered = new Set(open ? stage.answered : []);
  const inStudio = useInStudio();
  const promptRef = useRef<HTMLHeadingElement>(null);
  usePromptWordsIn(promptRef, question.id, stage.phase === 'question_read');

  return (
    <div className={`${styles.game} ${inStudio ? styles.gameStudio : ''}`}>
      <header className={styles.gameHeader}>
        <RoundLabel view={view} />
        <span className={styles.categoryChip}>
          {question.category} · {t.difficulty[question.difficulty]}
        </span>
        {inStudio && open ? (
          <FlipClock endsAt={view.phaseEndsAt} />
        ) : (
          <span className={styles.hint}>{open ? t.answerOnPhone : t.getReady}</span>
        )}
      </header>
      <h2 className={styles.prompt} data-testid="prompt" ref={promptRef}>
        {question.prompt}
      </h2>
      <ol className={`${styles.tiles} ${open ? styles.tilesOpen : inStudio ? styles.tilesHidden : styles.tilesWaiting}`}>
        {question.choices.map((c, i) => (
          <li key={i} className={styles.tile} style={{ background: TILE[i]!.bg, color: TILE[i]!.fg, '--i': i } as CSSProperties}>
            <span className={styles.tileLetter}>{LETTERS[i]}</span>
            <span className={styles.tileText}>{c}</span>
          </li>
        ))}
      </ol>
      {inStudio && stage.phase === 'question_read' && <RoundCard view={view} question={question} />}
      {!inStudio && (
        <footer className={styles.gameFooter}>
          <OttoFace size="7em" />
          <ul className={styles.answerRow}>
            {view.players.map((p) => (
              <li key={p.id} className={`${styles.answerRowItem} ${answered.has(p.id) ? styles.lockedIn : ''}`}>
                <Character id={p.avatar.character} size="3.6em" dimmed={!p.connected} />
                <span>{p.name}</span>
                <span className={styles.rowHits}>
                  {stage.hits
                    .filter((h) => h.target === p.id && !h.cleared)
                    .map((h, i) => (
                      <PowerIcon key={i} power={h.power} size="1.4em" />
                    ))}
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.footerTimer}>
            <TimerBar endsAt={view.phaseEndsAt} totalMs={open ? openMs(view) : TIMINGS.questionRead} />
          </div>
        </footer>
      )}
    </div>
  );
}
