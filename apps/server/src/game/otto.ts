import { ottoVariants, type OttoLine, type OttoLineKey } from '@trivia/shared';
import type { Rng } from '../content/select.ts';

// Chooses what Otto says. Pure: the room passes in facts, gets a line back.
// Lines carry no names (they are pre-recorded); `focus` says who they're about.
// Each picker checks the most remarkable thing first, so a streak beats a
// plain "everyone got it".

export const STREAK_MIN = 3;
export const LIGHTNING_MS = 2_000;
export const COMEBACK_PLACES = 2;
export const BLOWOUT_POINTS = 2_000;
export const CLOSE_RACE_POINTS = 300;
export const SOLO_FINAL_HIGH = 6_000;

export function line(key: OttoLineKey, rng: Rng, focus: string[] = []): OttoLine {
  return { key, variant: Math.floor(rng() * ottoVariants(key)), focus };
}

export function welcomeLine(players: number, rng: Rng): OttoLine {
  return line(players === 1 ? 'welcomeSolo' : 'welcome', rng);
}

export function voteLine(round: number, totalRounds: number, rng: Rng): OttoLine {
  return line(round === totalRounds ? 'lastRound' : 'pickCategory', rng);
}

export interface RevealFact {
  id: string;
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
  if (hot) return line('streak', rng, [hot.id]);
  if (right.length === facts.length) return line('allCorrect', rng, right.map((f) => f.id));
  const fastest = right.reduce((a, b) => ((a.responseMs ?? Infinity) <= (b.responseMs ?? Infinity) ? a : b));
  if ((fastest.responseMs ?? Infinity) < LIGHTNING_MS) return line('lightning', rng, [fastest.id]);
  return rng() < 0.6 ? line('fastest', rng, [fastest.id]) : line('someCorrect', rng, right.map((f) => f.id));
}

export interface StandingFact {
  id: string;
  score: number;
  rank: number;
  prevRank: number;
}

/** `standings` must be sorted best first. */
export function scoreboardLine(standings: StandingFact[], round: number, rng: Rng): OttoLine {
  if (standings.length === 1) return line('soloScore', rng, [standings[0]!.id]);
  const leaders = standings.filter((s) => s.rank === 1);
  const leader = leaders.length === 1 ? leaders[0]! : null;
  if (leader && leader.prevRank !== 1 && round > 1) return line('newLeader', rng, [leader.id]);
  const climber = standings
    .filter((s) => s.prevRank - s.rank >= COMEBACK_PLACES)
    .sort((a, b) => b.prevRank - b.rank - (a.prevRank - a.rank))[0];
  if (climber) return line('comeback', rng, [climber.id]);
  const [first, second] = standings;
  if (first && second && leader && round >= 3 && first.score - second.score >= BLOWOUT_POINTS) {
    return line('blowout', rng, [first.id]);
  }
  if (first && second && second.score > 0 && first.score - second.score <= CLOSE_RACE_POINTS) {
    return line('closeRace', rng, [first.id, second.id]);
  }
  return line('standings', rng, leaders.map((s) => s.id));
}

export function finalLine(standings: StandingFact[], rng: Rng): OttoLine | null {
  if (standings.length === 1) {
    const { id, score } = standings[0]!;
    return line(score >= SOLO_FINAL_HIGH ? 'soloFinalHigh' : 'soloFinalLow', rng, [id]);
  }
  const winners = standings.filter((s) => s.rank === 1).map((s) => s.id);
  if (winners.length === 1) return line('winner', rng, winners);
  if (winners.length > 1) return line('tie', rng, winners);
  return null;
}
