/**
 * Lists questions players flagged, most-flagged first, with their reasons.
 *
 *   pnpm flagged              # flagged questions that are still active
 *   pnpm flagged --retired    # ones already retired automatically
 *   pnpm flagged --retire <question-id>    # retire one by hand
 *   pnpm flagged --restore <question-id>   # put a wrongly retired one back
 */
import { QUESTION_KINDS, type QuestionKind } from '@trivia/shared';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { parseArgs } from 'node:util';
import { questionFlags, questions } from '../src/db/schema.ts';
import { PgStore, questionFromPayload } from '../src/db/store.ts';
import type { Question } from '../src/content/types.ts';

/** The answer line for a flagged question, whatever its kind. */
function answerLine(q: Question): string {
  switch (q.kind) {
    case 'mc':
      return `answer: ${q.choices[q.correct]}  (others: ${q.choices.filter((_, i) => i !== q.correct).join(' | ')})`;
    case 'bluff':
      return `answer: ${q.answer}  (house lies: ${q.decoys.join(' | ')})`;
    case 'timeline':
      return `order: ${q.items.map((it) => `${it.text} (${it.year})`).join(' → ')}`;
    case 'number':
      return `answer: ${q.answer}${q.unit ? ` ${q.unit}` : ''}`;
  }
}

const { values: args } = parseArgs({
  options: {
    retired: { type: 'boolean', default: false },
    retire: { type: 'string' },
    restore: { type: 'string' },
  },
});

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
const store = new PgStore(url);

try {
  if (args.retire || args.restore) {
    const id = (args.retire ?? args.restore)!;
    const status = args.retire ? 'retired' : 'active';
    const rows = await store.db.update(questions).set({ status }).where(eq(questions.id, id)).returning({ id: questions.id });
    console.log(rows.length ? `${id} is now ${status}` : `No question ${id}`);
  } else {
    const rows = await store.db
      .select({
        id: questions.id,
        prompt: questions.prompt,
        kind: questions.kind,
        payload: questions.payload,
        flagCount: questions.flagCount,
        timesShown: questions.timesShown,
        timesCorrect: questions.timesCorrect,
        reasons: sql<string>`string_agg(${questionFlags.reason}, ', ')`,
      })
      .from(questions)
      .leftJoin(questionFlags, eq(questionFlags.questionId, questions.id))
      .where(and(gt(questions.flagCount, 0), eq(questions.status, args.retired ? 'retired' : 'active')))
      .groupBy(questions.id)
      .orderBy(desc(questions.flagCount));
    if (!rows.length) console.log('Nothing flagged.');
    for (const r of rows) {
      const kind = (QUESTION_KINDS as readonly string[]).includes(r.kind) ? (r.kind as QuestionKind) : 'mc';
      const q = questionFromPayload(kind, { id: r.id, categoryId: 0, category: '', difficulty: 1, prompt: r.prompt, explanation: null }, r.payload);
      console.log(`\n[${r.flagCount} flag] ${r.id} (${kind})\n  ${r.prompt}\n  ${answerLine(q)}`);
      console.log(`  reasons: ${r.reasons}   answered right: ${r.timesCorrect}/${r.timesShown}`);
    }
  }
} finally {
  await store.close();
}
