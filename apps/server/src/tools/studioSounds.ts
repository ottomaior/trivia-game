// The studio's own sound set, rendered offline: denser and roomier than what
// the browser can synthesize live (hundreds of layered claps, a room echo,
// brass sections), and free of any licence question because every sample is
// computed here. `pnpm audio:render` writes them as WAVs into audio-src/,
// and `pnpm audio:prepare` turns them into the game's MP3s. A real recording
// dropped into audio-src/ under the same name replaces one.
//
// No crowd voices (ooh, aww, laugh, gasp): fake voices sound worse than none.

export const SR = 44_100;

/** Small deterministic PRNG, so every render of a sound is identical. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const buffer = (seconds: number) => new Float32Array(Math.ceil(seconds * SR));
const noteHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Adds `src` into `dst` starting at `at` seconds, scaled by `gain`. */
function mixInto(dst: Float32Array, src: Float32Array, at: number, gain = 1): void {
  const start = Math.round(at * SR);
  for (let i = 0; i < src.length && start + i < dst.length; i++) if (start + i >= 0) dst[start + i]! += src[i]! * gain;
}

// --- Filters (RBJ biquads) ----------------------------------------------------

type BiquadKind = 'lowpass' | 'highpass' | 'bandpass';

class Biquad {
  private b0 = 0;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(
    private readonly kind: BiquadKind,
    freq: number,
    q = 0.707,
  ) {
    this.set(freq, q);
  }

  set(freq: number, q: number): void {
    const w = (2 * Math.PI * Math.min(freq, SR * 0.45)) / SR;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    let b0: number, b1: number, b2: number;
    if (this.kind === 'lowpass') {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
    } else if (this.kind === 'highpass') {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  tick(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

function filter(src: Float32Array, kind: BiquadKind, freq: number, q = 0.707): Float32Array {
  const f = new Biquad(kind, freq, q);
  return src.map((x) => f.tick(x));
}

// --- Room echo (Freeverb) -----------------------------------------------------

/** A studio-sized room: returns dry + wet, with the tail appended. */
export function reverb(dry: Float32Array, { wet = 0.25, room = 0.72, damp = 0.35, tail = 1.2 } = {}): Float32Array {
  const out = new Float32Array(dry.length + Math.round(tail * SR));
  const scale = SR / 44_100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => ({
    buf: new Float32Array(Math.round(d * scale)),
    i: 0,
    store: 0,
  }));
  const allpasses = [556, 441, 341, 225].map((d) => ({ buf: new Float32Array(Math.round(d * scale)), i: 0 }));
  const feedback = room * 0.28 + 0.7;
  const d1 = damp * 0.4;
  for (let n = 0; n < out.length; n++) {
    const x = n < dry.length ? dry[n]! : 0;
    const input = x * 0.015;
    let acc = 0;
    for (const c of combs) {
      const y = c.buf[c.i]!;
      c.store = y * (1 - d1) + c.store * d1;
      c.buf[c.i] = input + c.store * feedback;
      c.i = (c.i + 1) % c.buf.length;
      acc += y;
    }
    for (const a of allpasses) {
      const b = a.buf[a.i]!;
      a.buf[a.i] = acc + b * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      acc = b - acc;
    }
    out[n] = x + acc * wet * 3;
  }
  return out;
}

// --- Building blocks ------------------------------------------------------------

/** Scales so the loudest sample sits at `peak`. */
export function normalize(src: Float32Array, peak = 0.89): Float32Array {
  let max = 0;
  for (const x of src) max = Math.max(max, Math.abs(x));
  if (max === 0) return src;
  const k = peak / max;
  return src.map((x) => x * k);
}

/** Short fades at both ends so nothing clicks. */
function fadeEdges(src: Float32Array, inS = 0.002, outS = 0.03): Float32Array {
  const a = Math.round(inS * SR);
  const b = Math.round(outS * SR);
  for (let i = 0; i < a && i < src.length; i++) src[i]! *= i / a;
  for (let i = 0; i < b && i < src.length; i++) src[src.length - 1 - i]! *= i / b;
  return src;
}

/** A struck resonance: a decaying sine with a slight downward pitch bend. */
function ping(freq: number, seconds: number, decay: number, bend = 0): Float32Array {
  const out = buffer(seconds);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const f = freq * (1 + bend * Math.exp(-t * 40));
    phase += (2 * Math.PI * f) / SR;
    out[i] = Math.sin(phase) * Math.exp(-t / decay);
  }
  // Fade the last fifth so a still-ringing tone never ends in a click.
  return fadeEdges(out, 0, seconds / 5);
}

/** White noise with an exponential decay, then filtered. */
function burst(r: () => number, seconds: number, decay: number, kind: BiquadKind, freq: number, q = 0.707): Float32Array {
  const out = buffer(seconds);
  for (let i = 0; i < out.length; i++) out[i] = (r() * 2 - 1) * Math.exp(-i / SR / decay);
  return fadeEdges(filter(out, kind, freq, q), 0, seconds / 5);
}

/** A bell: slightly inharmonic partials, the high ones dying first, plus a strike click. */
function bell(r: () => number, freq: number, seconds = 1.6, gain = 1): Float32Array {
  const out = buffer(seconds);
  const partials: [number, number, number][] = [
    [1, 1, 1.1],
    [2.01, 0.45, 0.7],
    [3.02, 0.25, 0.45],
    [4.13, 0.12, 0.28],
    [5.43, 0.07, 0.18],
  ];
  for (const [ratio, amp, decay] of partials) mixInto(out, ping(freq * ratio, seconds, decay), 0, amp * gain);
  mixInto(out, burst(r, 0.01, 0.002, 'highpass', 4000), 0, 0.25 * gain);
  return fadeEdges(out, 0, seconds / 4);
}

/**
 * A brass voice: a band-limited sawtooth whose brightness follows the
 * loudness (brass gets brighter as it's blown harder), with a late vibrato.
 */
function brass(freq: number, seconds: number, { attack = 0.03, release = 0.12, vibrato = 0.004, detune = 0 } = {}): Float32Array {
  const out = buffer(seconds + release);
  const f0 = freq * 2 ** (detune / 1200);
  const harmonics = Math.max(1, Math.min(24, Math.floor(SR / 2 / f0) - 1));
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = t < attack ? t / attack : t < seconds ? 1 - 0.15 * Math.min(1, (t - attack) / 0.3) : 0.85 * Math.exp(-(t - seconds) / (release / 3));
    const vib = 1 + vibrato * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, Math.max(0, (t - 0.2) / 0.3));
    phase += (2 * Math.PI * f0 * vib) / SR;
    const bright = 0.35 + 0.65 * env;
    let s = 0;
    for (let h = 1; h <= harmonics; h++) s += Math.sin(phase * h) * Math.pow(bright, h * 0.55) / h;
    out[i] = s * env;
  }
  return fadeEdges(filter(out, 'lowpass', 5200), 0, release);
}

/** A section: three slightly detuned players on the same note. */
function brassSection(midi: number, seconds: number, opts: Parameters<typeof brass>[2] = {}): Float32Array {
  const out = buffer(seconds + 0.2);
  for (const detune of [-6, 0, 5]) mixInto(out, brass(noteHz(midi), seconds, { ...opts, detune }), 0, 0.33);
  return out;
}

/** A crash cymbal: bright noise with a long, darkening tail. */
function cymbal(r: () => number, seconds = 2, gain = 1): Float32Array {
  const hi = burst(r, seconds, seconds / 3.2, 'highpass', 5200);
  const shimmer = burst(r, seconds, seconds / 5, 'bandpass', 8500, 1.2);
  const out = buffer(seconds);
  mixInto(out, hi, 0, 0.7 * gain);
  mixInto(out, shimmer, 0, 0.5 * gain);
  return out;
}

/** A timpani hit: a low, pitch-dropping boom. */
function timpani(r: () => number, midi: number, gain = 1): Float32Array {
  const out = buffer(1.4);
  mixInto(out, ping(noteHz(midi), 1.4, 0.45, 0.08), 0, gain);
  mixInto(out, ping(noteHz(midi) * 1.5, 1.4, 0.25, 0.05), 0, 0.35 * gain);
  mixInto(out, burst(r, 0.08, 0.015, 'lowpass', 900), 0, 0.4 * gain);
  return out;
}

// --- The sounds ---------------------------------------------------------------------

/** One hand clap: a few micro-transients of band-passed noise within ~10 ms. */
function clap(r: () => number, centre: number, far: number): Float32Array {
  const out = buffer(0.06);
  const hits = 2 + Math.floor(r() * 3);
  for (let h = 0; h < hits; h++) {
    mixInto(out, burst(r, 0.05, 0.004 + r() * 0.006, 'bandpass', centre * (0.85 + r() * 0.3), 1.4 + r()), h * (0.002 + r() * 0.003), 1 - h * 0.2);
  }
  return far > 0.5 ? filter(out, 'lowpass', 3500 - far * 1500) : out;
}

/** A studio audience clapping: dozens of people, each at their own pace, swelling in and fading out. */
export function applause(seed: number, seconds = 3.6, people = 70): Float32Array {
  const r = rng(seed);
  const out = buffer(seconds);
  for (let p = 0; p < people; p++) {
    const centre = 900 + r() * 1700;
    const far = r();
    const rate = 3.6 + r() * 2.2;
    const gain = (0.25 + r() * 0.75) * (1 - far * 0.55);
    const start = r() * r() * 0.45;
    const stop = seconds - 0.2 - r() * 1.6;
    for (let t = start; t < stop; t += (1 / rate) * (0.9 + r() * 0.2)) {
      // Everyone claps a little softer as they tire.
      const tired = 1 - 0.35 * Math.max(0, (t - seconds * 0.5) / seconds);
      mixInto(out, clap(r, centre, far), t, gain * tired);
    }
  }
  return fadeEdges(normalize(reverb(out, { wet: 0.22, tail: 0.8 })), 0.01, 0.6);
}

/** A crowd roaring: formant-shaped noise with slow swells, plus whistles, over applause. */
export function cheer(seed: number, seconds = 3.4): Float32Array {
  const r = rng(seed);
  const out = applause(seed + 100, seconds, 90);
  // The roar: noise through vowel-like resonances, swelling and settling.
  const roar = buffer(seconds);
  for (const [freq, q, gain] of [
    [650, 2.2, 1],
    [1150, 2.8, 0.7],
    [2500, 3, 0.35],
  ] as const) {
    const b = burst(r, seconds, 99, 'bandpass', freq, q);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      const env = Math.min(1, t / 0.25) * Math.exp(-Math.max(0, t - 0.6) / 1.4) * (0.8 + 0.2 * Math.sin(t * 7.3 + freq));
      roar[i]! += b[i]! * env * gain;
    }
  }
  mixInto(out, normalize(roar, 0.5), 0, 1);
  // Two whistles.
  for (const [at, f1, f2] of [
    [0.25, 1900, 2800],
    [0.9, 2600, 2000],
  ] as const) {
    const w = buffer(0.5);
    let ph = 0;
    for (let i = 0; i < w.length; i++) {
      const t = i / SR;
      const f = f1 + (f2 - f1) * Math.min(1, t / 0.35) + 25 * Math.sin(2 * Math.PI * 9 * t);
      ph += (2 * Math.PI * f) / SR;
      w[i] = Math.sin(ph) * Math.min(1, t / 0.03) * Math.min(1, (0.5 - t) / 0.08);
    }
    mixInto(out, w, at, 0.12);
  }
  return fadeEdges(normalize(reverb(out, { wet: 0.12, tail: 0.6 })), 0.01, 0.5);
}

/** A snare drumroll that builds for 0.8 s (the reveal's "ding" lands on its end). */
export function drumroll(seed: number, seconds = 0.8): Float32Array {
  const r = rng(seed);
  const out = buffer(seconds + 0.1);
  for (let t = 0, n = 0; t < seconds; t += 0.036 + (r() - 0.5) * 0.004, n++) {
    const v = (0.35 + 0.65 * (t / seconds) ** 1.4) * (n % 2 ? 0.85 : 1);
    mixInto(out, ping(185 + r() * 20, 0.12, 0.025, 0.2), t, 0.5 * v);
    mixInto(out, burst(r, 0.14, 0.05, 'bandpass', 3800 + r() * 800, 0.8), t, 1.1 * v);
  }
  return fadeEdges(normalize(reverb(out, { wet: 0.15, tail: 0.4 })), 0.001, 0.08);
}

/** The right answer: a bright double "ding-ding" with a little sparkle. */
export function reveal(seed: number): Float32Array {
  const r = rng(seed);
  const out = buffer(2.1);
  mixInto(out, bell(r, noteHz(88), 1.9), 0); // E6
  mixInto(out, bell(r, noteHz(92), 1.9), 0.13); // G#6
  for (const [i, m] of [96, 100, 103].entries()) mixInto(out, bell(r, noteHz(m), 0.9), 0.3 + i * 0.05, 0.12);
  return fadeEdges(normalize(reverb(out, { wet: 0.3, tail: 0.6 })), 0.001, 0.2);
}

/** Nobody got it: a muted "wah-wah-wah-waaah" trombone. */
export function wrong(seed: number): Float32Array {
  const r = rng(seed);
  const notes: [number, number][] = [
    [55, 0.3], // G3
    [54, 0.3],
    [53, 0.3],
    [52, 1.0],
  ];
  const out = buffer(2.3);
  let at = 0;
  for (const [i, [midi, len]] of notes.entries()) {
    const last = i === notes.length - 1;
    const tone = brass(noteHz(midi), len - 0.04, { attack: 0.04, release: 0.1, vibrato: last ? 0.02 : 0.003 });
    // The mute: a band-pass that opens on each note ("wah") and closes again.
    const f = new Biquad('bandpass', 500, 2.5);
    for (let n = 0; n < tone.length; n++) {
      const t = n / SR;
      const open = last ? 0.5 + 0.5 * Math.sin(2 * Math.PI * 4.5 * t - Math.PI / 2) : Math.min(1, t / 0.08) * Math.exp(-t / 0.25);
      f.set(450 + 1100 * open, 2.2);
      tone[n] = f.tick(tone[n]!) * 2.5 + tone[n]! * 0.15;
    }
    mixInto(out, tone, at);
    at += len;
  }
  mixInto(out, burst(r, 2.3, 0.6, 'bandpass', 900, 0.8), 0, 0.02);
  return fadeEdges(normalize(reverb(out, { wet: 0.18, tail: 0.5 })), 0.005, 0.3);
}

/** Time's up: the classic game-show buzzer. */
export function timeUp(): Float32Array {
  const seconds = 0.75;
  const out = buffer(seconds);
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    p1 += (2 * Math.PI * 98) / SR;
    p2 += (2 * Math.PI * 147.5) / SR;
    const sq = (p: number) => Math.tanh(Math.sin(p) * 6);
    const env = Math.min(1, t / 0.01) * Math.min(1, (seconds - t) / 0.05);
    out[i] = (sq(p1) * 0.6 + sq(p2) * 0.4) * env;
  }
  const nasal = filter(out, 'bandpass', 1100, 0.9);
  const mix = out.map((x, i) => x * 0.35 + nasal[i]! * 1.2);
  return fadeEdges(normalize(filter(mix, 'lowpass', 4500)));
}

/** A clock tick: a small wood block. */
export function tick(seed: number): Float32Array {
  const r = rng(seed);
  const out = buffer(0.08);
  mixInto(out, ping(1250, 0.08, 0.018), 0, 1);
  mixInto(out, ping(2750, 0.08, 0.008), 0, 0.5);
  mixInto(out, burst(r, 0.01, 0.0015, 'highpass', 3000), 0, 0.4);
  return fadeEdges(normalize(out), 0.0005, 0.01);
}

/** A new question: a rising whoosh that lands on a light chime. */
export function question(seed: number): Float32Array {
  const r = rng(seed);
  const seconds = 0.5;
  const out = buffer(1.4);
  const f = new Biquad('bandpass', 400, 1.6);
  for (let i = 0; i < seconds * SR; i++) {
    const t = i / SR;
    f.set(400 * (3500 / 400) ** (t / seconds), 1.6);
    const env = Math.sin(Math.PI * Math.min(1, t / seconds)) ** 1.5;
    out[i] = f.tick(r() * 2 - 1) * env;
  }
  mixInto(out, bell(r, noteHz(81), 0.9), 0.36, 0.35); // A5
  mixInto(out, bell(r, noteHz(88), 0.9), 0.42, 0.25); // E6
  return fadeEdges(normalize(reverb(out, { wet: 0.2, tail: 0.3 })), 0.01, 0.2);
}

/** The show starts: a short brass fanfare with a timpani and a crash. */
export function start(seed: number): Float32Array {
  const r = rng(seed);
  const out = buffer(2.4);
  // Ta-ta-ta TAAA.
  for (const t of [0, 0.13, 0.26]) mixInto(out, brassSection(67, 0.09, { attack: 0.01, release: 0.05 }), t, 0.8); // G4
  for (const m of [60, 64, 67, 72]) mixInto(out, brassSection(m, 1.3, { attack: 0.02, vibrato: 0.005 }), 0.4, 0.45); // C major
  mixInto(out, timpani(r, 36), 0.4, 0.9);
  mixInto(out, cymbal(r, 1.8), 0.4, 0.35);
  return fadeEdges(normalize(reverb(out, { wet: 0.25, tail: 0.8 })), 0.002, 0.4);
}

/** The winner: a bigger fanfare, rising to a held chord with timpani and crash. */
export function winner(seed: number): Float32Array {
  const r = rng(seed);
  const out = buffer(3.6);
  // Timpani roll building in.
  for (let t = 0, n = 0; t < 0.55; t += 0.05, n++) mixInto(out, timpani(r, n % 2 ? 43 : 36, 0.25 + t), t, 0.5);
  for (const [i, m] of [67, 72, 76].entries()) mixInto(out, brassSection(m, 0.14, { attack: 0.01, release: 0.05 }), 0.55 + i * 0.16, 0.8);
  for (const m of [60, 64, 67, 72, 79]) mixInto(out, brassSection(m, 2.1, { attack: 0.03, vibrato: 0.006 }), 1.03, 0.4);
  mixInto(out, timpani(r, 36), 1.03, 1);
  mixInto(out, cymbal(r, 2.4), 1.03, 0.45);
  return fadeEdges(normalize(reverb(out, { wet: 0.28, tail: 1 })), 0.002, 0.5);
}

/** Someone takes the lead: a quick rising brass "ba-BAM". */
export function leadChange(seed: number): Float32Array {
  const r = rng(seed);
  const out = buffer(1.6);
  for (const m of [55, 59, 62]) mixInto(out, brassSection(m, 0.1, { attack: 0.01, release: 0.05 }), 0, 0.5); // G major
  for (const m of [60, 64, 67, 72]) mixInto(out, brassSection(m, 0.55, { attack: 0.015 }), 0.16, 0.45); // C major
  mixInto(out, cymbal(r, 1.2), 0.16, 0.25);
  return fadeEdges(normalize(reverb(out, { wet: 0.22, tail: 0.6 })), 0.002, 0.3);
}

/** The standings appear: a soft swoosh with a low thump. */
export function scoreboard(seed: number): Float32Array {
  const r = rng(seed);
  const seconds = 0.55;
  const out = buffer(0.9);
  const f = new Biquad('bandpass', 1500, 1.2);
  for (let i = 0; i < seconds * SR; i++) {
    const t = i / SR;
    f.set(1600 - 1000 * (t / seconds), 1.2);
    out[i] = f.tick(r() * 2 - 1) * Math.sin(Math.PI * (t / seconds)) ** 2;
  }
  mixInto(out, ping(70, 0.4, 0.09, 0.4), 0.3, 0.8);
  return fadeEdges(normalize(reverb(out, { wet: 0.15, tail: 0.3 })), 0.01, 0.15);
}

/** One click of the category slot machine. */
export function spinTick(seed: number): Float32Array {
  const r = rng(seed);
  const out = buffer(0.05);
  mixInto(out, burst(r, 0.02, 0.0012, 'bandpass', 3600, 1.5), 0, 1);
  mixInto(out, ping(1500, 0.05, 0.006), 0.001, 0.35);
  return fadeEdges(normalize(out), 0.0003, 0.01);
}

/** The slot machine stops: a clunk and a small bell. */
export function spinLand(seed: number): Float32Array {
  const r = rng(seed);
  const out = buffer(1.4);
  mixInto(out, ping(95, 0.3, 0.06, 0.5), 0, 1);
  mixInto(out, burst(r, 0.1, 0.02, 'lowpass', 700), 0, 0.7);
  mixInto(out, bell(r, noteHz(84), 1.2), 0.03, 0.3); // C6
  return fadeEdges(normalize(reverb(out, { wet: 0.15, tail: 0.3 })), 0.0005, 0.15);
}

/** A player joins: a friendly pop and a tiny chime. */
export function join(seed: number): Float32Array {
  const r = rng(seed);
  const out = buffer(1);
  const pop = buffer(0.14);
  let ph = 0;
  for (let i = 0; i < pop.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (320 + 700 * Math.min(1, t / 0.05))) / SR;
    pop[i] = Math.sin(ph) * Math.exp(-t / 0.04) * Math.min(1, t / 0.002);
  }
  mixInto(out, pop, 0, 0.9);
  mixInto(out, bell(r, noteHz(84), 0.8), 0.06, 0.25);
  return fadeEdges(normalize(reverb(out, { wet: 0.12, tail: 0.2 })), 0.0005, 0.1);
}

/** A vote lands: a soft wooden tap. */
export function vote(seed: number): Float32Array {
  const r = rng(seed);
  const out = buffer(0.12);
  mixInto(out, ping(820, 0.12, 0.022), 0, 1);
  mixInto(out, ping(1900, 0.12, 0.01), 0, 0.3);
  mixInto(out, burst(r, 0.01, 0.0015, 'bandpass', 2500), 0, 0.3);
  return fadeEdges(normalize(out), 0.0005, 0.02);
}

/** An answer locks in: "ka-chunk" and a short confirming blip. */
export function lockIn(seed: number): Float32Array {
  const r = rng(seed);
  const out = buffer(0.4);
  mixInto(out, burst(r, 0.02, 0.002, 'bandpass', 3000, 1.2), 0, 0.8);
  mixInto(out, ping(140, 0.15, 0.03, 0.3), 0.045, 0.9);
  mixInto(out, burst(r, 0.05, 0.01, 'lowpass', 900), 0.045, 0.5);
  mixInto(out, ping(1320, 0.2, 0.05), 0.1, 0.18);
  return fadeEdges(normalize(out), 0.0005, 0.05);
}

/** Everything `pnpm audio:render` writes: file name (without .wav) → samples. */
export function renderAll(): Record<string, Float32Array> {
  return {
    applause: applause(1),
    'applause-2': applause(2, 3.2, 55),
    'applause-3': applause(3, 4, 85),
    cheer: cheer(11),
    'cheer-2': cheer(12, 3),
    drumroll: drumroll(21),
    reveal: reveal(31),
    wrong: wrong(41),
    timeUp: timeUp(),
    tick: tick(51),
    question: question(61),
    start: start(71),
    winner: winner(81),
    leadChange: leadChange(91),
    scoreboard: scoreboard(101),
    spinTick: spinTick(111),
    spinLand: spinLand(121),
    join: join(131),
    vote: vote(141),
    lockIn: lockIn(151),
  };
}

/** 16-bit mono PCM WAV. */
export function toWav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i]!)) * 32767), i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
