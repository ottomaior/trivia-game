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
