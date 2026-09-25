import { MAX_PLAYERS, MIN_PLAYERS, t, type HostView } from '@trivia/shared';
import { useEffect } from 'react';
import { useInStudio } from '../../stage/StudioContext.ts';
import { Character, preloadCharacters } from '../../ui/Character.tsx';
import { Logo } from '../../ui/Logo.tsx';
import { ModeArt } from '../../ui/ModeArt.tsx';
import { QrCode } from '../../ui/QrCode.tsx';
import styles from '../Tv.module.css';
import { VoiceCredit } from '../VoiceCredit.tsx';

export function Lobby({ view }: { view: HostView }) {
  const joinUrl = `${window.location.origin}/${view.roomCode}`;
  const missing = Math.max(0, MIN_PLAYERS - view.players.filter((p) => p.connected).length);
  const seats = Array.from({ length: MAX_PLAYERS }, (_, i) => view.players[i] ?? null);
  const inStudio = useInStudio();
  // Every face the game can show, cached before the first reveal.
  useEffect(() => preloadCharacters(true), []);

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
                <Character id={p.avatar.character} size="5.5em" dimmed={!p.connected} />
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

type LobbyStage = Extract<HostView['stage'], { phase: 'lobby' }>;

const STEP_LABEL = { mode: t.modePickOnPhone, packs: t.packVoteOnPhone, setup: t.vipPicksCategories } as const;

/**
 * The mode board: the five game modes as cards. The picked one grows and
 * holds the pack vote as it stands (packs with votes, leader first), then the
 * locked pack's categories.
 */
function PackPanel({ view }: { view: HostView }) {
  const { stage } = view;
  if (stage.phase !== 'lobby') return null;
  const picked = stage.step === 'mode' ? null : stage.mode;

  return (
    <div className={styles.packPanel}>
      <p className={styles.packLabel}>{STEP_LABEL[stage.step]}</p>
      {stage.modes && (
        <ul className={`${styles.modeBoard} ${picked ? styles.modeBoardPicked : ''}`} data-testid="mode-board">
          {stage.modes.map((m) => {
            const on = m.mode === picked;
            return (
              <li
                key={m.mode}
                className={`${styles.modeCard} ${on ? styles.modeCardOn : picked ? styles.modeCardDim : ''}`}
                aria-current={on || undefined}
              >
                <span className={styles.modeHead}>
                  <ModeArt mode={m.mode} size={on ? '3.2em' : picked ? '1.7em' : '2.4em'} />
                  <span className={styles.modeName}>{t.modeNames[m.mode]}</span>
                </span>
                {on && stage.step === 'packs' && <PackTally view={view} stage={stage} />}
                {on && stage.step === 'setup' && <PackSetup stage={stage} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PackTally({ view, stage }: { view: HostView; stage: Extract<LobbyStage, { step: 'packs' }> }) {
  const tally = stage.packs
    .map((pack) => ({ pack, voters: view.players.filter((p) => stage.votes[p.id] === pack.slug) }))
    .filter((row) => row.voters.length > 0)
    .sort((a, b) => b.voters.length - a.voters.length);
  const lead = tally[0]?.voters.length ?? 0;
  if (tally.length === 0) return null;
  return (
    <ul className={styles.packTally} data-testid="pack-tally">
      {tally.map(({ pack, voters }) => (
        <li key={pack.slug} className={`${styles.packRow} ${voters.length === lead ? styles.packRowLead : ''}`}>
          <span className={styles.packRowName}>{pack.name}</span>
          <span className={styles.voters}>
            {voters.map((p) => (
              <Character key={p.id} id={p.avatar.character} size="2.2em" />
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PackSetup({ stage }: { stage: Extract<LobbyStage, { step: 'setup' }> }) {
  // A mode with a single pack names it after itself: the card already says it.
  const named = stage.pack.name !== t.modeNames[stage.mode];
  return (
    <div className={styles.packSetup} data-testid="pack-setup">
      {named ? <h3 className={styles.packTitle}>{stage.pack.name}</h3> : <span className={styles.srOnly}>{stage.pack.name}</span>}
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
