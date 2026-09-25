import { BLUFF_BLANK, t, type HostView, type Pick, type PlayerSummary, type RevealResult, type Stage } from '@trivia/shared';
import type { CSSProperties } from 'react';
import { Blob } from '../../ui/Blob.tsx';
import { useInStudio } from '../../stage/StudioContext.ts';
import { Otto } from '../../ui/Otto.tsx';
import { LETTERS, letterOf, optionTile, TILE } from '../../ui/answers.ts';
import { withUnit } from '../../ui/format.ts';
import styles from '../Tv.module.css';
import { RoundLabel } from './common.tsx';

type RevealStage = Extract<Stage, { phase: 'reveal' }>;
type ResultOf<K extends RevealResult['kind']> = Extract<RevealResult, { kind: K }>;

export function Reveal({ view, stage }: { view: HostView; stage: RevealStage }) {
  const inStudio = useInStudio();
  const { question, picks, result } = stage;
  const byId = new Map(view.players.map((p) => [p.id, p]));
  const noAnswer = result.kind === 'bluff' || result.kind === 'mc' ? picks.filter((p) => p.choice === null) : [];
  // Blöffölő: the truth fills the blank once it's out.
  const prompt =
    result.kind === 'bluff' ? question.prompt.split(BLUFF_BLANK).join(result.options.find((o) => o.truth)?.text ?? BLUFF_BLANK) : question.prompt;
  return (
    <div className={styles.game}>
      <header className={styles.gameHeader}>
        <RoundLabel view={view} />
        <span className={styles.categoryChip}>{question.category}</span>
        <span />
      </header>
      <h2 className={`${styles.prompt} ${styles.promptSmall}`}>{prompt}</h2>
      {result.kind === 'mc' && question.kind === 'mc' && (
        <McTiles choices={question.choices} result={result} picks={picks} byId={byId} mode={view.mode} />
      )}
      {result.kind === 'bluff' && <BluffTiles result={result} picks={picks} byId={byId} />}
      {result.kind === 'timeline' && question.kind === 'timeline' && (
        <OrderReveal items={question.items} result={result} picks={picks} byId={byId} />
      )}
      {result.kind === 'number' && <GuessReveal result={result} picks={picks} byId={byId} />}
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

type ById = Map<string, PlayerSummary>;

/** A player's blob dropping onto a tile, with the points they won (when `points` is given). */
function PickerBlob({ player, index, points }: { player: PlayerSummary | undefined; index: number; points?: number }) {
  if (!player) return null;
  return (
    <span className={styles.picker} style={{ '--j': index } as CSSProperties}>
      <Blob avatar={player.avatar} size="2.8em" />
      {points !== undefined && points > 0 && <span className={styles.pickerPoints}>{t.plusPoints(points)}</span>}
    </span>
  );
}

/** The quiz: the right tile flashes, the wrong ones dim, and everyone's pick drops onto theirs. */
function McTiles({ choices, result, picks, byId, mode }: { choices: string[]; result: ResultOf<'mc'>; picks: Pick[]; byId: ById; mode: HostView['mode'] }) {
  return (
    <ol className={styles.tiles}>
      {choices.map((c, i) => {
        const isCorrect = i === result.correct;
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
                .map((p, j) => (
                  <PickerBlob key={p.playerId} player={byId.get(p.playerId)} index={j} points={mode !== 'ladder' ? p.points : undefined} />
                ))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Blöffölő: the options as they were shown, now with who wrote each lie and
 * who fell for it; the truth flashes.
 */
function BluffTiles({ result, picks, byId }: { result: ResultOf<'bluff'>; picks: Pick[]; byId: ById }) {
  const points = new Map(picks.map((p) => [p.playerId, p.points]));
  return (
    <ol className={`${styles.tiles} ${result.options.length > 4 ? styles.tilesMany : ''}`}>
      {result.options.map((o, i) => {
        const tile = optionTile(i);
        const names = o.authors.map((id) => byId.get(id)?.name ?? '?').join(', ');
        return (
          <li
            key={i}
            className={`${styles.tile} ${o.truth ? styles.tileCorrect : styles.tileLie}`}
            style={{ background: tile.bg, color: tile.fg, '--i': i } as CSSProperties}
            data-testid={o.truth ? 'correct-tile' : 'bluff-option'}
          >
            <span className={styles.tileLetter}>{letterOf(i)}</span>
            <span className={styles.optionBody}>
              <span className={styles.tileText}>{o.text}</span>
              <span className={styles.optionTag}>{o.truth ? t.bluffTruthTag : names ? t.bluffWroteIt(names) : t.bluffHouseLie}</span>
            </span>
            <span className={styles.pickers}>
              {o.pickers.map((id, j) => (
                <PickerBlob key={id} player={byId.get(id)} index={j} points={o.truth ? points.get(id) : undefined} />
              ))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Időrend: the cards fall into order with their years; below, how each player's order compares. */
function OrderReveal({ items, result, picks, byId }: { items: string[]; result: ResultOf<'timeline'>; picks: Pick[]; byId: ById }) {
  return (
    <div className={styles.orderReveal}>
      <ol className={`${styles.timelineRow} ${styles.tilesOpen}`}>
        {result.order.map((shown, k) => (
          <li
            key={shown}
            className={`${styles.tile} ${styles.timelineCard}`}
            style={{ background: optionTile(shown).bg, color: optionTile(shown).fg, '--i': k } as CSSProperties}
            data-testid={k === 0 ? 'correct-tile' : undefined}
          >
            <span className={styles.timelineYear}>{result.years[k]}</span>
            <span className={styles.tileLetter}>{letterOf(shown)}</span>
            <span className={styles.timelineText}>{items[shown]}</span>
          </li>
        ))}
      </ol>
      <ul className={styles.orderRows}>
        {picks.map((p, j) => {
          const player = byId.get(p.playerId);
          const order = result.orders[p.playerId] ?? null;
          return (
            <li key={p.playerId} className={styles.orderRow} style={{ '--j': j } as CSSProperties}>
              {player && <Blob avatar={player.avatar} size="2.4em" />}
              <span className={styles.orderName}>{player?.name}</span>
              {order ? (
                order.map((shown, k) => (
                  <span key={k} className={`${styles.orderChip} ${shown === result.order[k] ? styles.orderChipGood : styles.orderChipBad}`}>
                    {letterOf(shown)}
                  </span>
                ))
              ) : (
                <span className={styles.orderNone}>{t.noAnswer}</span>
              )}
              {p.points > 0 && <span className={styles.pickerPoints}>{t.plusPoints(p.points)}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Tippelj!: the exact answer, then every guess by how far off it was, with the chips that backed it. */
function GuessReveal({ result, picks, byId }: { result: ResultOf<'number'>; picks: Pick[]; byId: ById }) {
  const points = new Map(picks.map((p) => [p.playerId, p.points]));
  const byDistance = result.guesses.map((g, index) => ({ ...g, index })).sort((a, b) => a.distance - b.distance || a.index - b.index);
  const backers = (index: number) =>
    Object.entries(result.bets).flatMap(([id, chips]) => chips.filter((c) => c === index).map(() => id));
  return (
    <div className={styles.guessReveal}>
      <p className={styles.answerCard} data-testid="correct-tile">
        {withUnit(result.answer, result.unit)}
      </p>
      <ol className={styles.guessList}>
        {byDistance.map((g, j) => {
          const player = byId.get(g.playerId);
          const closest = result.closest.includes(g.playerId);
          return (
            <li key={g.playerId} className={`${styles.guessRow} ${closest ? styles.guessRowBest : ''}`} style={{ '--j': j } as CSSProperties}>
              {player && <Blob avatar={player.avatar} size="2.6em" />}
              <span className={styles.orderName}>{player?.name}</span>
              <span className={styles.guessValue}>{withUnit(g.value, result.unit)}</span>
              <span className={styles.guessOff}>{g.distance === 0 ? '✓' : t.guessOff(t.number(g.distance))}</span>
              <span className={styles.chips}>
                {backers(g.index).map((id, k) => {
                  const b = byId.get(id);
                  return b ? <Blob key={`${id}-${k}`} avatar={b.avatar} size="1.6em" /> : null;
                })}
              </span>
              {(points.get(g.playerId) ?? 0) > 0 && <span className={styles.pickerPoints}>{t.plusPoints(points.get(g.playerId)!)}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
