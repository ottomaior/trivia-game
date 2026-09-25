import { isInputPhase, QUESTION_VOICE_DELAY_MS, type HostView } from '@trivia/shared';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { serverNow } from '../net/clock.ts';
import { cuesFor, musicFor, ottoDelay } from './cues.ts';
import { audio } from './engine.ts';

/** Lets the question card land before Otto starts reading (the server times the phase to match). */
const QUESTION_VOICE_DELAY_S = QUESTION_VOICE_DELAY_MS / 1000;

/**
 * Plays sounds, music and Otto's voice for each new TV view, plus the
 * countdown ticks. With `showOpen` the intro is the show-open clip, which has
 * its own sting, applause and welcome, so those are skipped.
 */
export function useAudioCues(view: HostView | null, { showOpen = false }: { showOpen?: boolean } = {}): void {
  const prev = useRef<HostView | null>(null);

  useEffect(() => {
    if (!view) return;
    const before = prev.current;
    const clip = showOpen && view.stage.phase === 'intro';
    if (!clip) for (const { cue, at } of cuesFor(before, view)) audio.play(cue, at);
    audio.music(musicFor(view.stage.phase, view.paused));
    // Otto speaks each new line (only once it's actually new, not on every update).
    const line = view.otto;
    const phaseChanged = before?.stage.phase !== view.stage.phase;
    if (line && !clip && (phaseChanged || line.key !== before?.otto?.key || line.variant !== before?.otto?.variant)) {
      audio.voice(line, ottoDelay(view.stage.phase));
    }
    // Otto reads each new question out; the answers open when he has finished.
    if (view.stage.phase === 'question_read' && before?.stage.phase !== 'question_read') {
      audio.question(view.stage.question.voice, QUESTION_VOICE_DELAY_S);
    }
    prev.current = view;
  }, [view]);

  // Ticks for the last 5 seconds of any answering phase, and a buzzer if time runs out.
  const phase = view?.stage.phase;
  const endsAt = view?.phaseEndsAt ?? null;
  useEffect(() => {
    if (!phase || !isInputPhase(phase) || endsAt === null) return;
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
