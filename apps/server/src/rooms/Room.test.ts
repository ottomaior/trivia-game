import { MAX_PLAYERS } from '@trivia/shared';
import { describe, expect, it } from 'vitest';
import { HOUSEHOLD, seededRng } from '../testing.ts';
import { Room } from './Room.ts';

const newRoom = () => new Room('BCDF', HOUSEHOLD, 0, seededRng());

function joinOk(room: Room, name: string) {
  const res = room.join(name);
  if (!res.ok) throw new Error(`join failed: ${res.error}`);
  return res.player;
}

const question = {
  id: 'q1',
  categoryId: 1,
  category: 'Történelem',
  difficulty: 1 as const,
  prompt: 'Mikor?',
  choices: ['1914', '1918', '1939', '1905'],
  correct: 0,
  explanation: null,
};

describe('lobby', () => {
  it('makes the first player VIP and gives each player a distinct color and seat', () => {
    const room = newRoom();
    const a = joinOk(room, 'Anna');
    const b = joinOk(room, 'Béla');
    expect(room.vipId).toBe(a.id);
    expect(a.avatar.color).not.toBe(b.avatar.color);
    expect([a.seat, b.seat]).toEqual([0, 1]);
  });

  it('rejects duplicate names case-insensitively, including accents', () => {
    const room = newRoom();
    joinOk(room, 'Árpád');
    expect(room.join('  árpád ')).toEqual({ ok: false, error: 'NAME_TAKEN' });
  });

  it('rejects blank names and caps the room at MAX_PLAYERS', () => {
    const room = newRoom();
    expect(room.join('   ')).toEqual({ ok: false, error: 'BAD_REQUEST' });
    for (let i = 0; i < MAX_PLAYERS; i++) joinOk(room, `P${i}`);
    expect(room.join('Late')).toEqual({ ok: false, error: 'ROOM_FULL' });
  });

  it('lets only the VIP kick, only in the lobby, and reuses the freed seat', () => {
    const room = newRoom();
    const a = joinOk(room, 'Anna');
    const b = joinOk(room, 'Béla');
    expect(room.kick(b.id, a.id)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(room.kick(a.id, b.id)).toEqual({ ok: true });
    expect(joinOk(room, 'Cili').seat).toBe(1);
  });

  it('refuses a color someone else already has', () => {
    const room = newRoom();
    const a = joinOk(room, 'Anna');
    const b = joinOk(room, 'Béla');
    expect(room.setAvatar(b.id, { color: a.avatar.color, face: 'wink' })).toEqual({ ok: false, error: 'COLOR_TAKEN' });
    expect(room.setAvatar(b.id, { color: 'plum', face: 'wink' })).toEqual({ ok: true });
  });
});

describe('reconnection', () => {
  it('resumes a seat only with the right token', () => {
    const room = newRoom();
    const p = joinOk(room, 'Anna');
    room.playerDisconnected(p.id, 1000);
    expect(room.resumePlayer(p.id, 'x'.repeat(32))).toBeNull();
    expect(room.resumePlayer(p.id, p.sessionToken)?.connected).toBe(true);
  });

  it('hands VIP to the next connected player when the VIP drops', () => {
    const room = newRoom();
    const a = joinOk(room, 'Anna');
    const b = joinOk(room, 'Béla');
    room.playerDisconnected(a.id, 1000);
    expect(room.vipId).toBe(b.id);
  });

  it('keeps VIP on a lone disconnected player so they get it back', () => {
    const room = newRoom();
    const a = joinOk(room, 'Anna');
    room.playerDisconnected(a.id, 1000);
    expect(room.vipId).toBe(a.id);
    room.resumePlayer(a.id, a.sessionToken);
    expect(room.vipId).toBe(a.id);
  });

  it('removes lobby players only after the grace period', () => {
    const room = newRoom();
    const a = joinOk(room, 'Anna');
    const b = joinOk(room, 'Béla');
    room.playerDisconnected(a.id, 1000);
    expect(room.removeStalePlayers(1000 + 59_999, 60_000)).toBe(false);
    expect(room.removeStalePlayers(1000 + 60_000, 60_000)).toBe(true);
    expect([...room.players.keys()]).toEqual([b.id]);
    expect(room.vipId).toBe(b.id);
  });
});

describe('answering and scoring', () => {
  function roomAtQuestion() {
    const room = newRoom();
    const a = joinOk(room, 'Anna');
    const b = joinOk(room, 'Béla');
    room.enterIntro();
    room.enterVote([{ category: { id: 1, slug: 'x', name: 'Történelem' }, question }]);
    room.enterQuestionRead(question);
    room.openAnswers(10_000);
    return { room, a, b };
  }

  it('scores by server-measured time, minus the phone’s latency', () => {
    const { room, a, b } = roomAtQuestion();
    room.recordLatency(a.id, 200); // 100ms one way
    expect(room.submitAnswer(a.id, 'q1', 0, 10_100).ok).toBe(true); // 0ms after latency credit
    expect(room.submitAnswer(b.id, 'q1', 1, 12_000).ok).toBe(true);
    room.enterReveal(20_000);
    expect(room.picks.find((p) => p.playerId === a.id)).toMatchObject({ correct: true, points: 1000, responseMs: 0 });
    expect(room.picks.find((p) => p.playerId === b.id)).toMatchObject({ correct: false, points: 0 });
    expect(room.standings[0]).toMatchObject({ playerId: a.id, rank: 1, delta: 1000 });
  });

  it('caps the latency credit', () => {
    const { room, a } = roomAtQuestion();
    room.recordLatency(a.id, 5_000);
    expect(a.latencyMs).toBe(150);
  });

  it('does not allow changing an answer or answering a different question', () => {
    const { room, a } = roomAtQuestion();
    expect(room.submitAnswer(a.id, 'other', 0, 10_500)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(room.submitAnswer(a.id, 'q1', 2, 10_500).ok).toBe(true);
    expect(room.submitAnswer(a.id, 'q1', 0, 10_600)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
  });

  it('ties share a rank', () => {
    const { room, a, b } = roomAtQuestion();
    room.submitAnswer(a.id, 'q1', 0, 10_000);
    room.submitAnswer(b.id, 'q1', 0, 10_000);
    room.enterReveal(20_000);
    expect(room.standings.map((s) => s.rank)).toEqual([1, 1]);
    room.enterFinal();
    expect(room.otto?.key).toBe('tie');
  });

  it('counts only connected players when deciding everyone has answered', () => {
    const { room, a, b } = roomAtQuestion();
    room.playerDisconnected(b.id, 10_050);
    room.submitAnswer(a.id, 'q1', 0, 10_100);
    expect(room.allActed()).toBe(true);
  });
});

describe('power plays', () => {
  const option = { category: { id: 1, slug: 'x', name: 'Történelem' }, question };

  /** Three players at the vote of `round` (power plays are handed out in round 2). */
  function roomAtVote(round = 2, players = ['Anna', 'Béla', 'Cili']) {
    const room = newRoom();
    const joined = players.map((n) => joinOk(room, n));
    room.enterIntro();
    for (let r = 1; r <= round; r++) room.enterVote([option]);
    return { room, players: joined };
  }

  function toQuestion(room: Room) {
    room.enterVoteResult(0);
    room.enterQuestionRead(question);
    room.openAnswers(10_000);
  }

  it('hands everyone one in round 2, and none in round 1', () => {
    const early = roomAtVote(1);
    expect(early.room.powers.size).toBe(0);
    expect(early.room.powerState(early.players[0]!.id)).toBe('none');
    const { room, players } = roomAtVote(2);
    expect(room.powers.size).toBe(3);
    expect(room.powerState(players[0]!.id)).toBe('ready');
    expect(room.otto?.key).toBe('powerGranted');
  });

  it('never hands one out in a solo game', () => {
    const { room, players } = roomAtVote(2, ['Anna']);
    expect(room.powers.size).toBe(0);
    expect(room.powerState(players[0]!.id)).toBe('none');
    expect(room.powerVote()).toBe(false);
  });

  it('cannot target yourself, a stranger or someone who is offline', () => {
    const { room, players } = roomAtVote();
    const [a, b, c] = players;
    expect(room.choosePower(a!.id, 'freeze', a!.id)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(room.choosePower(a!.id, 'freeze', 'nobody')).toEqual({ ok: false, error: 'NOT_FOUND' });
    room.playerDisconnected(c!.id, 1_000);
    expect(room.choosePower(a!.id, 'freeze', c!.id)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(room.choosePower(a!.id, 'freeze', b!.id)).toEqual({ ok: true });
    expect(room.hits).toEqual([{ by: a!.id, target: b!.id, power: 'freeze', cleared: false }]);
  });

  it('allows one per round, and only during the vote', () => {
    const { room, players } = roomAtVote();
    const [a, b, c] = players;
    expect(room.choosePower(a!.id, 'freeze', b!.id)).toEqual({ ok: true });
    expect(room.choosePower(a!.id, 'slime', c!.id)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(room.powerState(a!.id)).toBe('used');
    room.enterVoteResult(0);
    expect(room.choosePower(b!.id, 'slime', a!.id)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
  });

  it('keeps a passed power play for a later round, without stacking a second one', () => {
    const { room, players } = roomAtVote();
    const [a, b] = players;
    expect(room.passPower(a!.id)).toEqual({ ok: true });
    expect(room.powerState(a!.id)).toBe('passed');
    toQuestion(room);
    expect(room.powerState(a!.id)).toBe('held');
    room.enterVote([option]); // round 3: nothing new handed out
    expect(room.powerState(a!.id)).toBe('ready');
    expect(room.choosePower(a!.id, 'slime', b!.id)).toEqual({ ok: true });
    expect(room.powers.has(a!.id)).toBe(false);
  });

  it('waits for everyone who can still throw one before ending the vote early', () => {
    const { room, players } = roomAtVote();
    const [a, b, c] = players;
    expect(room.powerVote()).toBe(true);
    for (const p of players) room.castVote(p.id, 0);
    expect(room.allActed()).toBe(false);
    room.choosePower(a!.id, 'freeze', b!.id);
    room.passPower(b!.id);
    expect(room.allActed()).toBe(false);
    room.playerDisconnected(c!.id, 1_000); // gone players are never waited for
    expect(room.allActed()).toBe(true);
  });

  it('blocks the target’s answer until they clear it, and the clock keeps running', () => {
    const { room, players } = roomAtVote();
    const [a, b, c] = players;
    room.choosePower(a!.id, 'freeze', b!.id);
    room.choosePower(c!.id, 'slime', b!.id);
    expect(room.clearPower(b!.id, 'freeze')).toEqual({ ok: false, error: 'NOT_ALLOWED' }); // not before answers open
    toQuestion(room);
    expect(room.submitAnswer(b!.id, 'q1', 0, 11_000)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(room.clearPower(a!.id, 'freeze')).toEqual({ ok: false, error: 'NOT_FOUND' }); // not a's to clear
    expect(room.clearPower(b!.id, 'freeze')).toEqual({ ok: true });
    expect(room.blocked(b!.id)).toBe(true);
    expect(room.clearPower(b!.id, 'slime')).toEqual({ ok: true });
    expect(room.submitAnswer(b!.id, 'q1', 0, 14_000)).toEqual({ ok: true });
    expect(room.answers.get(b!.id)?.responseMs).toBe(4_000);
    expect(room.submitAnswer(a!.id, 'q1', 0, 11_000)).toEqual({ ok: true });
  });

  it('keeps a hit on a target who drops, so it is still there when they come back', () => {
    const { room, players } = roomAtVote();
    const [a, b] = players;
    room.choosePower(a!.id, 'slime', b!.id);
    room.playerDisconnected(b!.id, 1_000);
    toQuestion(room);
    room.resumePlayer(b!.id, b!.sessionToken);
    expect(room.blocked(b!.id)).toBe(true);
    expect(room.clearPower(b!.id, 'slime')).toEqual({ ok: true });
  });

  it('has Otto comment on the hits instead of the category', () => {
    const { room, players } = roomAtVote();
    const [a, b, c] = players;
    room.choosePower(a!.id, 'freeze', c!.id);
    room.choosePower(b!.id, 'slime', c!.id);
    room.enterVoteResult(0);
    expect(room.otto).toMatchObject({ key: 'powerGangUp', focus: [c!.id] });
  });

  it('clears everything for a new game', () => {
    const { room, players } = roomAtVote();
    room.choosePower(players[0]!.id, 'freeze', players[1]!.id);
    room.enterIntro();
    expect(room.powers.size).toBe(0);
    expect(room.hits).toEqual([]);
  });
});
