import { BLUFF_LIE_MAX_CHARS, t, type PlayerView, type Stage } from '@trivia/shared';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { send } from '../../net/send.ts';
import type { GameSocket } from '../../net/socket.ts';
import { letterOf, optionTile } from '../../ui/answers.ts';
import styles from '../Phone.module.css';

type WriteStage = Extract<Stage, { phase: 'bluff_write' }>;
type PickStage = Extract<Stage, { phase: 'bluff_pick' }>;

/** While Otto reads a party-mode question: the prompt, and a moment to get ready. */
export function ReadingScreen({ prompt }: { prompt: string }) {
  return (
    <div className={styles.column}>
      <p className={styles.phonePrompt}>{prompt}</p>
      <p className={styles.hint}>{t.getReady}</p>
    </div>
  );
}

/** Loosely equal texts, the way the server merges lies: case, accents and punctuation don't count. */
function sameText(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  return norm(a) === norm(b);
}

/** Blöffölő: type a believable lie for the blank. A lie that is (nearly) the truth comes back to be rewritten. */
export function BluffWriteScreen({ view, stage, socket }: { view: PlayerView; stage: WriteStage; socket: GameSocket }) {
  const { question } = stage;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ questionId: string; lie: string } | null>(null);
  const mine = view.mine.lie ?? (pending?.questionId === question.id ? pending.lie : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const lie = text.trim();
    if (!lie || pending) return;
    setError(null);
    setPending({ questionId: question.id, lie });
    navigator.vibrate?.(40);
    const res = await send(socket, 'bluff:write', { questionId: question.id, lie });
    if (res.ok) return;
    setPending(null);
    if (res.error === 'TOO_CLOSE' || res.error === 'BAD_REQUEST') setError(t.errors[res.error]);
  }

  if (mine) {
    return (
      <div className={styles.column}>
        <p className={styles.hint}>{t.bluffYourLie}</p>
        <div className={styles.lockedCard} style={{ background: 'var(--plum)' }} data-testid="my-lie">
          <span>{mine}</span>
        </div>
        <h2 className={styles.screenTitle}>{t.lockedIn}</h2>
        <p className={styles.hint}>{t.waitForOthers}</p>
      </div>
    );
  }

  return (
    <form className={`${styles.column} ${styles.form}`} onSubmit={submit}>
      <p className={styles.phonePrompt}>{question.prompt}</p>
      <h2 className={styles.screenTitle}>{t.bluffWriteTitle}</h2>
      <p className={styles.hint}>{t.bluffWriteHint}</p>
      <input
        className={styles.input}
        name="lie"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        maxLength={BLUFF_LIE_MAX_CHARS}
        placeholder={t.bluffLiePlaceholder}
        autoComplete="off"
        autoCapitalize="none"
        enterKeyHint="send"
        aria-label={t.bluffLiePlaceholder}
        data-testid="lie-input"
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button className={styles.primary} type="submit" disabled={!text.trim() || pending !== null} data-testid="lie-submit">
        {t.bluffSubmit}
      </button>
    </form>
  );
}

/** Blöffölő: which one is the truth? Your own lie is on the list, but you can't pick it. */
export function BluffPickScreen({ view, stage, socket }: { view: PlayerView; stage: PickStage; socket: GameSocket }) {
  const { question, options } = stage;
  const [pending, setPending] = useState<{ questionId: string; option: number } | null>(null);
  const mine = view.mine.choice ?? (pending?.questionId === question.id ? pending.option : null);
  const lie = view.mine.lie;

  async function pick(option: number) {
    if (mine !== null) return;
    setPending({ questionId: question.id, option });
    navigator.vibrate?.(40);
    const res = await send(socket, 'bluff:pick', { questionId: question.id, option });
    if (!res.ok) setPending(null);
  }

  if (mine !== null) {
    const tile = optionTile(mine);
    return (
      <div className={styles.column}>
        <div className={styles.lockedCard} style={{ background: tile.bg, color: tile.fg }}>
          <span className={styles.lockedLetter}>{letterOf(mine)}</span>
          <span>{options[mine]}</span>
        </div>
        <h2 className={styles.screenTitle}>{t.lockedIn}</h2>
        <p className={styles.hint}>{t.waitForOthers}</p>
      </div>
    );
  }

  return (
    <div className={styles.column}>
      <p className={styles.phonePrompt}>{question.prompt}</p>
      <h2 className={styles.screenTitle}>{t.bluffPickTitle}</h2>
      <div className={styles.choices}>
        {options.map((text, i) => {
          const own = lie !== null && sameText(text, lie);
          const tile = optionTile(i);
          return (
            <button
              key={i}
              className={`${styles.choice} ${styles.choiceCompact}`}
              style={{ background: tile.bg, color: tile.fg, '--i': i } as CSSProperties}
              disabled={own}
              onClick={() => void pick(i)}
              data-testid={`option-${i}`}
            >
              <span className={styles.choiceLetter}>{letterOf(i)}</span>
              <span className={styles.choiceText}>{text}</span>
              {own && <span className={styles.ownTag}>{t.bluffOwnLie}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
