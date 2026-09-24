import { createContext, useContext } from 'react';
import { KEYS, readJson, writeJson } from '../net/storage.ts';

// Low-motion mode for weak smart-TV browsers or motion-sensitive players:
// /tv?lowfx=1 turns it on (and remembers it), ?lowfx=0 turns it off. The OS
// "reduce motion" setting also enables it. Screens must look correct with all
// animations removed, so every keyframe only animates *from* a start state.

export function initialLowFx(): boolean {
  const param = new URLSearchParams(window.location.search).get('lowfx');
  if (param === '1' || param === '0') writeJson(KEYS.lowFx, param === '1');
  const saved = readJson<boolean>(KEYS.lowFx) ?? false;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  return saved || reduced;
}

export const LowFxContext = createContext(false);

export function useLowFx(): boolean {
  return useContext(LowFxContext);
}
