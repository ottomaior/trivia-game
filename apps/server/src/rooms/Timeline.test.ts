import { TIMELINE_ITEM_POINTS, TIMELINE_SPEED_BONUS } from '@trivia/shared';
import { describe, expect, it } from 'vitest';
import type { TimelineQuestion } from '../content/types.ts';
import { seededRng } from '../testing.ts';
import { TimelineGame } from './Timeline.ts';

const question: TimelineQuestion = {
  kind: 'timeline',
  id: 't1',
  categoryId: 1,
  category: 'Filmes univerzumok',
  difficulty: 2,
  prompt: 'Tedd időrendbe a Harry Potter-filmeket!',
  items: [
    { text: 'A bölcsek köve', year: 2001 },
    { text: 'Az azkabani fogoly', year: 2004 },
    { text: 'A Félvér Herceg', year: 2009 },
    { text: 'A Halál ereklyéi 2.', year: 2011 },
    { text: 'Legendás állatok', year: 2016 },
  ],
  explanation: null,
};

function game(seed = 1) {
  const g = new TimelineGame(seededRng(seed));
  g.startRound(question);
  return g;
}

describe('TimelineGame', () => {
  it('never shows the items already in order, and maps the answer back to them', () => {
    for (let seed = 1; seed < 40; seed++) {
      const g = game(seed);
      const shown = g.displayItems();
      expect(shown).not.toEqual(question.items.map((it) => it.text));
      expect(g.correctOrder().map((i) => shown[i])).toEqual(question.items.map((it) => it.text));
    }
    expect(game().years()).toEqual([2001, 2004, 2009, 2011, 2016]);
  });

  it('accepts one permutation per player', () => {
    const g = game();
    expect(g.submit('a', [0, 1, 2, 3], 1000)).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(g.submit('a', [0, 0, 1, 2, 3], 1000)).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(g.submit('a', [4, 3, 2, 1, 0], 1000)).toEqual({ ok: true });
    expect(g.submit('a', [0, 1, 2, 3, 4], 1000)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(g.orderOf('a')).toEqual([4, 3, 2, 1, 0]);
    expect(g.submitted()).toEqual(['a']);
  });

  it('scores each item in place, and a speed bonus only for a perfect order', () => {
    const g = game();
    const right = g.correctOrder();
    const threeRight = [right[0]!, right[1]!, right[2]!, right[4]!, right[3]!];
    g.submit('a', right, 0);
    g.submit('b', threeRight, 0);
    const [a, b, c] = g.settle(['a', 'b', 'c'], 10_000);
    expect(a).toMatchObject({ rightSlots: 5, allRight: true, points: 5 * TIMELINE_ITEM_POINTS + TIMELINE_SPEED_BONUS });
    expect(b).toMatchObject({ rightSlots: 3, allRight: false, points: 3 * TIMELINE_ITEM_POINTS });
    expect(c).toMatchObject({ order: null, rightSlots: 0, points: 0 });
  });
});
