import { scoreTimeline, slotsRight, type ErrorCode } from '@trivia/shared';
import { shuffle, type Rng } from '../content/select.ts';
import type { TimelineQuestion } from '../content/types.ts';

type Result = { ok: true } | { ok: false; error: ErrorCode };

/** One player's order and what it scored (before the last round's doubling). */
export interface TimelineOutcome {
  playerId: string;
  order: number[] | null;
  rightSlots: number;
  allRight: boolean;
  points: number;
  responseMs: number | null;
}

/**
 * Időrend: the same five items for everyone, shown shuffled; each player
 * sends the order they think is chronological. Every item in its right
 * place scores, and a perfect order earns a speed bonus. Pure rules.
 */
export class TimelineGame {
  private question: TimelineQuestion | null = null;
  /** display[i] is the chronological index of the item shown i-th. */
  private display: number[] = [];
  private readonly orders = new Map<string, { order: number[]; responseMs: number }>();

  constructor(private readonly rng: Rng) {}

  startRound(q: TimelineQuestion): void {
    this.question = q;
    this.orders.clear();
    const n = q.items.length;
    const identity = Array.from({ length: n }, (_, i) => i);
    // Never show the items already in order.
    let display = shuffle(identity, this.rng);
    for (let tries = 0; tries < 5 && display.every((v, i) => v === i); tries++) display = shuffle(identity, this.rng);
    if (display.every((v, i) => v === i)) display.reverse();
    this.display = display;
  }

  /** The items' texts in the order shown. */
  displayItems(): string[] {
    const q = this.question;
    return q ? this.display.map((i) => q.items[i]!.text) : [];
  }

  /** Display indices of the items in chronological order: the right answer. */
  correctOrder(): number[] {
    return this.display.map((_, k) => this.display.indexOf(k));
  }

  /** Each item's year, earliest first. */
  years(): number[] {
    return this.question?.items.map((it) => it.year) ?? [];
  }

  submit(playerId: string, order: number[], responseMs: number): Result {
    const n = this.display.length;
    if (!this.question || this.orders.has(playerId)) return { ok: false, error: 'NOT_ALLOWED' };
    const valid = order.length === n && new Set(order).size === n && order.every((i) => Number.isInteger(i) && i >= 0 && i < n);
    if (!valid) return { ok: false, error: 'BAD_REQUEST' };
    this.orders.set(playerId, { order: [...order], responseMs });
    return { ok: true };
  }

  orderOf(playerId: string): number[] | null {
    return this.orders.get(playerId)?.order ?? null;
  }

  /** Who has sent an order so far. */
  submitted(): string[] {
    return [...this.orders.keys()];
  }

  settle(playerIds: string[], openMs: number): TimelineOutcome[] {
    const correct = this.correctOrder();
    return playerIds.map((id) => {
      const o = this.orders.get(id);
      if (!o) return { playerId: id, order: null, rightSlots: 0, allRight: false, points: 0, responseMs: null };
      const rightSlots = slotsRight(o.order, correct);
      return {
        playerId: id,
        order: o.order,
        rightSlots,
        allRight: rightSlots === correct.length,
        points: scoreTimeline(rightSlots, correct.length, o.responseMs, openMs),
        responseMs: o.responseMs,
      };
    });
  }
}
