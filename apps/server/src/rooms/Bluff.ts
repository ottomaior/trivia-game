import { BLUFF_LIE_MAX_CHARS, BLUFF_MIN_OPTIONS, type BluffOption, type ErrorCode } from '@trivia/shared';
import { normalizeText } from '../content/normalize.ts';
import { tooCloseToTruth } from '../content/seed.ts';
import { shuffle, type Rng } from '../content/select.ts';
import type { BluffQuestion } from '../content/types.ts';

type Result = { ok: true } | { ok: false; error: ErrorCode };

interface Option {
  text: string;
  truth: boolean;
  /** Players whose lie this is (several when they wrote the same thing); none for the truth and the house's lies. */
  authors: string[];
}

/** What one player's round came to. */
export interface BluffOutcome {
  playerId: string;
  /** The option picked, or null. */
  choice: number | null;
  foundTruth: boolean;
  /** How many players fell for this player's lie. */
  fooled: number;
  responseMs: number | null;
}

/**
 * Blöffölő: everyone writes a believable lie for the blank, then picks the
 * truth from among everyone's lies. Identical lies merge into one option
 * with several authors; too few lies get padded with the house's own.
 * Pure rules, like LadderGame: the room feeds in actions and reads back
 * the outcome.
 */
export class BluffGame {
  private question: BluffQuestion | null = null;
  private readonly lies = new Map<string, string>();
  private opts: Option[] = [];
  private readonly picks = new Map<string, { option: number; responseMs: number }>();

  constructor(private readonly rng: Rng) {}

  startRound(q: BluffQuestion): void {
    this.question = q;
    this.lies.clear();
    this.opts = [];
    this.picks.clear();
  }

  /** A lie is refused when it is (nearly) the truth: the player has to write another. */
  write(playerId: string, raw: string): Result {
    const q = this.question;
    if (!q || this.opts.length > 0) return { ok: false, error: 'NOT_ALLOWED' };
    if (this.lies.has(playerId)) return { ok: false, error: 'NOT_ALLOWED' };
    const text = raw.trim().replace(/\s+/g, ' ');
    if (!text || text.length > BLUFF_LIE_MAX_CHARS) return { ok: false, error: 'BAD_REQUEST' };
    if (tooCloseToTruth(text, [q.answer, ...q.alternates])) return { ok: false, error: 'TOO_CLOSE' };
    this.lies.set(playerId, text);
    return { ok: true };
  }

  lieOf(playerId: string): string | null {
    return this.lies.get(playerId) ?? null;
  }

  /** Who has written a lie so far. */
  written(): string[] {
    return [...this.lies.keys()];
  }

  /** Mixes the lies with the truth (and the house's lies, if there are too few) for picking. */
  buildOptions(): void {
    const q = this.question;
    if (!q) throw new Error('no bluff question');
    const byText = new Map<string, Option>();
    for (const [id, text] of this.lies) {
      const key = normalizeText(text);
      const same = byText.get(key);
      if (same) same.authors.push(id);
      else byText.set(key, { text, truth: false, authors: [id] });
    }
    const options = [...byText.values(), { text: q.answer, truth: true, authors: [] }];
    for (const decoy of q.decoys) {
      if (options.length >= BLUFF_MIN_OPTIONS) break;
      if (!byText.has(normalizeText(decoy))) options.push({ text: decoy, truth: false, authors: [] });
    }
    this.opts = shuffle(options, this.rng);
  }

  /** The options' texts, in the order shown; who wrote what stays secret until the reveal. */
  options(): string[] {
    return this.opts.map((o) => o.text);
  }

  /** Picks an option; your own lie doesn't count. */
  pick(playerId: string, option: number, responseMs: number): Result {
    if (this.opts.length === 0 || this.picks.has(playerId)) return { ok: false, error: 'NOT_ALLOWED' };
    const o = this.opts[option];
    if (!o) return { ok: false, error: 'BAD_REQUEST' };
    if (o.authors.includes(playerId)) return { ok: false, error: 'NOT_ALLOWED' };
    this.picks.set(playerId, { option, responseMs });
    return { ok: true };
  }

  pickOf(playerId: string): number | null {
    return this.picks.get(playerId)?.option ?? null;
  }

  /** Who has picked so far. */
  picked(): string[] {
    return [...this.picks.keys()];
  }

  /** Who picked what, whose lies fooled whom. */
  settle(playerIds: string[]): { options: BluffOption[]; outcomes: BluffOutcome[] } {
    const pickers = (i: number) => [...this.picks].filter(([, p]) => p.option === i).map(([id]) => id);
    const options = this.opts.map((o, i) => ({ text: o.text, truth: o.truth, authors: [...o.authors], pickers: pickers(i) }));
    const outcomes = playerIds.map((id) => {
      const p = this.picks.get(id);
      const fooled = options.filter((o) => o.authors.includes(id)).reduce((n, o) => n + o.pickers.length, 0);
      return {
        playerId: id,
        choice: p?.option ?? null,
        foundTruth: p !== undefined && options[p.option]!.truth,
        fooled,
        responseMs: p?.responseMs ?? null,
      };
    });
    return { options, outcomes };
  }
}
