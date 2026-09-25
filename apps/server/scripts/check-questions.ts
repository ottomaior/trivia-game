/**
 * Validates the seed question files before they are committed:
 * apps/server/seed/questions.json (multiple choice), bluff.json (Blöffölő),
 * timeline.json (Időrend) and numbers.json (Tippelj!). The loader enforces
 * the schemas, known categories and exact duplicates; this adds
 * near-duplicate prompts, kind-specific warnings, a count per category and
 * difficulty for each kind, and which question packs have enough questions
 * to be offered. No database or API key needed.
 *
 *   pnpm questions:check
 */
import { BLUFF_BLANK, PACK_MIN_QUESTIONS, questionKindFor, type QuestionKind } from '@trivia/shared';
import { loadPacks } from '../src/content/packs.ts';
import { loadSeedFile, type SeedFile } from '../src/content/seed.ts';
import { similarity } from '../src/content/normalize.ts';

/** A category that has questions should have at least this many at each difficulty. */
const PER_DIFFICULTY = 5;
const MAX_PROMPT = 200;
const MAX_ANSWER = 60;

/**
 * Short questions often share a template ("Melyik ország fővárosa …?"), so a
 * pair only counts as a duplicate when the prompts are nearly identical, or
 * similar and asking for the same answer.
 */
const NEAR_IDENTICAL = 0.8;
const SIMILAR = 0.5;

let seed: SeedFile;
let packs;
try {
  seed = loadSeedFile();
  packs = loadPacks();
} catch (err) {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

/** Every entry of one kind, reduced to what the checks need. */
interface Entry {
  label: string;
  category: string;
  difficulty: number;
  prompt: string;
  answer: string;
  /** Every text a player sees for it (answers, lies, items). */
  texts: string[];
}

const KINDS: { kind: QuestionKind; name: string; entries: Entry[] }[] = [
  {
    kind: 'mc',
    name: 'multiple choice (questions.json)',
    entries: seed.questions.map((q, i) => ({ label: `questions #${i}`, ...q, texts: [q.answer, ...q.wrong] })),
  },
  {
    kind: 'bluff',
    name: 'Blöffölő (bluff.json)',
    entries: seed.bluff.map((q, i) => ({ label: `bluff #${i}`, ...q, texts: [q.answer, ...q.decoys] })),
  },
  {
    kind: 'timeline',
    name: 'Időrend (timeline.json)',
    entries: seed.timeline.map((q, i) => ({
      label: `timeline #${i}`,
      ...q,
      answer: q.items.map((it) => it.text).join(' | '),
      texts: q.items.map((it) => it.text),
    })),
  },
  {
    kind: 'number',
    name: 'Tippelj! (numbers.json)',
    entries: seed.numbers.map((q, i) => ({ label: `numbers #${i}`, ...q, answer: String(q.answer), texts: q.unit ? [q.unit] : [] })),
  },
];

const warnings: string[] = [];
const lower = (s: string) => s.toLocaleLowerCase('hu');

for (const { kind, entries } of KINDS) {
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i]!;
    if (kind !== 'number' && kind !== 'timeline' && lower(a.prompt).includes(lower(a.answer))) {
      warnings.push(`${a.label} answer appears in the question: ${a.prompt}`);
    }
    if (a.texts.some((c) => c.length > MAX_ANSWER)) warnings.push(`${a.label} an answer is longer than ${MAX_ANSWER} characters`);
    if (a.prompt.length > MAX_PROMPT) warnings.push(`${a.label} the question is longer than ${MAX_PROMPT} characters`);
    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j]!;
      const s = similarity(a.prompt, b.prompt);
      const sameAnswer = lower(a.answer) === lower(b.answer);
      if (s > NEAR_IDENTICAL || (sameAnswer && s > SIMILAR)) warnings.push(`${a.label} and ${b.label} look alike (${s.toFixed(2)}):\n    ${a.prompt}\n    ${b.prompt}`);
    }
  }
}

for (const [i, q] of seed.bluff.entries()) {
  if (q.prompt.includes(BLUFF_BLANK) && q.prompt.endsWith('?')) warnings.push(`bluff #${i} has a blank and a question mark: pick one`);
  const long = Math.max(q.answer.length, ...q.decoys.map((d) => d.length));
  const short = Math.min(q.answer.length, ...q.decoys.map((d) => d.length));
  if (long > 2.5 * short + 4) warnings.push(`bluff #${i} the truth and the house lies differ a lot in length: ${[q.answer, ...q.decoys].join(' / ')}`);
}
for (const [i, q] of seed.timeline.entries()) {
  const gaps = q.items.slice(1).map((it, k) => it.year - q.items[k]!.year);
  if (Math.min(...gaps) < 1) warnings.push(`timeline #${i} two items share a year`);
}
for (const [i, q] of seed.numbers.entries()) {
  if (!Number.isInteger(q.answer) && String(q.answer).split('.')[1]!.length > 2) warnings.push(`numbers #${i} has more than two decimals`);
}

const row = (label: string, counts: number[], note = '') =>
  `${label.padEnd(15)} ${String(counts[0]).padStart(4)} ${String(counts[1]).padStart(7)} ${String(counts[2]).padStart(5)}${note}`;

const countsByKind = new Map<QuestionKind, Map<string, number[]>>();
for (const { kind, name, entries } of KINDS) {
  console.log(`✓ ${entries.length} ${name} valid.`);
  const counts = new Map(
    seed.categories.map((c) => [c.slug, [1, 2, 3].map((d) => entries.filter((q) => q.category === c.slug && q.difficulty === d).length)]),
  );
  countsByKind.set(kind, counts);
}
console.log(`  (${seed.categories.length} categories)`);

for (const { kind, name, entries } of KINDS) {
  if (entries.length === 0) continue;
  const counts = countsByKind.get(kind)!;
  console.log(`\n${name}\ncategory        easy  medium  hard`);
  for (const c of seed.categories) {
    const n = counts.get(c.slug)!;
    const stocked = n.some((x) => x > 0);
    if (!stocked) continue;
    // The party modes draw across every category, so thin categories are fine there.
    if (kind === 'mc' && n.some((x) => x < PER_DIFFICULTY)) warnings.push(`${c.slug} has fewer than ${PER_DIFFICULTY} questions at some difficulty`);
    console.log(row(c.slug, n));
  }
}

console.log(`\npack            easy  medium  hard   (offered from ${PACK_MIN_QUESTIONS} questions)`);
for (const p of packs) {
  const counts = countsByKind.get(questionKindFor(p.mode))!;
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
