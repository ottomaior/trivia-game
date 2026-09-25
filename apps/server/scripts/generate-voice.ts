/**
 * Records every Otto line with a text-to-speech voice (steps in
 * apps/web/public/voice/README.md). Set the keys in your own shell; never
 * commit them or paste them anywhere.
 *
 *   ElevenLabs: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID (optional ELEVENLABS_MODEL, default eleven_v3)
 *   Azure:      AZURE_SPEECH_KEY, AZURE_SPEECH_REGION (optional AZURE_VOICE)
 *
 *   pnpm voice:generate --dry-run            what would be recorded, and the cost
 *   pnpm voice:generate                      records new or changed lines only
 *   pnpm voice:generate --redo welcome-0     records those lines again (retakes)
 *   pnpm voice:generate --questions          reads every question in the seed files aloud
 *                                            (questions, bluff, timeline, numbers; into
 *                                            public/voice/q/; also --dry-run, --redo <id>)
 *
 * --provider elevenlabs|azure picks the service; by default ElevenLabs when
 * ELEVENLABS_API_KEY is set, otherwise Azure. Then commit apps/web/public/voice/.
 */
import { allOttoLines, BLUFF_BLANK, stripCues } from '@trivia/shared';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  AZURE_DEFAULT_VOICE,
  azureProvider,
  ELEVEN_DEFAULT_MODEL,
  elevenLabsProvider,
  elevenSupportsCues,
  estimateCredits,
  generateVoices,
  pendingLines,
  type VoiceProvider,
} from '../src/tools/generateVoice.ts';
import { questionVoiceId } from '../src/content/normalize.ts';
import { loadSeedFile } from '../src/content/seed.ts';

const { values } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    provider: { type: 'string' },
    redo: { type: 'string' },
    questions: { type: 'boolean', default: false },
  },
});
const env = process.env;
const outDir = fileURLToPath(new URL(values.questions ? '../../web/public/voice/q' : '../../web/public/voice', import.meta.url));
const redo = values.redo ? values.redo.split(',').map((s) => s.trim()).filter(Boolean) : [];
const which = values.provider ?? (env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'azure');
const model = env.ELEVENLABS_MODEL ?? ELEVEN_DEFAULT_MODEL;
// Otto's lines carry performance cues ("[excited]") that only v3 acts out; other voices get the plain words.
const keepCues = which === 'elevenlabs' && elevenSupportsCues(model);
const lines = values.questions ? questionLines() : allOttoLines().map((l) => (keepCues ? l : { ...l, text: stripCues(l.text) }));

/**
 * Every question prompt in the seed files, named by its prompt so a reworded
 * question is recorded again. Blöffölő's blank is read as a pause.
 */
function questionLines() {
  const seen = new Set<string>();
  const seed = loadSeedFile();
  const prompts = [...seed.questions, ...seed.bluff, ...seed.timeline, ...seed.numbers].map((q) => q.prompt);
  return prompts.flatMap((prompt) => {
    const id = questionVoiceId(prompt);
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ id, text: prompt.trim().split(BLUFF_BLANK).join('…') }];
  });
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function provider(): VoiceProvider {
  if (which === 'elevenlabs') {
    const missing = ['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID'].filter((k) => !env[k]);
    if (missing.length) fail(`Set ${missing.join(' and ')} in your shell first (see apps/web/public/voice/README.md).`);
    return elevenLabsProvider({ key: env.ELEVENLABS_API_KEY!, voiceId: env.ELEVENLABS_VOICE_ID!, model });
  }
  if (which === 'azure') {
    const missing = ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION'].filter((k) => !env[k]);
    if (missing.length) fail(`Set ${missing.join(' and ')} in your shell first (see apps/web/public/voice/README.md).`);
    return azureProvider({ key: env.AZURE_SPEECH_KEY!, region: env.AZURE_SPEECH_REGION!, voice: env.AZURE_VOICE ?? AZURE_DEFAULT_VOICE });
  }
  fail(`Unknown --provider ${which} (use elevenlabs or azure).`);
}

if (values['dry-run']) {
  // Without keys we can't know the voice, so every line counts as new; with keys, only what would change.
  const haveKeys = which === 'elevenlabs' ? env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID : env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION;
  const todo = haveKeys ? await pendingLines({ lines, outDir, provider: provider(), redo }) : lines;
  for (const l of todo) console.log(`${l.id}: ${l.text}`);
  const chars = todo.reduce((n, l) => n + l.text.length, 0);
  const cost = which === 'azure' && values.provider ? '' : `, about ${estimateCredits(chars, model)} ElevenLabs credits (${model})`;
  console.log(`\n${todo.length} of ${lines.length} lines to record, ${chars} characters${cost}.`);
  process.exit(0);
}

try {
  const r = await generateVoices({ lines, outDir, provider: provider(), redo, pauseMs: 300, log: console.log });
  console.log(`\nRecorded ${r.generated.length}, unchanged ${r.skipped.length}, removed ${r.removed.length}.`);
  if (r.generated.length) console.log('Listen with `pnpm dev`, then commit apps/web/public/voice/ and push.');
} catch (err) {
  console.error((err as Error).message);
  console.error('Lines recorded before the error are kept; run the same command again to continue.');
  process.exitCode = 1;
}
