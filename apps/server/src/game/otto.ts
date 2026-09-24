import { CATEGORY_LINES, ottoVariants, type OttoLine, type OttoLineKey } from '@trivia/shared';
import type { Rng } from '../content/select.ts';

// Chooses what Otto says. Pure apart from the LinePicker's decks: the room
// passes in facts, gets a line back. Lines carry no names (they are
// pre-recorded); `focus` says who they're about. Each picker checks the most
// remarkable thing first, so a streak beats a plain "everyone got it".

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

/** For the round about to be voted on: the opener, halfway and the double-points finale get their own lines. */
export function voteLine(round: number, totalRounds: number, pick: LinePicker): OttoLine {
  if (round === totalRounds) return line('lastRound', pick);
  if (round === 1) return line('firstRound', pick);
  if (totalRounds >= 6 && round === Math.floor(totalRounds / 2) + 1) return line('halfway', pick);
  return line('pickCategory', pick);
}

/** Otto's reaction to the category that won the vote. */
export function categoryLine(slug: string, pick: LinePicker): OttoLine {
  const key: OttoLineKey = (CATEGORY_LINES as Record<string, OttoLineKey>)[slug] ?? 'categoryPicked';
  return line(key, pick);
}

export interface RevealFact {
  id: string;
  correct: boolean;
  responseMs: number | null;
  /** Consecutive correct answers including this round. */
  streak: number;
}

export function revealLine(facts: RevealFact[], noneCorrectRun: number, pick: LinePicker): OttoLine {
  if (facts.length === 1) return line(facts[0]!.correct ? 'soloCorrect' : 'soloWrong', pick);
  const right = facts.filter((f) => f.correct);
  if (right.length === 0) return line(noneCorrectRun >= 2 ? 'noneCorrectAgain' : 'noneCorrect', pick);
  const hot = right.filter((f) => f.streak >= STREAK_MIN).sort((a, b) => b.streak - a.streak)[0];
  if (hot) return line('streak', pick, [hot.id]);
  if (right.length === facts.length) return line('allCorrect', pick, right.map((f) => f.id));
  if (right.length === 1 && facts.length >= ONLY_ONE_MIN_PLAYERS) return line('onlyOne', pick, [right[0]!.id]);
  const fastest = right.reduce((a, b) => ((a.responseMs ?? Infinity) <= (b.responseMs ?? Infinity) ? a : b));
  if ((fastest.responseMs ?? Infinity) < LIGHTNING_MS) return line('lightning', pick, [fastest.id]);
  return pick.rng() < 0.6 ? line('fastest', pick, [fastest.id]) : line('someCorrect', pick, right.map((f) => f.id));
}

export interface StandingFact {
  id: string;
  score: number;
  rank: number;
  prevRank: number;
}

/** `standings` must be sorted best first. */
export function scoreboardLine(standings: StandingFact[], round: number, pick: LinePicker): OttoLine {
  if (standings.length === 1) return line('soloScore', pick, [standings[0]!.id]);
  const leaders = standings.filter((s) => s.rank === 1);
  const leader = leaders.length === 1 ? leaders[0]! : null;
  if (leader && leader.prevRank !== 1 && round > 1) return line('newLeader', pick, [leader.id]);
  const climber = standings
    .filter((s) => s.prevRank - s.rank >= COMEBACK_PLACES)
    .sort((a, b) => b.prevRank - b.rank - (a.prevRank - a.rank))[0];
  if (climber) return line('comeback', pick, [climber.id]);
  const [first, second] = standings;
  if (first && second && leader && round >= 3 && first.score - second.score >= BLOWOUT_POINTS) {
    return line('blowout', pick, [first.id]);
  }
  if (first && second && second.score > 0 && first.score - second.score <= CLOSE_RACE_POINTS) {
    return line('closeRace', pick, [first.id, second.id]);
  }
  return line('standings', pick, leaders.map((s) => s.id));
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
