import { MUSIC_TRACKS, SOUND_CUES, type AudioManifest } from '@trivia/shared';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

// Turns hand-picked sound files into game-ready MP3s: trims silence, evens
// out loudness (−16 LUFS, the usual target for games and streaming), keeps
// effects short, and writes public/audio/manifest.json.

const INPUT_EXT = new Set(['.wav', '.mp3', '.ogg', '.flac', '.aif', '.aiff', '.m4a']);
const NAMES = new Set<string>([...SOUND_CUES, ...MUSIC_TRACKS]);
const MUSIC = new Set<string>(MUSIC_TRACKS);
/** Everything together should stay small enough to load quickly on a TV. */
export const BUDGET_BYTES = 6 * 1024 * 1024;
/** Effects longer than this are cut (with a fade), so a crowd doesn't drone on. */
export const MAX_EFFECT_SECONDS = 5;

export interface Parsed {
  name: string;
  variant: number;
}

/** "applause-2.wav" → { name: "applause", variant: 2 }; unknown names → null. */
export function parseName(file: string): Parsed | null {
  const base = file.slice(0, file.length - extname(file).length);
  const m = /^(.*?)(?:-(\d+))?$/.exec(base);
  if (!m || !NAMES.has(m[1]!)) return null;
  return { name: m[1]!, variant: m[2] ? Number(m[2]) : 1 };
}

export function ffmpegArgs(input: string, output: string, music: boolean): string[] {
  const filters = music
    ? ['loudnorm=I=-16:TP=-1.5:LRA=11']
    : [
        // Trim silence at the start, then (reversed) at the end.
        'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02',
        'areverse',
        'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05',
        'areverse',
        `atrim=0:${MAX_EFFECT_SECONDS}`,
        `afade=t=out:st=${MAX_EFFECT_SECONDS - 0.4}:d=0.4`,
        'loudnorm=I=-16:TP=-1.5:LRA=11',
      ];
  return [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    input,
    '-af',
    filters.join(','),
    '-ar',
    '44100',
    '-ac',
    music ? '2' : '1',
    '-b:a',
    music ? '128k' : '96k',
    output,
  ];
}

export interface PrepareResult {
  manifest: AudioManifest;
  skipped: string[];
  totalBytes: number;
}

export async function prepareAudio(opts: { inDir: string; outDir: string; ffmpeg: string }): Promise<PrepareResult> {
  await mkdir(opts.outDir, { recursive: true });
  const manifestPath = join(opts.outDir, 'manifest.json');
  const old: AudioManifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};

  const entries = (await readdir(opts.inDir)).filter((f) => INPUT_EXT.has(extname(f).toLowerCase())).sort();
  const found: Record<string, { variant: number; file: string }[]> = {};
  const skipped: string[] = [];
  let totalBytes = 0;

  for (const file of entries) {
    const parsed = parseName(file);
    if (!parsed) {
      skipped.push(file);
      continue;
    }
    const outName = parsed.variant === 1 ? `${parsed.name}.mp3` : `${parsed.name}-${parsed.variant}.mp3`;
    const outPath = join(opts.outDir, outName);
    await run(opts.ffmpeg, ffmpegArgs(join(opts.inDir, file), outPath, MUSIC.has(parsed.name)));
    totalBytes += (await stat(outPath)).size;
    (found[parsed.name] ??= []).push({ variant: parsed.variant, file: outName });
  }
  // Variant 1 first, then 2, 3, … (a plain sort puts "applause-2" before "applause").
  const manifest: Record<string, string[]> = Object.fromEntries(
    Object.entries(found).map(([name, list]) => [name, list.sort((a, b) => a.variant - b.variant).map((v) => v.file)]),
  );

  // Remove files this tool made earlier that no longer have a source.
  const keep = new Set(Object.values(manifest).flat());
  for (const list of Object.values(old)) {
    for (const f of Array.isArray(list) ? list : list ? [list] : []) {
      if (!keep.has(f)) await rm(join(opts.outDir, f), { force: true });
    }
  }

  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(manifestPath, JSON.stringify(sorted, null, 2) + '\n');
  return { manifest: sorted, skipped, totalBytes };
}
