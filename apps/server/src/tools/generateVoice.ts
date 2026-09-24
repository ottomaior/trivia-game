import type { VoiceManifest } from '@trivia/shared';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Records Otto's lines with Azure's neural text-to-speech, once, into
// public/voice/. Lines whose text (or voice settings) haven't changed are
// skipped, so re-running after editing a few lines only pays for those.

export const DEFAULT_VOICE = 'hu-HU-TamasNeural';
/** A cheerier, slightly quicker host than the voice's default delivery. */
export const PROSODY = { rate: '+8%', pitch: '+6%' };

export interface VoiceLine {
  id: string;
  text: string;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function ssml(text: string, voice = DEFAULT_VOICE): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="hu-HU">` +
    `<voice name="${voice}"><prosody rate="${PROSODY.rate}" pitch="${PROSODY.pitch}">${escapeXml(text)}</prosody></voice>` +
    `</speak>`
  );
}

/** Identifies the recording: changes when the text, voice or delivery changes. */
export function lineHash(text: string, voice = DEFAULT_VOICE): string {
  return createHash('sha256').update(`${voice}|${PROSODY.rate}|${PROSODY.pitch}|${text}`).digest('hex').slice(0, 16);
}

export interface GenerateOptions {
  lines: VoiceLine[];
  outDir: string;
  key: string;
  region: string;
  voice?: string;
  fetchFn?: typeof fetch;
  log?: (msg: string) => void;
  /** Wait between requests (ms), to stay well inside the free tier's rate limit. */
  pauseMs?: number;
}

export async function generateVoices(opts: GenerateOptions): Promise<{ generated: string[]; skipped: string[]; removed: string[] }> {
  const voice = opts.voice ?? DEFAULT_VOICE;
  const fetchFn = opts.fetchFn ?? fetch;
  const log = opts.log ?? (() => {});
  await mkdir(opts.outDir, { recursive: true });
  const manifestPath = join(opts.outDir, 'manifest.json');
  const old: VoiceManifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};
  const manifest: VoiceManifest = {};
  const generated: string[] = [];
  const skipped: string[] = [];

  for (const line of opts.lines) {
    const hash = lineHash(line.text, voice);
    const file = `${line.id}.mp3`;
    if (old[line.id]?.hash === hash && existsSync(join(opts.outDir, file))) {
      manifest[line.id] = old[line.id]!;
      skipped.push(line.id);
      continue;
    }
    const audio = await synthesize(fetchFn, opts.region, opts.key, ssml(line.text, voice));
    await writeFile(join(opts.outDir, file), audio);
    manifest[line.id] = { file, hash };
    generated.push(line.id);
    log(`  ✓ ${line.id}: ${line.text}`);
    if (opts.pauseMs) await new Promise((r) => setTimeout(r, opts.pauseMs));
  }

  // Lines that were removed from the game: delete their clips.
  const removed = Object.keys(old).filter((id) => !(id in manifest));
  for (const id of removed) await rm(join(opts.outDir, old[id]!.file), { force: true });

  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(manifestPath, JSON.stringify(sorted, null, 2) + '\n');
  return { generated, skipped, removed };
}

async function synthesize(fetchFn: typeof fetch, region: string, key: string, body: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetchFn(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
        'User-Agent': 'otto-quiz-show',
      },
      body,
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    // Too many requests: back off and retry a few times.
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    throw new Error(`Azure TTS failed: HTTP ${res.status} ${await res.text().catch(() => '')}`.trim());
  }
}
