/**
 * Validates apps/server/seed/questions.json before it is committed:
 * schema, four distinct choices, known categories, no exact duplicates
 * (all enforced by the loader), plus near-duplicate prompts, a count per
 * category and difficulty, and which question packs have enough questions
 * to be offered. No database or API key needed.
 *
 *   pnpm questions:check
 */
import { PACK_MIN_QUESTIONS } from '@trivia/shared';
import { loadPacks } from '../src/content/packs.ts';
import { loadSeedFile } from '../src/content/seed.ts';
import { similarity } from '../src/content/normalize.ts';

/** A category that has questions should have at least this many at each difficulty. */
const PER_DIFFICULTY = 5;
const MAX_PROMPT = 200;

/**
 * Short questions often share a template ("Melyik ország fővárosa …?"), so a
 * pair only counts as a duplicate when the prompts are nearly identical, or
 * similar and asking for the same answer.
 */
const NEAR_IDENTICAL = 0.8;
const SIMILAR = 0.5;

let seed;
let packs;
try {
  seed = loadSeedFile();
  packs = loadPacks();
} catch (err) {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const warnings: string[] = [];
const qs = seed.questions;
for (let i = 0; i < qs.length; i++) {
  const a = qs[i]!;
  const choices = [a.answer, ...a.wrong];
  if (a.prompt.toLocaleLowerCase('hu').includes(a.answer.toLocaleLowerCase('hu'))) {
    warnings.push(`#${i} answer appears in the question: ${a.prompt}`);
  }
  if (choices.some((c) => c.length > 60)) warnings.push(`#${i} an answer is longer than 60 characters`);
  if (a.prompt.length > MAX_PROMPT) warnings.push(`#${i} the question is longer than ${MAX_PROMPT} characters`);
  for (let j = i + 1; j < qs.length; j++) {
    const b = qs[j]!;
    const s = similarity(a.prompt, b.prompt);
    const sameAnswer = a.answer.toLocaleLowerCase('hu') === b.answer.toLocaleLowerCase('hu');
    if (s > NEAR_IDENTICAL || (sameAnswer && s > SIMILAR)) warnings.push(`#${i} and #${j} look alike (${s.toFixed(2)}):\n    ${a.prompt}\n    ${b.prompt}`);
  }
}

console.log(`✓ ${qs.length} questions in ${seed.categories.length} categories are valid.\n`);
const row = (label: string, counts: number[], note = '') =>
  `${label.padEnd(15)} ${String(counts[0]).padStart(4)} ${String(counts[1]).padStart(7)} ${String(counts[2]).padStart(5)}${note}`;
const counts = new Map(
  seed.categories.map((c) => [c.slug, [1, 2, 3].map((d) => qs.filter((q) => q.category === c.slug && q.difficulty === d).length)]),
);

console.log('category        easy  medium  hard');
for (const c of seed.categories) {
  const n = counts.get(c.slug)!;
  const stocked = n.some((x) => x > 0);
  if (stocked && n.some((x) => x < PER_DIFFICULTY)) warnings.push(`${c.slug} has fewer than ${PER_DIFFICULTY} questions at some difficulty`);
  console.log(row(c.slug, n, stocked ? '' : '   (no questions yet)'));
}

console.log(`\npack            easy  medium  hard   (offered from ${PACK_MIN_QUESTIONS} questions)`);
for (const p of packs) {
  const slugs = p.categories === '*' ? seed.categories.map((c) => c.slug) : p.categories;
  const total = [0, 1, 2].map((d) => slugs.reduce((sum, s) => sum + counts.get(s)![d]!, 0));
  const offered = total.reduce((a, b) => a + b, 0) >= PACK_MIN_QUESTIONS;
  console.log(row(p.slug, total, offered ? '' : '   (hidden: too few questions)'));
}
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s) — fix or consciously keep:`);
  for (const w of warnings) console.log(`  ! ${w}`);
  process.exitCode = 1;
}
