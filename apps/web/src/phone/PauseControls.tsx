import { t, type PlayerView } from '@trivia/shared';
import { useState } from 'react';
import { send } from '../net/send.ts';
import type { GameSocket } from '../net/socket.ts';
import styles from './Phone.module.css';

// The VIP can stop every clock for a break, carry on, or call the game off
// (started by mistake, say). The pause sits over the current screen rather
// than replacing it, so a half-typed lie or half-broken ice survives it.

/** Whether the game is past the lobby and not yet over. */
export function inGame(view: PlayerView): boolean {
  return view.stage.phase !== 'lobby' && view.stage.phase !== 'final';
}

/** The VIP's pause button, for the header bar. */
export function PauseButton({ view, socket }: { view: PlayerView; socket: GameSocket }) {
  if (!view.me.isVip || !inGame(view) || view.paused) return null;
  return (
    <button className={styles.pauseButton} onClick={() => void send(socket, 'vip:pause', {})} aria-label={t.pause} data-testid="pause">
      ❚❚
    </button>
  );
}

/** Covers the screen while the game is paused; the VIP carries on or cancels from here. */
export function PauseOverlay({ view, socket }: { view: PlayerView; socket: GameSocket }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!view.paused) return null;
  const vip = view.players.find((p) => p.isVip);
  const run = async (event: 'vip:resume' | 'vip:cancel') => {
    setBusy(true);
    await send(socket, event, {});
    setBusy(false);
    setConfirming(false);
  };
  return (
    <div className={styles.pauseOverlay} role="dialog" aria-modal="true" data-testid="paused">
      <h2 className={styles.screenTitle}>{t.paused}</h2>
      <p className={styles.message}>
        {view.pauseReason === 'tv' ? t.tvDisconnected : vip && !view.me.isVip ? t.pausedBy(vip.name) : null}
      </p>
      {view.me.isVip &&
        (confirming ? (
          <>
            <p className={styles.hint}>{t.cancelSure}</p>
            <button className={styles.secondary} disabled={busy} onClick={() => void run('vip:cancel')} data-testid="cancel-yes">
              {t.cancelYes}
            </button>
            <button className={styles.textButton} disabled={busy} onClick={() => setConfirming(false)}>
              {t.cancelNo}
            </button>
          </>
        ) : (
          <>
            {view.pauseReason === 'vip' && (
              <button className={styles.primary} disabled={busy} onClick={() => void run('vip:resume')} data-testid="resume">
                {t.resume}
              </button>
            )}
            <button className={styles.textButton} disabled={busy} onClick={() => setConfirming(true)} data-testid="cancel-game">
              {t.cancelGame}
            </button>
          </>
        ))}
    </div>
  );
}
