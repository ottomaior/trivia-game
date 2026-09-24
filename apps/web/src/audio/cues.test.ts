import type { HostView, Stage } from '@trivia/shared';
import { describe, expect, it } from 'vitest';
import { cuesFor as timedCues, musicFor } from './cues.ts';

/** Just the cue names, in order. */
const cuesFor = (...args: Parameters<typeof timedCues>) => timedCues(...args).map((c) => c.cue);

const player = (id: string) => ({
  id,
  name: id,
  avatar: { color: 'teal' as const, face: 'grin' as const },
  connected: true,
  isVip: id === 'a',
  score: 0,
  hasPower: false,
});

function view(stage: Stage, extra: Partial<HostView> = {}): HostView {
  return {
    role: 'host',
    roomCode: 'BCDF',
    stage,
    round: 2,
    totalRounds: 10,
    serverNow: 0,
    phaseEndsAt: null,
    paused: false,
    players: [player('a'), player('b')],
    pack: null,
    mode: 'classic',
    ladder: null,
    otto: null,
    ...extra,
  };
}

const lobby: Stage = { phase: 'lobby', step: 'packs', packs: null, votes: {} };
const question = { id: 'q', category: 'Zene', difficulty: 1 as const, prompt: 'p', choices: ['a', 'b', 'c', 'd'], voice: 'v' };
const pick = (playerId: string, correct: boolean) => ({ playerId, choice: 0, correct, points: correct ? 900 : 0, responseMs: 1000 });
const standing = (playerId: string, rank: number, prevRank: number) => ({ playerId, score: 1000, delta: 0, rank, prevRank });

describe('cuesFor', () => {
  it('stays quiet on the first view (load or reconnect) and on a room switch', () => {
    expect(cuesFor(null, view({ phase: 'intro' }))).toEqual([]);
    expect(cuesFor(view(lobby), view({ phase: 'intro' }, { roomCode: 'GHJK' }))).toEqual([]);
  });

  it('chimes when someone joins the lobby', () => {
    const before = view(lobby, { players: [player('a')] });
    expect(cuesFor(before, view(lobby))).toEqual(['join']);
  });

  it('plays the opening fanfare and the question sting', () => {
    expect(cuesFor(view(lobby), view({ phase: 'intro' }))).toEqual(['start', 'applause']);
    const vote = view({ phase: 'vote', options: [], votes: {}, hits: [], powerVote: false });
    expect(cuesFor(vote, view({ phase: 'question_read', question, hits: [] }))).toEqual(['question']);
  });

  it('blips for each vote and each locked-in answer', () => {
    expect(cuesFor(view({ phase: 'vote', options: [], votes: {}, hits: [], powerVote: false }), view({ phase: 'vote', options: [], votes: { a: 0 }, hits: [], powerVote: false }))).toEqual(['vote']);
    const open = (answered: string[]) => view({ phase: 'question_open', question, answered, hits: [] });
    expect(cuesFor(open([]), open(['a']))).toEqual(['lockIn']);
    expect(cuesFor(open(['a']), open(['a']))).toEqual([]);
  });

  it('rings and applauds a right answer, groans and "aww"s when nobody got it', () => {
    const open = view({ phase: 'question_open', question, answered: ['a', 'b'], hits: [] });
    const reveal = (picks: ReturnType<typeof pick>[]) => view({ phase: 'reveal', question, correct: 0, explanation: null, picks });
    expect(cuesFor(open, reveal([pick('a', true), pick('b', false)]))).toEqual(['reveal', 'applause']);
    expect(cuesFor(open, reveal([pick('a', true), pick('b', true)]))).toEqual(['reveal', 'applause', 'cheer']);
    expect(cuesFor(open, reveal([pick('a', false), pick('b', false)]))).toEqual(['wrong', 'aww']);
    // The applause lands after the drumroll's "ding".
    const timed = timedCues(open, reveal([pick('a', true), pick('b', false)]));
    expect(timed.find((c) => c.cue === 'applause')!.at).toBeGreaterThan(0.75);
  });

  it('splats and freezes as power plays land, and shatters when the ice is broken', () => {
    const hit = (power: 'freeze' | 'slime', cleared = false) => ({ by: 'a', target: 'b', power, cleared });
    const vote = (hits: ReturnType<typeof hit>[]) => view({ phase: 'vote', options: [], votes: {}, hits, powerVote: true });
    expect(cuesFor(vote([]), vote([hit('slime')]))).toEqual(['splat']);
    expect(cuesFor(vote([hit('slime')]), vote([hit('slime'), hit('freeze')]))).toEqual(['freeze']);
    const open = (hits: ReturnType<typeof hit>[]) => view({ phase: 'question_open', question, answered: [], hits });
    expect(cuesFor(open([hit('freeze')]), open([hit('freeze', true)]))).toEqual(['shatter']);
    expect(cuesFor(open([hit('slime')]), open([hit('slime', true)]))).toEqual(['wipe']);
    expect(cuesFor(open([hit('slime', true)]), open([hit('slime', true)]))).toEqual([]);
  });

  it('lets the audience laugh at Otto\'s jokes when he says them', () => {
    const open = view({ phase: 'question_open', question, answered: ['a', 'b'], hits: [] });
    const reveal = view(
      { phase: 'reveal', question, correct: 0, explanation: null, picks: [pick('a', false), pick('b', false)] },
      { otto: { key: 'noneCorrect', variant: 0, focus: [] } },
    );
    const laugh = timedCues(open, reveal).find((c) => c.cue === 'laugh');
    expect(laugh?.at).toBeGreaterThan(3.2); // Otto speaks 3.2s into the reveal
  });

  it('adds a sting when the lead changes, and a fanfare at the end', () => {
    const reveal = view({ phase: 'reveal', question, correct: 0, explanation: null, picks: [] });
    const board = (rank1Prev: number) => view({ phase: 'scoreboard', standings: [standing('b', 1, rank1Prev), standing('a', 2, 1)] });
    expect(cuesFor(reveal, board(2))).toEqual(['scoreboard', 'leadChange', 'cheer']);
    expect(cuesFor(reveal, board(1))).toEqual(['scoreboard']);
    expect(cuesFor(reveal, view({ phase: 'final', standings: [] }))).toEqual(['winner', 'cheer', 'applause']);
  });
});

describe('musicFor', () => {
  it('plays the lounge loop between questions and the pulse under them', () => {
    expect(musicFor('lobby', false)).toBe('lobby');
    expect(musicFor('scoreboard', false)).toBe('lobby');
    expect(musicFor('question_open', false)).toBe('thinking');
    expect(musicFor('reveal', false)).toBeNull();
    expect(musicFor('final', false)).toBe('final');
    expect(musicFor('question_open', true)).toBeNull();
  });
});
