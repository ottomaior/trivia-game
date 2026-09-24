import {
  isValidRoomCode,
  normalizeRoomCode,
  t,
  type ErrorCode,
  type PlayerSession,
  type PlayerView,
  type RoomClosedReason,
} from '@trivia/shared';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { roughSync, syncClock } from '../net/clock.ts';
import { ACK_TIMEOUT_MS } from '../net/socket.ts';
import { KEYS, readJson, removeKey, writeJson } from '../net/storage.ts';
import { useConnected } from '../net/useConnected.ts';
import { useSocket } from '../net/useSocket.ts';
import { useWakeLock } from '../net/useWakeLock.ts';
import { JoinForm } from './JoinForm.tsx';
import { PhoneStage } from './PhoneStage.tsx';
import styles from './Phone.module.css';

type Screen =
  | { kind: 'boot' }
  | { kind: 'join' }
  | { kind: 'live'; view: PlayerView | null }
  | { kind: 'closed'; reason: RoomClosedReason };

export function PhoneApp() {
  const params = useParams();
  const navigate = useNavigate();
  const urlCode = normalizeRoomCode(params.code ?? '');
  const socket = useSocket();
  const connected = useConnected(socket);
  const [screen, setScreen] = useState<Screen>({ kind: 'boot' });
  const [error, setError] = useState<ErrorCode | null>(null);
  const [joining, setJoining] = useState(false);

  useWakeLock(screen.kind === 'live');

  useEffect(() => {
    async function onConnect() {
      void syncClock(socket);
      const session = readJson<PlayerSession>(KEYS.playerSession);
      // A QR scan for a different room wins over an old saved seat.
      const usable = session && (!urlCode || session.roomCode === urlCode) ? session : null;
      if (!usable) {
        setScreen((s) => (s.kind === 'boot' ? { kind: 'join' } : s));
        return;
      }
      try {
        const res = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('player:resume', usable);
        if (res.ok) {
          setScreen((s) => (s.kind === 'live' ? s : { kind: 'live', view: null }));
          return;
        }
      } catch {
        return; // timed out; retried on the next reconnect
      }
      removeKey(KEYS.playerSession);
      setScreen({ kind: 'join' });
    }

    const onView = (view: PlayerView) => {
      roughSync(view.serverNow);
      setScreen({ kind: 'live', view });
    };
    const onClosed = ({ reason }: { reason: RoomClosedReason }) => {
      removeKey(KEYS.playerSession);
      setScreen({ kind: 'closed', reason });
    };
    // The server times these round trips to credit slow connections fairly.
    const onProbe = (_payload: object, ack: (ok: boolean) => void) => ack(true);

    socket.on('connect', onConnect);
    socket.on('view:player', onView);
    socket.on('room:closed', onClosed);
    socket.on('latency:probe', onProbe);
    if (socket.connected) void onConnect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('view:player', onView);
      socket.off('room:closed', onClosed);
      socket.off('latency:probe', onProbe);
    };
  }, [socket, urlCode]);

  async function join(code: string, name: string) {
    if (joining) return;
    setError(null);
    const roomCode = normalizeRoomCode(code);
    if (!isValidRoomCode(roomCode)) {
      setError('NOT_FOUND');
      return;
    }
    setJoining(true);
    try {
      const res = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('player:join', { roomCode, name });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      writeJson(KEYS.playerSession, {
        roomCode: res.roomCode,
        playerId: res.playerId,
        sessionToken: res.sessionToken,
      } satisfies PlayerSession);
      if (urlCode !== res.roomCode) navigate(`/${res.roomCode}`, { replace: true });
      setScreen((s) => (s.kind === 'live' ? s : { kind: 'live', view: null }));
    } catch {
      setError('BAD_REQUEST');
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className={styles.phone}>
      {screen.kind === 'join' && (
        <JoinForm initialCode={urlCode} onJoin={join} busy={joining || !connected} error={error ? t.errors[error] : null} />
      )}
      {screen.kind === 'live' && screen.view && <PhoneStage view={screen.view} socket={socket} />}
      {(screen.kind === 'boot' || (screen.kind === 'live' && !screen.view)) && (
        <p className={styles.message}>{t.connecting}</p>
      )}
      {screen.kind === 'closed' && (
        <div className={styles.message}>
          <p>{screen.reason === 'kicked' ? t.kicked : t.roomClosed}</p>
          <p className={styles.hint}>{t.playAgainHint}</p>
          <button
            className={styles.primary}
            onClick={() => {
              navigate('/', { replace: true });
              setScreen({ kind: 'join' });
            }}
          >
            {t.join}
          </button>
        </div>
      )}
      {!connected && screen.kind === 'live' && (
        <div className={styles.banner} role="status">
          {t.reconnecting}
        </div>
      )}
    </main>
  );
}
