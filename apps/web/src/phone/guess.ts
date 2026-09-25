/**
 * Reads a typed guess the way Hungarians write numbers: a space (or a dot)
 * between thousands, a comma before decimals. "1 234,5", "1.234.567", "3,14"
 * and "-12" all work; anything else is null.
 */
export function parseGuess(raw: string): number | null {
  let s = raw.replace(/[\s ]/g, '');
  if (!s) return null;
  if (s.includes(',')) {
    // A comma is the decimal mark; dots are thousands.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" or "1.234.567": dots between thousands.
    s = s.replace(/\./g, '');
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}
