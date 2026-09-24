import {
  MIN_GAME_QUESTIONS,
  type HostView,
  type PlayerSummary,
  type PlayerView,
  type PublicQuestion,
  type Stage,
} from '@trivia/shared';
import { questionVoiceId } from '../content/normalize.ts';
import { packOption } from '../content/packs.ts';
import type { Question } from '../content/types.ts';
import type { Player, Room } from '../rooms/Room.ts';

// Builds the snapshots each screen receives. Only public information may pass
// through here: the answer key appears in the reveal stage and nowhere else.
// Tests assert on these to guarantee it.

function summarize(room: Room, p: Player): PlayerSummary {
  return {
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    connected: p.connected,
    isVip: room.vipId === p.id,
    score: p.score,
  };
}

function publicQuestion(q: Question): PublicQuestion {
  return {
    id: q.id,
    category: q.category,
    difficulty: q.difficulty,
    prompt: q.prompt,
    choices: q.choices,
    voice: questionVoiceId(q.prompt),
  };
}

function stage(room: Room): Stage {
  const q = room.question;
  switch (room.phase) {
    case 'lobby':
      return lobbyStage(room);
    case 'intro':
      return { phase: 'intro' };
    case 'vote':
      return {
        phase: 'vote',
        options: room.voteOptions.map((o) => ({ id: o.category.id, name: o.category.name })),
        votes: Object.fromEntries(room.votes),
      };
    case 'vote_result':
      return {
        phase: 'vote_result',
        options: room.voteOptions.map((o) => ({ id: o.category.id, name: o.category.name })),
        votes: Object.fromEntries(room.votes),
        chosen: room.chosenOption,
      };
    case 'question_read':
      return { phase: 'question_read', question: publicQuestion(q!) };
    case 'question_open':
      return { phase: 'question_open', question: publicQuestion(q!), answered: [...room.answers.keys()] };
    case 'reveal':
      return {
        phase: 'reveal',
        question: publicQuestion(q!),
        correct: q!.correct,
        explanation: q!.explanation,
        picks: room.picks,
      };
    case 'scoreboard':
    case 'final':
      return { phase: room.phase, standings: room.standings };
  }
}

function lobbyStage(room: Room): Stage {
  const { pack } = room;
  if (room.lobbyStep === 'setup' && pack) {
    return {
      phase: 'lobby',
      step: 'setup',
      pack: packOption(pack),
      categories: pack.categories.map((c) => ({
        id: c.id,
        name: c.name,
        questions: c.questions,
        enabled: room.enabledCategories.has(c.id),
      })),
      minQuestions: MIN_GAME_QUESTIONS,
    };
  }
  return {
    phase: 'lobby',
    step: 'packs',
    packs: room.packOffers?.map(packOption) ?? null,
    votes: Object.fromEntries(room.currentPackVotes()),
  };
}

function base(room: Room, now: number) {
  return {
    roomCode: room.code,
    stage: stage(room),
    round: room.round,
    totalRounds: room.totalRounds,
    serverNow: now,
    phaseEndsAt: room.phaseEndsAt,
    paused: room.paused,
    players: [...room.players.values()].map((p) => summarize(room, p)),
    pack: room.pack?.name ?? null,
  };
}

export function toHostView(room: Room, now: number): HostView {
  return { role: 'host', ...base(room, now), otto: room.otto };
}

export function toPlayerView(room: Room, playerId: string, now: number): PlayerView | null {
  const player = room.players.get(playerId);
  if (!player) return null;
  const inVote = room.phase === 'vote' || room.phase === 'vote_result';
  const q = room.question;
  return {
    role: 'player',
    ...base(room, now),
    me: summarize(room, player),
    mine: {
      vote: inVote ? (room.votes.get(playerId) ?? null) : null,
      choice: q && !inVote ? (room.answers.get(playerId)?.choice ?? null) : null,
      flagged: q ? room.hasFlagged(playerId, q.id) : false,
    },
  };
}
