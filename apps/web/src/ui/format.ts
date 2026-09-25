import { t } from '@trivia/shared';

/** A number the Hungarian way (space between thousands, decimal comma), with its unit if it has one. */
export function withUnit(value: number, unit: string | null): string {
  return unit ? `${t.number(value)} ${unit}` : t.number(value);
}
