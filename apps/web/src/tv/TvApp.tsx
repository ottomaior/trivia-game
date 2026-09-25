import { isInputPhase, t, type HostSession, type HostView } from '@trivia/shared';
import { useCallback, useEffect, useState } from 'react';
import { audio } from '../audio/engine.ts';
import { useAudioCues } from '../audio/useAudioCues.ts';
import { loadVoiceCredit } from '../audio/voiceCredit.ts';
import { roughSync, syncClock } from '../net/clock.ts';
import { ACK_TIMEOUT_MS } from '../net/socket.ts';
import { KEYS, readJson, removeKey, uuid, writeJson } from '../net/storage.ts';
import { useConnected } from '../net/useConnected.ts';
import { useSocket } from '../net/useSocket.ts';
import { initialFxMode, LowFxContext, rememberFxMode, stepDown, type FxMode } from '../ui/lowfx.ts';
import { Marquee, type MarqueeMode } from '../ui/Marquee.tsx';
import { Studio } from '../stage/Studio.tsx';
import { MuteButton } from './MuteButton.tsx';
import { StartScreen } from './StartScreen.tsx';
import { TvStage } from './TvStage.tsx';
import styles from './Tv.module.css';

type Screen = { kind: 'boot' } | { kind: 'start' } | { kind: 'live'; view: HostView | null };

function householdId(): string {
  const existing = readJson<string>(KEYS.household);
  if (existing) return existing;
  const id = uuid();
  writeJson(KEYS.household, id);
  return id;
}

function goFullscreen(): void {
  document.documentElement.requestFullscreen?.().catch(() => {});
}

export function TvApp() {
  const socket = useSocket();
  const connected = useConnected(socket);
  const [screen, setScreen] = useState<Screen>({ kind: 'boot' });
  const [creating, setCreating] = useState(false);
  // Browsers only allow sound after a click; a resumed TV needs one again.
  const [activated, setActivated] = useState(() => navigator.userActivation?.hasBeenActive ?? false);
  const [fxMode, setFxMode] = useState<FxMode>(initialFxMode);
  const lowFx = fxMode === 'flat';
  // A TV that can't keep up steps down: full studio → lite studio → flat (remembered).
  const onTooSlow = useCallback(() => {
    setFxMode((m) => {
      const next = stepDown(m);
      rememberFxMode(next);
      return next;
    });
  }, []);
  const liveView = screen.kind === 'live' ? screen.view : null;
  useAudioCues(liveView);

  // Chrome keeps the earlier click across a reload, so sound can start right away.
  useEffect(() => {
    if (activated) audio.unlock();
  }, [activated]);

  // Fetch the voice credit while the socket connects, not after the start screen appears.
  useEffect(() => {
    void loadVoiceCredit();
  }, []);

  // Test hook: /tv?audiotest exposes an offline render of every sound.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('audiotest')) return;
    void import('../audio/selftest.ts').then((m) => {
      (window as unknown as { __audioSelfTest: typeof m.renderAll }).__audioSelfTest = m.renderAll;
    });
  }, []);

  // M toggles sound (works from a keyboard or a TV remote with keys).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') audio.toggleMute();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    // Runs on first connect and after every reconnect: re-claim the TV seat.
    async function onConnect() {
      void syncClock(socket);
      const session = readJson<HostSession>(KEYS.hostSession);
      if (!session) {
        setScreen((s) => (s.kind === 'boot' ? { kind: 'start' } : s));
        return;
      }
      try {
        const res = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('host:resume', session);
        if (res.ok) {
          setScreen((s) => (s.kind === 'live' ? s : { kind: 'live', view: null }));
          return;
        }
      } catch {
        return; // timed out; the next reconnect will retry
      }
      removeKey(KEYS.hostSession);
      setScreen({ kind: 'start' });
    }

    const onView = (view: HostView) => {
      roughSync(view.serverNow);
      setScreen({ kind: 'live', view });
    };
    const onClosed = () => {
      removeKey(KEYS.hostSession);
      setScreen({ kind: 'start' });
    };

    socket.on('connect', onConnect);
    socket.on('view:host', onView);
    socket.on('room:closed', onClosed);
    if (socket.connected) void onConnect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('view:host', onView);
      socket.off('room:closed', onClosed);
    };
  }, [socket]);

  async function createRoom() {
    if (creating) return;
    setCreating(true);
    setActivated(true);
    audio.unlock();
    goFullscreen();
    try {
      const res = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('host:create', { householdId: householdId() });
      if (res.ok) {
        writeJson(KEYS.hostSession, { roomCode: res.roomCode, hostToken: res.hostToken } satisfies HostSession);
        setScreen((s) => (s.kind === 'live' ? s : { kind: 'live', view: null }));
      }
    } catch {
      // Stay on the start screen; the button becomes clickable again.
    } finally {
      setCreating(false);
    }
  }

  return (
    <LowFxContext.Provider value={lowFx}>
      <div className={styles.tv} data-lowfx={lowFx} data-fx={fxMode}>
        <Marquee mode={marqueeMode(liveView, fxMode !== 'full')}>
          {screen.kind === 'start' && <StartScreen onStart={createRoom} disabled={creating || !connected} />}
          {screen.kind === 'live' &&
            screen.view &&
            (lowFx ? (
              <TvStage view={screen.view} />
            ) : (
              <Studio view={screen.view} lite={fxMode === 'lite'} onTooSlow={onTooSlow} />
            ))}
          {(screen.kind === 'boot' || (screen.kind === 'live' && !screen.view)) && (
            <p className={styles.center}>{t.connecting}</p>
          )}
          {!connected && screen.kind !== 'boot' && (
            <div className={styles.banner} role="status">
              {t.reconnecting}
            </div>
          )}
          {screen.kind === 'live' && <MuteButton />}
          {screen.kind === 'live' && !activated && (
            <button
              className={styles.activate}
              autoFocus
              onClick={() => {
                setActivated(true);
                audio.unlock();
                goFullscreen();
              }}
            >
              {t.clickToContinue}
            </button>
          )}
        </Marquee>
      </div>
    </LowFxContext.Provider>
  );
}

/** Bulbs chase faster while the clock runs and flash at the reveal. */
function marqueeMode(view: HostView | null, still: boolean): MarqueeMode {
  if (still) return 'still';
  if (view && isInputPhase(view.stage.phase)) return 'fast';
  switch (view?.stage.phase) {
    case 'reveal':
    case 'final':
      return 'flash';
    default:
      return 'idle';
  }
}
