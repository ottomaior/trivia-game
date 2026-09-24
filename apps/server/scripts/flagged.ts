/**
 * Lists questions players flagged, most-flagged first, with their reasons.
 *
 *   pnpm flagged              # flagged questions that are still active
 *   pnpm flagged --retired    # ones already retired automatically
 *   pnpm flagged --retire <question-id>    # retire one by hand
 *   pnpm flagged --restore <question-id>   # put a wrongly retired one back
 */
import { mcPayloadSchema } from '@trivia/shared';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { parseArgs } from 'node:util';
import { questionFlags, questions } from '../src/db/schema.ts';
import { PgStore } from '../src/db/store.ts';

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
      const p = mcPayloadSchema.parse(r.payload);
      console.log(`\n[${r.flagCount} flag] ${r.id}\n  ${r.prompt}\n  answer: ${p.choices[p.correct]}  (others: ${p.choices.filter((_, i) => i !== p.correct).join(' | ')})`);
      console.log(`  reasons: ${r.reasons}   answered right: ${r.timesCorrect}/${r.timesShown}`);
    }
  }
} finally {
  await store.close();
}
