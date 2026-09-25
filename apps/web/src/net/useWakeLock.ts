import { useEffect } from 'react';

/**
 * Keeps the screen on while mounted: a phone during the game, and the TV,
 * which nobody touches for an hour (an iPad mirrored to the TV would
 * otherwise lock itself and end the mirroring). The lock is dropped by the
 * browser whenever the page is hidden, so it is re-requested on every return.
 * Some browsers only grant it right after a tap, so a tap retries as well.
 * Needs HTTPS (or localhost); silently does nothing where unsupported.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let pending = false;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || lock || pending) return;
      pending = true;
      try {
        const l = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void l.release();
          return;
        }
        lock = l;
        lock.addEventListener('release', () => {
          lock = null;
        });
      } catch {
        // Denied (battery saver, not allowed yet); we try again on the next tap or visibility change.
      } finally {
        pending = false;
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', acquire);
    document.addEventListener('pointerdown', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      document.removeEventListener('pointerdown', acquire);
      void lock?.release();
    };
  }, [active]);
}
