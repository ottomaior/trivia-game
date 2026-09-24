import { KEYS, readJson, writeJson } from '../net/storage.ts';
import { MusicPlayer, type Track } from './music.ts';
import { SFX, type Cue } from './sfx.ts';

// The TV's sound. One AudioContext, created on the first user gesture
// (browsers refuse to start audio before one). Phones never use this.

/** Mix levels, all in one place for tuning after a real game night. */
const LEVELS = {
  master: 0.9,
  music: 0.35,
  sfx: 0.8,
  /** Music level while the countdown ticks, relative to normal. */
  duck: 0.4,
};

const FADE_S = 0.6;

/**
 * Optional replacements: list files in public/audio/manifest.json, e.g.
 * { "winner": "winner.mp3", "lobby": "lobby.mp3" }, and drop the files next
 * to it. Music tracks loop.
 */
type Manifest = Partial<Record<Cue | Track, string>>;

interface Settings {
  muted: boolean;
}

type Listener = (muted: boolean) => void;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private current: { track: Track; stop: () => void } | null = null;
  private wanted: Track | null = null;
  private overrides = new Map<string, AudioBuffer>();
  private listeners = new Set<Listener>();
  muted = readJson<Settings>(KEYS.audio)?.muted ?? false;

  /** Call from a click/keypress handler. Safe to call repeatedly. */
  unlock(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : LEVELS.master;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = LEVELS.music;
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = LEVELS.sfx;
      this.sfxBus.connect(this.master);
      void this.loadOverrides();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.wanted && !this.current) this.music(this.wanted);
  }

  get ready(): boolean {
    return this.ctx?.state === 'running';
  }

  play(cue: Cue): void {
    const { ctx, sfxBus } = this;
    if (!ctx || !sfxBus || this.muted) return;
    const file = this.overrides.get(cue);
    if (file) {
      const src = ctx.createBufferSource();
      src.buffer = file;
      src.connect(sfxBus);
      src.start();
    } else {
      SFX[cue](ctx, sfxBus, ctx.currentTime + 0.01);
    }
    if (cue === 'tick') this.duck();
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

    const fader = ctx.createGain();
    fader.gain.setValueAtTime(0.0001, ctx.currentTime);
    fader.gain.exponentialRampToValueAtTime(1, ctx.currentTime + FADE_S);
    fader.connect(musicBus);

    const file = this.overrides.get(track);
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

  private duck(): void {
    const { ctx, musicBus } = this;
    if (!ctx || !musicBus) return;
    const now = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setTargetAtTime(LEVELS.music * LEVELS.duck, now, 0.02);
    musicBus.gain.setTargetAtTime(LEVELS.music, now + 0.6, 0.2);
  }

  private async loadOverrides(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const res = await fetch('/audio/manifest.json');
      if (!res.ok) return;
      const manifest = (await res.json()) as Manifest;
      await Promise.all(
        Object.entries(manifest).map(async ([name, file]) => {
          if (!file) return;
          const data = await (await fetch(`/audio/${file}`)).arrayBuffer();
          this.overrides.set(name, await ctx.decodeAudioData(data));
        }),
      );
      // A track that was already playing as synth switches to its file next time.
    } catch {
      // Overrides are optional; the synthesized sounds always work.
    }
  }
}

export const audio = new AudioEngine();
export type { Cue, Track };
