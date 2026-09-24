/**
 * Renders the studio's own sound set into ./audio-src/ (repo root) as WAVs.
 *
 *   pnpm audio:render     (skips names you already have a file for; --force overwrites)
 *   pnpm audio:prepare    converts audio-src/ into apps/web/public/audio/
 *
 * To use a real recording instead of a rendered sound, put it in audio-src/
 * under the same name (e.g. applause.wav) and run both steps again.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { renderAll, SR, toWav } from '../src/tools/studioSounds.ts';

const { values } = parseArgs({ options: { force: { type: 'boolean', default: false } } });
const dir = fileURLToPath(new URL('../../../audio-src/', import.meta.url));
mkdirSync(dir, { recursive: true });
const have = new Set(readdirSync(dir).map((f) => f.slice(0, f.length - extname(f).length)));

for (const [name, samples] of Object.entries(renderAll())) {
  const path = `${dir}${name}.wav`;
  if (!values.force && have.has(name) && !existsSync(path)) {
    console.log(`  – ${name}: kept your own file`);
    continue;
  }
  if (!values.force && existsSync(path)) {
    console.log(`  – ${name}: already rendered (--force to redo)`);
    continue;
  }
  writeFileSync(path, toWav(samples));
  console.log(`  ✓ ${name} (${(samples.length / SR).toFixed(2)} s)`);
}
