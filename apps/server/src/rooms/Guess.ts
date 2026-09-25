import { closestGuesses, GUESS_CHIPS, scoreGuess, type ErrorCode, type Guess } from '@trivia/shared';
import type { NumberQuestion } from '../content/types.ts';

type Result = { ok: true } | { ok: false; error: ErrorCode };

/** One player's round: their guess (as an index into the sorted guesses) and what it and their chips won. */
export interface GuessOutcome {
  playerId: string;
  choice: number | null;
  closest: boolean;
  exact: boolean;
  chipsOnClosest: number;
  points: number;
  responseMs: number | null;
}

export interface GuessSettlement {
  guesses: (Guess & { distance: number })[];
  closest: string[];
  bets: Record<string, number[]>;
  outcomes: GuessOutcome[];
}

/**
 * Tippelj!: everyone guesses a number, then puts two chips on the guesses
 * they think are closest (their own included). The closest guess scores,
 * an exact one scores extra, and so does every chip on a closest guess.
 * Pure rules.
 */
export class GuessGame {
  private question: NumberQuestion | null = null;
  private readonly guesses = new Map<string, { value: number; responseMs: number }>();
  private readonly bets = new Map<string, number[]>();

  startRound(q: NumberQuestion): void {
    this.question = q;
    this.guesses.clear();
    this.bets.clear();
  }

  submit(playerId: string, value: number, responseMs: number): Result {
    if (!this.question || this.guesses.has(playerId)) return { ok: false, error: 'NOT_ALLOWED' };
    if (!Number.isFinite(value)) return { ok: false, error: 'BAD_REQUEST' };
    this.guesses.set(playerId, { value, responseMs });
    return { ok: true };
  }

  guessOf(playerId: string): number | null {
    return this.guesses.get(playerId)?.value ?? null;
  }

  /** Who has guessed so far. */
  guessed(): string[] {
    return [...this.guesses.keys()];
  }

  /** Guesses ascending (equal values in the order they came in): chips point at these indices. */
  sortedGuesses(): Guess[] {
    return [...this.guesses].map(([playerId, g]) => ({ playerId, value: g.value })).sort((a, b) => a.value - b.value);
  }

  /** Only players who guessed may bet, once, with exactly their chips. */
  bet(playerId: string, chips: number[]): Result {
    if (!this.guesses.has(playerId) || this.bets.has(playerId)) return { ok: false, error: 'NOT_ALLOWED' };
    const n = this.guesses.size;
    if (chips.length !== GUESS_CHIPS || !chips.every((c) => Number.isInteger(c) && c >= 0 && c < n)) {
      return { ok: false, error: 'BAD_REQUEST' };
    }
    this.bets.set(playerId, [...chips]);
    return { ok: true };
  }

  betsOf(playerId: string): number[] | null {
    return this.bets.get(playerId) ?? null;
  }

  /** Who has placed their chips so far. */
  betted(): string[] {
    return [...this.bets.keys()];
  }

  settle(playerIds: string[]): GuessSettlement {
    const answer = this.question?.answer ?? 0;
    const sorted = this.sortedGuesses();
    const closest = closestGuesses(sorted, answer);
    const winning = new Set(sorted.flatMap((g, i) => (closest.includes(g.playerId) ? [i] : [])));
    const outcomes = playerIds.map((id) => {
      const g = this.guesses.get(id);
      const isClosest = closest.includes(id);
      const exact = g !== undefined && g.value === answer;
      const chipsOnClosest = (this.bets.get(id) ?? []).filter((c) => winning.has(c)).length;
      const index = sorted.findIndex((s) => s.playerId === id);
      return {
        playerId: id,
        choice: index >= 0 ? index : null,
        closest: isClosest,
        exact,
        chipsOnClosest,
        points: scoreGuess(isClosest, exact, chipsOnClosest),
        responseMs: g?.responseMs ?? null,
      };
    });
    return {
      guesses: sorted.map((g) => ({ ...g, distance: Math.abs(g.value - answer) })),
      closest,
      bets: Object.fromEntries(this.bets),
      outcomes,
    };
  }
}
