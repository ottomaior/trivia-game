import { ottoVoiceId, type AudioManifest, type OttoLine, type VoiceManifest } from '@trivia/shared';
import { KEYS, readJson, writeJson } from '../net/storage.ts';
import { MusicPlayer, type Track } from './music.ts';
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

const FADE_S = 0.6;
/** When the reveal's "ding" lands after the drumroll starts (matches the TV animation). */
const REVEAL_HIT_S = 0.75;

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
  private voices = new Map<string, Promise<AudioBuffer | null>>();
  private voicePlaying: AudioBufferSourceNode | null = null;
  private listeners = new Set<Listener>();
  muted = readJson<Settings>(KEYS.audio)?.muted ?? false;

  /** Call from a click/keypress handler. Safe to call repeatedly. */
  unlock(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : LEVELS.master;
      this.master.connect(ctx.destination);
      this.musicBus = this.bus(LEVELS.music);
      this.sfxBus = this.bus(LEVELS.sfx);
      this.voiceBus = this.bus(LEVELS.voice);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.levelBuf = new Float32Array(this.analyser.fftSize);
      this.voiceBus.connect(this.analyser);
      void this.loadFiles();
      void this.loadVoiceManifest();
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
    if (!file && !MusicPlayer.canSynthesize(track)) return;

    const fader = ctx.createGain();
    fader.gain.setValueAtTime(0.0001, ctx.currentTime);
    fader.gain.exponentialRampToValueAtTime(1, ctx.currentTime + FADE_S);
    fader.connect(musicBus);

    let stopSource: () => void;
    if (file) {
      const src = ctx.createBufferSource();
      src.buffer = file;
      src.loop = true;
      src.connect(fader);
      src.start();
      stopSource = () => src.stop(ctx.currentTime + FADE_S);
    } else {
      const player = new MusicPlayer(ctx, fader, track);
      player.start();
      stopSource = () => player.stop();
    }
    this.current = {
      track,
      stop: () => {
        fader.gain.cancelScheduledValues(ctx.currentTime);
        fader.gain.setValueAtTime(fader.gain.value, ctx.currentTime);
        fader.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + FADE_S);
        setTimeout(() => {
          stopSource();
          fader.disconnect();
        }, FADE_S * 1000 + 50);
      },
    };
  }

  /** Whether a pre-recorded voice clip exists for this line. */
  hasVoice(line: Pick<OttoLine, 'key' | 'variant'> | null): boolean {
    return line !== null && ottoVoiceId(line) in this.voiceManifest;
  }

  /** Plays Otto's recorded line (if there is one), ducking the music under it. */
  voice(line: Pick<OttoLine, 'key' | 'variant'>, delay = 0): void {
    const { ctx, voiceBus } = this;
    if (!ctx || !voiceBus || this.muted || !this.hasVoice(line)) return;
    const id = ottoVoiceId(line);
    const startAt = ctx.currentTime + delay;
    void this.loadVoice(id).then((buffer) => {
      if (!buffer || !this.ctx) return;
      this.voicePlaying?.stop();
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(voiceBus);
      const at = Math.max(this.ctx.currentTime, startAt);
      src.start(at);
      this.voicePlaying = src;
      this.duck(LEVELS.duckVoice, at - this.ctx.currentTime + buffer.duration + 0.2);
    });
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

  private playFile(name: string, at: number): boolean {
    const buffer = this.pickFile(name);
    if (!buffer || !this.ctx || !this.sfxBus) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.sfxBus);
    src.start(at);
    return true;
  }

  private duck(level: number, seconds: number): void {
    const { ctx, musicBus } = this;
    if (!ctx || !musicBus) return;
    const now = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(now);
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

  private async loadVoiceManifest(): Promise<void> {
    try {
      const res = await fetch('/voice/manifest.json');
      if (res.ok) this.voiceManifest = (await res.json()) as VoiceManifest;
    } catch {
      // No voice: Otto stays text-only.
    }
  }

  private loadVoice(id: string): Promise<AudioBuffer | null> {
    let p = this.voices.get(id);
    if (!p) {
      const entry = this.voiceManifest[id];
      p = entry
        ? fetch(`/voice/${entry.file}`)
            .then((r) => r.arrayBuffer())
            .then((data) => this.ctx!.decodeAudioData(data))
            .catch(() => null)
        : Promise.resolve(null);
      this.voices.set(id, p);
    }
    return p;
  }
}

export const audio = new AudioEngine();
export type { Cue, Track };
