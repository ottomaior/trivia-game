import {
  fallbackRung,
  LADDER_RUNGS,
  LADDER_WALK_FROM,
  type ErrorCode,
  type LadderHelp,
  type LadderSeat,
  type LadderStatus,
  type Lifeline,
} from '@trivia/shared';
import { shuffle, type Rng } from '../content/select.ts';

type Result = { ok: true } | { ok: false; error: ErrorCode };

interface Seat {
  status: LadderStatus;
  /** Highest rung banked. */
  rung: number;
  used: Set<Lifeline>;
  /** Answer time summed over the game: the faster climber wins a tie. */
  totalMs: number;
  /** This step's choice, once made: true stops before the rung. */
  walk: boolean | null;
  /** Help asked for on the current question. */
  fifty: boolean;
  audience: boolean;
  friendId: string | null;
}

/** What one climbing player's answer did to them on a rung. */
export interface RungOutcome {
  playerId: string;
  choice: number | null;
  correct: boolean;
  status: LadderStatus;
  /** Rungs gained, or lost when falling back to the last safe rung. */
  delta: number;
  responseMs: number | null;
}

/**
 * Milliomos-létra: everyone climbs the same ladder, one question per rung.
 * Before each rung a player may walk away with what they hold; a wrong
 * answer drops them to the last safe rung and off the ladder, where they
 * become the audience the others can ask. Pure rules, like Room: the room
 * feeds in answers and reads back the outcome.
 */
export class LadderGame {
  /** The rung being played, from 1; 0 before the first. */
  rung = 0;
  private readonly seats = new Map<string, Seat>();
  /** 50:50 takes the same two wrong choices away from everyone who asks on a question. */
  private fiftyHidden: number[] | null = null;

  constructor(
    playerIds: string[],
    private readonly rng: Rng,
  ) {
    for (const id of playerIds) {
      this.seats.set(id, { status: 'in', rung: 0, used: new Set(), totalMs: 0, walk: null, fifty: false, audience: false, friendId: null });
    }
  }

  /** Players still on the ladder. */
  climbing(): string[] {
    return [...this.seats].filter(([, s]) => s.status === 'in').map(([id]) => id);
  }

  isOver(): boolean {
    return this.climbing().length === 0;
  }

  status(playerId: string): LadderStatus | null {
    return this.seats.get(playerId)?.status ?? null;
  }

  rungOf(playerId: string): number {
    return this.seats.get(playerId)?.rung ?? 0;
  }

  totalMs(playerId: string): number {
    return this.seats.get(playerId)?.totalMs ?? 0;
  }

  /** Moves on to the next rung; choices and help from the last one are cleared. */
  nextRung(): number {
    this.rung += 1;
    this.fiftyHidden = null;
    for (const s of this.seats.values()) {
      s.walk = null;
      s.fifty = false;
      s.audience = false;
      s.friendId = null;
    }
    return this.rung;
  }

  /** Walking away needs something to keep, so the first rung can't be skipped. */
  canWalk(): boolean {
    return this.rung >= LADDER_WALK_FROM;
  }

  decide(playerId: string, walk: boolean): Result {
    const s = this.seats.get(playerId);
    if (!s) return { ok: false, error: 'NOT_FOUND' };
    if (s.status !== 'in' || !this.canWalk()) return { ok: false, error: 'NOT_ALLOWED' };
    s.walk = walk;
    return { ok: true };
  }

  /** Choices made so far on this step, by player id (true: stopping). */
  decisions(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const [id, s] of this.seats) if (s.status === 'in' && s.walk !== null) out[id] = s.walk;
    return out;
  }

  /** Every connected climber has chosen, so the step can end early. */
  allDecided(connected: string[]): boolean {
    if (!this.canWalk()) return false;
    const waiting = this.climbing().filter((id) => connected.includes(id));
    return waiting.length > 0 && waiting.every((id) => this.seats.get(id)!.walk !== null);
  }

  /** Those who chose to stop leave the ladder, keeping their rung. Returns who walked. */
  applyWalks(): string[] {
    const walked: string[] = [];
    for (const [id, s] of this.seats) {
      if (s.status === 'in' && s.walk === true) {
        s.status = 'walked';
        walked.push(id);
      }
    }
    return walked;
  }

  /** Players off the ladder: they answer too, as the audience. */
  audienceIds(): string[] {
    return [...this.seats].filter(([, s]) => s.status === 'out' || s.status === 'walked').map(([id]) => id);
  }

  /**
   * A climber asks for help before answering, each lifeline once per game.
   * Asking the audience needs someone off the ladder; phoning needs a friend
   * who is in the room.
   */
  useLifeline(
    playerId: string,
    kind: Lifeline,
    q: { answered: boolean; correct: number; choices: number; friendId?: string; players: string[] },
  ): Result {
    const s = this.seats.get(playerId);
    if (!s) return { ok: false, error: 'NOT_FOUND' };
    if (s.status !== 'in' || q.answered || s.used.has(kind)) return { ok: false, error: 'NOT_ALLOWED' };
    if (kind === 'fifty') {
      if (!this.fiftyHidden) {
        const wrong = Array.from({ length: q.choices }, (_, i) => i).filter((i) => i !== q.correct);
        this.fiftyHidden = shuffle(wrong, this.rng).slice(0, 2).sort((a, b) => a - b);
      }
      s.fifty = true;
    } else if (kind === 'audience') {
      if (this.audienceIds().length === 0) return { ok: false, error: 'NOT_ALLOWED' };
      s.audience = true;
    } else {
      const friend = q.friendId;
      if (!friend || friend === playerId || !q.players.includes(friend)) return { ok: false, error: 'BAD_REQUEST' };
      s.friendId = friend;
    }
    s.used.add(kind);
    return { ok: true };
  }

  /** Choices 50:50 took away from this player, if they asked. */
  hiddenFor(playerId: string): number[] {
    return this.seats.get(playerId)?.fifty && this.fiftyHidden ? this.fiftyHidden : [];
  }

  /** What this player's lifelines show right now, given the answers so far. */
  help(playerId: string, answers: ReadonlyMap<string, { choice: number }>, choices: number): LadderHelp | null {
    const s = this.seats.get(playerId);
    if (!s) return null;
    let audience: number[] | null = null;
    if (s.audience) {
      audience = Array.from({ length: choices }, () => 0);
      for (const id of this.audienceIds()) {
        const a = answers.get(id);
        if (a) audience[a.choice]! += 1;
      }
    }
    return {
      hidden: this.hiddenFor(playerId),
      audience,
      friend: s.friendId ? { playerId: s.friendId, choice: answers.get(s.friendId)?.choice ?? null } : null,
    };
  }

  /**
   * Settles the rung for everyone still climbing. A right answer banks it; a
   * wrong one (or silence) falls back to the last safe rung and off the
   * ladder. Someone whose phone dropped without answering walks away with
   * what they held instead: a dead battery shouldn't cost a rung.
   */
  settle(answers: ReadonlyMap<string, { choice: number; responseMs: number }>, correct: number, connected: ReadonlySet<string>): RungOutcome[] {
    const out: RungOutcome[] = [];
    for (const [id, s] of this.seats) {
      if (s.status !== 'in') continue;
      const a = answers.get(id);
      const before = s.rung;
      if (a) s.totalMs += a.responseMs;
      if (a?.choice === correct) {
        s.rung = this.rung;
        if (this.rung >= LADDER_RUNGS) s.status = 'top';
      } else if (!a && !connected.has(id)) {
        s.status = 'walked';
      } else {
        s.status = 'out';
        s.rung = fallbackRung(this.rung);
      }
      out.push({
        playerId: id,
        choice: a?.choice ?? null,
        correct: a?.choice === correct,
        status: s.status,
        delta: s.rung - before,
        responseMs: a?.responseMs ?? null,
      });
    }
    return out;
  }

  /** Public seats, in the given (join) order. */
  seatsView(order: string[]): LadderSeat[] {
    return order.flatMap((id) => {
      const s = this.seats.get(id);
      return s ? [{ playerId: id, status: s.status, rung: s.rung, used: [...s.used] }] : [];
    });
  }
}
