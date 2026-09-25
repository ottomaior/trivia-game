import { ottoVoiceId, type AudioManifest, type OttoLine, type VoiceManifest } from '@trivia/shared';
import { KEYS, readJson, writeJson } from '../net/storage.ts';
import { canSynthesize, renderLoop, synthesizedTracks, type Track } from './music.ts';
import { SFX, type Cue } from './sfx.ts';

// The TV's sound. One AudioContext, created on the first user gesture
// (browsers refuse to start audio before one). Phones never use this.
//
// Recorded files (public/audio/, listed in manifest.json) are the main
// sounds; a cue with several files ("applause", "applause-2", …) picks one at
// random. Cues without a file fall back to the synthesized versions in sfx.ts
// and music.ts. Otto's lines play from public/voice/ when recorded.

/** Mix levels, all in one place for tuning after a real game night. */
const LEVELS = {
  master: 0.9,
  music: 0.32,
  sfx: 0.8,
  voice: 1,
  /** Music level under the countdown ticks and under Otto's voice, relative to normal. */
  duck: 0.4,
  duckVoice: 0.25,
};

/**
 * Level of each recorded sound, relative to the effects bus. audio:prepare
 * brings every file to the same loudness, so a tiny click would otherwise be
 * as loud as the winner's fanfare.
 */
const FILE_LEVELS: Partial<Record<Cue, number>> = {
  applause: 0.5,
  cheer: 0.55,
  drumroll: 0.55,
  reveal: 0.85,
  wrong: 0.6,
  timeUp: 0.55,
  tick: 0.35,
  question: 0.5,
  start: 0.7,
  winner: 0.8,
  leadChange: 0.65,
  scoreboard: 0.45,
  spinTick: 0.25,
  spinLand: 0.5,
  join: 0.45,
  vote: 0.35,
  lockIn: 0.4,
  ooh: 0.6,
  aww: 0.6,
  laugh: 0.6,
  gasp: 0.6,
};

const FADE_S = 0.6;
/** When the reveal's "ding" lands after the drumroll starts (matches the TV animation). */
const REVEAL_HIT_S = 0.75;
/**
 * The server waits for Otto to finish before moving on, so his lines never
 * overlap; if one still would (a slow load, a reconnect), the new line waits
 * up to this long for the old one to end, and otherwise fades it out.
 */
const MAX_QUEUE_WAIT_S = 1.5;
/** Fade for a line that has to make way, instead of a hard cut. */
const VOICE_FADE_S = 0.15;
/** /tv?audiolog prints when Otto starts, finishes or gets faded out, to check timing in a real game. */
const LOG_VOICE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('audiolog');

interface Settings {
  muted: boolean;
}

type Listener = (muted: boolean) => void;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private levelBuf: Float32Array<ArrayBuffer> | null = null;
  private current: { track: Track; stop: () => void } | null = null;
  private wanted: Track | null = null;
  private files = new Map<string, AudioBuffer[]>();
  private voiceManifest: VoiceManifest = {};
  /** Read-alouds of the questions, by PublicQuestion.voice. */
  private questionManifest: VoiceManifest = {};
  private voices = new Map<string, Promise<AudioBuffer | null>>();
  /** The synthesized music loops, rendered once each (see renderLoop). */
  private loops = new Map<Track, Promise<AudioBuffer | null>>();
  private voicePlaying: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private voiceKey = '';
  /** Context time the current voice clip ends, so a question can wait for Otto to finish. */
  private voiceEndsAt = 0;
  private listeners = new Set<Listener>();
  muted = readJson<Settings>(KEYS.audio)?.muted ?? false;

  /** Call from a click/keypress handler. Safe to call repeatedly. */
  unlock(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.ctx) {
      // Nothing here needs a tight buffer (cues are scheduled ahead on the audio
      // clock, and lip sync only reads a level), so ask for the roomier
      // 'playback' one: a TV whose main thread stalls for a frame or two then
      // doesn't crackle.
      const ctx = new AudioContext({ latencyHint: 'playback' });
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : LEVELS.master;
      // A gentle limiter, so a ding, applause and a cheer landing together never clip.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      this.master.connect(limiter);
      limiter.connect(ctx.destination);
      this.musicBus = this.bus(LEVELS.music);
      this.sfxBus = this.bus(LEVELS.sfx);
      this.voiceBus = this.bus(LEVELS.voice);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.levelBuf = new Float32Array(this.analyser.fftSize);
      this.voiceBus.connect(this.analyser);
      void this.loadFiles();
      void this.loadVoiceManifests();
      for (const track of synthesizedTracks()) void this.synthLoop(track);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.wanted && !this.current) this.music(this.wanted);
  }

  get ready(): boolean {
    return this.ctx?.state === 'running';
  }

  hasFile(name: string): boolean {
    return (this.files.get(name)?.length ?? 0) > 0;
  }

  /** Plays a cue now (or `delay` seconds from now). */
  play(cue: Cue, delay = 0): void {
    const { ctx, sfxBus } = this;
    if (!ctx || !sfxBus || this.muted) return;
    const at = ctx.currentTime + 0.01 + delay;
    // The reveal is a drumroll with a "ding" on the hit; recordings come as two files.
    if (cue === 'reveal' && this.hasFile('reveal')) {
      this.playFile('drumroll', at);
      this.playFile('reveal', at + REVEAL_HIT_S);
      return;
    }
    if (!this.playFile(cue, at)) SFX[cue]?.(ctx, sfxBus, at);
    if (cue === 'tick') this.duck(LEVELS.duck, 0.6);
  }

  /** Switches the background loop, fading between tracks; null for silence. */
  music(track: Track | null): void {
    this.wanted = track;
    if (this.current?.track === track) return;
    const { ctx, musicBus } = this;
    if (!ctx || !musicBus) return;

    if (this.current) {
      this.current.stop();
      this.current = null;
    }
    if (!track) return;
    const file = this.pickFile(track);
    if (!file && !canSynthesize(track)) return;

    const fader = ctx.createGain();
    fader.gain.setValueAtTime(0.0001, ctx.currentTime);
    fader.gain.exponentialRampToValueAtTime(1, ctx.currentTime + FADE_S);
    fader.connect(musicBus);

    // A recording, or the synthesized loop once it has rendered (usually long before it's needed).
    let src: AudioBufferSourceNode | null = null;
    let cancelled = false;
    const loop = (buffer: AudioBuffer) => {
      src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(fader);
      src.start();
    };
    if (file) loop(file);
    else
      void this.synthLoop(track).then((buffer) => {
        if (buffer && !cancelled) loop(buffer);
      });
    this.current = {
      track,
      stop: () => {
        cancelled = true;
        fader.gain.cancelScheduledValues(ctx.currentTime);
        fader.gain.setValueAtTime(fader.gain.value, ctx.currentTime);
        fader.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + FADE_S);
        setTimeout(() => {
          src?.stop();
          fader.disconnect();
        }, FADE_S * 1000 + 50);
      },
    };
  }

  private synthLoop(track: Track): Promise<AudioBuffer | null> {
    let loop = this.loops.get(track);
    if (!loop) {
      loop = this.ctx ? renderLoop(track, this.ctx.sampleRate).catch(() => null) : Promise.resolve(null);
      this.loops.set(track, loop);
    }
    return loop;
  }

  /** Whether a pre-recorded voice clip exists for this line. */
  hasVoice(line: Pick<OttoLine, 'key' | 'variant'> | null): boolean {
    return line !== null && ottoVoiceId(line) in this.voiceManifest;
  }

  /** Plays Otto's recorded line (if there is one), after whatever he is still saying. */
  voice(line: Pick<OttoLine, 'key' | 'variant'>, delay = 0): void {
    if (!this.hasVoice(line)) return;
    const id = ottoVoiceId(line);
    this.speak(id, `/voice/${this.voiceManifest[id]!.file}`, delay, false);
  }

  /** Otto reads the question out (if it was recorded), right after his current line ends. */
  question(voice: string, delay = 0): void {
    const entry = this.questionManifest[voice];
    if (entry) this.speak(`q/${voice}`, `/voice/q/${entry.file}`, delay, true);
  }

  /** Loudness of Otto's voice right now, 0–1, for lip sync. */
  voiceLevel(): number {
    const { analyser, levelBuf } = this;
    if (!analyser || !levelBuf) return 0;
    analyser.getFloatTimeDomainData(levelBuf);
    let sum = 0;
    for (const v of levelBuf) sum += v * v;
    return Math.min(1, Math.sqrt(sum / levelBuf.length) * 6);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    writeJson(KEYS.audio, { muted } satisfies Settings);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : LEVELS.master, this.ctx.currentTime, 0.05);
    }
    for (const l of this.listeners) l(muted);
  }

  toggleMute(): void {
    this.setMuted(!this.muted);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---------------------------------------------------------------------------

  /**
   * Plays a voice clip after `delay` seconds, ducking the music under it. If
   * Otto is still talking then, it waits a moment for him to finish (always,
   * for a `queue`d question), and otherwise fades him out: never a hard cut.
   */
  private speak(key: string, url: string, delay: number, queue: boolean): void {
    const { ctx, voiceBus } = this;
    if (!ctx || !voiceBus || this.muted) return;
    const startAt = ctx.currentTime + delay;
    void this.loadVoice(key, url).then((buffer) => {
      if (!buffer || !this.ctx) return;
      const now = this.ctx.currentTime;
      let at = Math.max(now, startAt);
      const busy = this.voicePlaying && this.voiceEndsAt > at;
      if (busy) {
        const limit = queue ? MAX_QUEUE_WAIT_S * 2 : MAX_QUEUE_WAIT_S;
        at = Math.max(at, Math.min(this.voiceEndsAt + 0.1, now + limit));
        if (this.voiceEndsAt > at) {
          this.fadeOut(this.voicePlaying!, at);
          if (LOG_VOICE) console.info(`[otto] fading out ${this.voiceKey} for ${key}`);
        }
      }
      const gain = this.ctx.createGain();
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(gain).connect(voiceBus);
      src.start(at);
      src.onended = () => {
        gain.disconnect();
        if (LOG_VOICE) console.info(`[otto] done ${key}`);
      };
      if (LOG_VOICE) console.info(`[otto] ${key} at +${(at - now).toFixed(2)}s for ${buffer.duration.toFixed(2)}s`);
      this.voicePlaying = { src, gain };
      this.voiceKey = key;
      this.voiceEndsAt = at + buffer.duration;
      this.duck(LEVELS.duckVoice, at - now + buffer.duration + 0.2);
    });
  }

  private fadeOut({ src, gain }: { src: AudioBufferSourceNode; gain: GainNode }, at: number): void {
    gain.gain.setValueAtTime(1, at);
    gain.gain.linearRampToValueAtTime(0, at + VOICE_FADE_S);
    src.stop(at + VOICE_FADE_S);
  }

  private bus(level: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.value = level;
    g.connect(this.master!);
    return g;
  }

  private pickFile(name: string): AudioBuffer | null {
    const variants = this.files.get(name);
    if (!variants?.length) return null;
    return variants[Math.floor(Math.random() * variants.length)]!;
  }

  private playFile(name: Cue, at: number): boolean {
    const buffer = this.pickFile(name);
    if (!buffer || !this.ctx || !this.sfxBus) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const level = this.ctx.createGain();
    level.gain.value = FILE_LEVELS[name] ?? 0.6;
    src.connect(level).connect(this.sfxBus);
    src.onended = () => level.disconnect();
    src.start(at);
    return true;
  }

  private duck(level: number, seconds: number): void {
    const { ctx, musicBus } = this;
    if (!ctx || !musicBus) return;
    const now = ctx.currentTime;
    holdAt(musicBus.gain, now);
    musicBus.gain.setTargetAtTime(LEVELS.music * level, now, 0.03);
    musicBus.gain.setTargetAtTime(LEVELS.music, now + seconds, 0.25);
  }

  private async loadFiles(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const res = await fetch('/audio/manifest.json');
      if (!res.ok) return;
      const manifest = (await res.json()) as AudioManifest;
      await Promise.all(
        Object.entries(manifest).map(async ([name, entry]) => {
          const list = Array.isArray(entry) ? entry : entry ? [entry] : [];
          const buffers = await Promise.all(
            list.map(async (file) => {
              try {
                return await ctx.decodeAudioData(await (await fetch(`/audio/${file}`)).arrayBuffer());
              } catch {
                return null;
              }
            }),
          );
          this.files.set(name, buffers.filter((b): b is AudioBuffer => b !== null));
        }),
      );
      // A loop already playing as synth switches to its recording on the next change.
    } catch {
      // Recordings are optional; the synthesized sounds always work.
    }
  }

  private async loadVoiceManifests(): Promise<void> {
    const load = async (url: string): Promise<VoiceManifest> => {
      try {
        const res = await fetch(url);
        return res.ok ? ((await res.json()) as VoiceManifest) : {};
      } catch {
        return {}; // No voice: Otto stays text-only.
      }
    };
    [this.voiceManifest, this.questionManifest] = await Promise.all([load('/voice/manifest.json'), load('/voice/q/manifest.json')]);
  }

  private loadVoice(key: string, url: string): Promise<AudioBuffer | null> {
    let p = this.voices.get(key);
    if (!p) {
      p = fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => this.ctx!.decodeAudioData(data))
        .catch(() => null);
      this.voices.set(key, p);
    }
    return p;
  }
}

/**
 * Cancels a parameter's scheduled changes from `at` on, keeping the value it
 * has reached (cancelling alone would snap it back to the value before the
 * ramp, an audible click when a duck lands mid-fade).
 */
function holdAt(param: AudioParam, at: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(at);
  } else {
    const current = param.value;
    param.cancelScheduledValues(at);
    param.setValueAtTime(current, at);
  }
}

export const audio = new AudioEngine();
export type { Cue, Track };
