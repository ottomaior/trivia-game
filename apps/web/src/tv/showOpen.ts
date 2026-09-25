import type { FxMode } from '../ui/lowfx.ts';

// The show open: a 10-second clip rendered with Remotion in apps/motion
// (`pnpm --filter @trivia/motion render:web`), played full-screen on the TV
// through the intro. It carries its own sound (Ottó's welcome, the sting and
// the applause), so the TV skips those while it plays. Flat mode, a browser
// without H.264, or a clip that fails to load or play falls back to the
// title card with the usual sounds.

export const SHOW_OPEN_SRC = '/clips/show-open.mp4';

let canPlay: boolean | null = null;

/** Whether this TV plays the show open in the given effects mode. */
export function showOpenPlayable(fx: FxMode): boolean {
  if (fx === 'flat') return false;
  if (canPlay === null) {
    try {
      canPlay = document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') !== '';
    } catch {
      canPlay = false;
    }
  }
  return canPlay;
}

let preloaded: HTMLVideoElement | null = null;

/** Starts downloading the clip (from the lobby), so it plays from the first frame. */
export function preloadShowOpen(): void {
  if (preloaded) return;
  preloaded = document.createElement('video');
  preloaded.preload = 'auto';
  preloaded.muted = true;
  preloaded.src = SHOW_OPEN_SRC;
}
