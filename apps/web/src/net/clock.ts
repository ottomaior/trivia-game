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

/**
 * Milliseconds left until a server timestamp. It re-renders once per whole
 * second, just after the displayed number (`Math.ceil(left / 1000)`)
 * changes: every re-render repaints the screen, which a TV can't afford ten
 * times a second. Anything smoother (the timer bar) animates on its own.
 */
export function useCountdown(endsAt: number | null): number | null {
  const [left, setLeft] = useState(() => (endsAt === null ? null : Math.max(0, endsAt - serverNow())));
  useEffect(() => {
    if (endsAt === null) {
      setLeft(null);
      return;
    }
    let id: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const now = Math.max(0, endsAt - serverNow());
      setLeft(now);
      // Wake just past the next whole second.
      if (now > 0) id = setTimeout(tick, (now % 1000 || 1000) + 5);
    };
    tick();
    return () => clearTimeout(id);
  }, [endsAt]);
  return left;
}
