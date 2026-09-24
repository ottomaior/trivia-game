import { scheduleTrack, type Track } from './music.ts';
import { SFX, type Cue } from './sfx.ts';

// Renders every sound offline and reports its loudness, so automated tests can
// check each one makes sound and doesn't clip. Loaded only with ?audiotest on /tv.

export interface SoundReport {
  name: Cue | Track;
  seconds: number;
  peak: number;
  rms: number;
  /** 16-bit mono WAV, base64, so a test can save it for a listen. */
  wav: string;
}

const RATE = 44_100;

async function render(
  seconds: number,
  draw: (ctx: OfflineAudioContext) => void,
): Promise<{ peak: number; rms: number; wav: string }> {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * RATE), RATE);
  draw(ctx);
  const data = (await ctx.startRendering()).getChannelData(0);
  let peak = 0;
  let sum = 0;
  for (const v of data) {
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
  }
  return { peak, rms: Math.sqrt(sum / data.length), wav: toWav(data) };
}

function toWav(samples: Float32Array): string {
  const buf = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  buf.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVEfmt ');
  buf.setUint32(16, 16, true);
  buf.setUint16(20, 1, true);
  buf.setUint16(22, 1, true);
  buf.setUint32(24, RATE, true);
  buf.setUint32(28, RATE * 2, true);
  buf.setUint16(32, 2, true);
  buf.setUint16(34, 16, true);
  str(36, 'data');
  buf.setUint32(40, samples.length * 2, true);
  samples.forEach((v, i) => buf.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  let bin = '';
  const bytes = new Uint8Array(buf.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function renderAll(): Promise<SoundReport[]> {
  const reports: SoundReport[] = [];
  for (const [cue, synth] of Object.entries(SFX) as [Cue, NonNullable<(typeof SFX)[Cue]>][]) {
    // Measure the cue's length with a throwaway context, then render it.
    const probe = new OfflineAudioContext(1, RATE, RATE);
    const seconds = synth(probe, probe.destination, 0) + 0.2;
    reports.push({ name: cue, seconds, ...(await render(seconds, (ctx) => synth(ctx, ctx.destination, 0.01))) });
  }
  for (const track of ['lobby', 'thinking'] as const) {
    reports.push({ name: track, seconds: 8, ...(await render(8, (ctx) => scheduleTrack(ctx, ctx.destination, track, 8))) });
  }
  return reports;
}
