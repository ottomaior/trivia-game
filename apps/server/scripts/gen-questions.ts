/**
 * Generates new Hungarian questions with Claude and stores the ones that pass
 * a blind verification.
 *
 *   pnpm gen --category tortenelem --difficulty 2 --count 10
 *   pnpm gen --category all --difficulty all --count 8
 *   pnpm gen --category zene --count 5 --dry-run   # print only, no database needed
 *
 * Needs ANTHROPIC_API_KEY (or an `ant auth login` profile) and DATABASE_URL
 * (use Railway's DATABASE_PUBLIC_URL when running from your computer).
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { Difficulty } from '@trivia/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import { parseArgs } from 'node:util';
import {
  GENERATOR_SYSTEM,
  generatedBatchSchema,
  generatorPrompt,
  judge,
  prepareCandidates,
  PROMPT_VERSION,
  verdictBatchSchema,
  VERIFIER_SYSTEM,
  verifierPrompt,
  type Candidate,
} from '../src/content/generate.ts';
import { loadSeedFile } from '../src/content/seed.ts';
import { categories, generationBatches, questions } from '../src/db/schema.ts';
import { PgStore } from '../src/db/store.ts';

const { values: args } = parseArgs({
  options: {
    category: { type: 'string', default: 'all' },
    difficulty: { type: 'string', default: 'all' },
    count: { type: 'string', default: '10' },
    model: { type: 'string', default: 'claude-haiku-4-5' },
    'verify-model': { type: 'string', default: 'claude-haiku-4-5' },
    'dry-run': { type: 'boolean', default: false },
  },
});

const count = Math.max(1, Math.min(30, Number(args.count)));
const difficulties: Difficulty[] = args.difficulty === 'all' ? [1, 2, 3] : [Number(args.difficulty) as Difficulty];
if (difficulties.some((d) => ![1, 2, 3].includes(d))) throw new Error('--difficulty must be 1, 2, 3 or all');
const dryRun = args['dry-run'];
const VERIFY_CHUNK = 10;
/** Prompts this similar (pg_trgm, 0–1) to an existing one in the category count as duplicates. */
const SIMILARITY_LIMIT = 0.6;

const client = new Anthropic();
const store = dryRun ? null : new PgStore(requireEnv('DATABASE_URL'));

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} is not set`);
    process.exit(1);
  }
  return v;
}

interface Cat {
  id: number;
  slug: string;
  name: string;
}

async function loadCategories(): Promise<Cat[]> {
  if (!store) return loadSeedFile().categories.map((c, i) => ({ id: i + 1, ...c }));
  const rows = await store.db.select().from(categories).where(eq(categories.active, true));
  if (!rows.length) throw new Error('No categories in the database. Run `pnpm db:seed` first.');
  return rows;
}

async function existingPrompts(cat: Cat): Promise<string[]> {
  if (!store) return loadSeedFile().questions.filter((q) => q.category === cat.slug).map((q) => q.prompt);
  const rows = await store.db
    .select({ prompt: questions.prompt })
    .from(questions)
    .where(eq(questions.categoryId, cat.id))
    .orderBy(desc(questions.createdAt))
    .limit(150);
  return rows.map((r) => r.prompt);
}

async function isDuplicate(cat: Cat, c: Candidate): Promise<boolean> {
  if (!store) return false;
  const rows = await store.db
    .select({ id: questions.id })
    .from(questions)
    .where(
      and(
        eq(questions.categoryId, cat.id),
        sql`(${questions.normHash} = ${c.normHash} or similarity(${questions.prompt}, ${c.prompt}) > ${SIMILARITY_LIMIT})`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

const usage = { input: 0, output: 0 };
function track(u: Anthropic.Usage): void {
  usage.input += u.input_tokens;
  usage.output += u.output_tokens;
}

async function generate(cat: Cat, difficulty: Difficulty, avoid: string[]) {
  const response = await client.messages.parse({
    model: args.model!,
    max_tokens: 16000,
    system: GENERATOR_SYSTEM,
    messages: [{ role: 'user', content: generatorPrompt({ category: cat.name, difficulty, count, avoid }) }],
    output_config: { format: zodOutputFormat(generatedBatchSchema) },
  });
  track(response.usage);
  if (response.stop_reason !== 'end_turn' || !response.parsed_output) {
    throw new Error(`generation stopped: ${response.stop_reason}`);
  }
  return response.parsed_output;
}

async function verify(chunk: Candidate[]) {
  const response = await client.messages.parse({
    model: args['verify-model']!,
    max_tokens: 8000,
    system: VERIFIER_SYSTEM,
    messages: [{ role: 'user', content: verifierPrompt(chunk) }],
    output_config: { format: zodOutputFormat(verdictBatchSchema) },
  });
  track(response.usage);
  if (response.stop_reason !== 'end_turn' || !response.parsed_output) {
    throw new Error(`verification stopped: ${response.stop_reason}`);
  }
  return response.parsed_output;
}

async function runSlot(cat: Cat, difficulty: Difficulty): Promise<{ accepted: number; rejected: number }> {
  const label = `${cat.name} / ${difficulty}`;
  const before = { ...usage };
  const raw = await generate(cat, difficulty, await existingPrompts(cat));
  const prepared = prepareCandidates(raw, { category: cat.slug, difficulty }, Math.random);
  const rejected = [...prepared.rejected];
  const accepted: (Candidate & { confidence: number })[] = [];

  for (let i = 0; i < prepared.candidates.length; i += VERIFY_CHUNK) {
    const chunk = prepared.candidates.slice(i, i + VERIFY_CHUNK);
    const result = judge(chunk, await verify(chunk));
    rejected.push(...result.rejected);
    for (const c of result.accepted) {
      if (await isDuplicate(cat, c)) rejected.push({ prompt: c.prompt, reason: 'similar question exists' });
      else accepted.push(c);
    }
  }

  console.log(`\n== ${label}: ${accepted.length} kept, ${rejected.length} dropped`);
  for (const q of accepted) console.log(`  + ${q.prompt} → ${q.answer}  [${q.wrong.join(' | ')}]`);
  for (const r of rejected) console.log(`  - ${r.prompt}  (${r.reason})`);

  if (store) {
    const [batch] = await store.db
      .insert(generationBatches)
      .values({
        model: args.model!,
        promptVersion: PROMPT_VERSION,
        categoryId: cat.id,
        difficulty,
        requested: count,
        accepted: accepted.length,
        rejected: rejected.length,
        inputTokens: usage.input - before.input,
        outputTokens: usage.output - before.output,
      })
      .returning({ id: generationBatches.id });
    if (accepted.length) {
      await store.db
        .insert(questions)
        .values(
          accepted.map((q) => ({
            categoryId: cat.id,
            kind: 'mc',
            difficulty,
            prompt: q.prompt,
            payload: { choices: [q.answer, ...q.wrong], correct: 0 },
            explanation: q.explanation ?? null,
            source: 'claude',
            sourceRef: batch!.id,
            verifierScore: q.confidence,
            normHash: q.normHash,
          })),
        )
        .onConflictDoNothing();
    }
  }
  return { accepted: accepted.length, rejected: rejected.length };
}

try {
  const all = await loadCategories();
  const cats = args.category === 'all' ? all : all.filter((c) => c.slug === args.category);
  if (!cats.length) throw new Error(`Unknown category "${args.category}". Known: ${all.map((c) => c.slug).join(', ')}`);

  let kept = 0;
  let dropped = 0;
  for (const cat of cats) {
    for (const d of difficulties) {
      try {
        const r = await runSlot(cat, d);
        kept += r.accepted;
        dropped += r.rejected;
      } catch (err) {
        if (err instanceof Anthropic.AuthenticationError) throw err;
        if (err instanceof Anthropic.RateLimitError) console.error(`\n!! ${cat.name} / ${d}: rate limited, skipping`);
        else if (err instanceof Anthropic.APIError) console.error(`\n!! ${cat.name} / ${d}: API error ${err.status}: ${err.message}`);
        else console.error(`\n!! ${cat.name} / ${d}:`, err instanceof Error ? err.message : err);
      }
    }
  }
  console.log(`\nDone${dryRun ? ' (dry run, nothing saved)' : ''}: ${kept} kept, ${dropped} dropped.`);
  console.log(`Tokens: ${usage.input} in, ${usage.output} out.`);
} catch (err) {
  if (err instanceof Anthropic.AuthenticationError) {
    console.error('The Anthropic API rejected the credentials: set ANTHROPIC_API_KEY (or run `ant auth login`).');
  } else {
    console.error(err instanceof Error ? err.message : err);
  }
  process.exitCode = 1;
} finally {
  await store?.close();
}
