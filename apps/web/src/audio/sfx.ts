// Synthesized versions of the sound effects: oscillators, filtered noise and
// envelopes, in a 70s–80s game-show style. They play whenever no recorded
// file is provided for a cue (see engine.ts); some audience sounds (ooh, aww,
// laugh, gasp) only exist as recordings. Each cue schedules itself on the
// given context from `t` and returns its length in seconds, so it can also be
// rendered offline (see selftest.ts).

import type { SoundCue } from '@trivia/shared';

export type Cue = SoundCue;

type Ctx = BaseAudioContext;

interface ToneOpts {
  freq: number;
  start: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  glideTo?: number;
  filter?: number;
}

/** One enveloped oscillator note. */
function tone(ctx: Ctx, out: AudioNode, o: ToneOpts): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const attack = o.attack ?? 0.005;
  const release = o.release ?? Math.min(0.2, o.dur * 0.6);
  const peak = o.gain ?? 0.3;
  osc.type = o.type ?? 'triangle';
  osc.frequency.setValueAtTime(o.freq, o.start);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, o.start + o.dur);
  env.gain.setValueAtTime(0.0001, o.start);
  env.gain.exponentialRampToValueAtTime(peak, o.start + attack);
  env.gain.setValueAtTime(peak, Math.max(o.start + attack, o.start + o.dur - release));
  env.gain.exponentialRampToValueAtTime(0.0001, o.start + o.dur);
  let node: AudioNode = osc;
  if (o.filter) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.filter;
    osc.connect(lp);
    node = lp;
  }
  node.connect(env).connect(out);
  osc.start(o.start);
  osc.stop(o.start + o.dur + 0.02);
}

const noiseBuffers = new WeakMap<Ctx, AudioBuffer>();
function noiseBuffer(ctx: Ctx): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}

interface NoiseOpts {
  start: number;
  dur: number;
  gain?: number;
  type?: BiquadFilterType;
  freq?: number;
  sweepTo?: number;
  q?: number;
}

/** A burst of filtered white noise (hi-hats, swooshes, drumrolls). */
export function noise(ctx: Ctx, out: AudioNode, o: NoiseOpts): GainNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = o.type ?? 'highpass';
  filter.frequency.setValueAtTime(o.freq ?? 6000, o.start);
  if (o.sweepTo) filter.frequency.exponentialRampToValueAtTime(o.sweepTo, o.start + o.dur);
  filter.Q.value = o.q ?? 0.7;
  const env = ctx.createGain();
  const peak = o.gain ?? 0.2;
  env.gain.setValueAtTime(0.0001, o.start);
  env.gain.exponentialRampToValueAtTime(peak, o.start + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, o.start + o.dur);
  src.connect(filter).connect(env).connect(out);
  src.start(o.start);
  src.stop(o.start + o.dur + 0.02);
  return env;
}

const N = (semitonesFromA4: number) => 440 * 2 ** (semitonesFromA4 / 12);
// Handy pitches.
const C5 = N(3);
const E5 = N(7);
const G5 = N(10);
const A5 = N(12);
const C6 = N(15);

/** A bright bell: fundamental plus an inharmonic partial. */
function bell(ctx: Ctx, out: AudioNode, freq: number, start: number, gain = 0.25): void {
  tone(ctx, out, { freq, start, dur: 0.9, type: 'sine', gain, release: 0.8 });
  tone(ctx, out, { freq: freq * 2.76, start, dur: 0.4, type: 'sine', gain: gain * 0.25, release: 0.35 });
}

/** A brassy chord stab (detuned saws through a lowpass). */
function brass(ctx: Ctx, out: AudioNode, freqs: number[], start: number, dur: number, gain = 0.1): void {
  for (const f of freqs) {
    tone(ctx, out, { freq: f, start, dur, type: 'sawtooth', gain, filter: 2400, attack: 0.02 });
    tone(ctx, out, { freq: f * 1.004, start, dur, type: 'sawtooth', gain: gain * 0.7, filter: 2400, attack: 0.02 });
  }
}

/** A crowd clapping: many short filtered noise bursts at random moments, swelling then fading. */
function clapping(ctx: Ctx, out: AudioNode, t: number, seconds: number, density: number): void {
  const claps = Math.round(seconds * density);
  for (let i = 0; i < claps; i++) {
    const at = Math.random() * seconds;
    const swell = Math.min(1, at / 0.4) * Math.max(0, 1 - Math.max(0, at - seconds * 0.55) / (seconds * 0.45));
    noise(ctx, out, {
      start: t + at,
      dur: 0.025 + Math.random() * 0.03,
      gain: 0.05 + swell * 0.1 * Math.random(),
      type: 'bandpass',
      freq: 900 + Math.random() * 1800,
      q: 1.2,
    });
  }
}

export const SFX: Partial<Record<Cue, (ctx: Ctx, out: AudioNode, t: number) => number>> = {
  applause(ctx, out, t) {
    clapping(ctx, out, t, 2.6, 150);
    return 2.7;
  },
  cheer(ctx, out, t) {
    clapping(ctx, out, t, 3, 190);
    // A couple of whistles over the clapping.
    tone(ctx, out, { freq: 1800, glideTo: 2700, start: t + 0.2, dur: 0.35, type: 'sine', gain: 0.05 });
    tone(ctx, out, { freq: 2600, glideTo: 1900, start: t + 0.6, dur: 0.4, type: 'sine', gain: 0.04 });
    return 3.1;
  },
  join(ctx, out, t) {
    tone(ctx, out, { freq: E5, start: t, dur: 0.14, gain: 0.25 });
    tone(ctx, out, { freq: A5, start: t + 0.1, dur: 0.3, gain: 0.25 });
    return 0.45;
  },
  start(ctx, out, t) {
    [C5, E5, G5].forEach((f, i) => brass(ctx, out, [f], t + i * 0.13, 0.14, 0.12));
    brass(ctx, out, [C5, E5, G5, C6], t + 0.42, 0.9, 0.08);
    noise(ctx, out, { start: t + 0.42, dur: 0.5, gain: 0.08, freq: 5000 });
    return 1.4;
  },
  vote(ctx, out, t) {
    tone(ctx, out, { freq: 1200, start: t, dur: 0.07, type: 'sine', gain: 0.2 });
    return 0.1;
  },
  question(ctx, out, t) {
    tone(ctx, out, { freq: 330, glideTo: 990, start: t, dur: 0.25, type: 'triangle', gain: 0.15 });
    bell(ctx, out, 990, t + 0.25, 0.18);
    return 1.2;
  },
  lockIn(ctx, out, t) {
    tone(ctx, out, { freq: 1700, glideTo: 900, start: t, dur: 0.06, type: 'sine', gain: 0.3 });
    noise(ctx, out, { start: t, dur: 0.03, gain: 0.08, type: 'bandpass', freq: 2500, q: 3 });
    return 0.1;
  },
  tick(ctx, out, t) {
    tone(ctx, out, { freq: 1000, start: t, dur: 0.035, type: 'square', gain: 0.07, filter: 3000 });
    return 0.05;
  },
  timeUp(ctx, out, t) {
    tone(ctx, out, { freq: 110, start: t, dur: 0.7, type: 'sawtooth', gain: 0.14, filter: 1200 });
    tone(ctx, out, { freq: 116, start: t, dur: 0.7, type: 'sawtooth', gain: 0.14, filter: 1200 });
    return 0.75;
  },
  reveal(ctx, out, t) {
    // Snare-ish roll that swells, then the "ding-ding" of a right answer.
    for (let i = 0; i < 14; i++) {
      noise(ctx, out, { start: t + i * 0.05, dur: 0.05, gain: 0.03 + i * 0.006, type: 'bandpass', freq: 1800, q: 0.8 });
    }
    bell(ctx, out, C6, t + 0.75, 0.22);
    bell(ctx, out, N(19), t + 0.95, 0.22);
    return 2;
  },
  wrong(ctx, out, t) {
    tone(ctx, out, { freq: 233, glideTo: 117, start: t, dur: 0.55, type: 'sawtooth', gain: 0.16, filter: 900 });
    tone(ctx, out, { freq: 220, glideTo: 110, start: t, dur: 0.55, type: 'sawtooth', gain: 0.12, filter: 900 });
    return 0.6;
  },
  scoreboard(ctx, out, t) {
    noise(ctx, out, { start: t, dur: 0.45, gain: 0.7, type: 'bandpass', freq: 400, sweepTo: 4000, q: 0.6 });
    return 0.5;
  },
  leadChange(ctx, out, t) {
    brass(ctx, out, [N(-2), N(2), N(5)], t, 0.12, 0.1);
    brass(ctx, out, [N(0), N(4), N(7)], t + 0.15, 0.5, 0.1);
    return 0.7;
  },
  spinTick(ctx, out, t) {
    tone(ctx, out, { freq: 2200, glideTo: 1400, start: t, dur: 0.03, type: 'square', gain: 0.08, filter: 5000 });
    return 0.05;
  },
  spinLand(ctx, out, t) {
    brass(ctx, out, [N(3), N(7), N(10)], t, 0.35, 0.1);
    bell(ctx, out, N(15), t, 0.2);
    return 1;
  },
  winner(ctx, out, t) {
    const steps = [C5, E5, G5, C6, G5, C6];
    steps.forEach((f, i) => brass(ctx, out, [f], t + i * 0.14, 0.13, 0.12));
    const hold = t + steps.length * 0.14;
    brass(ctx, out, [C5, E5, G5, C6], hold, 1.6, 0.08);
    for (let i = 0; i < 6; i++) noise(ctx, out, { start: hold + i * 0.25, dur: 0.2, gain: 0.05, freq: 7000 });
    bell(ctx, out, C6 * 2, hold, 0.12);
    return hold - t + 1.8;
  },
};
