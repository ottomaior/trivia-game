import { allOttoLines } from '@trivia/shared';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { generateVoices, lineHash, ssml } from './generateVoice.ts';
import { ffmpegArgs, parseName, prepareAudio } from './prepareAudio.ts';

describe('voice generation', () => {
  it('builds SSML for the Hungarian voice and escapes the text', () => {
    const x = ssml('Fej fej mellett & "szoros"!');
    expect(x).toContain('xml:lang="hu-HU"');
    expect(x).toContain('<voice name="hu-HU-TamasNeural">');
    expect(x).toContain('Fej fej mellett &amp; &quot;szoros&quot;!');
  });

  it('records every line once, skips unchanged ones, and drops removed ones', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'voice-'));
    const fetchFn = vi.fn(async () => new Response(new Uint8Array([0xff, 0xf3, 0x44]), { status: 200 }));
    const lines = allOttoLines();

    const first = await generateVoices({ lines, outDir, key: 'k', region: 'westeurope', fetchFn });
    expect(first.generated).toHaveLength(lines.length);
    expect(fetchFn).toHaveBeenCalledTimes(lines.length);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
    expect((init.headers as Record<string, string>)['Ocp-Apim-Subscription-Key']).toBe('k');

    // Second run: nothing changed, nothing is paid for.
    const second = await generateVoices({ lines, outDir, key: 'k', region: 'westeurope', fetchFn });
    expect(second.generated).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(lines.length);

    // One line edited, one removed.
    const edited = lines.slice(1).map((l, i) => (i === 0 ? { ...l, text: `${l.text} Igen!` } : l));
    const third = await generateVoices({ lines: edited, outDir, key: 'k', region: 'westeurope', fetchFn });
    expect(third.generated).toEqual([edited[0]!.id]);
    expect(third.removed).toEqual([lines[0]!.id]);
    expect(existsSync(join(outDir, `${lines[0]!.id}.mp3`))).toBe(false);
    const manifest = JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8'));
    expect(manifest[edited[0]!.id].hash).toBe(lineHash(edited[0]!.text));
  });

  it('reports Azure errors clearly', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'voice-'));
    const fetchFn = vi.fn(async () => new Response('bad key', { status: 401 }));
    await expect(
      generateVoices({ lines: [{ id: 'x-0', text: 'Szia' }], outDir, key: 'k', region: 'r', fetchFn }),
    ).rejects.toThrow('HTTP 401');
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
