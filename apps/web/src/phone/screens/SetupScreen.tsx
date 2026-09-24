import { t, type PlayerView, type Stage } from '@trivia/shared';
import { useState } from 'react';
import { send } from '../../net/send.ts';
import type { GameSocket } from '../../net/socket.ts';
import styles from '../Phone.module.css';

type SetupStage = Extract<Stage, { phase: 'lobby'; step: 'setup' }>;

/** The pack is locked: the VIP switches off unwanted categories and starts the show. */
export function SetupScreen({ view, stage, socket }: { view: PlayerView; stage: SetupStage; socket: GameSocket }) {
  const isVip = view.me.isVip;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const enabled = stage.categories.filter((c) => c.enabled).reduce((n, c) => n + c.questions, 0);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await action();
    setBusy(false);
    if (!res.ok && res.error && res.error in t.errors) setError(t.errors[res.error as keyof typeof t.errors]);
  }

  return (
    <div className={styles.lobby}>
      <p className={styles.hint}>{t.categoriesTitle}</p>
      <h2 className={styles.screenTitle}>{stage.pack.name}</h2>

      {isVip ? (
        <>
          <p className={styles.hint}>{t.categoriesHint}</p>
          <ul className={styles.toggles}>
            {stage.categories.map((c) => {
              // Switching this one off would leave too few questions.
              const locked = c.enabled && enabled - c.questions < stage.minQuestions;
              return (
                <li key={c.id}>
                  <button
                    role="switch"
                    aria-checked={c.enabled}
                    className={`${styles.toggle} ${c.enabled ? styles.toggleOn : ''}`}
                    disabled={busy || locked}
                    onClick={() => run(() => send(socket, 'vip:setCategory', { categoryId: c.id, enabled: !c.enabled }))}
                  >
                    <span className={styles.toggleName}>{c.name}</span>
                    <span className={styles.toggleCount}>{t.packQuestions(c.questions)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className={styles.hint}>{t.enabledQuestions(enabled)}</p>
          <button className={styles.primary} disabled={busy} onClick={() => run(() => send(socket, 'vip:start', {}))}>
            {t.startShow}
          </button>
          <button className={styles.textButton} disabled={busy} onClick={() => run(() => send(socket, 'vip:backToPacks', {}))}>
            {t.back}
          </button>
        </>
      ) : (
        <>
          <ul className={styles.catChips}>
            {stage.categories
              .filter((c) => c.enabled)
              .map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
          </ul>
          <p className={styles.hint}>{t.vipPicking}</p>
        </>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
