import { allOttoLines, ottoText, stripCues } from '@trivia/shared';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  azureProvider,
  elevenLabsProvider,
  estimateCredits,
  generateVoices,
  lineHash,
  pendingLines,
  ssml,
} from './generateVoice.ts';
import { ffmpegArgs, MAX_EFFECT_SECONDS, parseName, prepareAudio } from './prepareAudio.ts';
import { renderAll, SR, tick, toWav } from './studioSounds.ts';

describe('voice generation', () => {
  const ok = () => vi.fn(async (_url: string, _init?: RequestInit) => new Response(new Uint8Array([0xff, 0xf3, 0x44]), { status: 200 }));
  const azure = (fetchFn: typeof fetch) => azureProvider({ key: 'k', region: 'westeurope', fetchFn });
  const eleven = (fetchFn: typeof fetch, voiceId = 'otto123') => elevenLabsProvider({ key: 'secret', voiceId, fetchFn });

  it('builds SSML for the Hungarian voice and escapes the text', () => {
    const x = ssml('Fej fej mellett & "szoros"!');
    expect(x).toContain('xml:lang="hu-HU"');
    expect(x).toContain('<voice name="hu-HU-TamasNeural">');
    expect(x).toContain('Fej fej mellett &amp; &quot;szoros&quot;!');
  });

  it('records every line once, skips unchanged ones, and drops removed ones', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'voice-'));
    const fetchFn = ok();
    const provider = azure(fetchFn as unknown as typeof fetch);
    const lines = allOttoLines();

    const first = await generateVoices({ lines, outDir, provider });
    expect(first.generated).toHaveLength(lines.length);
    expect(fetchFn).toHaveBeenCalledTimes(lines.length);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
    expect((init!.headers as Record<string, string>)['Ocp-Apim-Subscription-Key']).toBe('k');
    expect(existsSync(join(outDir, 'credit.json'))).toBe(false);

    // Second run: nothing changed, nothing is paid for.
    const second = await generateVoices({ lines, outDir, provider });
    expect(second.generated).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(lines.length);

    // One line edited, one removed.
    const edited = lines.slice(1).map((l, i) => (i === 0 ? { ...l, text: `${l.text} Igen!` } : l));
    const third = await generateVoices({ lines: edited, outDir, provider });
    expect(third.generated).toEqual([edited[0]!.id]);
    expect(third.removed).toEqual([lines[0]!.id]);
    expect(existsSync(join(outDir, `${lines[0]!.id}.mp3`))).toBe(false);
    const manifest = JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8'));
    expect(manifest[edited[0]!.id].hash).toBe(lineHash(edited[0]!.text, provider.fingerprint));
  });

  it('calls ElevenLabs with the voice, model and key, and credits it on the TV', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'voice-'));
    const fetchFn = ok();
    const lines = [{ id: 'welcome-0', text: 'Jó estét!' }];
    await generateVoices({ lines, outDir, provider: eleven(fetchFn as unknown as typeof fetch) });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/otto123?output_format=mp3_44100_128');
    expect((init!.headers as Record<string, string>)['xi-api-key']).toBe('secret');
    const body = JSON.parse(init!.body as string);
    // Default: v3 on "Creative", forced to Hungarian.
    expect(body).toMatchObject({ text: 'Jó estét!', model_id: 'eleven_v3', language_code: 'hu', voice_settings: { stability: 0 } });
    expect(JSON.parse(await readFile(join(outDir, 'credit.json'), 'utf8'))).toEqual({ voice: 'ElevenLabs' });

    // Switching back to Azure records again and drops the credit.
    const azureFetch = ok();
    const r = await generateVoices({ lines, outDir, provider: azure(azureFetch as unknown as typeof fetch) });
    expect(r.generated).toEqual(['welcome-0']);
    expect(existsSync(join(outDir, 'credit.json'))).toBe(false);
  });

  it('forces Hungarian on ElevenLabs models that accept a language code', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'voice-'));
    const fetchFn = ok();
    const provider = elevenLabsProvider({
      key: 'secret',
      voiceId: 'otto123',
      model: 'eleven_flash_v2_5',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await generateVoices({ lines: [{ id: 'welcome-0', text: 'Jó estét!' }], outDir, provider });
    const body = JSON.parse(fetchFn.mock.calls[0]![1]!.body as string);
    expect(body).toMatchObject({ model_id: 'eleven_flash_v2_5', language_code: 'hu' });
    expect(body.voice_settings.similarity_boost).toBeGreaterThan(0);

    // multilingual_v2 rejects language_code, so it isn't sent.
    const v2Fetch = ok();
    const v2 = elevenLabsProvider({ key: 'secret', voiceId: 'otto123', model: 'eleven_multilingual_v2', fetchFn: v2Fetch as unknown as typeof fetch });
    await generateVoices({ lines: [{ id: 'welcome-0', text: 'Jó estét!' }], outDir: await mkdtemp(join(tmpdir(), 'voice-')), provider: v2 });
    expect(JSON.parse(v2Fetch.mock.calls[0]![1]!.body as string)).not.toHaveProperty('language_code');
  });

  it('gives every Otto line a performance cue that screens never show', () => {
    for (const { id, text } of allOttoLines()) {
      expect(text, id).toMatch(/^\[[a-z ]+\] /);
      expect(stripCues(text), id).not.toMatch(/[[\]]/);
    }
    expect(ottoText({ key: 'winner', variant: 1 })).toBe('Íme, a műsor győztese! Meghajlás!');
  });

  it('re-records a changed voice, and retakes only the lines asked for', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'voice-'));
    const fetchFn = ok();
    const f = fetchFn as unknown as typeof fetch;
    const lines = [
      { id: 'a-0', text: 'Egy' },
      { id: 'b-0', text: 'Kettő' },
    ];
    await generateVoices({ lines, outDir, provider: eleven(f) });
    expect(await pendingLines({ lines, outDir, provider: eleven(f) })).toEqual([]);
    expect(await pendingLines({ lines, outDir, provider: eleven(f, 'other') })).toHaveLength(2);

    const retake = await generateVoices({ lines, outDir, provider: eleven(f), redo: ['b-0'] });
    expect(retake.generated).toEqual(['b-0']);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    await expect(generateVoices({ lines, outDir, provider: eleven(f), redo: ['nope-0'] })).rejects.toThrow('No such line: nope-0');
  });

  it('retries when rate limited and explains failures, keeping lines already recorded', async () => {
    {
      const outDir = await mkdtemp(join(tmpdir(), 'voice-'));
      let calls = 0;
      const fetchFn = vi.fn(async () => {
        calls++;
        if (calls === 1) return new Response('slow down', { status: 429 });
        if (calls === 2) return new Response(new Uint8Array([1]), { status: 200 });
        return new Response('{"detail":"invalid key"}', { status: 401 });
      }) as unknown as typeof fetch;
      const lines = [
        { id: 'a-0', text: 'Egy' },
        { id: 'b-0', text: 'Kettő' },
      ];
      const provider = elevenLabsProvider({ key: 'secret', voiceId: 'otto123', fetchFn, retryMs: 1 });
      await expect(generateVoices({ lines, outDir, provider })).rejects.toThrow(/HTTP 401.*text-to-speech permission/);
      expect(calls).toBe(3);
      const manifest = JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8'));
      expect(Object.keys(manifest)).toEqual(['a-0']);
    }
  });

  it('estimates credits per model', () => {
    expect(estimateCredits(1718, 'eleven_multilingual_v2')).toBe(1718);
    expect(estimateCredits(1718, 'eleven_flash_v2_5')).toBe(859);
  });
});

describe('audio preparation', () => {
  it('recognises sound names and variants', () => {
    expect(parseName('applause.wav')).toEqual({ name: 'applause', variant: 1 });
    expect(parseName('applause-3.mp3')).toEqual({ name: 'applause', variant: 3 });
    expect(parseName('lobby.ogg')).toEqual({ name: 'lobby', variant: 1 });
    expect(parseName('random-noise.wav')).toBeNull();
  });

  it('trims and shortens effects but never music loops', () => {
    expect(ffmpegArgs('in', 'out', false).join(' ')).toMatch(/silenceremove.*atrim.*loudnorm/);
    expect(ffmpegArgs('in', 'out', true).join(' ')).not.toMatch(/silenceremove|atrim/);
  });

  const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
  const hasFfmpeg = (() => {
    try {
      execFileSync(ffmpeg, ['-version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();

  it.skipIf(!hasFfmpeg)('converts real files and writes the manifest', async () => {
    const inDir = await mkdtemp(join(tmpdir(), 'audio-in-'));
    const outDir = await mkdtemp(join(tmpdir(), 'audio-out-'));
    const tone = (file: string) =>
      execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=d=0.5', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-filter_complex', '[0][1]concat=n=2:v=0:a=1', join(inDir, file)]);
    tone('applause.wav');
    tone('applause-2.wav');
    tone('lobby.wav');
    await writeFile(join(inDir, 'mystery.wav'), '');
    const result = await prepareAudio({ inDir, outDir, ffmpeg });
    expect(result.manifest).toEqual({ applause: ['applause.mp3', 'applause-2.mp3'], lobby: ['lobby.mp3'] });
    expect(result.skipped).toEqual(['mystery.wav']);
    expect(existsSync(join(outDir, 'applause-2.mp3'))).toBe(true);
    expect(result.totalBytes).toBeGreaterThan(0);
  }, 30_000);
});

describe('studio sounds', () => {
  it('renders every sound audible, unclipped and within the effect length limit', { timeout: 30_000 }, () => {
    const all = renderAll();
    for (const [name, samples] of Object.entries(all)) {
      expect(parseName(`${name}.wav`), name).not.toBeNull();
      let peak = 0;
      let finite = true;
      for (const x of samples) {
        if (!Number.isFinite(x)) finite = false;
        peak = Math.max(peak, Math.abs(x));
      }
      expect(finite, name).toBe(true);
      expect(peak, name).toBeGreaterThan(0.5);
      expect(peak, name).toBeLessThanOrEqual(1);
      expect(samples.length / SR, name).toBeLessThanOrEqual(MAX_EFFECT_SECONDS + 1);
    }
  });

  it('is deterministic and writes valid WAV headers', () => {
    expect(tick(5)).toEqual(tick(5));
    const wav = toWav(tick(5));
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.readUInt32LE(24)).toBe(SR);
    expect(wav.length).toBe(44 + tick(5).length * 2);
  });
});
