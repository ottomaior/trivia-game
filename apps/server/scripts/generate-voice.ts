/**
 * Records every Otto line with Azure's Hungarian neural voice.
 *
 *   1. Create an Azure "Speech" resource (the free F0 tier is plenty).
 *   2. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (e.g. westeurope) in your shell.
 *   3. pnpm voice:generate            (only new or changed lines are recorded)
 *   4. Commit apps/web/public/voice/ and push.
 *
 * Optional: AZURE_VOICE to try another voice (default hu-HU-TamasNeural);
 * --dry-run lists what would be recorded.
 */
import { allOttoLines } from '@trivia/shared';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DEFAULT_VOICE, generateVoices } from '../src/tools/generateVoice.ts';

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const outDir = fileURLToPath(new URL('../../web/public/voice', import.meta.url));
const lines = allOttoLines();
const voice = process.env.AZURE_VOICE ?? DEFAULT_VOICE;

if (values['dry-run']) {
  for (const l of lines) console.log(`${l.id}: ${l.text}`);
  console.log(`\n${lines.length} lines, ${lines.reduce((n, l) => n + l.text.length, 0)} characters, voice ${voice}.`);
  process.exit(0);
}

const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION;
if (!key || !region) {
  console.error('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION first (see the comment at the top of this script).');
  process.exit(1);
}

try {
  const r = await generateVoices({ lines, outDir, key, region, voice, pauseMs: 150, log: console.log });
  console.log(`\nRecorded ${r.generated.length}, unchanged ${r.skipped.length}, removed ${r.removed.length}.`);
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
}
