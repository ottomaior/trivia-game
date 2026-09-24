/**
 * Validates apps/server/seed/questions.json before it is committed:
 * schema, four distinct choices, known categories, no exact duplicates
 * (all enforced by the loader), plus near-duplicate prompts and a count per
 * category and difficulty. No database or API key needed.
 *
 *   pnpm questions:check
 */
import { loadSeedFile } from '../src/content/seed.ts';
import { similarity } from '../src/content/normalize.ts';

/**
 * Short questions often share a template ("Melyik ország fővárosa …?"), so a
 * pair only counts as a duplicate when the prompts are nearly identical, or
 * similar and asking for the same answer.
 */
const NEAR_IDENTICAL = 0.8;
const SIMILAR = 0.5;

let seed;
try {
  seed = loadSeedFile();
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
  for (let j = i + 1; j < qs.length; j++) {
    const b = qs[j]!;
    const s = similarity(a.prompt, b.prompt);
    const sameAnswer = a.answer.toLocaleLowerCase('hu') === b.answer.toLocaleLowerCase('hu');
    if (s > NEAR_IDENTICAL || (sameAnswer && s > SIMILAR)) warnings.push(`#${i} and #${j} look alike (${s.toFixed(2)}):\n    ${a.prompt}\n    ${b.prompt}`);
  }
}

console.log(`✓ ${qs.length} questions in ${seed.categories.length} categories are valid.\n`);
console.log('category        easy  medium  hard');
for (const c of seed.categories) {
  const n = (d: number) => qs.filter((q) => q.category === c.slug && q.difficulty === d).length;
  console.log(`${c.slug.padEnd(15)} ${String(n(1)).padStart(4)} ${String(n(2)).padStart(7)} ${String(n(3)).padStart(5)}`);
}
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s) — fix or consciously keep:`);
  for (const w of warnings) console.log(`  ! ${w}`);
  process.exitCode = 1;
}
