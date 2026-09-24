import { createContext, useContext } from 'react';
import { KEYS, readJson, writeJson } from '../net/storage.ts';

// How much the TV animates, for weak smart-TV browsers and motion-sensitive
// players:
//   full – the 2.5D studio with moving camera, lights and particles
//   lite – the same studio, but the set holds still and there are no particles
//   flat – the classic flat screens with no animation at all
// URL overrides (remembered): ?fx=full|lite|flat; the older ?lowfx=1 means
// flat and ?lowfx=0 means full. Without an override the TV measures its own
// frame rate and steps down (see stage/perfGuard.ts). The OS "reduce motion"
// setting means flat.

export type FxMode = 'full' | 'lite' | 'flat';
const MODES: FxMode[] = ['full', 'lite', 'flat'];

function urlMode(): FxMode | null {
  const params = new URLSearchParams(window.location.search);
  const fx = params.get('fx');
  if (fx && (MODES as string[]).includes(fx)) return fx as FxMode;
  const low = params.get('lowfx');
  if (low === '1') return 'flat';
  if (low === '0') return 'full';
  return null;
}

export function initialFxMode(): FxMode {
  const forced = urlMode();
  if (forced) {
    rememberFxMode(forced);
    return forced;
  }
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reduced) return 'flat';
  const saved = readJson<FxMode>(KEYS.fxMode);
  return saved && MODES.includes(saved) ? saved : 'full';
}

export function rememberFxMode(mode: FxMode): void {
  writeJson(KEYS.fxMode, mode);
}

/** One step down in effects, for a TV that can't keep up. */
export function stepDown(mode: FxMode): FxMode {
  return mode === 'full' ? 'lite' : 'flat';
}

/** True when the URL chose a mode, which disables the automatic frame-rate check. */
export function fxForcedByUrl(): boolean {
  return urlMode() !== null;
}

/** True in flat mode: screens skip their own CSS animations and confetti. */
export const LowFxContext = createContext(false);

export function useLowFx(): boolean {
  return useContext(LowFxContext);
}
