import { strings, type HostSession, type HostView, type Lang } from '@trivia/shared';
import { useEffect, useState } from 'react';
import { KEYS, readJson, removeKey, uuid, writeJson } from '../net/storage.ts';
import { ACK_TIMEOUT_MS } from '../net/socket.ts';
import { useConnected } from '../net/useConnected.ts';
import { useSocket } from '../net/useSocket.ts';
import { Marquee } from '../ui/Marquee.tsx';
import { LanguagePicker } from './LanguagePicker.tsx';
import { Lobby } from './Lobby.tsx';
import styles from './Tv.module.css';

type Screen = { kind: 'boot' } | { kind: 'pick' } | { kind: 'live'; view: HostView | null };

function householdId(): string {
  const existing = readJson<string>(KEYS.household);
  if (existing) return existing;
  const id = uuid();
  writeJson(KEYS.household, id);
  return id;
}

export function TvApp() {
  const socket = useSocket();
  const connected = useConnected(socket);
  const [screen, setScreen] = useState<Screen>({ kind: 'boot' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Runs on first connect and after every reconnect: re-claim the TV seat.
    async function onConnect() {
      const session = readJson<HostSession>(KEYS.hostSession);
      if (!session) {
        setScreen((s) => (s.kind === 'boot' ? { kind: 'pick' } : s));
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
      setScreen({ kind: 'pick' });
    }

    const onView = (view: HostView) => setScreen({ kind: 'live', view });
    const onClosed = () => {
      removeKey(KEYS.hostSession);
      setScreen({ kind: 'pick' });
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

  async function createRoom(lang: Lang) {
    if (creating) return;
    setCreating(true);
    try {
      const res = await socket
        .timeout(ACK_TIMEOUT_MS)
        .emitWithAck('host:create', { householdId: householdId(), lang });
      if (res.ok) {
        writeJson(KEYS.hostSession, { roomCode: res.roomCode, hostToken: res.hostToken });
        setScreen((s) => (s.kind === 'live' ? s : { kind: 'live', view: null }));
      }
    } catch {
      // Stay on the picker; the button becomes clickable again.
    } finally {
      setCreating(false);
    }
  }

  const lang = screen.kind === 'live' && screen.view ? screen.view.lang : 'en';

  return (
    <div className={styles.tv}>
      <Marquee>
        {screen.kind === 'pick' && <LanguagePicker onPick={createRoom} disabled={creating || !connected} />}
        {screen.kind === 'live' && screen.view && <Lobby view={screen.view} />}
        {(screen.kind === 'boot' || (screen.kind === 'live' && !screen.view)) && (
          <p className={styles.center}>{strings(lang).connecting}</p>
        )}
        {!connected && screen.kind !== 'boot' && (
          <div className={styles.banner} role="status">
            {strings(lang).reconnecting}
          </div>
        )}
      </Marquee>
    </div>
  );
}
