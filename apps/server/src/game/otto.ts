import { ottoVariants, type OttoLine, type OttoLineKey, type PowerHit } from '@trivia/shared';
import type { Rng } from '../content/select.ts';

// Chooses what Otto says, and above all when he stays quiet. Pure apart from
// the LinePicker's decks: the room passes in facts, gets a line or null back.
// Lines carry no names (they are pre-recorded); `focus` says who they're about.
//
// Otto is a host, not a commentator: each round he reads the question, and
// says at most one more thing, only when something happened. Big moments
// (a streak, a new leader) always get a line; small ones (everyone right, a
// lightning answer) only after a round in which he kept quiet. Silence and
// the studio sounds carry the rest.

export const STREAK_MIN = 3;
export const LIGHTNING_MS = 2_000;
export const COMEBACK_PLACES = 2;
export const BLOWOUT_POINTS = 2_000;
export const CLOSE_RACE_POINTS = 300;
export const SOLO_FINAL_HIGH = 6_000;
/** "Only one of you knew it" needs a crowd to mean something. */
export const ONLY_ONE_MIN_PLAYERS = 3;

/**
 * Deals each line's variants like a shuffled deck, so Otto says every version
 * once before repeating any, and never the same one twice in a row. One per
 * room, so the decks carry over into the next game.
 */
export class LinePicker {
  private readonly decks = new Map<OttoLineKey, number[]>();
  private readonly last = new Map<OttoLineKey, number>();

  constructor(readonly rng: Rng) {}

  next(key: OttoLineKey): number {
    let deck = this.decks.get(key);
    if (!deck || deck.length === 0) {
      deck = shuffle([...Array(ottoVariants(key)).keys()], this.rng);
      // Variants are dealt from the end: don't open with the one said last.
      if (deck.length > 1 && deck[deck.length - 1] === this.last.get(key)) deck.unshift(deck.pop()!);
      this.decks.set(key, deck);
    }
    const variant = deck.pop()!;
    this.last.set(key, variant);
    return variant;
  }
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

export function line(key: OttoLineKey, pick: LinePicker, focus: string[] = []): OttoLine {
  return { key, variant: pick.next(key), focus };
}

export function welcomeLine(players: number, pick: LinePicker): OttoLine {
  return line(players === 1 ? 'welcomeSolo' : 'welcome', pick);
}

/**
 * For the round about to be voted on: only the double-points finale and the
 * first round that hands out power plays (they need explaining) get a line.
 */
export function voteLine(round: number, totalRounds: number, pick: LinePicker, explainPowers = false): OttoLine | null {
  if (round === totalRounds) return line('lastRound', pick);
  if (explainPowers) return line('powerGranted', pick);
  return null;
}

/**
 * Otto's take on the power plays thrown this round (`hits` is never empty):
 * always on a gang-up, otherwise only after a quiet round (the TV shows the
 * hits either way).
 */
export function powerLine(hits: PowerHit[], pick: LinePicker, quietBefore = true): OttoLine | null {
  const byTarget = new Map<string, number>();
  for (const h of hits) byTarget.set(h.target, (byTarget.get(h.target) ?? 0) + 1);
  const ganged = [...byTarget].filter(([, n]) => n >= 2).map(([id]) => id);
  if (ganged.length > 0) return line('powerGangUp', pick, ganged);
  if (!quietBefore) return null;
  const targets = [...byTarget.keys()];
  if (hits.length > 1) return line('powerMany', pick, targets);
  return line(hits[0]!.power === 'freeze' ? 'powerFreeze' : 'powerSlime', pick, targets);
}

export interface RevealFact {
  id: string;
  correct: boolean;
  responseMs: number | null;
  /** Consecutive correct answers including this round. */
  streak: number;
}

/** Streak lines at three right in a row, then every other one (not every round of a hot run). */
const streakWorthMentioning = (streak: number) => streak >= STREAK_MIN && (streak - STREAK_MIN) % 2 === 0;

/**
 * The reveal's comment, or null. `quietBefore`: Otto made no comment last
 * round, so a small moment may get one now.
 */
export function revealLine(facts: RevealFact[], noneCorrectRun: number, pick: LinePicker, quietBefore = true): OttoLine | null {
  if (facts.length === 1) {
    const [f] = facts;
    if (f!.correct && streakWorthMentioning(f!.streak)) return line('soloCorrect', pick, [f!.id]);
    if (!f!.correct && noneCorrectRun === 2) return line('soloWrong', pick, [f!.id]);
    if (quietBefore && f!.correct && (f!.responseMs ?? Infinity) < LIGHTNING_MS) return line('soloCorrect', pick, [f!.id]);
    return null;
  }
  const right = facts.filter((f) => f.correct);
  // Big moments: always worth a line.
  if (right.length === 0 && noneCorrectRun === 2) return line('noneCorrectAgain', pick);
  const hot = right.filter((f) => streakWorthMentioning(f.streak)).sort((a, b) => b.streak - a.streak)[0];
  if (hot) return line('streak', pick, [hot.id]);
  if (right.length === 1 && facts.length >= ONLY_ONE_MIN_PLAYERS) return line('onlyOne', pick, [right[0]!.id]);
  // Small moments: only after a quiet round.
  if (!quietBefore) return null;
  if (right.length === 0 && noneCorrectRun === 1) return line('noneCorrect', pick);
  if (right.length === facts.length && facts.length >= ONLY_ONE_MIN_PLAYERS) return line('allCorrect', pick, right.map((f) => f.id));
  const fastest = right.reduce<RevealFact | null>((a, b) => (a && (a.responseMs ?? Infinity) <= (b.responseMs ?? Infinity) ? a : b), null);
  if (fastest && (fastest.responseMs ?? Infinity) < LIGHTNING_MS) return line('lightning', pick, [fastest.id]);
  return null;
}

export interface StandingFact {
  id: string;
  score: number;
  rank: number;
  prevRank: number;
}

export interface ScoreboardContext {
  round: number;
  totalRounds: number;
  /** Otto already commented on this round's reveal. */
  spokeThisRound: boolean;
  quietBefore: boolean;
  /** A blowout is called once a game. */
  blowoutCalled: boolean;
}

/** The scoreboard's comment, or null. `standings` must be sorted best first. */
export function scoreboardLine(standings: StandingFact[], ctx: ScoreboardContext, pick: LinePicker): OttoLine | null {
  if (standings.length === 1 || ctx.spokeThisRound) return null;
  const leaders = standings.filter((s) => s.rank === 1);
  const leader = leaders.length === 1 ? leaders[0]! : null;
  if (leader && leader.prevRank !== 1 && ctx.round > 1) return line('newLeader', pick, [leader.id]);
  const climber = standings
    .filter((s) => s.prevRank - s.rank >= COMEBACK_PLACES)
    .sort((a, b) => b.prevRank - b.rank - (a.prevRank - a.rank))[0];
  if (climber) return line('comeback', pick, [climber.id]);
  if (!ctx.quietBefore) return null;
  const [first, second] = standings;
  if (first && second && leader && !ctx.blowoutCalled && ctx.round >= 4 && first.score - second.score >= BLOWOUT_POINTS) {
    return line('blowout', pick, [first.id]);
  }
  // A close race only matters towards the end.
  const late = ctx.round >= ctx.totalRounds - 3;
  if (late && first && second && second.score > 0 && first.score - second.score <= CLOSE_RACE_POINTS) {
    return line('closeRace', pick, [first.id, second.id]);
  }
  return null;
}

export function finalLine(standings: StandingFact[], pick: LinePicker): OttoLine | null {
  if (standings.length === 1) {
    const { id, score } = standings[0]!;
    return line(score >= SOLO_FINAL_HIGH ? 'soloFinalHigh' : 'soloFinalLow', pick, [id]);
  }
  const winners = standings.filter((s) => s.rank === 1).map((s) => s.id);
  if (winners.length === 1) return line('winner', pick, winners);
  if (winners.length > 1) return line('tie', pick, winners);
  return null;
}
