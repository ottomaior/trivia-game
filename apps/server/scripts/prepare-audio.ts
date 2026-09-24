/**
 * Converts the sounds you picked into game-ready files.
 *
 *   1. Put your chosen files in ./audio-src/ (repo root), named after the
 *      sound they are for: applause.wav, applause-2.wav, lobby.mp3, …
 *      (the list is in apps/web/public/audio/README.md).
 *   2. pnpm audio:prepare
 *   3. Commit apps/web/public/audio/ and push.
 *
 * Needs ffmpeg: `winget install ffmpeg` (Windows) or `brew install ffmpeg`
 * (macOS), or point FFMPEG_PATH at an ffmpeg binary.
 */
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { BUDGET_BYTES, prepareAudio } from '../src/tools/prepareAudio.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const { values } = parseArgs({ options: { in: { type: 'string', default: `${root}audio-src` } } });
const outDir = `${root}apps/web/public/audio`;

try {
  const r = await prepareAudio({ inDir: values.in!, outDir, ffmpeg: process.env.FFMPEG_PATH ?? 'ffmpeg' });
  for (const [name, files] of Object.entries(r.manifest)) console.log(`  ✓ ${name}: ${[files].flat().join(', ')}`);
  for (const f of r.skipped) console.log(`  – skipped ${f} (not a known sound name)`);
  const mb = (r.totalBytes / 1024 / 1024).toFixed(1);
  console.log(`\n${Object.keys(r.manifest).length} sounds, ${mb} MB${r.totalBytes > BUDGET_BYTES ? ' — over the 6 MB budget, consider fewer variants or shorter music' : ''}.`);
} catch (err) {
  const e = err as NodeJS.ErrnoException;
  if (e.code === 'ENOENT' && String(e.path ?? '').includes('ffmpeg')) {
    console.error('ffmpeg was not found. Install it (winget install ffmpeg / brew install ffmpeg) or set FFMPEG_PATH.');
  } else console.error(e.message);
  process.exitCode = 1;
}
