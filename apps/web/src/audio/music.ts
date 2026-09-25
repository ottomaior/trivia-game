import { noise } from './sfx.ts';

// Two procedural loops, scheduled a little ahead on the audio clock so timing
// stays tight even if the main thread stutters.

import type { MusicTrack } from '@trivia/shared';

export type Track = MusicTrack;

/** How far ahead notes are booked on the audio clock, and how often the booking runs. */
const LOOKAHEAD_S = 1.0;
const SCHEDULE_EVERY_MS = 250;

const A4 = 440;
const f = (semitonesFromA4: number) => A4 * 2 ** (semitonesFromA4 / 12);

interface Pattern {
  bpm: number;
  /** Steps per beat (2 = eighth notes). */
  stepsPerBeat: number;
  steps: number;
  play: (ctx: BaseAudioContext, out: AudioNode, step: number, t: number, stepDur: number) => void;
}

function note(
  ctx: BaseAudioContext,
  out: AudioNode,
  freq: number,
  t: number,
  dur: number,
  gain: number,
  type: OscillatorType,
  filter = 2000,
): void {
  const osc = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  lp.type = 'lowpass';
  lp.frequency.value = filter;
  env.gain.value = 0; // a gain is 1 until its first event: stay silent until the note starts
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(lp).connect(env).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// Lounge ii–V–I–vi in C: Dm7, G7, Cmaj7, Am7 (semitones from A4).
const LOUNGE_CHORDS = [
  [-7, -4, 0, 3], // Dm7: D F A C
  [-2, 2, 5, 8], // G7: G B D F
  [-9, -5, -2, 2], // Cmaj7: C E G B
  [-12, -9, -5, -2], // Am7: A C E G
];
const LOUNGE_BASS = [
  [-19, -12, -15, -14], // D A F# F
  [-14, -7, -10, -9], // G D B Bb
  [-21, -14, -17, -16], // C G E Eb
  [-24, -17, -21, -20], // A E C C#
];

/** Synthesized loops; 'final' only plays from a recording. */
const PATTERNS: Partial<Record<Track, Pattern>> = {
  lobby: {
    bpm: 100,
    stepsPerBeat: 2,
    steps: 32, // 4 bars of 4 beats in eighths
    play(ctx, out, step, t, stepDur) {
      const bar = Math.floor(step / 8);
      const inBar = step % 8;
      // Walking bass on the beats.
      if (inBar % 2 === 0) note(ctx, out, f(LOUNGE_BASS[bar]![inBar / 2]!), t, stepDur * 1.8, 0.22, 'triangle', 900);
      // Organ stabs on 2 and 4 (with a little swing push on the "and" of 4).
      if (inBar === 2 || inBar === 6 || inBar === 7) {
        for (const s of LOUNGE_CHORDS[bar]!) note(ctx, out, f(s), t, stepDur * 0.9, 0.035, 'square', 1600);
      }
      // Brushed hi-hat on every eighth, accented off-beats.
      noise(ctx, out, { start: t, dur: 0.05, gain: inBar % 2 ? 0.035 : 0.018, freq: 7000 });
    },
  },
  thinking: {
    bpm: 120,
    stepsPerBeat: 1,
    steps: 16,
    play(ctx, out, step, t, stepDur) {
      const bar = Math.floor(step / 4);
      const roots = [-12, -16, -19, -14]; // A, F, D, G
      // Low pulse on every beat.
      note(ctx, out, f(roots[bar]! - 12), t, stepDur * 0.5, 0.2, 'sine', 400);
      // Soft pad at the start of each bar.
      if (step % 4 === 0) {
        for (const s of [0, 3, 7]) note(ctx, out, f(roots[bar]! + s), t, stepDur * 3.8, 0.025, 'triangle', 1200);
      }
      // A clock-like tick on the off-beat.
      noise(ctx, out, { start: t + stepDur / 2, dur: 0.02, gain: 0.02, type: 'bandpass', freq: 3500, q: 4 });
    },
  },
};

/** Plays one looping track into `out` until stop() is called. */
export class MusicPlayer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    readonly track: Track,
  ) {}

  /** Whether this track has a synthesized version. */
  static canSynthesize(track: Track): boolean {
    return PATTERNS[track] !== undefined;
  }

  start(): void {
    const pattern = PATTERNS[this.track];
    if (!pattern) return;
    const stepDur = 60 / pattern.bpm / pattern.stepsPerBeat;
    this.nextTime = this.ctx.currentTime + 0.05;
    // Notes are booked a second ahead: a main-thread stall shorter than that
    // (a screen change, a burst of bitmaps decoding on a TV) then never
    // delays or bunches them.
    const schedule = () => {
      while (this.nextTime < this.ctx.currentTime + LOOKAHEAD_S) {
        pattern.play(this.ctx, this.out, this.step, this.nextTime, stepDur);
        this.nextTime += stepDur;
        this.step = (this.step + 1) % pattern.steps;
      }
    };
    schedule();
    this.timer = setInterval(schedule, SCHEDULE_EVERY_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

/** Schedules `seconds` of a track in one go (for offline rendering in the self-test). */
export function scheduleTrack(ctx: BaseAudioContext, out: AudioNode, track: Track, seconds: number): void {
  const pattern = PATTERNS[track];
  if (!pattern) return;
  const stepDur = 60 / pattern.bpm / pattern.stepsPerBeat;
  for (let step = 0, t = 0.01; t < seconds; step++, t += stepDur) {
    pattern.play(ctx, out, step % pattern.steps, t, stepDur);
  }
}
