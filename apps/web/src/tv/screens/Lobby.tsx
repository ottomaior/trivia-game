import { MAX_PLAYERS, MIN_PLAYERS, t, type HostView } from '@trivia/shared';
import { Blob } from '../../ui/Blob.tsx';
import { Logo } from '../../ui/Logo.tsx';
import { QrCode } from '../../ui/QrCode.tsx';
import styles from '../Tv.module.css';

export function Lobby({ view }: { view: HostView }) {
  const joinUrl = `${window.location.origin}/${view.roomCode}`;
  const missing = Math.max(0, MIN_PLAYERS - view.players.filter((p) => p.connected).length);
  const seats = Array.from({ length: MAX_PLAYERS }, (_, i) => view.players[i] ?? null);

  return (
    <div className={styles.lobby}>
      <section className={styles.joinPanel}>
        <Logo />
        <p className={styles.joinAt}>
          {t.joinAt} <strong>{window.location.host}</strong>
        </p>
        <div className={styles.code} aria-label={t.roomCode} data-testid="room-code">
          {[...view.roomCode].map((ch, i) => (
            <span key={i} className={styles.codeLetter}>
              {ch}
            </span>
          ))}
        </div>
        <QrCode value={joinUrl} className={styles.qr} />
      </section>

      <section className={styles.seatsPanel}>
        <h2 className={styles.seatsTitle}>{t.playersCount(view.players.length, MAX_PLAYERS)}</h2>
        <ul className={styles.seats}>
          {seats.map((p, i) =>
            p ? (
              <li key={p.id} className={styles.seat} data-testid="seat">
                <Blob avatar={p.avatar} size="5.5em" dimmed={!p.connected} />
                <span className={styles.seatName}>{p.name}</span>
                {p.isVip && <span className={styles.vip}>{t.vip}</span>}
              </li>
            ) : (
              <li key={`empty-${i}`} className={`${styles.seat} ${styles.seatEmpty}`}>
                <span className={styles.seatPlaceholder}>?</span>
              </li>
            ),
          )}
        </ul>
        <p className={styles.status}>{missing > 0 ? t.needMorePlayers(missing) : t.vipStartsOnPhone}</p>
      </section>
    </div>
  );
}
