import { describe, expect, it } from 'vitest';
import type { BluffQuestion } from '../content/types.ts';
import { seededRng } from '../testing.ts';
import { BluffGame } from './Bluff.ts';

const question: BluffQuestion = {
  kind: 'bluff',
  id: 'b1',
  categoryId: 1,
  category: 'Állatvilág',
  difficulty: 2,
  prompt: 'A vombat ____ alakú ürüléket hagy maga után.',
  answer: 'kocka',
  alternates: ['kocka alakú', 'kockás'],
  decoys: ['csillag', 'spirál'],
  explanation: null,
};

function game() {
  const g = new BluffGame(seededRng());
  g.startRound(question);
  return g;
}

/** The index of the option with this text. */
const at = (g: BluffGame, text: string) => g.options().indexOf(text);

describe('BluffGame: writing', () => {
  it('refuses the truth, however it is spelled', () => {
    const g = game();
    expect(g.write('a', 'Kocka')).toEqual({ ok: false, error: 'TOO_CLOSE' });
    expect(g.write('a', '  KÓCKA!  ')).toEqual({ ok: false, error: 'TOO_CLOSE' });
    expect(g.write('a', 'kocka alakú')).toEqual({ ok: false, error: 'TOO_CLOSE' });
    expect(g.write('a', 'kockák')).toEqual({ ok: false, error: 'TOO_CLOSE' });
    expect(g.written()).toEqual([]);
    expect(g.write('a', 'gömb')).toEqual({ ok: true });
  });

  it('takes one lie per player, trimmed, and none once picking has started', () => {
    const g = game();
    expect(g.write('a', '  henger   alakú ')).toEqual({ ok: true });
    expect(g.lieOf('a')).toBe('henger alakú');
    expect(g.write('a', 'gúla')).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(g.write('b', '   ')).toEqual({ ok: false, error: 'BAD_REQUEST' });
    g.buildOptions();
    expect(g.write('b', 'gúla')).toEqual({ ok: false, error: 'NOT_ALLOWED' });
  });
});

describe('BluffGame: options', () => {
  it('pads a small round with the house lies, up to four options', () => {
    const g = game();
    g.write('a', 'gömb');
    g.buildOptions();
    expect([...g.options()].sort()).toEqual(['csillag', 'gömb', 'kocka', 'spirál']);
  });

  it('merges identical lies into one option with both authors', () => {
    const g = game();
    g.write('a', 'Gömb');
    g.write('b', 'gömb!');
    g.write('c', 'henger');
    g.write('d', 'gúla');
    g.buildOptions();
    expect(g.options()).toHaveLength(4); // two lies + henger + gúla… plus the truth, minus the merge
    expect(g.options()).toContain('kocka');
    const { options } = g.settle(['a', 'b', 'c', 'd']);
    expect(options.find((o) => o.text === 'Gömb')?.authors).toEqual(['a', 'b']);
  });

  it('skips a house lie a player already wrote', () => {
    const g = game();
    g.write('a', 'Csillag');
    g.buildOptions();
    expect(g.options().filter((o) => o.toLowerCase() === 'csillag')).toHaveLength(1);
    expect(g.options()).toContain('spirál');
  });
});

describe('BluffGame: picking and scoring', () => {
  it('won’t let you pick your own lie, and takes one pick each', () => {
    const g = game();
    g.write('a', 'gömb');
    g.write('b', 'henger');
    g.buildOptions();
    expect(g.pick('a', at(g, 'gömb'), 1000)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(g.pick('a', 99, 1000)).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(g.pick('a', at(g, 'henger'), 1000)).toEqual({ ok: true });
    expect(g.pick('a', at(g, 'kocka'), 1000)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(g.picked()).toEqual(['a']);
  });

  it('credits the truth to its finders and every victim to each author of the lie', () => {
    const g = game();
    g.write('a', 'gömb');
    g.write('b', 'gömb');
    g.write('c', 'henger');
    g.buildOptions();
    g.pick('a', at(g, 'kocka'), 1000);
    g.pick('b', at(g, 'henger'), 2000);
    g.pick('c', at(g, 'gömb'), 3000);
    const { outcomes, options } = g.settle(['a', 'b', 'c', 'd']);
    const by = Object.fromEntries(outcomes.map((o) => [o.playerId, o]));
    expect(by.a).toMatchObject({ foundTruth: true, fooled: 1, responseMs: 1000 }); // c fell for the shared "gömb"
    expect(by.b).toMatchObject({ foundTruth: false, fooled: 1 });
    expect(by.c).toMatchObject({ foundTruth: false, fooled: 1 });
    expect(by.d).toMatchObject({ choice: null, foundTruth: false, fooled: 0, responseMs: null });
    expect(options.find((o) => o.truth)).toMatchObject({ text: 'kocka', authors: [], pickers: ['a'] });
  });
});
