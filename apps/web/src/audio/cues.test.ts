import type { HostView, Stage } from '@trivia/shared';
import { describe, expect, it } from 'vitest';
import { cuesFor, musicFor } from './cues.ts';

const player = (id: string) => ({
  id,
  name: id,
  avatar: { color: 'teal' as const, face: 'grin' as const },
  connected: true,
  isVip: id === 'a',
  score: 0,
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
    otto: null,
    ...extra,
  };
}

const question = { id: 'q', category: 'Zene', difficulty: 1 as const, prompt: 'p', choices: ['a', 'b', 'c', 'd'] };
const pick = (playerId: string, correct: boolean) => ({ playerId, choice: 0, correct, points: correct ? 900 : 0, responseMs: 1000 });
const standing = (playerId: string, rank: number, prevRank: number) => ({ playerId, score: 1000, delta: 0, rank, prevRank });

describe('cuesFor', () => {
  it('stays quiet on the first view (load or reconnect) and on a room switch', () => {
    expect(cuesFor(null, view({ phase: 'intro' }))).toEqual([]);
    expect(cuesFor(view({ phase: 'lobby' }), view({ phase: 'intro' }, { roomCode: 'GHJK' }))).toEqual([]);
  });

  it('chimes when someone joins the lobby', () => {
    const before = view({ phase: 'lobby' }, { players: [player('a')] });
    expect(cuesFor(before, view({ phase: 'lobby' }))).toEqual(['join']);
  });

  it('plays the opening fanfare and the question sting', () => {
    expect(cuesFor(view({ phase: 'lobby' }), view({ phase: 'intro' }))).toEqual(['start']);
    const vote = view({ phase: 'vote', options: [], votes: {} });
    expect(cuesFor(vote, view({ phase: 'question_read', question }))).toEqual(['question']);
  });

  it('blips for each vote and each locked-in answer', () => {
    expect(cuesFor(view({ phase: 'vote', options: [], votes: {} }), view({ phase: 'vote', options: [], votes: { a: 0 } }))).toEqual(['vote']);
    const open = (answered: string[]) => view({ phase: 'question_open', question, answered });
    expect(cuesFor(open([]), open(['a']))).toEqual(['lockIn']);
    expect(cuesFor(open(['a']), open(['a']))).toEqual([]);
  });

  it('rings for a right answer, groans when nobody got it', () => {
    const open = view({ phase: 'question_open', question, answered: ['a', 'b'] });
    const reveal = (picks: ReturnType<typeof pick>[]) => view({ phase: 'reveal', question, correct: 0, explanation: null, picks });
    expect(cuesFor(open, reveal([pick('a', true), pick('b', false)]))).toEqual(['reveal']);
    expect(cuesFor(open, reveal([pick('a', false), pick('b', false)]))).toEqual(['wrong']);
  });

  it('adds a sting when the lead changes, and a fanfare at the end', () => {
    const reveal = view({ phase: 'reveal', question, correct: 0, explanation: null, picks: [] });
    const board = (rank1Prev: number) => view({ phase: 'scoreboard', standings: [standing('b', 1, rank1Prev), standing('a', 2, 1)] });
    expect(cuesFor(reveal, board(2))).toEqual(['scoreboard', 'leadChange']);
    expect(cuesFor(reveal, board(1))).toEqual(['scoreboard']);
    expect(cuesFor(reveal, view({ phase: 'final', standings: [] }))).toEqual(['winner']);
  });
});

describe('musicFor', () => {
  it('plays the lounge loop between questions and the pulse under them', () => {
    expect(musicFor('lobby', false)).toBe('lobby');
    expect(musicFor('scoreboard', false)).toBe('lobby');
    expect(musicFor('question_open', false)).toBe('thinking');
    expect(musicFor('reveal', false)).toBeNull();
    expect(musicFor('question_open', true)).toBeNull();
  });
});
