import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Every paper drawing reaches the browser as a bitmap from scripts/art.mjs;
// an SVG would make the TV run the paper filters itself.

const SRC = join(import.meta.dirname, '..');
const SVG_DIR = join(SRC, '..', '.art', 'svg');

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (/\.(tsx?|css)$/.test(entry) && !entry.endsWith('.test.ts')) yield path;
  }
}

describe('paper art references', () => {
  const sources = [...sourceFiles(SRC)].map((path) => ({ path, text: readFileSync(path, 'utf8') }));

  it('never point at an SVG', () => {
    const offenders = sources.filter((s) => /\/art\/[^'"`)]*\.svg/.test(s.text)).map((s) => s.path);
    expect(offenders).toEqual([]);
  });

  it('name drawings the generator produces', () => {
    if (!existsSync(SVG_DIR)) return; // `pnpm art` has not run in this checkout
    const generated = new Set(readdirSync(SVG_DIR).map((f) => f.replace(/\.svg$/, '')));
    const named = new Set<string>();
    for (const { text } of sources) {
      for (const m of text.matchAll(/art\('([\w-]+)'\)/g)) named.add(m[1]!);
      for (const m of text.matchAll(/\/art\/([\w-]+)\.webp/g)) named.add(m[1]!);
    }
    expect(named.size).toBeGreaterThan(20);
    expect([...named].filter((n) => !generated.has(n))).toEqual([]);
  });
});
