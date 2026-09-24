import { describe, expect, it } from 'vitest';
import { seededRng } from '../testing.ts';
import { generatorPrompt, judge, prepareCandidates, verifierPrompt } from './generate.ts';

const good = { prompt: 'Melyik bolygó a legnagyobb a Naprendszerben?', answer: 'Jupiter', wrong: ['Szaturnusz', 'Neptunusz', 'Uránusz'], explanation: 'A Jupiter tömege a többi bolygóénak több mint kétszerese.' };

describe('prepareCandidates', () => {
  it('rejects malformed, duplicate and self-answering questions', () => {
    const { candidates, rejected } = prepareCandidates(
      {
        questions: [
          good,
          { ...good }, // duplicate
          { ...good, prompt: 'Mi a Jupiter? Melyik bolygó?', answer: 'Jupiter' }, // answer in prompt
          { ...good, prompt: 'Rövid?', answer: 'x' }, // too short
          { ...good, prompt: 'Hány lába van egy póknak általában?', answer: '8', wrong: ['8', '6', '10'] },
          { ...good, prompt: 'Hány holdja van a Marsnak összesen?', answer: '2', wrong: ['1', '3'] }, // only 2 wrong
        ],
      },
      { category: 'tudomany', difficulty: 1 },
      seededRng(),
    );
    expect(candidates).toHaveLength(1);
    expect(rejected.map((r) => r.reason)).toEqual([
      'duplicate in batch',
      'answer appears in the question',
      expect.stringMatching(/^schema/),
      'duplicate choices',
      expect.stringMatching(/^schema/),
    ]);
    const [c] = candidates;
    expect(c!.shown[c!.answerIndex]).toBe('Jupiter');
  });
});

describe('judge', () => {
  const { candidates } = prepareCandidates({ questions: [good] }, { category: 'tudomany', difficulty: 1 }, seededRng(3));
  const letter = 'ABCD'[candidates[0]!.answerIndex] as 'A' | 'B' | 'C' | 'D';
  const wrongLetter = 'ABCD'[(candidates[0]!.answerIndex + 1) % 4] as 'A' | 'B' | 'C' | 'D';

  it('accepts a confident, unambiguous blind match', () => {
    const res = judge(candidates, { verdicts: [{ id: 1, choice: letter, confidence: 0.97, ambiguous: false, problem: '' }] });
    expect(res.accepted).toHaveLength(1);
  });

  it('rejects mismatches, doubts and low confidence', () => {
    for (const v of [
      { id: 1, choice: wrongLetter, confidence: 0.99, ambiguous: false, problem: '' },
      { id: 1, choice: letter, confidence: 0.99, ambiguous: true, problem: 'két jó válasz' },
      { id: 1, choice: letter, confidence: 0.5, ambiguous: false, problem: '' },
    ]) {
      expect(judge(candidates, { verdicts: [v] }).accepted).toHaveLength(0);
    }
    expect(judge(candidates, { verdicts: [] }).rejected[0]?.reason).toBe('not verified');
  });
});

describe('prompts', () => {
  it('lists questions to avoid and shows shuffled choices without the key', () => {
    expect(generatorPrompt({ category: 'Zene', difficulty: 2, count: 5, avoid: ['Ki írta a Himnuszt?'] })).toContain('- Ki írta a Himnuszt?');
    const { candidates } = prepareCandidates({ questions: [good] }, { category: 'tudomany', difficulty: 1 }, seededRng());
    const text = verifierPrompt(candidates);
    expect(text).toContain('1. Melyik bolygó');
    expect(text).not.toMatch(/helyes|answer/i);
  });
});
