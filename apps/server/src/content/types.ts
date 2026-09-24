import type { Difficulty } from '@trivia/shared';

export interface Category {
  id: number;
  slug: string;
  name: string;
}

/** A playable multiple-choice question, including its answer key (server only). */
export interface Question {
  id: string;
  categoryId: number;
  category: string;
  difficulty: Difficulty;
  prompt: string;
  choices: string[];
  correct: number;
  explanation: string | null;
}

/** Per-category availability for one household, used to pick vote options. */
export interface CategoryStats extends Category {
  total: number;
  unseen: number;
}

/** Active multiple-choice questions per category, by difficulty 1–3. */
export interface CategoryCount extends Category {
  counts: [number, number, number];
}
