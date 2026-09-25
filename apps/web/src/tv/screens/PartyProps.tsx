import { t, type BluffOption, type Expression, type Guess, type PlayerSummary } from '@trivia/shared';
import type { CSSProperties } from 'react';
import { Character } from '../../ui/Character.tsx';
import { letterOf, optionTile } from '../../ui/answers.ts';
import { withUnit } from '../../ui/format.ts';
import styles from '../Tv.module.css';

// The party modes' paper props on the TV: Időrend's clothesline, Tippelj!'s
// measuring tape and chips, and Blöffölő's cards with the truth's rosette.

type ById = Map<string, PlayerSummary>;

const TILTS = [-3, 2, -1.5, 3, -2, 1.5];

/**
 * Időrend: the cards pegged on a clothesline that sags in the middle, each
 * with the letter and colour the phones use. At the reveal they hang in the
 * right order with their years underneath, over a timeline arrow.
 */
export function Clothesline({ cards, open, years }: { cards: { item: number; text: string }[]; open: boolean; years?: number[] }) {
  return (
    <div className={`${styles.clothesline} ${years ? styles.clotheslineRevealed : ''}`}>
      <ol className={`${styles.lineCards} ${open ? styles.tilesOpen : ''}`}>
        {cards.map((c, k) => {
          // The rope is the curve y = 20 + 140·u(1−u) in a 1000×90 drawing: hang each card from it.
          const u = (k + 0.5) / cards.length;
          const drop = ((20 + 140 * u * (1 - u)) / 1000) * 100;
          const tile = optionTile(c.item);
          return (
            <li
              key={c.item}
              className={styles.hangCard}
              style={{ '--i': k, '--tilt': `${TILTS[k % TILTS.length]}deg`, '--drop': `${drop}%` } as CSSProperties}
              data-testid={years && k === 0 ? 'correct-tile' : undefined}
            >
              <span className={styles.hangPaper}>
                <img className={styles.peg} src="/art/peg.svg" alt="" draggable={false} />
                <span className={styles.hangLetter} style={{ background: tile.bg, color: tile.fg }}>
                  {letterOf(c.item)}
                </span>
                <span className={styles.timelineText}>{c.text}</span>
              </span>
              {years && <span className={styles.yearTag}>{years[k]}</span>}
            </li>
          );
        })}
      </ol>
      {years && <img className={styles.timelineArrow} src="/art/timeline.svg" alt="" draggable={false} />}
    </div>
  );
}

/**
 * Tippelj!: everyone's guess pinned on a paper measuring tape, smallest
 * first, evenly spaced (the values can be wildly apart). At the reveal the
 * chips stack on the guesses they backed, and a marker shows where the exact
 * answer falls between the guesses.
 */
export function Tape({
  guesses,
  unit,
  byId,
  answer,
  bets,
  faces,
  closest = [],
}: {
  guesses: Guess[];
  unit: string | null;
  byId: ById;
  /** The exact answer, at the reveal. */
  answer?: number;
  /** Each player's chips (indices into `guesses`), at the reveal. */
  bets?: Record<string, number[]>;
  faces?: (playerId: string) => Expression | undefined;
  closest?: string[];
}) {
  const n = guesses.length;
  const x = (i: number) => ((i + 0.5) / n) * 100;
  return (
    <div className={styles.tape}>
      <ol className={styles.tapeGuesses}>
        {guesses.map((g, i) => {
          const p = byId.get(g.playerId);
          const backers = bets ? Object.entries(bets).flatMap(([id, chips]) => chips.filter((c) => c === i).map(() => id)) : [];
          const spotOn = answer !== undefined && g.value === answer;
          return (
            <li
              key={g.playerId}
              className={`${styles.tapeGuess} ${closest.includes(g.playerId) ? styles.tapeBest : ''}`}
              style={{ left: `${x(i)}%`, '--i': i } as CSSProperties}
            >
              {spotOn && <span className={styles.spotOn}>{t.guessSpotOn}</span>}
              {p && <Character id={p.avatar.character} size="6.6em" expression={faces?.(g.playerId)} />}
              <span className={styles.tapeName}>{p?.name}</span>
              <span className={styles.valueTag}>{withUnit(g.value, unit)}</span>
              {backers.length > 0 && (
                <span className={styles.chipStack}>
                  {backers.map((id, k) => {
                    const b = byId.get(id);
                    return (
                      <span key={`${id}-${k}`} className={styles.chip} style={{ '--k': k } as CSSProperties}>
                        {b && <Character id={b.avatar.character} size="1.3em" />}
                      </span>
                    );
                  })}
                </span>
              )}
              <img className={styles.pin} src="/art/pin.svg" alt="" draggable={false} />
            </li>
          );
        })}
      </ol>
      <div className={styles.tapeStrip} />
      {answer !== undefined && (
        <div className={styles.tapeAnswer} style={{ left: `${answerX(guesses, answer, x)}%` }} data-testid="correct-tile">
          <span className={styles.tapeArrow} aria-hidden="true" />
          <span className={styles.tapeAnswerLabel}>{t.guessExactLabel}</span>
          <span className={styles.tapeAnswerValue}>{withUnit(answer, unit)}</span>
        </div>
      )}
    </div>
  );
}

/** Where the answer falls on the evenly spaced guesses: between its neighbours, in proportion. */
export function answerX(guesses: Guess[], answer: number, x: (i: number) => number): number {
  const n = guesses.length;
  if (n === 0) return 50;
  const half = 50 / n;
  if (answer <= guesses[0]!.value) return Math.max(4, x(0) - (answer < guesses[0]!.value ? half : 0));
  if (answer >= guesses[n - 1]!.value) return Math.min(96, x(n - 1) + (answer > guesses[n - 1]!.value ? half : 0));
  for (let i = 0; i < n - 1; i++) {
    const lo = guesses[i]!.value;
    const hi = guesses[i + 1]!.value;
    if (answer >= lo && answer <= hi) return x(i) + ((answer - lo) / (hi - lo || 1)) * (x(i + 1) - x(i));
  }
  return 50;
}

/**
 * Blöffölő's reveal: each option on a paper card. The truth is gold with a
 * rosette and the faces of who found it; each lie says who wrote it (they
 * grin if it worked) and shows who fell for it.
 */
export function BluffCards({ options, byId, points }: { options: BluffOption[]; byId: ById; points: Map<string, number> }) {
  return (
    <ol className={`${styles.bluffCards} ${options.length > 4 ? styles.bluffCardsMany : ''}`}>
      {options.map((o, i) => {
        const names = o.authors.map((id) => byId.get(id)?.name ?? '?').join(', ');
        return (
          <li
            key={i}
            className={`${styles.bluffCard} ${o.truth ? styles.bluffTruth : styles.bluffLie}`}
            style={{ '--i': i } as CSSProperties}
            data-testid={o.truth ? 'correct-tile' : 'bluff-option'}
          >
            {o.truth && <img className={styles.rosette} src="/art/rosette.svg" alt="" draggable={false} />}
            <span className={styles.bluffText}>{o.text}</span>
            <span className={styles.bluffTag}>
              {!o.truth && <img className={styles.bluffMask} src="/art/mask.svg" alt="" draggable={false} />}
              {o.truth ? t.bluffTruthTag : names ? t.bluffWroteIt(names) : t.bluffHouseLie}
            </span>
            <span className={styles.bluffPeople}>
              {!o.truth &&
                o.authors.map((id) => {
                  const p = byId.get(id);
                  const worked = o.pickers.some((picker) => picker !== id);
                  return p ? <Character key={id} id={p.avatar.character} size="2.8em" expression={worked ? 'sneaky' : undefined} /> : null;
                })}
              <span className={styles.bluffPickers}>
                {o.pickers.length > 0 ? (
                  <>
                    <span className={styles.bluffPickersLabel}>{o.truth ? t.bluffFound : t.bluffFellFor}</span>
                    {o.pickers.map((id, j) => {
                      const p = byId.get(id);
                      if (!p) return null;
                      const won = o.truth ? (points.get(id) ?? 0) : 0;
                      return (
                        <span key={id} className={styles.picker} style={{ '--j': j } as CSSProperties}>
                          <Character id={p.avatar.character} size="2.6em" expression={o.truth ? 'correct' : 'fooled'} />
                          {won > 0 && <span className={styles.pickerPoints}>{t.plusPoints(won)}</span>}
                        </span>
                      );
                    })}
                  </>
                ) : (
                  !o.truth && <span className={styles.bluffPickersLabel}>{t.bluffNobodyFell}</span>
                )}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
