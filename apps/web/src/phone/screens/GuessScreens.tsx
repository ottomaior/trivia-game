import { GUESS_CHIPS, t, type PlayerView, type Stage } from '@trivia/shared';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { send } from '../../net/send.ts';
import type { GameSocket } from '../../net/socket.ts';
import { Character } from '../../ui/Character.tsx';
import { optionTile } from '../../ui/answers.ts';
import { withUnit } from '../../ui/format.ts';
import { parseGuess } from '../guess.ts';
import styles from '../Phone.module.css';

type GuessStage = Extract<Stage, { phase: 'guess_open' }>;
type BetStage = Extract<Stage, { phase: 'guess_bet' }>;

function unitOf(stage: GuessStage | BetStage): string | null {
  return stage.question.kind === 'number' ? stage.question.unit : null;
}

/** Tippelj!: type a number; the closest guess wins. */
export function GuessScreen({ view, stage, socket }: { view: PlayerView; stage: GuessStage; socket: GameSocket }) {
  const { question } = stage;
  const unit = unitOf(stage);
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState<{ questionId: string; value: number } | null>(null);
  const mine = view.mine.guess ?? (pending?.questionId === question.id ? pending.value : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = parseGuess(text);
    if (value === null) {
      setInvalid(true);
      return;
    }
    if (pending) return;
    setPending({ questionId: question.id, value });
    navigator.vibrate?.(40);
    const res = await send(socket, 'guess:submit', { questionId: question.id, value });
    if (!res.ok) setPending(null);
  }

  if (mine !== null) {
    return (
      <div className={styles.column}>
        <p className={styles.hint}>{t.yourGuess}</p>
        <div className={styles.lockedCard} style={{ background: 'var(--teal)' }} data-testid="my-guess">
          <span className={styles.lockedLetter}>{withUnit(mine, unit)}</span>
        </div>
        <h2 className={styles.screenTitle}>{t.lockedIn}</h2>
        <p className={styles.hint}>{t.waitForOthers}</p>
      </div>
    );
  }

  return (
    <form className={`${styles.column} ${styles.form}`} onSubmit={submit}>
      <p className={styles.phonePrompt}>{question.prompt}</p>
      <p className={styles.hint}>{t.guessHint}</p>
      <div className={styles.guessField}>
        <input
          className={`${styles.input} ${styles.guessInput}`}
          name="guess"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setInvalid(false);
          }}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="send"
          placeholder={t.guessPlaceholder}
          aria-label={t.guessPlaceholder}
          data-testid="guess-input"
        />
        {unit && <span className={styles.guessUnit}>{unit}</span>}
      </div>
      {invalid && (
        <p className={styles.error} role="alert">
          {t.guessInvalid}
        </p>
      )}
      <button className={styles.primary} type="submit" disabled={!text.trim() || pending !== null} data-testid="guess-submit">
        {t.guessSubmit}
      </button>
    </form>
  );
}

/**
 * Tippelj!: put two chips on the guesses you think are closest (both on
 * one is fine, your own too). The chips go in as soon as both are down.
 */
export function BetScreen({ view, stage, socket }: { view: PlayerView; stage: BetStage; socket: GameSocket }) {
  const { question, guesses } = stage;
  const unit = unitOf(stage);
  const [chips, setChips] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const placed = view.mine.bets ?? (sending ? chips : null);

  if (view.mine.guess === null) return <p className={styles.bigNote}>{t.noGuessNoBet}</p>;

  async function place(index: number) {
    if (placed || chips.length >= GUESS_CHIPS) return;
    const next = [...chips, index];
    setChips(next);
    navigator.vibrate?.(25);
    if (next.length < GUESS_CHIPS) return;
    setSending(true);
    const res = await send(socket, 'guess:bet', { questionId: question.id, chips: next });
    setSending(false);
    if (!res.ok) setChips([]);
  }

  const shown = placed ?? chips;
  const byId = new Map(view.players.map((p) => [p.id, p]));
  return (
    <div className={styles.column}>
      <h2 className={styles.screenTitle}>{t.betTitle}</h2>
      <p className={styles.hint}>{placed ? t.lockedIn : t.betHint(GUESS_CHIPS - chips.length)}</p>
      <div className={styles.choices}>
        {guesses.map((g, i) => {
          const tile = optionTile(i);
          const p = byId.get(g.playerId);
          const on = shown.filter((c) => c === i).length;
          return (
            <button
              key={g.playerId}
              className={`${styles.choice} ${styles.choiceCompact} ${on > 0 ? styles.choiceMine : ''}`}
              style={{ background: tile.bg, color: tile.fg } as CSSProperties}
              disabled={placed !== null}
              onClick={() => void place(i)}
              data-testid={`bet-${i}`}
            >
              {p && <Character id={p.avatar.character} size="2.6rem" />}
              <span className={styles.choiceText}>
                {withUnit(g.value, unit)}
                <span className={styles.betOwner}>{g.playerId === view.me.id ? t.mineTag(p?.name ?? '') : p?.name}</span>
              </span>
              <span className={styles.betChips} aria-label={t.betChips(on)}>
                {'●'.repeat(on)}
              </span>
            </button>
          );
        })}
      </div>
      {!placed && chips.length > 0 && (
        <button className={styles.textButton} onClick={() => setChips([])}>
          {t.cancel}
        </button>
      )}
    </div>
  );
}
