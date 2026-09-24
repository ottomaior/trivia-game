import { MAX_PLAYERS, MIN_PLAYERS, t, type HostView } from '@trivia/shared';
import { useInStudio } from '../../stage/StudioContext.ts';
import { Blob } from '../../ui/Blob.tsx';
import { Logo } from '../../ui/Logo.tsx';
import { QrCode } from '../../ui/QrCode.tsx';
import styles from '../Tv.module.css';
import { VoiceCredit } from '../VoiceCredit.tsx';

export function Lobby({ view }: { view: HostView }) {
  const joinUrl = `${window.location.origin}/${view.roomCode}`;
  const missing = Math.max(0, MIN_PLAYERS - view.players.filter((p) => p.connected).length);
  const seats = Array.from({ length: MAX_PLAYERS }, (_, i) => view.players[i] ?? null);
  const inStudio = useInStudio();

  return (
    <div className={`${styles.lobby} ${inStudio ? styles.lobbyStudio : ''}`}>
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
        <VoiceCredit />
      </section>

      {inStudio ? (
        <section className={styles.seatsPanel}>
          <h2 className={styles.seatsTitle}>{t.playersCount(view.players.length, MAX_PLAYERS)}</h2>
          <PackPanel view={view} />
          <p className={styles.status}>{missing > 0 ? t.needMorePlayers(missing) : t.vipStartsOnPhone}</p>
        </section>
      ) : (
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
        <PackPanel view={view} />
        <p className={styles.status}>{missing > 0 ? t.needMorePlayers(missing) : t.vipStartsOnPhone}</p>
      </section>
      )}
    </div>
  );
}

/** The pack vote as it stands (packs with votes, leader first), then the locked pack's categories. */
function PackPanel({ view }: { view: HostView }) {
  const { stage } = view;
  if (stage.phase !== 'lobby') return null;

  if (stage.step === 'setup') {
    return (
      <div className={styles.packPanel} data-testid="pack-setup">
        <p className={styles.packLabel}>{t.vipPicksCategories}</p>
        <h3 className={styles.packTitle}>{stage.pack.name}</h3>
        <ul className={styles.packCats}>
          {stage.categories.map((c) => (
            <li key={c.id} className={c.enabled ? '' : styles.packCatOff}>
              {c.name}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const tally = (stage.packs ?? [])
    .map((pack) => ({ pack, voters: view.players.filter((p) => stage.votes[p.id] === pack.slug) }))
    .filter((row) => row.voters.length > 0)
    .sort((a, b) => b.voters.length - a.voters.length);
  const lead = tally[0]?.voters.length ?? 0;
  return (
    <div className={styles.packPanel}>
      <p className={styles.packLabel}>{t.packVoteOnPhone}</p>
      {tally.length > 0 && (
        <ul className={styles.packTally} data-testid="pack-tally">
          {tally.map(({ pack, voters }) => (
            <li key={pack.slug} className={`${styles.packRow} ${voters.length === lead ? styles.packRowLead : ''}`}>
              <span className={styles.packRowName}>{pack.name}</span>
              <span className={styles.voters}>
                {voters.map((p) => (
                  <Blob key={p.id} avatar={p.avatar} size="2.2em" />
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
