import type { HostView } from '@trivia/shared';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { serverNow } from '../net/clock.ts';
import { cuesFor, musicFor } from './cues.ts';
import { audio } from './engine.ts';

/** Plays sounds and music for each new TV view, plus the countdown ticks. */
export function useAudioCues(view: HostView | null): void {
  const prev = useRef<HostView | null>(null);

  useEffect(() => {
    if (!view) return;
    for (const cue of cuesFor(prev.current, view)) audio.play(cue);
    audio.music(musicFor(view.stage.phase, view.paused));
    prev.current = view;
  }, [view]);

  // Ticks for the last 5 seconds of a question, and a buzzer if time runs out.
  const phase = view?.stage.phase;
  const endsAt = view?.phaseEndsAt ?? null;
  useEffect(() => {
    if (phase !== 'question_open' || endsAt === null) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const left = endsAt - serverNow();
    for (let s = 5; s >= 1; s--) {
      const at = left - s * 1000;
      if (at >= 0) timers.push(setTimeout(() => audio.play('tick'), at));
    }
    if (left > 0) timers.push(setTimeout(() => audio.play('timeUp'), left));
    return () => timers.forEach(clearTimeout);
  }, [phase, endsAt]);
}

/** Current mute state, re-rendering on change. */
export function useMuted(): boolean {
  return useSyncExternalStore(
    (cb) => audio.subscribe(cb),
    () => audio.muted,
  );
}
