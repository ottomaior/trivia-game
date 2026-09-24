import { authoredQuestionSchema, type AuthoredQuestion, type Difficulty } from '@trivia/shared';
import { z } from 'zod';
import { questionHash } from './normalize.ts';
import { shuffle, type Rng } from './select.ts';

// Pure pieces of the AI question pipeline (prompts, schemas, filtering), kept
// apart from the CLI so they can be tested without calling the API.

export const PROMPT_VERSION = 'hu-mc-v1';

const DIFFICULTY_TEXT: Record<Difficulty, string> = {
  1: 'KÖNNYŰ: a legtöbb felnőtt magyar tudja, általános iskolai szintű tudás.',
  2: 'KÖZEPES: egy tájékozott, érdeklődő felnőtt tudja, de nem mindenki.',
  3: 'NEHÉZ: a téma iránt érdeklődők tudják; a többiek legfeljebb tippelnek.',
};

/** What the generator model must return. Kept simple for structured outputs. */
export const generatedBatchSchema = z.object({
  questions: z.array(
    z.object({
      prompt: z.string(),
      answer: z.string(),
      wrong: z.array(z.string()),
      explanation: z.string(),
    }),
  ),
});

export type GeneratedBatch = z.infer<typeof generatedBatchSchema>;

export const GENERATOR_SYSTEM = `Magyar nyelvű kvízműsorhoz írsz feleletválasztós kérdéseket, baráti társaságoknak, tévé előtt játszva.

Szabályok:
- Minden kérdés természetes, választékos magyar nyelven szóljon, ne fordításnak hangozzon.
- Pontosan EGY helyes válasz legyen, amely vitathatatlanul igaz és jól ellenőrizhető tény.
- Kerüld az idővel változó tényeket (rekordok, "jelenlegi" tisztségviselők, népességszámok, legfrissebb események).
- Kerüld a becslést igénylő vagy értelmezésfüggő kérdéseket, és a "melyik NEM…" típusú kérdéseket.
- A három rossz válasz legyen hihető, azonos típusú és hasonló hosszúságú, mint a helyes; egyik se legyen részben helyes.
- A kérdés legfeljebb 200 karakter, minden válasz legfeljebb 60 karakter.
- A helyes válasz ne szerepeljen a kérdés szövegében.
- A magyarázat egy rövid, érdekes mondat, ami megerősíti a helyes választ (legfeljebb 180 karakter).
- Legyen változatos: más-más témák, korszakok, típusok. Magyar és nemzetközi témák vegyesen, ha a kategória engedi.
- Családbarát tartalom.`;

export function generatorPrompt(opts: {
  category: string;
  difficulty: Difficulty;
  count: number;
  avoid: string[];
}): string {
  const avoid = opts.avoid.length
    ? `\n\nEzek a kérdések már léteznek, ne ismételd őket és ne kérdezz rá ugyanarra a tényre:\n${opts.avoid
        .map((p) => `- ${p}`)
        .join('\n')}`
    : '';
  return `Írj ${opts.count} új kérdést.
Kategória: ${opts.category}
Nehézség: ${DIFFICULTY_TEXT[opts.difficulty]}
Minden kérdéshez: prompt (a kérdés), answer (a helyes válasz), wrong (pontosan 3 rossz válasz), explanation.${avoid}`;
}

/** What the verifier returns for each question it answered blind. */
export const verdictBatchSchema = z.object({
  verdicts: z.array(
    z.object({
      id: z.number(),
      choice: z.enum(['A', 'B', 'C', 'D']),
      confidence: z.number(),
      ambiguous: z.boolean(),
      problem: z.string(),
    }),
  ),
});

export type VerdictBatch = z.infer<typeof verdictBatchSchema>;

export const VERIFIER_SYSTEM = `Egy kvízműsor kérdéseinek szigorú tényellenőrzője vagy. Minden kérdésre válaszolj magad, a válaszkulcs ismerete nélkül.

Kérdésenként add meg:
- choice: az általad helyesnek tartott betű (A–D)
- confidence: 0 és 1 közötti szám, mennyire vagy biztos benne, hogy ez tényszerűen helyes
- ambiguous: true, ha több válasz is védhető, ha a kérdés félreérthető, idővel változó tényre kérdez, vagy ha egyik válasz sem helyes
- problem: rövid megjegyzés a gondról (helyesírás, félreérthetőség, ténybeli hiba), vagy üres szöveg, ha nincs gond

Légy szigorú: ha nem vagy biztos a tényben, adj alacsony confidence értéket.`;

export interface Candidate extends AuthoredQuestion {
  normHash: string;
  /** Choice order shown to the verifier, and where the answer landed. */
  shown: string[];
  answerIndex: number;
}

const LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * Validates raw model output against the content rules and shuffles each
 * question's choices for the blind check. Invalid items are returned with
 * their reason so the CLI can report them.
 */
export function prepareCandidates(
  batch: GeneratedBatch,
  meta: { category: string; difficulty: Difficulty },
  rng: Rng,
): { candidates: Candidate[]; rejected: { prompt: string; reason: string }[] } {
  const candidates: Candidate[] = [];
  const rejected: { prompt: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const raw of batch.questions) {
    const parsed = authoredQuestionSchema.safeParse({
      category: meta.category,
      difficulty: meta.difficulty,
      prompt: raw.prompt,
      answer: raw.answer,
      wrong: raw.wrong,
      explanation: raw.explanation || undefined,
    });
    if (!parsed.success) {
      rejected.push({ prompt: raw.prompt, reason: `schema: ${parsed.error.issues[0]?.message ?? 'invalid'}` });
      continue;
    }
    const q = parsed.data;
    const choices = [q.answer, ...q.wrong];
    if (new Set(choices.map((c) => c.toLocaleLowerCase('hu'))).size !== 4) {
      rejected.push({ prompt: q.prompt, reason: 'duplicate choices' });
      continue;
    }
    if (q.prompt.toLocaleLowerCase('hu').includes(q.answer.toLocaleLowerCase('hu'))) {
      rejected.push({ prompt: q.prompt, reason: 'answer appears in the question' });
      continue;
    }
    const normHash = questionHash(q.prompt, q.answer);
    if (seen.has(normHash)) {
      rejected.push({ prompt: q.prompt, reason: 'duplicate in batch' });
      continue;
    }
    seen.add(normHash);
    const shown = shuffle(choices, rng);
    candidates.push({ ...q, normHash, shown, answerIndex: shown.indexOf(q.answer) });
  }
  return { candidates, rejected };
}

export function verifierPrompt(candidates: Candidate[]): string {
  return candidates
    .map((c, i) => `${i + 1}. ${c.prompt}\n${c.shown.map((s, j) => `   ${LETTERS[j]}) ${s}`).join('\n')}`)
    .join('\n\n');
}

export const MIN_CONFIDENCE = 0.85;

/** Keeps a candidate only if the blind answer matches with high confidence and no doubts. */
export function judge(
  candidates: Candidate[],
  verdicts: VerdictBatch,
): { accepted: (Candidate & { confidence: number })[]; rejected: { prompt: string; reason: string }[] } {
  const byId = new Map(verdicts.verdicts.map((v) => [v.id, v]));
  const accepted: (Candidate & { confidence: number })[] = [];
  const rejected: { prompt: string; reason: string }[] = [];
  candidates.forEach((c, i) => {
    const v = byId.get(i + 1);
    if (!v) return rejected.push({ prompt: c.prompt, reason: 'not verified' });
    if (LETTERS.indexOf(v.choice) !== c.answerIndex) {
      return rejected.push({ prompt: c.prompt, reason: `verifier chose ${v.choice}: ${c.shown[LETTERS.indexOf(v.choice)]}` });
    }
    if (v.ambiguous) return rejected.push({ prompt: c.prompt, reason: `ambiguous: ${v.problem}` });
    if (v.confidence < MIN_CONFIDENCE) return rejected.push({ prompt: c.prompt, reason: `low confidence ${v.confidence}` });
    accepted.push({ ...c, confidence: v.confidence });
  });
  return { accepted, rejected };
}
