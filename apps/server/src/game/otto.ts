import { ottoVariants, type OttoLine, type OttoLineKey } from '@trivia/shared';
import type { Rng } from '../content/select.ts';

// Chooses what Otto says. Pure: the room passes in facts, gets a line back.
// Each picker checks the most remarkable thing first, so a streak beats a
// plain "everyone got it".

export const STREAK_MIN = 3;
export const LIGHTNING_MS = 2_000;
export const COMEBACK_PLACES = 2;
export const BLOWOUT_POINTS = 2_000;
export const CLOSE_RACE_POINTS = 300;
export const SOLO_FINAL_HIGH = 6_000;

const fmt = (n: number) => n.toLocaleString('hu');

export function line(key: OttoLineKey, rng: Rng, vars: Record<string, string> = {}): OttoLine {
  return { key, variant: Math.floor(rng() * ottoVariants(key)), vars };
}

export function welcomeLine(players: number, rng: Rng): OttoLine {
  return players === 1 ? line('welcomeSolo', rng) : line('welcome', rng, { n: String(players) });
}

export function voteLine(round: number, totalRounds: number, rng: Rng): OttoLine {
  return line(round === totalRounds ? 'lastRound' : 'pickCategory', rng);
}

export interface RevealFact {
  name: string;
  correct: boolean;
  responseMs: number | null;
  /** Consecutive correct answers including this round. */
  streak: number;
}

export function revealLine(facts: RevealFact[], noneCorrectRun: number, rng: Rng): OttoLine {
  if (facts.length === 1) return line(facts[0]!.correct ? 'soloCorrect' : 'soloWrong', rng);
  const right = facts.filter((f) => f.correct);
  if (right.length === 0) return line(noneCorrectRun >= 2 ? 'noneCorrectAgain' : 'noneCorrect', rng);
  const hot = right.filter((f) => f.streak >= STREAK_MIN).sort((a, b) => b.streak - a.streak)[0];
  if (hot) return line('streak', rng, { name: hot.name, n: String(hot.streak) });
  if (right.length === facts.length) return line('allCorrect', rng);
  const fastest = right.reduce((a, b) => ((a.responseMs ?? Infinity) <= (b.responseMs ?? Infinity) ? a : b));
  if ((fastest.responseMs ?? Infinity) < LIGHTNING_MS) return line('lightning', rng, { name: fastest.name });
  return line(rng() < 0.6 ? 'fastest' : 'someCorrect', rng, { name: fastest.name });
}

export interface StandingFact {
  name: string;
  score: number;
  rank: number;
  prevRank: number;
}

/** `standings` must be sorted best first. */
export function scoreboardLine(standings: StandingFact[], round: number, rng: Rng): OttoLine {
  if (standings.length === 1) return line('soloScore', rng, { score: fmt(standings[0]!.score) });
  const leaders = standings.filter((s) => s.rank === 1);
  const leader = leaders.length === 1 ? leaders[0]! : null;
  if (leader && leader.prevRank !== 1 && round > 1) return line('newLeader', rng, { name: leader.name });
  const climber = standings
    .filter((s) => s.prevRank - s.rank >= COMEBACK_PLACES)
    .sort((a, b) => b.prevRank - b.rank - (a.prevRank - a.rank))[0];
  if (climber) return line('comeback', rng, { name: climber.name });
  const [first, second] = standings;
  if (first && second && leader && round >= 3 && first.score - second.score >= BLOWOUT_POINTS) {
    return line('blowout', rng, { name: first.name });
  }
  if (first && second && second.score > 0 && first.score - second.score <= CLOSE_RACE_POINTS) {
    return line('closeRace', rng, { a: first.name, b: second.name });
  }
  if (leader) return line('standings', rng, { name: leader.name });
  return line('standings', rng, { name: leaders.map((s) => s.name).join(' és ') });
}

export function finalLine(standings: StandingFact[], rng: Rng): OttoLine | null {
  if (standings.length === 1) {
    const { score } = standings[0]!;
    return line(score >= SOLO_FINAL_HIGH ? 'soloFinalHigh' : 'soloFinalLow', rng, { score: fmt(score) });
  }
  const winners = standings.filter((s) => s.rank === 1).map((s) => s.name);
  if (winners.length === 1) return line('winner', rng, { name: winners[0]! });
  if (winners.length > 1) return line('tie', rng, { name: winners.join(' és ') });
  return null;
}
