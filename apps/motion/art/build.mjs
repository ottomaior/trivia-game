// Builds the paper-studio art (Ottó, the cast and their expressions, the
// studio set, party-mode props) as standalone SVG files in ../public/art,
// plus an index.html contact sheet, and copies the audio the clips use.
//
// `--out <dir>` writes the SVGs somewhere else (relative to the working
// directory); `--web` writes only the SVGs, for the game (apps/web runs
// `node ../motion/art/build.mjs --web --out public/art`).
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { C, paper } from './paperlib.mjs';
import { ottoReal } from './otto-real.mjs';
import { buildCast6 } from './cast6.mjs';
import { buildParty } from './party.mjs';
import { buildExpressions, EXPRESSIONS } from './expr.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const WEB_ONLY = args.includes('--web');
const OUT = outArg >= 0 && args[outArg + 1] ? resolve(args[outArg + 1]) : join(HERE, '..', 'public', 'art');
const AUDIO = join(HERE, '..', 'public', 'audio');
const WEB = join(HERE, '..', '..', 'web', 'public');
mkdirSync(OUT, { recursive: true });

function svg(name, w, h, defs, body) {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
${defs.join('\n')}
</defs>
${body}
</svg>
`;
  writeFileSync(join(OUT, name), s);
}

/* ---------------- Ottó ---------------- */
{
  const o = ottoReal(C, paper);
  svg('otto.svg', 380, 490, o.defs, o.body);
}

/* ---------------- Gombóc: bored, heavy-lidded ---------------- */
{
  const defs = [paper('gb', { seed: 41 }), paper('gt', { seed: 43, border: 2.5, dy: 2, blur: 2 })];
  svg('gomboc.svg', 220, 220, defs, `<g transform="translate(10 14)">
<g filter="url(#gt)"><path d="M88 34 C80 12 96 2 102 16 C106 2 124 6 116 34 Z" fill="${C.mustardDk}"/></g>
<g filter="url(#gb)">
<path d="M96 28 C140 24 176 56 178 106 C180 154 150 186 104 186 C58 186 24 162 22 118 C20 74 50 32 96 28 Z" fill="${C.mustard}"/>
<path d="M150 58 C174 84 182 128 168 158 C152 182 122 190 98 186 C134 176 160 150 164 112 C166 94 160 74 150 58 Z" fill="${C.mustardDk}" opacity="0.7"/>
<path d="M44 70 C52 56 64 46 78 42" stroke="${C.mustardLt}" stroke-width="7" fill="none" stroke-linecap="round"/>
<ellipse cx="78" cy="100" rx="18" ry="17" fill="#fbf5e6"/>
<ellipse cx="126" cy="98" rx="18" ry="17" fill="#fbf5e6"/>
<circle cx="70" cy="106" r="6.5" fill="${C.ink}"/>
<circle cx="118" cy="104" r="6.5" fill="${C.ink}"/>
<path d="M58 102 C58 80 98 78 98 100 Z" fill="${C.mustardDk}"/>
<path d="M106 100 C106 78 146 76 146 98 Z" fill="${C.mustardDk}"/>
<path d="M58 101 C70 96 88 96 98 99 M106 99 C118 94 136 94 146 97" stroke="${C.ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
<ellipse cx="58" cy="130" rx="11" ry="6" fill="${C.blush}" opacity="0.35"/>
<path d="M80 142 C94 145 108 143 122 136" stroke="${C.ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
<path d="M118 134 L126 140" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>
</g></g>`);
}

/* ---------------- Kocka: anxious nerd ---------------- */
{
  const defs = [paper('kb', { seed: 53 }), paper('kg', { seed: 59, border: 2.5, dy: 2, blur: 2 }), paper('kd', { seed: 61, border: 2.5, dy: 2, blur: 2 })];
  svg('kocka.svg', 220, 220, defs, `<g transform="translate(10 12) rotate(-4 100 110)">
<g filter="url(#kb)">
<path d="M44 40 L156 36 C170 36 176 44 176 58 L178 162 C178 176 170 182 156 182 L48 184 C34 184 26 176 26 162 L24 60 C24 46 32 40 44 40 Z" fill="${C.rust}"/>
<path d="M160 40 C170 42 176 48 176 58 L178 162 C178 176 170 182 156 182 L150 182 C158 176 162 170 162 160 L160 40 Z" fill="${C.rustDk}"/>
<path d="M36 58 C38 50 44 46 54 46" stroke="#cf7456" stroke-width="6" fill="none" stroke-linecap="round"/>
<path d="M52 66 C62 60 76 56 90 56" stroke="#5a2418" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M112 52 C126 52 140 56 152 64" stroke="#5a2418" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M76 138 L132 134 C140 134 142 152 132 154 L78 156 C68 156 68 138 76 138 Z" fill="${C.paper}"/>
<path d="M76 138 L132 134 C140 134 142 152 132 154 L78 156 C68 156 68 138 76 138 Z M90 137 L91 155 M104 136 L105 155 M118 135 L119 154 M72 146 L138 144" stroke="${C.ink}" stroke-width="3" fill="none" stroke-linejoin="round"/>
</g>
<g filter="url(#kg)">
<circle cx="78" cy="98" r="23" fill="#f6f0e0" stroke="${C.ink}" stroke-width="5.5"/>
<circle cx="132" cy="92" r="23" fill="#f6f0e0" stroke="${C.ink}" stroke-width="5.5"/>
<path d="M100 96 C104 90 108 90 110 92" stroke="${C.ink}" stroke-width="5" fill="none" stroke-linecap="round"/>
<circle cx="74" cy="90" r="7" fill="${C.ink}"/>
<circle cx="128" cy="84" r="7" fill="${C.ink}"/>
<circle cx="76" cy="88" r="2" fill="#fbf5e6"/>
<circle cx="130" cy="82" r="2" fill="#fbf5e6"/>
</g>
<g filter="url(#kd)"><path d="M170 58 C176 70 182 78 182 86 C182 94 176 98 170 98 C164 98 158 94 158 86 C158 78 164 70 170 58 Z" fill="${C.ice}"/></g>
</g>`);
}

/* ---------------- Background ---------------- */
{
  const full = 'filterUnits="userSpaceOnUse" x="-40" y="-40" width="1360" height="800"';
  const defs = [
    paper('rays', { seed: 71, border: 0, wobble: 6, freq: 0.02, shadow: 0.35, blur: 5, dx: 0, dy: 3, region: full }),
    paper('arch', { seed: 73, border: 3, wobble: 5, freq: 0.03, region: full }),
    paper('floor', { seed: 79, border: 2.5, wobble: 9, freq: 0.02, shadow: 0.5, blur: 6, dx: 0, dy: -3, region: full }),
    paper('floor2', { seed: 83, border: 2.5, wobble: 9, freq: 0.025, shadow: 0.5, blur: 6, dx: 0, dy: -3, region: full }),
    paper('bulb', { seed: 89, border: 1.8, wobble: 1.5, shadow: 0.3, blur: 1.5, dx: 1, dy: 2, region: full }),
    `<radialGradient id="glow"><stop offset="0" stop-color="#ffd978" stop-opacity="0.75"/><stop offset="1" stop-color="#ffd978" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="light" cx="0.6" cy="0.35" r="0.7"><stop offset="0" stop-color="#ffcf7a" stop-opacity="0.16"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></radialGradient>`,
  ];
  const cx = 775, cy = 300;
  let rays = '';
  for (let i = 0; i < 20; i++) {
    const a0 = (i * 18) * Math.PI / 180, a1 = (i * 18 + 9) * Math.PI / 180, R = 1600;
    rays += `<path d="M${cx} ${cy} L${(cx + R * Math.cos(a0)).toFixed(1)} ${(cy + R * Math.sin(a0)).toFixed(1)} L${(cx + R * Math.cos(a1)).toFixed(1)} ${(cy + R * Math.sin(a1)).toFixed(1)} Z" fill="${C.bgRay}"/>`;
  }
  const ax = 775, ay = 390, ro = 430, ri = 382, rb = 406;
  let bulbs = '', glows = '';
  for (let deg = 180; deg <= 360; deg += 7.5) {
    const a = deg * Math.PI / 180;
    const x = (ax + rb * Math.cos(a)).toFixed(1), y = (ay + rb * Math.sin(a)).toFixed(1);
    glows += `<circle cx="${x}" cy="${y}" r="17" fill="url(#glow)"/>`;
    bulbs += `<circle cx="${x}" cy="${y}" r="7" fill="#fff1c2"/>`;
  }
  const arch = `M${ax - ro} ${ay} A${ro} ${ro} 0 0 1 ${ax + ro} ${ay} L${ax + ri} ${ay} A${ri} ${ri} 0 0 0 ${ax - ri} ${ay} Z`;
  svg('bg.svg', 1280, 720, defs, `<rect width="1280" height="720" fill="${C.bg}"/>
<g filter="url(#rays)">${rays}</g>
<g filter="url(#arch)"><path d="${arch}" fill="${C.mustard}"/><path d="M${ax - ro + 8} ${ay} A${ro - 8} ${ro - 8} 0 0 1 ${ax + ro - 8} ${ay}" stroke="${C.mustardDk}" stroke-width="3" fill="none"/></g>
${glows}
<g filter="url(#bulb)">${bulbs}</g>
<g filter="url(#floor)"><path d="M-20 574 C180 566 420 580 640 570 C860 560 1080 578 1300 566 L1300 740 L-20 740 Z" fill="${C.floor}"/>
<path d="M-20 620 L1300 612 M-20 668 L1300 662" stroke="${C.floor2}" stroke-width="3"/></g>
<g filter="url(#floor2)"><path d="M-20 690 C240 684 520 696 760 688 C1000 680 1160 694 1300 686 L1300 740 L-20 740 Z" fill="${C.floor2}"/></g>
<rect width="1280" height="720" fill="url(#light)"/>`);
}

/* ---------------- Props ---------------- */
{
  const tape = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M-44 -13 L44 -15 L42 -9 L46 -3 L43 3 L45 9 L42 15 L-42 14 L-45 8 L-42 2 L-46 -4 L-42 -9 Z" fill="#eadfae" opacity="0.82"/></g>`;
  svg('card.svg', 980, 220, [paper('cd', { seed: 101, wobble: 4, freq: 0.02, border: 0, shadow: 0.5, blur: 5, dx: 4, dy: 8 }), paper('tp', { seed: 103, border: 0, wobble: 2.5, shadow: 0.15, blur: 1.5, dx: 1, dy: 1 })],
    `<g filter="url(#cd)"><path d="M16 18 L962 12 L966 200 L14 206 Z" fill="${C.cream}"/><path d="M16 18 L962 12 L962 26 L16 30 Z" fill="#fff8e8" opacity="0.5"/></g>
<g filter="url(#tp)">${tape(70, 22, -12)}${tape(910, 18, 9)}</g>`);

  const shapes = {
    a: `<path d="M0 -15 L15 11 L-15 11 Z"/>`,
    b: `<path d="M0 -16 L16 0 L0 16 L-16 0 Z"/>`,
    c: `<circle r="14"/>`,
    d: `<rect x="-13" y="-13" width="26" height="26" rx="2"/>`,
  };
  const tiles = { a: [C.rust, C.rustDk], b: [C.teal, C.tealDk], c: [C.plum, C.plumDk], d: [C.mustard, C.mustardDk] };
  let seed = 111;
  for (const [k, [fill, dk]] of Object.entries(tiles)) {
    svg(`tile-${k}.svg`, 480, 96, [paper('tl', { seed: seed++, wobble: 3.5, freq: 0.03, border: 3 }), paper('bd', { seed: seed++, border: 2, wobble: 2, shadow: 0.3, blur: 1.5, dx: 1, dy: 2 })],
      `<g filter="url(#tl)"><path d="M12 14 L466 10 L468 80 L10 84 Z" fill="${fill}"/><path d="M12 72 L468 68 L468 80 L10 84 Z" fill="${dk}"/></g>
<g filter="url(#bd)"><circle cx="50" cy="46" r="27" fill="${C.paper}"/><g transform="translate(50 47)" fill="${fill}">${shapes[k]}</g></g>`);
  }

  svg('desk.svg', 300, 150, [paper('dk', { seed: 131, wobble: 4, freq: 0.03 }), paper('np', { seed: 137, border: 2, wobble: 2.5, shadow: 0.3, blur: 2, dx: 1, dy: 2 })],
    `<g filter="url(#dk)"><path d="M14 22 L286 18 L290 150 L10 150 Z" fill="#6a2c38"/><path d="M14 22 L286 18 L286 34 L14 38 Z" fill="${C.mustard}"/><path d="M40 60 L40 150 M260 58 L262 150" stroke="#55222c" stroke-width="4"/></g>
<g filter="url(#np)"><path d="M52 56 L248 52 L250 128 L50 132 Z" fill="${C.cream}"/></g>`);

  svg('podium.svg', 270, 220, [paper('pd', { seed: 141, wobble: 4, freq: 0.03 }), paper('pp', { seed: 143, border: 2.5, wobble: 2.5, shadow: 0.3, blur: 2, dx: 1, dy: 2 })],
    `<g filter="url(#pd)"><path d="M28 24 L242 20 L262 220 L8 220 Z" fill="${C.rust}"/><path d="M22 14 L248 10 L250 36 L20 40 Z" fill="${C.mustard}"/><path d="M200 44 L220 44 L236 220 L212 220 Z" fill="${C.rustDk}" opacity="0.7"/></g>
<g filter="url(#pp)"><path d="M58 68 L212 64 L214 142 L56 146 Z" fill="${C.cream}"/></g>`);

  svg('timer.svg', 100, 100, [paper('tm', { seed: 151, border: 3, wobble: 2.5 }), paper('tw', { seed: 157, border: 0, wobble: 2, shadow: 0.2, blur: 1, dx: 0, dy: 1 })],
    `<g filter="url(#tm)"><circle cx="50" cy="48" r="40" fill="${C.cream}"/></g>
<g filter="url(#tw)"><path d="M50 48 L50 14 A34 34 0 1 1 20.6 64.9 Z" fill="${C.mustard}"/></g>
<g filter="url(#tm)"><circle cx="50" cy="48" r="20" fill="${C.cream}"/></g>`);

  svg('chip.svg', 200, 60, [paper('ch', { seed: 161, border: 2.5, wobble: 2.5, freq: 0.04, shadow: 0.35, blur: 2, dx: 1, dy: 3 })],
    `<g filter="url(#ch)"><path d="M10 10 L190 8 L192 50 L8 52 Z" fill="${C.plum}"/></g>`);
  svg('chip-round.svg', 200, 60, [paper('ch', { seed: 167, border: 2.5, wobble: 2.5, freq: 0.04, shadow: 0.35, blur: 2, dx: 1, dy: 3 })],
    `<g filter="url(#ch)"><path d="M10 8 L190 10 L190 52 L10 50 Z" fill="#5a2533"/></g>`);
  svg('check.svg', 64, 64, [paper('ck', { seed: 171, border: 2.5, wobble: 2, shadow: 0.35, blur: 2, dx: 1, dy: 2 })],
    `<g filter="url(#ck)"><circle cx="32" cy="31" r="22" fill="#86a845"/><path d="M21 31 L29 39 L43 23" stroke="${C.paper}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`);
}
buildCast6(C, paper, svg);
buildParty(C, paper, svg);
const chars = buildExpressions(C, paper, svg);
if (!WEB_ONLY) {
  const cols = ['', ...EXPRESSIONS];
  const head = cols.map((c) => '<div class=h>' + (c || 'idle') + '</div>').join('');
  const rows = chars.map((n) => cols.map((c) => '<img src="' + n + (c ? '-' + c : '') + '.svg">').join('')).join('');
  writeFileSync(join(OUT, 'index.html'), '<!doctype html><meta charset=utf-8><style>body{margin:0;background:#2c121a;padding:10px;display:grid;grid-template-columns:repeat(8,150px);gap:4px;font:700 14px Arial;color:#f6eedb}.h{text-align:center}img{width:150px;height:150px}</style>' + head + rows);
}
// Audio for the clips, taken from the game's own recordings.
if (!WEB_ONLY) {
  mkdirSync(AUDIO, { recursive: true });
  for (const [from, to] of [['voice/welcome-1.mp3', 'welcome-1.mp3'], ['audio/start.mp3', 'start.mp3'], ['audio/applause.mp3', 'applause.mp3']]) {
    copyFileSync(join(WEB, from), join(AUDIO, to));
  }
}
console.log('art built in', OUT);
