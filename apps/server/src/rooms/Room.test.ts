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

describe('question packs', () => {
  const cat = (id: number, questions: number) => ({ id, slug: `c${id}`, name: `Kategória ${id}`, questions });
  const offer = (slug: string, categories: ReturnType<typeof cat>[]) => ({
    slug,
    name: slug.toUpperCase(),
    description: '',
    mode: 'classic' as const,
    categories,
    questions: categories.reduce((n, c) => n + c.questions, 0),
  });

  function lobbyWithOffers() {
    const room = newRoom();
    const a = joinOk(room, 'Anna');
    const b = joinOk(room, 'Béla');
    const c = joinOk(room, 'Cili');
    room.setPackOffers([offer('alap', [cat(1, 20), cat(2, 20)]), offer('pop', [cat(3, 20), cat(4, 20), cat(5, 20)])]);
    return { room, a, b, c };
  }

  it('lets anyone vote and change their vote, but only for an offered pack', () => {
    const { room, a, b } = lobbyWithOffers();
    expect(room.votePack(a.id, 'pop')).toEqual({ ok: true });
    expect(room.votePack(b.id, 'alap')).toEqual({ ok: true });
    expect(room.votePack(b.id, 'pop')).toEqual({ ok: true });
    expect(room.votePack(b.id, 'nincs')).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(Object.fromEntries(room.currentPackVotes())).toEqual({ [a.id]: 'pop', [b.id]: 'pop' });
  });

  it('locks the most voted pack with every category on, and only the VIP may', () => {
    const { room, a, b, c } = lobbyWithOffers();
    room.votePack(a.id, 'alap');
    room.votePack(b.id, 'pop');
    room.votePack(c.id, 'pop');
    expect(room.lockPack(b.id)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(room.lockPack(a.id)).toEqual({ ok: true });
    expect(room.pack?.slug).toBe('pop');
    expect([...room.enabledCategories]).toEqual([3, 4, 5]);
    expect(room.votePack(a.id, 'alap')).toEqual({ ok: false, error: 'NOT_ALLOWED' });
  });

  it('plays the first pack when nobody voted, and ignores votes of kicked players', () => {
    const { room, a, b } = lobbyWithOffers();
    room.votePack(b.id, 'pop');
    room.kick(a.id, b.id);
    expect(room.lockPack(a.id)).toEqual({ ok: true });
    expect(room.pack?.slug).toBe('alap');
  });

  it('cannot lock before the offers arrive', () => {
    const room = newRoom();
    const a = joinOk(room, 'Anna');
    expect(room.lockPack(a.id)).toEqual({ ok: false, error: 'NO_QUESTIONS' });
    room.setPackOffers([]);
    expect(room.lockPack(a.id)).toEqual({ ok: false, error: 'NO_QUESTIONS' });
  });

  it('lets the VIP switch categories off while enough questions stay on', () => {
    const { room, a, b } = lobbyWithOffers();
    room.votePack(a.id, 'pop');
    room.lockPack(a.id);
    expect(room.setCategory(b.id, 3, false)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(room.setCategory(a.id, 1, false)).toEqual({ ok: false, error: 'BAD_REQUEST' }); // not in this pack
    expect(room.setCategory(a.id, 3, false)).toEqual({ ok: true });
    expect(room.setCategory(a.id, 4, false)).toEqual({ ok: false, error: 'TOO_FEW_QUESTIONS' }); // 20 left
    expect(room.setCategory(a.id, 3, true)).toEqual({ ok: true });
    expect(room.settings()).toEqual({ mode: 'classic', pack: 'pop', categories: ['c3', 'c4', 'c5'] });
  });

  it('starts only from the setup step, and going back reopens the vote with the votes kept', () => {
    const { room, a } = lobbyWithOffers();
    room.votePack(a.id, 'pop');
    expect(room.canStart(a.id)).toEqual({ ok: false, error: 'NO_QUESTIONS' });
    room.lockPack(a.id);
    expect(room.canStart(a.id)).toEqual({ ok: true });
    expect(room.backToPacks(a.id)).toEqual({ ok: true });
    expect(room.lobbyStep).toBe('packs');
    expect(room.pack).toBeNull();
    expect(room.currentPackVotes().get(a.id)).toBe('pop');
    expect(room.canStart(a.id)).toEqual({ ok: false, error: 'NO_QUESTIONS' });
  });

  it('keeps the pack for play again, and a new lobby starts the vote over', () => {
    const { room, a } = lobbyWithOffers();
    room.votePack(a.id, 'pop');
    room.lockPack(a.id);
    room.enterIntro();
    room.enterFinal();
    expect(room.canStart(a.id)).toEqual({ ok: true });
    room.enterLobby();
    expect(room.lobbyStep).toBe('packs');
    expect(room.pack).toBeNull();
    expect(room.currentPackVotes().size).toBe(0);
  });
});
