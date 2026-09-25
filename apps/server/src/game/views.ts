import {
  MIN_GAME_QUESTIONS,
  type HostView,
  type McQuestionView,
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
    hasPower: room.powers.has(p.id),
  };
}

/** What screens may know of a question before its reveal: never the answer, the years or the house's lies. */
function publicQuestion(room: Room, q: Question): PublicQuestion {
  const base = { id: q.id, category: q.category, difficulty: q.difficulty, prompt: q.prompt, voice: questionVoiceId(q.prompt) };
  switch (q.kind) {
    case 'mc':
      return { ...base, kind: 'mc', choices: q.choices };
    case 'bluff':
      return { ...base, kind: 'bluff' };
    case 'timeline':
      return { ...base, kind: 'timeline', items: room.timeline?.displayItems() ?? [] };
    case 'number':
      return { ...base, kind: 'number', unit: q.unit };
  }
}

function mcView(room: Room, q: Question): McQuestionView {
  const pub = publicQuestion(room, q);
  if (pub.kind !== 'mc') throw new Error('expected a multiple-choice question');
  return pub;
}

function stage(room: Room): Stage {
  const q = room.question;
  const question = () => publicQuestion(room, q!);
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
        hits: room.hits,
        powerVote: room.powerVote(),
      };
    case 'vote_result':
      return {
        phase: 'vote_result',
        options: room.voteOptions.map((o) => ({ id: o.category.id, name: o.category.name })),
        votes: Object.fromEntries(room.votes),
        chosen: room.chosenOption,
        hits: room.hits,
      };
    case 'ladder_step': {
      const next = room.voteOptions[0]!;
      return {
        phase: 'ladder_step',
        rung: room.round,
        category: { id: next.category.id, name: next.category.name },
        difficulty: next.question.difficulty,
        walking: room.ladder?.decisions() ?? {},
      };
    }
    case 'question_read':
      return { phase: 'question_read', question: question(), hits: room.hits };
    case 'question_open':
      return {
        phase: 'question_open',
        question: mcView(room, q!),
        answered: [...room.answers.keys()],
        hits: room.hits,
      };
    case 'bluff_write':
      return { phase: 'bluff_write', question: question(), written: room.bluff!.written() };
    case 'bluff_pick':
      return { phase: 'bluff_pick', question: question(), options: room.bluff!.options(), picked: room.bluff!.picked() };
    case 'order_open':
      return { phase: 'order_open', question: question(), answered: room.timeline!.submitted() };
    case 'guess_open':
      return { phase: 'guess_open', question: question(), answered: room.guess!.guessed() };
    case 'guess_bet':
      return { phase: 'guess_bet', question: question(), guesses: room.guess!.sortedGuesses(), bet: room.guess!.betted() };
    case 'reveal':
      return {
        phase: 'reveal',
        question: question(),
        explanation: q!.explanation,
        picks: room.picks,
        result: room.revealResult!,
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
  const { ladder } = room;
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
    mode: room.mode,
    ladder: ladder ? { seats: ladder.seatsView([...room.players.keys()]) } : null,
  };
}

export function toHostView(room: Room, now: number): HostView {
  return { role: 'host', ...base(room, now), otto: room.otto };
}

export function toPlayerView(room: Room, playerId: string, now: number): PlayerView | null {
  const player = room.players.get(playerId);
  if (!player) return null;
  const inVote = room.phase === 'vote' || room.phase === 'vote_result';
  const q = inVote ? null : room.question;
  const { bluff, timeline, guess } = room;
  return {
    role: 'player',
    ...base(room, now),
    me: summarize(room, player),
    // Only this player's own doings: other phones never see them.
    mine: {
      vote: inVote ? (room.votes.get(playerId) ?? null) : null,
      choice: !q ? null : bluff ? bluff.pickOf(playerId) : (room.answers.get(playerId)?.choice ?? null),
      flagged: room.question ? room.hasFlagged(playerId, room.question.id) : false,
      ladder: room.ladder && q?.kind === 'mc' ? room.ladder.help(playerId, room.answers, q.choices.length) : null,
      power: room.powerState(playerId),
      lie: q && bluff ? bluff.lieOf(playerId) : null,
      order: q && timeline ? timeline.orderOf(playerId) : null,
      guess: q && guess ? guess.guessOf(playerId) : null,
      bets: q && guess ? guess.betsOf(playerId) : null,
    },
  };
}
