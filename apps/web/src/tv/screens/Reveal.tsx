import { BLUFF_BLANK, t, type Expression, type HostView, type Pick, type PlayerSummary, type RevealResult, type Stage } from '@trivia/shared';
import type { CSSProperties } from 'react';
import { Character } from '../../ui/Character.tsx';
import { useInStudio } from '../../stage/StudioContext.ts';
import { Otto } from '../../ui/Otto.tsx';
import { letterOf, optionTile, TILE, tileStyle } from '../../ui/answers.ts';
import { AnswerShape } from '../../ui/AnswerShape.tsx';
import { heldExpression, revealExpression } from '../../stage/expressions.ts';
import { BluffCards, Clothesline, Tape } from './PartyProps.tsx';
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
      {result.kind === 'bluff' && <BluffCards options={result.options} byId={byId} points={new Map(picks.map((p) => [p.playerId, p.points]))} />}
      {result.kind === 'timeline' && question.kind === 'timeline' && (
        <OrderReveal items={question.items} result={result} picks={picks} byId={byId} face={(id) => revealExpression(stage, id)} />
      )}
      {result.kind === 'number' && (
        <Tape
          guesses={result.guesses}
          unit={result.unit}
          byId={byId}
          answer={result.answer}
          bets={result.bets}
          closest={result.closest}
          faces={(id) => revealExpression(stage, id) ?? heldExpression(view, id)}
        />
      )}
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

/** A player dropping onto a tile, with the face it earned and the points they won (when `points` is given). */
function PickerBlob({ player, index, points, expression }: { player: PlayerSummary | undefined; index: number; points?: number; expression?: Expression }) {
  if (!player) return null;
  return (
    <span className={styles.picker} style={{ '--j': index } as CSSProperties}>
      <Character id={player.avatar.character} size="2.8em" expression={expression} />
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
            style={tileStyle(TILE[i]!, i)}
            data-testid={isCorrect ? 'correct-tile' : undefined}
          >
            <span className={styles.tileLetter}>
              <AnswerShape index={i} color={TILE[i]!.bg} />
            </span>
            <span className={styles.tileText}>{c}</span>
            <span className={styles.pickers}>
              {picks
                .filter((p) => p.choice === i)
                .map((p, j) => (
                  <PickerBlob
                    key={p.playerId}
                    player={byId.get(p.playerId)}
                    index={j}
                    points={mode !== 'ladder' ? p.points : undefined}
                    expression={isCorrect ? 'correct' : 'wrong'}
                  />
                ))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Időrend: the cards hang in order with their years; below, how each player did. */
function OrderReveal({
  items,
  result,
  picks,
  byId,
  face,
}: {
  items: string[];
  result: ResultOf<'timeline'>;
  picks: Pick[];
  byId: ById;
  face: (playerId: string) => Expression | undefined;
}) {
  return (
    <div className={styles.orderReveal}>
      <Clothesline cards={result.order.map((item) => ({ item, text: items[item]! }))} open years={result.years} />
      <ul className={styles.orderRows}>
        {picks.map((p, j) => {
          const player = byId.get(p.playerId);
          const order = result.orders[p.playerId] ?? null;
          const right = order ? order.filter((shown, k) => shown === result.order[k]).length : 0;
          return (
            <li key={p.playerId} className={styles.orderRow} style={{ '--j': j } as CSSProperties}>
              {player && <Character id={player.avatar.character} size="5.6em" expression={face(p.playerId)} />}
              <span className={styles.orderCard}>
                <span className={styles.orderName}>{player?.name}</span>
                <span className={`${styles.orderScore} ${order && right === order.length ? styles.orderPerfect : ''}`}>
                  {!order ? t.noAnswer : right === order.length ? t.orderPerfect : t.orderRight(right, order.length)}
                </span>
                {p.points > 0 && <span className={styles.pickerPoints}>{t.plusPoints(p.points)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
