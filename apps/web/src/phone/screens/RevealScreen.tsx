import {
  FLAG_REASONS,
  slotsRight,
  t,
  type FlagReason,
  type LadderSeat,
  type Pick,
  type PlayerView,
  type RevealResult,
  type Stage,
} from '@trivia/shared';
import { useEffect, useState } from 'react';
import { send } from '../../net/send.ts';
import type { GameSocket } from '../../net/socket.ts';
import { LETTERS } from '../../ui/answers.ts';
import { withUnit } from '../../ui/format.ts';
import { Burst } from '../Burst.tsx';
import styles from '../Phone.module.css';
import { OrderList } from './OrderScreen.tsx';

type RevealStage = Extract<Stage, { phase: 'reveal' }>;

export function RevealScreen({ view, stage, socket }: { view: PlayerView; stage: RevealStage; socket: GameSocket }) {
  const pick = stage.picks.find((p) => p.playerId === view.me.id);
  const correct = pick?.correct ?? false;
  const seat = view.ladder?.seats.find((s) => s.playerId === view.me.id) ?? null;
  // One buzz per reveal: two short taps for right, one long for wrong.
  useEffect(() => {
    navigator.vibrate?.(correct ? [60, 50, 60] : [250]);
  }, [stage.question.id, correct]);
  const { result, question } = stage;
  return (
    <div className={styles.column}>
      {seat ? (
        <LadderVerdict seat={seat} climbed={pick !== undefined} correct={correct} />
      ) : (
        <Verdict good={correct} text={verdictText(view, result, pick)} points={pick?.points ?? 0} note={verdictNote(view, result)} />
      )}
      {result.kind === 'mc' && question.kind === 'mc' && (
        <>
          <p className={styles.hint}>{t.theAnswerWas}</p>
          <p className={styles.answerText}>
            {LETTERS[result.correct]}: {question.choices[result.correct]}
          </p>
        </>
      )}
      {result.kind === 'bluff' && (
        <>
          <p className={styles.hint}>{t.bluffTruthWas}</p>
          <p className={styles.answerText}>{result.options.find((o) => o.truth)?.text}</p>
        </>
      )}
      {result.kind === 'timeline' && question.kind === 'timeline' && (
        <>
          <p className={styles.hint}>{t.orderCorrectWas}</p>
          <OrderList
            items={question.items.map((text, i) => `${result.years[result.order.indexOf(i)]} · ${text}`)}
            order={result.order}
            marks={result.order.map((item, k) => result.orders[view.me.id]?.[k] === item)}
          />
        </>
      )}
      {result.kind === 'number' && (
        <>
          <p className={styles.hint}>{t.guessAnswerWas}</p>
          <p className={styles.answerText}>{withUnit(result.answer, result.unit)}</p>
        </>
      )}
      <FlagButton questionId={question.id} flagged={view.mine.flagged} socket={socket} />
    </div>
  );
}

function Verdict({ good, text, points, note }: { good: boolean; text: string; points: number; note: string | null }) {
  return (
    <div className={`${styles.verdict} ${good ? styles.verdictGood : styles.verdictBad}`} data-testid="verdict">
      {good && <Burst count={22} />}
      <span className={styles.verdictText}>{text}</span>
      {note && <span className={styles.verdictNote}>{note}</span>}
      {points > 0 && <span className={styles.verdictPoints}>{t.plusPoints(points)}</span>}
    </div>
  );
}

/** How the round went for this player, in the words of its mode. */
function verdictText(view: PlayerView, result: RevealResult, pick: Pick | undefined): string {
  const me = view.me.id;
  switch (result.kind) {
    case 'mc':
      return pick?.correct ? t.correct : pick?.choice === null ? t.tooSlow : t.wrong;
    case 'bluff': {
      if (pick?.correct) return t.bluffFoundTruth;
      const chosen = pick?.choice !== null && pick?.choice !== undefined ? result.options[pick.choice] : undefined;
      if (!chosen) return t.bluffMissed;
      return t.bluffFooledBy(chosen.authors.map((id) => view.players.find((p) => p.id === id)?.name ?? '?').join(', '));
    }
    case 'timeline': {
      const order = result.orders[me];
      if (!order) return t.tooSlow;
      const right = slotsRight(order, result.order);
      return right === result.order.length ? t.orderPerfect : t.orderRight(right, result.order.length);
    }
    case 'number': {
      if (!result.guesses.some((g) => g.playerId === me)) return t.tooSlow;
      return pick?.correct ? t.guessClosest : t.guessNotClosest;
    }
  }
}

/** A second line: whom your lie fooled, how far off your guess was, what your chips won. */
function verdictNote(view: PlayerView, result: RevealResult): string | null {
  const me = view.me.id;
  if (result.kind === 'bluff') {
    const fooled = result.options.filter((o) => o.authors.includes(me)).reduce((n, o) => n + o.pickers.length, 0);
    return fooled > 0 ? t.bluffFooled(fooled) : null;
  }
  if (result.kind === 'number') {
    const mine = result.guesses.find((g) => g.playerId === me);
    const winning = new Set(result.guesses.flatMap((g, i) => (result.closest.includes(g.playerId) ? [i] : [])));
    const won = (result.bets[me] ?? []).filter((c) => winning.has(c)).length;
    const parts = [mine && mine.distance > 0 ? t.guessOff(withUnit(mine.distance, result.unit)) : null, won > 0 ? t.chipsWon(won) : null];
    return parts.filter(Boolean).join(' · ') || null;
  }
  return null;
}

/**
 * Milliomos-létra: what this rung did to you. Those already off the ladder
 * (the audience) just see where they ended up.
 */
function LadderVerdict({ seat, climbed, correct }: { seat: LadderSeat; climbed: boolean; correct: boolean }) {
  const good = seat.status === 'top' || (climbed && correct);
  const text = !climbed
    ? t.seatStatus[seat.status]
    : seat.status === 'top'
      ? t.reachedTop
      : correct
        ? t.climbed
        : seat.status === 'walked'
          ? t.youWalked
          : t.fell;
  return (
    <div className={`${styles.verdict} ${good ? styles.verdictGood : styles.verdictBad}`} data-testid="verdict">
      {good && <Burst count={22} />}
      <span className={styles.verdictText}>{text}</span>
      <span className={styles.verdictPoints}>{seat.status === 'in' || seat.status === 'top' ? t.rung(seat.rung) : t.youKeep(seat.rung)}</span>
    </div>
  );
}

/** "Something wrong with this question?" → reason list → thanks. */
function FlagButton({ questionId, flagged, socket }: { questionId: string; flagged: boolean; socket: GameSocket }) {
  const [open, setOpen] = useState(false);
  if (flagged) return <p className={styles.flagThanks}>{t.flagThanks}</p>;
  if (!open) {
    return (
      <button className={styles.textButton} onClick={() => setOpen(true)}>
        {t.flagQuestion}
      </button>
    );
  }
  const flag = (reason: FlagReason) => {
    setOpen(false);
    void send(socket, 'question:flag', { questionId, reason });
  };
  return (
    <div className={styles.flagSheet}>
      {FLAG_REASONS.map((r) => (
        <button key={r} className={styles.secondary} onClick={() => flag(r)}>
          {t.flagReasons[r]}
        </button>
      ))}
      <button className={styles.textButton} onClick={() => setOpen(false)}>
        {t.cancel}
      </button>
    </div>
  );
}
