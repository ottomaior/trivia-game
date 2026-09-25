import type { Difficulty } from '@trivia/shared';

export interface Category {
  id: number;
  slug: string;
  name: string;
}

interface QuestionBase {
  id: string;
  categoryId: number;
  category: string;
  difficulty: Difficulty;
  prompt: string;
  explanation: string | null;
}

/** A playable multiple-choice question, including its answer key (server only). */
export interface McQuestion extends QuestionBase {
  kind: 'mc';
  choices: string[];
  correct: number;
}

/** Blöffölő: the truth, its other accepted spellings, and the house's two lies. */
export interface BluffQuestion extends QuestionBase {
  kind: 'bluff';
  answer: string;
  alternates: string[];
  decoys: [string, string];
}

/** Időrend: five items, earliest first. */
export interface TimelineQuestion extends QuestionBase {
  kind: 'timeline';
  items: { text: string; year: number }[];
}

/** Tippelj!: one exact number. */
export interface NumberQuestion extends QuestionBase {
  kind: 'number';
  answer: number;
  unit: string | null;
}

export type Question = McQuestion | BluffQuestion | TimelineQuestion | NumberQuestion;

/** Per-category availability for one household, used to pick vote options. */
export interface CategoryStats extends Category {
  total: number;
  unseen: number;
}

/** Active questions of one kind per category, by difficulty 1–3. */
export interface CategoryCount extends Category {
  counts: [number, number, number];
}
