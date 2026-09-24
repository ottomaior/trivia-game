import { GAME_MODES, type GameMode, type PackOption } from '@trivia/shared';
import { z } from 'zod';
import categoriesJson from '../../seed/categories.json' with { type: 'json' };
import packsJson from '../../seed/packs.json' with { type: 'json' };
import type { Category, CategoryCount } from './types.ts';

// Question packs: named sets of categories the lobby votes on. They are
// content, like the seed questions, so they live in seed/packs.json rather
// than the database.

const packsSchema = z.array(
  z.object({
    slug: z.string().min(1).max(40),
    name: z.string().min(1),
    description: z.string().min(1),
    mode: z.enum(GAME_MODES),
    /** Category slugs, or "*" for every category. */
    categories: z.union([z.array(z.string().min(1)).min(1), z.literal('*')]),
  }),
);

export type PackDef = z.infer<typeof packsSchema>[number];

export interface PackCategoryOffer extends Category {
  questions: number;
}

/** A pack that has enough questions to play right now. */
export interface PackOffer {
  slug: string;
  name: string;
  description: string;
  mode: GameMode;
  categories: PackCategoryOffer[];
  questions: number;
}

/** Validates the bundled pack file against the category list; throws with a precise message if broken. */
export function loadPacks(raw: unknown = packsJson, categorySlugs: string[] = categoriesJson.map((c) => c.slug)): PackDef[] {
  const packs = packsSchema.parse(raw);
  const known = new Set(categorySlugs);
  const slugs = new Set<string>();
  for (const p of packs) {
    if (slugs.has(p.slug)) throw new Error(`Pack "${p.slug}" is defined twice`);
    slugs.add(p.slug);
    if (p.categories === '*') continue;
    for (const c of p.categories) if (!known.has(c)) throw new Error(`Pack "${p.slug}": unknown category "${c}"`);
    if (new Set(p.categories).size !== p.categories.length) throw new Error(`Pack "${p.slug}" lists a category twice`);
  }
  return packs;
}

/** The packs worth offering: empty categories dropped, packs under `min` questions left out. */
export function buildOffers(packs: PackDef[], counts: CategoryCount[], min: number): PackOffer[] {
  const bySlug = new Map(counts.map((c) => [c.slug, c]));
  return packs.flatMap((p) => {
    const slugs = p.categories === '*' ? counts.map((c) => c.slug) : p.categories;
    const categories = slugs.flatMap((slug) => {
      const c = bySlug.get(slug);
      const questions = c ? c.counts.reduce((a, b) => a + b, 0) : 0;
      return c && questions > 0 ? [{ id: c.id, slug: c.slug, name: c.name, questions }] : [];
    });
    const questions = categories.reduce((a, c) => a + c.questions, 0);
    if (questions < min) return [];
    return [{ slug: p.slug, name: p.name, description: p.description, mode: p.mode, categories, questions }];
  });
}

export function packOption(offer: PackOffer): PackOption {
  return {
    slug: offer.slug,
    name: offer.name,
    description: offer.description,
    categories: offer.categories.length,
    questions: offer.questions,
  };
}
