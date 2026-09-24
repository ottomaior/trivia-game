import type { Lang } from '../rules.ts';
import { en, type Strings } from './en.ts';
import { hu } from './hu.ts';

const dictionaries: Record<Lang, Strings> = { en, hu };

export function strings(lang: Lang): Strings {
  return dictionaries[lang];
}

export type { Strings };
