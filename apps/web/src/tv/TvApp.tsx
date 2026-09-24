import { t, type HostSession, type HostView } from '@trivia/shared';
import { useEffect, useState } from 'react';
import { roughSync, syncClock } from '../net/clock.ts';
import { ACK_TIMEOUT_MS } from '../net/socket.ts';
import { KEYS, readJson, removeKey, uuid, writeJson } from '../net/storage.ts';
import { useConnected } from '../net/useConnected.ts';
import { useSocket } from '../net/useSocket.ts';
import { Marquee } from '../ui/Marquee.tsx';
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
    <div className={styles.tv}>
      <Marquee>
        {screen.kind === 'start' && <StartScreen onStart={createRoom} disabled={creating || !connected} />}
        {screen.kind === 'live' && screen.view && <TvStage view={screen.view} />}
        {(screen.kind === 'boot' || (screen.kind === 'live' && !screen.view)) && (
          <p className={styles.center}>{t.connecting}</p>
        )}
        {!connected && screen.kind !== 'boot' && (
          <div className={styles.banner} role="status">
            {t.reconnecting}
          </div>
        )}
        {screen.kind === 'live' && !activated && (
          <button
            className={styles.activate}
            autoFocus
            onClick={() => {
              setActivated(true);
              goFullscreen();
            }}
          >
            {t.clickToContinue}
          </button>
        )}
      </Marquee>
    </div>
  );
}
