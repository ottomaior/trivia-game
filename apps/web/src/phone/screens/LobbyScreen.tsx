import { CHARACTERS, MIN_PLAYERS, t, type CharacterId, type GameMode, type PlayerView, type Stage } from '@trivia/shared';
import { useEffect, useState } from 'react';
import { send } from '../../net/send.ts';
import type { GameSocket } from '../../net/socket.ts';
import { Character, preloadCharacters } from '../../ui/Character.tsx';
import { ModeArt } from '../../ui/ModeArt.tsx';
import styles from '../Phone.module.css';
import { SetupScreen } from './SetupScreen.tsx';

type LobbyStage = Extract<Stage, { phase: 'lobby' }>;
type ModeStage = Extract<LobbyStage, { step: 'mode' }>;
type PacksStage = Extract<LobbyStage, { step: 'packs' }>;

export function LobbyScreen({ view, stage, socket }: { view: PlayerView; stage: LobbyStage; socket: GameSocket }) {
  if (stage.step === 'setup') return <SetupScreen view={view} stage={stage} socket={socket} />;
  return <LobbyShell view={view} stage={stage} socket={socket} />;
}

/** Your character and the cast, then the VIP's mode choice or the pack vote. */
function LobbyShell({ view, stage, socket }: { view: PlayerView; stage: ModeStage | PacksStage; socket: GameSocket }) {
  const { me } = view;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const taken = new Set(view.players.filter((p) => p.id !== me.id).map((p) => p.avatar.character));
  const missing = Math.max(0, MIN_PLAYERS - view.players.filter((p) => p.connected).length);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await action();
    setBusy(false);
    if (!res.ok && res.error && res.error in t.errors) setError(t.errors[res.error as keyof typeof t.errors]);
  }

  const pick = (character: CharacterId) => run(() => send(socket, 'player:setAvatar', { character }));
  useEffect(() => preloadCharacters(), []);

  return (
    <div className={styles.lobby}>
      <div className={styles.myCharacter}>
        <Character id={me.avatar.character} size="8rem" />
      </div>
      <p className={styles.name} data-testid="my-name">
        {me.name}
      </p>
      {me.isVip && <span className={styles.vip}>{t.vip}</span>}

      <div className={styles.cast} role="radiogroup" aria-label={t.yourCharacter}>
        {CHARACTERS.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={me.avatar.character === c}
            aria-label={t.characters[c]}
            className={`${styles.castPick} ${me.avatar.character === c ? styles.castPickOn : ''}`}
            disabled={busy || taken.has(c)}
            onClick={() => pick(c)}
          >
            <Character id={c} size="3.3rem" />
          </button>
        ))}
      </div>

      {!me.isVip && <h2 className={styles.youreIn}>{t.youreIn}</h2>}

      {stage.step === 'mode' ? (
        <ModePicker
          stage={stage}
          isVip={me.isVip}
          missing={missing}
          busy={busy}
          onPick={(mode) => run(() => send(socket, 'vip:pickMode', { mode }))}
        />
      ) : (
        <PackPicker view={view} stage={stage} onVote={(pack) => run(() => send(socket, 'pack:vote', { pack }))} busy={busy} />
      )}

      {me.isVip ? (
        <>
          {stage.step === 'mode' ? (
            missing > 0 && <p className={styles.hint}>{t.waitingForMore(missing)}</p>
          ) : (
            <>
              <button
                className={styles.primary}
                disabled={busy || missing > 0 || stage.packs.length === 0}
                onClick={() => run(() => send(socket, 'vip:lockPack', {}))}
              >
                {missing > 0 ? t.waitingForMore(missing) : t.lockPack}
              </button>
              <button className={styles.textButton} disabled={busy} onClick={() => run(() => send(socket, 'vip:backToModes', {}))}>
                {t.back}
              </button>
            </>
          )}
          {view.players.length > 1 && (
            <ul className={styles.kickList}>
              {view.players
                .filter((p) => p.id !== me.id)
                .map((p) => (
                  <li key={p.id}>
                    <Character id={p.avatar.character} size="2rem" dimmed={!p.connected} />
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
        <p className={styles.hint}>{stage.step === 'mode' ? t.vipPicksMode : t.waitForVip}</p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** The five game modes as cards; only the VIP can tap one. */
function ModePicker({
  stage,
  isVip,
  missing,
  busy,
  onPick,
}: {
  stage: ModeStage;
  isVip: boolean;
  missing: number;
  busy: boolean;
  onPick: (mode: GameMode) => void;
}) {
  return (
    <section className={styles.modes} aria-label={t.modeTitle} data-testid="mode-picker">
      <h2 className={styles.packsTitle}>{t.modeTitle}</h2>
      {stage.modes === null ? (
        <p className={styles.hint}>{t.packsLoading}</p>
      ) : stage.modes.length === 0 ? (
        <p className={styles.hint}>{t.noPacks}</p>
      ) : (
        stage.modes.map((m) => (
          <button
            key={m.mode}
            className={`${styles.modeCard} ${isVip ? '' : styles.modeCardOff}`}
            disabled={!isVip || busy || missing > 0}
            data-testid={`mode-${m.mode}`}
            onClick={() => {
              navigator.vibrate?.(30);
              onPick(m.mode);
            }}
          >
            <span className={styles.modeName}>{t.modeNames[m.mode]}</span>
            <span className={styles.modeDesc}>{t.modeTaglines[m.mode]}</span>
            {m.packs > 1 && <span className={styles.modeMeta}>{t.modePacks(m.packs)}</span>}
            <span className={styles.modeArt}>
              <ModeArt mode={m.mode} size="3.4rem" />
            </span>
          </button>
        ))
      )}
    </section>
  );
}

/** Every phone votes for a pack of the picked mode; the votes (and who cast them) show live. */
function PackPicker({
  view,
  stage,
  onVote,
  busy,
}: {
  view: PlayerView;
  stage: PacksStage;
  onVote: (pack: string) => void;
  busy: boolean;
}) {
  const mine = stage.votes[view.me.id] ?? null;
  if (stage.packs.length === 0) return <p className={styles.hint}>{t.noPacks}</p>;
  return (
    <section className={styles.packs} aria-label={t.packsTitle}>
      <p className={styles.modeTag}>{t.modeNames[stage.mode]}</p>
      <h2 className={styles.packsTitle}>{t.packsTitle}</h2>
      {stage.packs.map((p) => {
        const voters = view.players.filter((pl) => stage.votes[pl.id] === p.slug);
        return (
          <button
            key={p.slug}
            className={`${styles.packCard} ${mine === p.slug ? styles.packMine : ''}`}
            aria-pressed={mine === p.slug}
            disabled={busy}
            onClick={() => {
              navigator.vibrate?.(30);
              onVote(p.slug);
            }}
          >
            <span className={styles.packName}>{p.name}</span>
            <span className={styles.packDesc}>{p.description}</span>
            <span className={styles.packMeta}>
              {t.packCategories(p.categories)} · {t.packQuestions(p.questions)}
            </span>
            {voters.length > 0 && (
              <span className={styles.packVoters}>
                {voters.map((pl) => (
                  <Character key={pl.id} id={pl.avatar.character} size="1.6rem" />
                ))}
              </span>
            )}
          </button>
        );
      })}
    </section>
  );
}
