import { useEffect, useState } from 'react';
import type { GameSocket } from './socket.ts';

// Estimates the server clock so countdowns match on every screen, whatever
// the device's own clock says. offset = serverTime - localTime.

let offset = 0;
let bestRtt = Infinity;

export function serverNow(): number {
  return Date.now() + offset;
}

/** Fallback from a view's timestamp when no ping has completed yet. */
export function roughSync(serverTime: number): void {
  if (bestRtt === Infinity) offset = serverTime - Date.now();
}

/** A few pings; keeps the sample with the smallest round trip. */
export async function syncClock(socket: GameSocket, samples = 5): Promise<void> {
  for (let i = 0; i < samples; i++) {
    const t0 = Date.now();
    try {
      const res = await socket.timeout(3_000).emitWithAck('time:ping', { t: t0 });
      const t1 = Date.now();
      const rtt = t1 - t0;
      if (rtt < bestRtt) {
        bestRtt = rtt;
        offset = res.serverNow - (t0 + rtt / 2);
      }
    } catch {
      return;
    }
  }
}

/** Milliseconds left until a server timestamp, re-rendering ~10x a second. */
export function useCountdown(endsAt: number | null): number | null {
  const [left, setLeft] = useState(() => (endsAt === null ? null : Math.max(0, endsAt - serverNow())));
  useEffect(() => {
    if (endsAt === null) {
      setLeft(null);
      return;
    }
    const tick = () => setLeft(Math.max(0, endsAt - serverNow()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [endsAt]);
  return left;
}
