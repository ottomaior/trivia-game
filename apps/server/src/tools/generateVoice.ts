import type { VoiceManifest } from '@trivia/shared';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Records Otto's lines once, into public/voice/, with a text-to-speech
// service: ElevenLabs (the most expressive host voice) or Azure. Lines whose
// text, voice and settings haven't changed are skipped, so re-running after
// editing a few lines only pays for those.

export interface VoiceLine {
  id: string;
  text: string;
}

export interface VoiceProvider {
  /** Shown on the TV as the voice credit (null: no credit needed). */
  credit: string | null;
  /** Everything besides the text that changes the recording: voice, model, settings. */
  fingerprint: string;
  synthesize(text: string): Promise<Buffer>;
}

/** Identifies a recording: changes when the text or the provider's voice or settings change. */
export function lineHash(text: string, fingerprint: string): string {
  return createHash('sha256').update(`${fingerprint}|${text}`).digest('hex').slice(0, 16);
}

type FetchFn = typeof fetch;

/** POSTs with a few retries when the service says "too many requests". */
async function postAudio(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit,
  explain: (status: number, body: string) => string,
  retryMs = 1000,
): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetchFn(url, { ...init, method: 'POST' });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, retryMs * 2 ** attempt));
      continue;
    }
    throw new Error(explain(res.status, await res.text().catch(() => '')));
  }
}

// --- Azure -------------------------------------------------------------------

export const AZURE_DEFAULT_VOICE = 'hu-HU-TamasNeural';
/** A cheerier, slightly quicker host than the voice's default delivery. */
export const PROSODY = { rate: '+8%', pitch: '+6%' };

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function ssml(text: string, voice = AZURE_DEFAULT_VOICE): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="hu-HU">` +
    `<voice name="${voice}"><prosody rate="${PROSODY.rate}" pitch="${PROSODY.pitch}">${escapeXml(text)}</prosody></voice>` +
    `</speak>`
  );
}

export function azureProvider(opts: { key: string; region: string; voice?: string; fetchFn?: FetchFn }): VoiceProvider {
  const voice = opts.voice ?? AZURE_DEFAULT_VOICE;
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    credit: null,
    fingerprint: `${voice}|${PROSODY.rate}|${PROSODY.pitch}`,
    synthesize: (text) =>
      postAudio(
        fetchFn,
        `https://${opts.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': opts.key,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
            'User-Agent': 'otto-quiz-show',
          },
          body: ssml(text, voice),
        },
        (status, body) => `Azure TTS failed: HTTP ${status} ${body}`.trim(),
      ),
  };
}

// --- ElevenLabs --------------------------------------------------------------

export const ELEVEN_DEFAULT_MODEL = 'eleven_multilingual_v2';
/**
 * Delivery for a lively game-show host: a little less stable than default
 * (more expression), close to the chosen voice, with some added style.
 */
export const ELEVEN_SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true };

export function elevenLabsProvider(opts: {
  key: string;
  voiceId: string;
  model?: string;
  settings?: typeof ELEVEN_SETTINGS;
  fetchFn?: FetchFn;
  /** Base back-off when rate limited (tests shorten it). */
  retryMs?: number;
}): VoiceProvider {
  const model = opts.model ?? ELEVEN_DEFAULT_MODEL;
  const settings = opts.settings ?? ELEVEN_SETTINGS;
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    credit: 'ElevenLabs',
    fingerprint: `elevenlabs|${opts.voiceId}|${model}|${JSON.stringify(settings)}`,
    synthesize: (text) =>
      postAudio(
        fetchFn,
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}?output_format=mp3_44100_128`,
        {
          headers: { 'xi-api-key': opts.key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
          body: JSON.stringify({ text, model_id: model, voice_settings: settings }),
        },
        (status, body) => {
          const hint =
            status === 401
              ? ' Check the API key, and that it has the text-to-speech permission.'
              : status === 402 || body.includes('quota_exceeded')
                ? ' Out of credits for this month.'
                : status === 404
                  ? ' Check ELEVENLABS_VOICE_ID (copy it from the voice in your ElevenLabs library).'
                  : '';
          return `ElevenLabs failed: HTTP ${status} ${body}`.trim() + hint;
        },
        opts.retryMs,
      ),
  };
}

/** Rough credits a recording costs: one per character, half on the Flash/Turbo models. */
export function estimateCredits(chars: number, model: string): number {
  return Math.ceil(/flash|turbo/.test(model) ? chars / 2 : chars);
}

// --- Recording ---------------------------------------------------------------

export interface GenerateOptions {
  lines: VoiceLine[];
  outDir: string;
  provider: VoiceProvider;
  log?: (msg: string) => void;
  /** Wait between requests (ms), to stay inside free-tier rate limits. */
  pauseMs?: number;
  /** Line ids to record again even though they haven't changed (retakes). */
  redo?: string[];
}

export interface GenerateResult {
  generated: string[];
  skipped: string[];
  removed: string[];
}

/** Which lines a run would record (new, changed or retaken), without recording anything. */
export async function pendingLines(opts: Pick<GenerateOptions, 'lines' | 'outDir' | 'provider' | 'redo'>): Promise<VoiceLine[]> {
  const old = await readManifest(opts.outDir);
  const redo = new Set(opts.redo ?? []);
  return opts.lines.filter((l) => redo.has(l.id) || !isCurrent(old, opts.outDir, l, opts.provider));
}

export async function generateVoices(opts: GenerateOptions): Promise<GenerateResult> {
  const log = opts.log ?? (() => {});
  await mkdir(opts.outDir, { recursive: true });
  const old = await readManifest(opts.outDir);
  const redo = new Set(opts.redo ?? []);
  const unknown = [...redo].filter((id) => !opts.lines.some((l) => l.id === id));
  if (unknown.length > 0) throw new Error(`No such line: ${unknown.join(', ')} (see --dry-run for the ids)`);

  const manifest: VoiceManifest = {};
  const generated: string[] = [];
  const skipped: string[] = [];
  try {
    for (const line of opts.lines) {
      const file = `${line.id}.mp3`;
      if (!redo.has(line.id) && isCurrent(old, opts.outDir, line, opts.provider)) {
        manifest[line.id] = old[line.id]!;
        skipped.push(line.id);
        continue;
      }
      const audio = await opts.provider.synthesize(line.text);
      await writeFile(join(opts.outDir, file), audio);
      manifest[line.id] = { file, hash: lineHash(line.text, opts.provider.fingerprint) };
      generated.push(line.id);
      log(`  ✓ ${line.id}: ${line.text}`);
      if (opts.pauseMs) await new Promise((r) => setTimeout(r, opts.pauseMs));
    }
  } catch (err) {
    // Keep what was already recorded (and paid for) before failing.
    for (const line of opts.lines) if (!(line.id in manifest) && old[line.id]) manifest[line.id] = old[line.id]!;
    await writeManifest(opts.outDir, manifest, opts.provider);
    throw err;
  }

  // Lines that were removed from the game: delete their clips.
  const removed = Object.keys(old).filter((id) => !(id in manifest));
  for (const id of removed) await rm(join(opts.outDir, old[id]!.file), { force: true });
  await writeManifest(opts.outDir, manifest, opts.provider);
  return { generated, skipped, removed };
}

function isCurrent(old: VoiceManifest, outDir: string, line: VoiceLine, provider: VoiceProvider): boolean {
  const entry = old[line.id];
  return entry?.hash === lineHash(line.text, provider.fingerprint) && existsSync(join(outDir, entry.file));
}

async function readManifest(outDir: string): Promise<VoiceManifest> {
  const path = join(outDir, 'manifest.json');
  return existsSync(path) ? (JSON.parse(await readFile(path, 'utf8')) as VoiceManifest) : {};
}

/** Writes the manifest, and the TV's voice credit when the service asks for one. */
async function writeManifest(outDir: string, manifest: VoiceManifest, provider: VoiceProvider): Promise<void> {
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(sorted, null, 2) + '\n');
  const creditPath = join(outDir, 'credit.json');
  if (provider.credit) await writeFile(creditPath, JSON.stringify({ voice: provider.credit }, null, 2) + '\n');
  else await rm(creditPath, { force: true });
}
