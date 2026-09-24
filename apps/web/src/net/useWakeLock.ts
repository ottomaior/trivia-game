import { useEffect } from 'react';

/**
 * Keeps the phone screen on while mounted. The lock is dropped by the browser
 * whenever the page is hidden, so it is re-requested on every return.
 * Needs HTTPS (or localhost); silently does nothing where unsupported.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || lock) return;
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
        // Denied (battery saver, not allowed yet); we try again on the next visibility change.
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release();
    };
  }, [active]);
}
