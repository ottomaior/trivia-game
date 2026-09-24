import { createHash } from 'node:crypto';

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Identity of a question for de-duplication: same prompt + same answer. */
export function questionHash(prompt: string, answer: string): string {
  return createHash('sha256')
    .update(`${normalizeText(prompt)}|${normalizeText(answer)}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * File name of a question's recorded read-aloud. Follows the exact prompt, so
 * fixing a typo makes the recording stale and it gets recorded again.
 */
export function questionVoiceId(prompt: string): string {
  return createHash('sha256').update(prompt.trim()).digest('hex').slice(0, 16);
}

/** Trigram set of a normalized string, padded like Postgres pg_trgm. */
function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (const word of normalizeText(s).split(' ')) {
    if (!word) continue;
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  }
  return out;
}

/** Trigram similarity 0–1, the same measure as pg_trgm's similarity(). */
export function similarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}
