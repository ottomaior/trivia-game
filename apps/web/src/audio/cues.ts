import type { HostView, Phase } from '@trivia/shared';
import type { Track } from './music.ts';
import type { Cue } from './sfx.ts';

// Which sounds a change on the TV deserves. Pure, so it is unit-tested; the
// server protocol needs no audio events.

export function cuesFor(prev: HostView | null, next: HostView): Cue[] {
  // First view after load or reconnect: we don't know what changed.
  if (!prev || prev.roomCode !== next.roomCode) return [];
  const cues: Cue[] = [];
  const a = prev.stage;
  const b = next.stage;

  if (b.phase === 'lobby' && next.players.length > prev.players.length) cues.push('join');

  if (a.phase !== b.phase) {
    switch (b.phase) {
      case 'intro':
        cues.push('start');
        break;
      case 'question_read':
        cues.push('question');
        break;
      case 'reveal':
        cues.push(b.picks.some((p) => p.correct) ? 'reveal' : 'wrong');
        break;
      case 'scoreboard': {
        cues.push('scoreboard');
        const leaders = b.standings.filter((s) => s.rank === 1);
        if (next.round > 1 && leaders.length === 1 && leaders[0]!.prevRank !== 1) cues.push('leadChange');
        break;
      }
      case 'final':
        cues.push('winner');
        break;
    }
  } else if (a.phase === 'vote' && b.phase === 'vote') {
    if (Object.keys(b.votes).length > Object.keys(a.votes).length) cues.push('vote');
  } else if (a.phase === 'question_open' && b.phase === 'question_open') {
    if (b.answered.length > a.answered.length) cues.push('lockIn');
  }
  return cues;
}

/** Background loop per phase: lounge between questions, a pulse under them. */
export function musicFor(phase: Phase, paused: boolean): Track | null {
  if (paused) return null;
  switch (phase) {
    case 'lobby':
    case 'vote':
    case 'scoreboard':
      return 'lobby';
    case 'question_read':
    case 'question_open':
      return 'thinking';
    case 'intro':
    case 'reveal':
    case 'final':
      return null;
  }
}
