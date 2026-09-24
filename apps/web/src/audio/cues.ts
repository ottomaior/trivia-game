import { ottoLineOffsetMs, type HostView, type OttoLineKey, type Phase, type PowerHit } from '@trivia/shared';
import type { Track } from './music.ts';
import type { Cue } from './sfx.ts';

// Which sounds a change on the TV deserves, and when (seconds after the
// change). Pure, so it is unit-tested; the server protocol has no audio events.

export interface CueEvent {
  cue: Cue;
  at: number;
}

const now = (cue: Cue): CueEvent => ({ cue, at: 0 });

/** Otto lines the studio audience reacts to, and how. */
const AUDIENCE: Partial<Record<OttoLineKey, CueEvent>> = {
  noneCorrect: { cue: 'laugh', at: 0.6 },
  noneCorrectAgain: { cue: 'laugh', at: 0.6 },
  lightning: { cue: 'ooh', at: 0.2 },
  streak: { cue: 'ooh', at: 0.2 },
  closeRace: { cue: 'gasp', at: 0.1 },
  comeback: { cue: 'cheer', at: 0.2 },
  powerFreeze: { cue: 'ooh', at: 0.3 },
  powerSlime: { cue: 'laugh', at: 0.6 },
  powerMany: { cue: 'laugh', at: 0.6 },
  powerGangUp: { cue: 'gasp', at: 0.2 },
};

const HIT_CUE = { freeze: 'freeze', slime: 'splat' } as const;
const CLEAR_CUE = { freeze: 'shatter', slime: 'wipe' } as const;

/** Power plays on the stage, whichever phase it is. */
function hitsOf(stage: HostView['stage']): PowerHit[] {
  return 'hits' in stage ? stage.hits : [];
}

export function cuesFor(prev: HostView | null, next: HostView): CueEvent[] {
  // First view after load or reconnect: we don't know what changed.
  if (!prev || prev.roomCode !== next.roomCode) return [];
  const cues: CueEvent[] = [];
  const a = prev.stage;
  const b = next.stage;

  if (b.phase === 'lobby' && next.players.length > prev.players.length) cues.push(now('join'));

  if (a.phase !== b.phase) {
    switch (b.phase) {
      case 'intro':
        cues.push(now('start'), { cue: 'applause', at: 0.5 });
        break;
      case 'question_read':
        cues.push(now('question'));
        break;
      case 'reveal': {
        const right = b.picks.filter((p) => p.correct).length;
        if (right > 0) {
          cues.push(now('reveal'), { cue: 'applause', at: 0.85 });
          // Everybody right: the crowd goes wild.
          if (right === b.picks.length && right > 1) cues.push({ cue: 'cheer', at: 0.9 });
        } else {
          cues.push(now('wrong'), { cue: 'aww', at: 0.3 });
        }
        break;
      }
      case 'scoreboard': {
        cues.push(now('scoreboard'));
        const leaders = b.standings.filter((s) => s.rank === 1);
        if (next.round > 1 && leaders.length === 1 && leaders[0]!.prevRank !== 1) {
          cues.push({ cue: 'leadChange', at: 0.6 }, { cue: 'cheer', at: 0.7 });
        }
        break;
      }
      case 'final':
        cues.push(now('winner'), { cue: 'cheer', at: 2.2 }, { cue: 'applause', at: 2.4 });
        break;
    }
  } else if (a.phase === 'vote' && b.phase === 'vote') {
    if (Object.keys(b.votes).length > Object.keys(a.votes).length) cues.push(now('vote'));
  } else if (a.phase === 'ladder_step' && b.phase === 'ladder_step') {
    if (Object.keys(b.walking).length > Object.keys(a.walking).length) cues.push(now('vote'));
  } else if (a.phase === 'question_open' && b.phase === 'question_open') {
    if (b.answered.length > a.answered.length) cues.push(now('lockIn'));
  }

  // A power play lands on someone, or its target breaks free.
  const before = hitsOf(a);
  const after = hitsOf(b);
  if (after.length > before.length) for (const h of after.slice(before.length)) cues.push(now(HIT_CUE[h.power]));
  if (after.length === before.length) {
    after.forEach((h, i) => {
      if (h.cleared && !before[i]!.cleared) cues.push(now(CLEAR_CUE[h.power]));
    });
  }

  // The audience reacts to some of Otto's lines, when he says them.
  const line = next.otto;
  const lineChanged = line && (line.key !== prev.otto?.key || line.variant !== prev.otto?.variant || a.phase !== b.phase);
  const reaction = lineChanged ? AUDIENCE[line.key] : undefined;
  if (reaction) cues.push({ ...reaction, at: reaction.at + ottoDelay(b.phase) });
  return cues;
}

/** Seconds after a phase starts that Otto speaks (the reveal waits for the drumroll and pan). */
export function ottoDelay(phase: Phase): number {
  return ottoLineOffsetMs(phase) / 1000;
}

/** Background loop per phase: lounge between questions, a pulse under them, a finale theme. */
export function musicFor(phase: Phase, paused: boolean): Track | null {
  if (paused) return null;
  switch (phase) {
    case 'lobby':
    case 'vote':
    case 'vote_result':
    case 'ladder_step':
    case 'scoreboard':
      return 'lobby';
    case 'question_read':
    case 'question_open':
      return 'thinking';
    case 'final':
      return 'final';
    case 'intro':
    case 'reveal':
      return null;
  }
}
