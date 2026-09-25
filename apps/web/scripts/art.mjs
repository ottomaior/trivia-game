// Builds the game's paper art as bitmaps.
//
// The drawings are generated as SVGs by apps/motion/art/build.mjs, and every
// one of them carries the paper filter (fractal noise, displacement, blur…).
// Browsers evaluate those filters on the CPU each time an image is drawn,
// which a 4K smart TV cannot afford, so this script renders each SVG once,
// here at build time, and the web app ships WebP bitmaps instead:
//
//   apps/motion/art/build.mjs  →  .art/svg/*.svg  →  public/art/*.webp
//
// Unchanged drawings are skipped (a hash per file in .art/raster-manifest.json),
// so a normal `pnpm dev` costs about a second. The manifest's version, a hash
// of every file's key, becomes `__ART_VERSION__` (see vite.config.ts) and is
// appended to every art URL as `?v=`, so the server can cache the bitmaps for
// a year.
//
//   node scripts/art.mjs            build (or refresh) public/art
//   node scripts/art.mjs --sheet    also write .art/sheet.html, the SVGs
//                                   beside their bitmaps, for a parity check
//   node scripts/art.mjs --force    re-render everything

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { availableParallelism } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderAsync } from '@resvg/resvg-js';
import sharp from 'sharp';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATOR = resolve(WEB, '../motion/art/build.mjs');
const WORK = join(WEB, '.art');
const SVG_DIR = join(WORK, 'svg');
const OUT = join(WEB, 'public', 'art');
const MANIFEST = join(WORK, 'raster-manifest.json');
const SHEET = join(WORK, 'sheet.html');

// Bump when the renderer or encoder settings change, so every file re-renders.
const RASTER_VERSION = 1;

// Drawings only the Remotion clips use.
const SKIP = new Set(['otto.svg', 'bg.svg']);

// The two lifeline badges print "50:50" (the SVG asks for Arial). A bundled
// TTF keeps Windows and the Linux build pixel-identical.
const FONT = createRequire(import.meta.url).resolve('@expo-google-fonts/archivo/700Bold/Archivo_700Bold.ttf');

const WEBP = { quality: 85, alphaQuality: 100, effort: 4 };

/**
 * How many bitmap pixels per SVG unit. Sized so every drawing is at least as
 * big as its largest use on a 4K TV (1em = 40px) or a DPR-3 phone, without
 * going far past it: the paper grain is noise and does not compress.
 */
function scaleFor(name, w, h) {
  if (w === 220 && h === 220) return 2.5; // the cast, drawn up to ~380px
  if (name.startsWith('otto-')) return 3; // Ottó's rig, ~1040px wide
  if (name === 'bg-rays') return 1.5; // the sunburst, far larger than the screen; soft anyway
  if (name === 'bg-arch') return 3;
  if (name === 'bg-floor') return 2;
  const m = Math.max(w, h);
  if (m >= 600) return 2.5; // wide cards and tapes
  if (m >= 200) return 3; // panels, tiles, desks, props
  return 4; // badges and small props
}

const args = new Set(process.argv.slice(2));
const force = args.has('--force');

function log(msg) {
  process.stdout.write(`[art] ${msg}\n`);
}

function runGenerator() {
  mkdirSync(SVG_DIR, { recursive: true });
  execFileSync(process.execPath, [GENERATOR, '--web', '--out', SVG_DIR], { cwd: WEB, stdio: 'inherit' });
}

function readSvgs() {
  const files = [];
  for (const file of readdirSync(SVG_DIR).sort()) {
    if (!file.endsWith('.svg') || SKIP.has(file)) continue;
    const text = readFileSync(join(SVG_DIR, file), 'utf8');
    const box = /viewBox="0 0 (\d+) (\d+)"/.exec(text);
    if (!box) throw new Error(`${file}: no viewBox`);
    const w = Number(box[1]);
    const h = Number(box[2]);
    const name = file.slice(0, -4);
    const scale = scaleFor(name, w, h);
    const key = createHash('sha1').update(`${RASTER_VERSION}|${scale}|${text}`).digest('hex');
    files.push({ name, text, w, h, scale, key });
  }
  return files;
}

function loadManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8'));
  } catch {
    return { version: '', files: {} };
  }
}

async function rasterise(file) {
  // resvg's displacement map panics at some fractional zooms (its source and
  // noise map round to different sizes), so render at the next whole number
  // and let sharp bring the bitmap down to the size we want.
  const zoom = Math.ceil(file.scale);
  const image = await renderAsync(file.text, {
    fitTo: { mode: 'zoom', value: zoom },
    font: { loadSystemFonts: false, fontFiles: [FONT], defaultFontFamily: 'Archivo', sansSerifFamily: 'Archivo' },
  });
  const out = join(OUT, `${file.name}.webp`);
  let pipeline = sharp(image.asPng());
  if (zoom !== file.scale) pipeline = pipeline.resize(Math.round(file.w * file.scale), Math.round(file.h * file.scale), { kernel: 'lanczos3' });
  await pipeline.webp(WEBP).toFile(out);
  return statSync(out).size;
}

/** Runs `fn` over `items` with at most `n` in flight. */
async function pool(items, n, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}

function writeSheet(files) {
  const bigRow = [
    ['gomboc-correct', 380],
    ['otto-head', 1040],
    ['opt-0', 1600],
    ['life-fifty', 160],
    ['bg-rays', 3840],
  ];
  const cell = (f, width) => {
    const w = width ?? f.w;
    const h = Math.round((w * f.h) / f.w);
    return `<figure><figcaption>${f.name} ${f.w}×${f.h} ×${f.scale}</figcaption>
<img src="svg/${f.name}.svg" width="${w}" height="${h}"><img src="/art/${f.name}.webp" width="${w}" height="${h}"></figure>`;
  };
  const byName = new Map(files.map((f) => [f.name, f]));
  const html = `<!doctype html><meta charset="utf-8"><title>Paper art: SVG beside WebP</title>
<style>body{background:#2c121a;color:#f3e7cf;font:14px system-ui;margin:16px}figure{display:inline-block;margin:8px;vertical-align:top}figcaption{margin-bottom:4px}img{margin-right:8px;background:#0002;vertical-align:top}</style>
<h1>Left: the SVG (filters run in the browser). Right: the WebP the game ships.</h1>
<h2>At real 4K display sizes</h2>
${bigRow.map(([n, w]) => (byName.has(n) ? cell(byName.get(n), w) : '')).join('\n')}
<h2>Everything, at the drawing's own size</h2>
${files.map((f) => cell(f)).join('\n')}
`;
  writeFileSync(SHEET, html);
}

async function main() {
  const started = Date.now();
  runGenerator();
  mkdirSync(OUT, { recursive: true });
  const files = readSvgs();
  const before = loadManifest();
  const wanted = new Set(files.map((f) => `${f.name}.webp`));

  // Anything else in public/art is stale (an old bitmap, or the SVGs from before).
  for (const entry of readdirSync(OUT)) {
    if (!wanted.has(entry)) rmSync(join(OUT, entry), { recursive: true, force: true });
  }

  const todo = files.filter((f) => force || before.files[f.name]?.key !== f.key || !existsSync(join(OUT, `${f.name}.webp`)));
  let bytes = 0;
  await pool(todo, availableParallelism(), async (f) => {
    bytes += await rasterise(f);
  });

  const manifest = {
    version: createHash('sha1')
      .update(files.map((f) => f.key).join('\n'))
      .digest('hex')
      .slice(0, 12),
    files: Object.fromEntries(files.map((f) => [f.name, { key: f.key, w: f.w, h: f.h, scale: f.scale }])),
  };
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  if (args.has('--sheet')) {
    writeSheet(files);
    log(`sheet: ${SHEET}`);
  }
  const total = readdirSync(OUT).reduce((sum, entry) => sum + statSync(join(OUT, entry)).size, 0);
  log(
    `${files.length} drawings, ${todo.length} rendered (${(bytes / 1e6).toFixed(1)} MB), ${files.length - todo.length} unchanged; ` +
      `public/art is ${(total / 1e6).toFixed(1)} MB; version ${manifest.version}; ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
