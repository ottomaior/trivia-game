import { AVATAR_COLORS, AVATAR_FACES, MIN_PLAYERS, t, type AvatarColor, type PlayerView } from '@trivia/shared';
import { useState } from 'react';
import { send } from '../../net/send.ts';
import type { GameSocket } from '../../net/socket.ts';
import { Blob } from '../../ui/Blob.tsx';
import styles from '../Phone.module.css';

export function LobbyScreen({ view, socket }: { view: PlayerView; socket: GameSocket }) {
  const { me } = view;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const takenColors = new Set(view.players.filter((p) => p.id !== me.id).map((p) => p.avatar.color));
  const missing = Math.max(0, MIN_PLAYERS - view.players.filter((p) => p.connected).length);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await action();
    setBusy(false);
    if (!res.ok && res.error && res.error in t.errors) setError(t.errors[res.error as keyof typeof t.errors]);
  }

  const setColor = (color: AvatarColor) => run(() => send(socket, 'player:setAvatar', { color, face: me.avatar.face }));
  const nextFace = () => {
    const i = AVATAR_FACES.indexOf(me.avatar.face);
    const face = AVATAR_FACES[(i + 1) % AVATAR_FACES.length]!;
    return run(() => send(socket, 'player:setAvatar', { color: me.avatar.color, face }));
  };

  return (
    <div className={styles.lobby}>
      <button className={styles.blobButton} onClick={nextFace} aria-label={t.newFace} disabled={busy}>
        <Blob avatar={me.avatar} size="8rem" />
      </button>
      <p className={styles.name} data-testid="my-name">
        {me.name}
      </p>
      {me.isVip && <span className={styles.vip}>{t.vip}</span>}

      <div className={styles.swatches} role="radiogroup" aria-label={t.yourColor}>
        {AVATAR_COLORS.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={me.avatar.color === c}
            aria-label={c}
            className={`${styles.swatch} ${me.avatar.color === c ? styles.swatchOn : ''}`}
            style={{ background: `var(--${c})` }}
            disabled={busy || takenColors.has(c)}
            onClick={() => setColor(c)}
          />
        ))}
      </div>

      {me.isVip ? (
        <>
          <button
            className={styles.primary}
            disabled={busy || missing > 0}
            onClick={() => run(() => send(socket, 'vip:start', {}))}
          >
            {missing > 0 ? t.waitingForMore(missing) : t.startShow}
          </button>
          {view.players.length > 1 && (
            <ul className={styles.kickList}>
              {view.players
                .filter((p) => p.id !== me.id)
                .map((p) => (
                  <li key={p.id}>
                    <Blob avatar={p.avatar} size="2rem" dimmed={!p.connected} />
                    <span>{p.name}</span>
                    <button
                      className={styles.textButton}
                      disabled={busy}
                      onClick={() => run(() => send(socket, 'vip:kick', { playerId: p.id }))}
                    >
                      {t.remove}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <h2 className={styles.youreIn}>{t.youreIn}</h2>
          <p className={styles.hint}>{t.waitForVip}</p>
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
