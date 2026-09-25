// Pieces for the live studio in the game: Ottó's rig as one file per layer
// (the web app stacks them as images and moves them with CSS at the pivots),
// and the studio backdrop split into layers the camera can move past.
import { backFore, backUpper, frontArm, headLayers, neck, ottoDefs, ottoLayerDefs, torso } from './otto-rig.mjs';

/** Ottó's layers, in draw order (back to front). Every file is 380x490, in rig space. */
export const OTTO_LAYERS = {
  'back-upper': backUpper,
  'back-fore': backFore,
  neck,
  torso,
  head: headLayers.face,
  mouth: headLayers.mouth,
  stache: headLayers.stache,
  lids: headLayers.lids,
  'front-arm': frontArm,
};

/** Layers that redraw their edges ("boil") in the full studio: three versions each. */
export const BOILING = ['torso', 'head', 'front-arm'];

export function buildOttoParts(svg) {
  for (const [name, body] of Object.entries(OTTO_LAYERS)) {
    const versions = BOILING.includes(name) ? [0, 1, 2] : [0];
    for (const boil of versions) {
      svg(`otto-${name}${boil ? `-${boil}` : ''}.svg`, 380, 490, [ottoDefs(boil), ottoLayerDefs(boil)], body);
    }
  }
}

/**
 * The backdrop as layers: the sunburst (a square that can spin), the arch of
 * bulbs (transparent around it), and the floor. Same drawing as bg.svg.
 */
export function buildSet(C, paper, svg) {
  // Sunburst: 20 rays from the centre of a 1600 square.
  {
    const full = 'filterUnits="userSpaceOnUse" x="-40" y="-40" width="1680" height="1680"';
    const cx = 800, cy = 800, R = 1150;
    let rays = '';
    for (let i = 0; i < 20; i++) {
      const a0 = (i * 18) * Math.PI / 180, a1 = (i * 18 + 9) * Math.PI / 180;
      rays += `<path d="M${cx} ${cy} L${(cx + R * Math.cos(a0)).toFixed(1)} ${(cy + R * Math.sin(a0)).toFixed(1)} L${(cx + R * Math.cos(a1)).toFixed(1)} ${(cy + R * Math.sin(a1)).toFixed(1)} Z" fill="${C.bgRay}"/>`;
    }
    svg('bg-rays.svg', 1600, 1600, [paper('rays', { seed: 71, border: 0, wobble: 6, freq: 0.02, shadow: 0.35, blur: 5, dx: 0, dy: 3, region: full })],
      `<rect width="1600" height="1600" fill="${C.bg}"/><g filter="url(#rays)">${rays}</g>`);
  }

  // Arch of bulbs: a mustard half-ring with 25 lit bulbs, 1000x520.
  {
    const full = 'filterUnits="userSpaceOnUse" x="-20" y="-20" width="1040" height="560"';
    const ax = 500, ay = 480, ro = 460, ri = 410, rb = 435;
    let bulbs = '', glows = '';
    for (let deg = 180; deg <= 360; deg += 7.5) {
      const a = deg * Math.PI / 180;
      const x = (ax + rb * Math.cos(a)).toFixed(1), y = (ay + rb * Math.sin(a)).toFixed(1);
      glows += `<circle cx="${x}" cy="${y}" r="18" fill="url(#glow)"/>`;
      bulbs += `<circle cx="${x}" cy="${y}" r="7.5" fill="#fff1c2"/>`;
    }
    const arch = `M${ax - ro} ${ay} A${ro} ${ro} 0 0 1 ${ax + ro} ${ay} L${ax + ri} ${ay} A${ri} ${ri} 0 0 0 ${ax - ri} ${ay} Z`;
    svg('bg-arch.svg', 1000, 520, [
      paper('arch', { seed: 73, border: 3, wobble: 5, freq: 0.03, region: full }),
      paper('bulb', { seed: 89, border: 1.8, wobble: 1.5, shadow: 0.3, blur: 1.5, dx: 1, dy: 2, region: full }),
      `<radialGradient id="glow"><stop offset="0" stop-color="#ffd978" stop-opacity="0.75"/><stop offset="1" stop-color="#ffd978" stop-opacity="0"/></radialGradient>`,
    ], `<g filter="url(#arch)"><path d="${arch}" fill="${C.mustard}"/><path d="M${ax - ro + 8} ${ay} A${ro - 8} ${ro - 8} 0 0 1 ${ax + ro - 8} ${ay}" stroke="${C.mustardDk}" stroke-width="3" fill="none"/></g>
${glows}
<g filter="url(#bulb)">${bulbs}</g>`);
  }

  // Floor: two torn strips, 1400x200 (wider than the screen, for camera moves).
  {
    const full = 'filterUnits="userSpaceOnUse" x="-40" y="-40" width="1480" height="280"';
    svg('bg-floor.svg', 1400, 200, [
      paper('floor', { seed: 79, border: 2.5, wobble: 9, freq: 0.02, shadow: 0.5, blur: 6, dx: 0, dy: -3, region: full }),
      paper('floor2', { seed: 83, border: 2.5, wobble: 9, freq: 0.025, shadow: 0.5, blur: 6, dx: 0, dy: -3, region: full }),
    ], `<g filter="url(#floor)"><path d="M-20 14 C200 6 460 20 700 10 C940 0 1180 18 1420 6 L1420 220 L-20 220 Z" fill="${C.floor}"/>
<path d="M-20 60 L1420 52 M-20 108 L1420 102" stroke="${C.floor2}" stroke-width="3"/></g>
<g filter="url(#floor2)"><path d="M-20 130 C260 124 560 136 820 128 C1080 120 1260 134 1420 126 L1420 220 L-20 220 Z" fill="${C.floor2}"/></g>`);
  }
}

/** The eight option colours (fill, darker strip), in the order the game uses them. */
export const OPTION_COLOURS = (C) => [
  [C.rust, C.rustDk], [C.teal, C.tealDk], [C.plum, C.plumDk], [C.mustard, C.mustardDk],
  [C.ice, '#7eaab0'], [C.cream, '#d6c6a4'], ['#8fb04a', '#6f8f36'], ['#d98a8f', '#b86a72'],
];

/**
 * Paper panels for the boards, in the eight option colours: `opt-<n>` wide
 * tiles (600x90) for answers and options, and `panel-<n>` cards (300x200) for
 * the category vote and the party cards. Plus `badge.svg`, the round paper
 * disc a tile's shape or letter sits on (kept separate so it stays round on
 * tiles of any width).
 */
export function buildPanels(C, paper, svg) {
  OPTION_COLOURS(C).forEach(([fill, dk], n) => {
    svg(`opt-${n}.svg`, 600, 90, [paper('tl', { seed: 401 + n, wobble: 3.5, freq: 0.03, border: 3 })],
      `<g filter="url(#tl)"><path d="M12 12 L586 9 L588 76 L10 79 Z" fill="${fill}"/><path d="M11 67 L588 64 L588 76 L10 79 Z" fill="${dk}"/></g>`);
    svg(`panel-${n}.svg`, 300, 200, [paper('pn', { seed: 441 + n, wobble: 3.5, freq: 0.03, border: 3 })],
      `<g filter="url(#pn)"><path d="M12 12 L288 8 L290 180 L10 184 Z" fill="${fill}"/><path d="M11 168 L290 165 L290 180 L10 184 Z" fill="${dk}"/></g>`);
  });
  svg('badge.svg', 64, 64, [paper('bd', { seed: 461, border: 2, wobble: 2, shadow: 0.3, blur: 1.5, dx: 1, dy: 2 })],
    `<g filter="url(#bd)"><circle cx="31" cy="30" r="25" fill="${C.paper}"/></g>`);
}
