// Ottó as a jointed paper puppet: separate pieces with pivots, a mouth that
// opens 0..1, eyelids that blink, and a `boil` step that shifts the paper
// filter seeds so the torn edges redraw like hand-cut animation.
import { C, paper } from './paperlib.mjs';

const O = {
  suit: '#3a3540', suitDk: '#27232c', lapel: '#2d2933', vest: '#312c36', shirt: '#f4efe4',
  tie: '#d2bc9f', tieDk: '#b59e82', skin: '#ecbfa0', skinDk: '#d9a283', lid: '#e0ab8d',
  beard: '#5f4231', beardDk: '#4a3225', beardLt: '#7d5a42', stache: '#523727', brow: '#6a4630', iris: '#6f8a92',
};

/** Pivot points (in the 380x490 rig space). */
export const PIVOTS = { elbow: [318, 326], shoulderBack: [250, 290], shoulderFront: [104, 292], neck: [180, 250], hips: [180, 470] };

export function ottoDefs(boil = 0) {
  const s = boil * 97;
  return [
    paper('oA', { seed: 3 + s }), paper('oF', { seed: 5 + s }), paper('oT', { seed: 7 + s }), paper('oH', { seed: 13 + s }),
    paper('oM', { seed: 19 + s, border: 3, dy: 3 }), paper('oR', { seed: 29 + s }), paper('oN', { seed: 31 + s, border: 0, shadow: 0.25 }),
    paper('oS', { seed: 37 + s, border: 2.5, dy: 2, blur: 2 }),
  ].join('\n');
}

export const backUpper = `<g filter="url(#oA)"><path d="M246 282 C272 288 300 300 324 314 L314 336 C290 326 266 316 242 308 Z" fill="${O.suit}"/></g>`;

export const backFore = `<g filter="url(#oF)">
<path d="M308 322 C318 302 326 282 332 260 L352 266 C348 290 340 312 328 334 Z" fill="${O.suit}"/>
<path d="M330 264 L352 270 L354 260 L332 254 Z" fill="${O.shirt}"/>
<path d="M328 258 C320 240 324 216 338 212 L352 210 C362 210 366 220 364 234 L362 252 C360 264 350 270 340 268 Z" fill="${O.skin}"/>
<path d="M330 254 C318 252 312 240 318 234 C324 230 330 240 334 246 Z" fill="${O.skin}"/>
<path d="M344 216 L343 236 M354 214 L353 236" stroke="${O.skinDk}" stroke-width="2.5" stroke-linecap="round"/>
</g>
<g filter="url(#oS)"><path d="M327 272 L349 278 L346 288 L324 282 Z" fill="#1f1d24"/><circle cx="337" cy="280" r="10" fill="#1f1d24"/><circle cx="337" cy="280" r="6.5" fill="#5a5763"/></g>`;

export const neck = `<g filter="url(#oN)"><path d="M160 230 L200 230 L202 272 L158 272 Z" fill="${O.skinDk}"/></g>`;

export const torso = `<g transform="translate(0 20)"><g filter="url(#oT)">
<path d="M100 262 C120 246 150 240 180 240 C210 240 240 246 260 262 C280 300 292 380 296 460 L64 460 C68 380 80 300 100 262 Z" fill="${O.suit}"/>
<path d="M226 250 C252 262 272 300 282 360 L288 460 L262 460 C262 380 250 300 226 250 Z" fill="${O.suitDk}" opacity="0.6"/>
<path d="M150 244 L180 336 L210 244 C196 240 164 240 150 244 Z" fill="${O.shirt}"/>
<path d="M174 262 L186 262 L193 322 L180 338 L167 322 Z" fill="${O.tie}"/>
<path d="M176 280 L190 272 M175 298 L191 290 M173 316 L192 306" stroke="${O.tieDk}" stroke-width="2" opacity="0.7"/>
<path d="M146 290 L168 290 L180 322 L192 290 L214 290 L216 400 L144 400 Z" fill="${O.vest}"/>
<circle cx="180" cy="346" r="3.5" fill="#18161b"/><circle cx="180" cy="370" r="3.5" fill="#18161b"/>
<path d="M150 244 L180 336 L160 360 L112 266 C124 254 136 247 150 244 Z" fill="${O.lapel}"/>
<path d="M210 244 L180 336 L200 360 L248 266 C236 254 224 247 210 244 Z" fill="${O.lapel}"/>
<path d="M222 304 L256 296 L258 308 L224 316 Z" fill="${O.suitDk}"/>
</g>
<g filter="url(#oS)"><path d="M170 244 L190 244 L188 262 L172 262 Z" fill="${O.tieDk}"/></g>
<g filter="url(#oS)"><path d="M228 302 L236 288 L243 298 L251 290 L254 300 Z" fill="${O.tie}"/></g></g>`;

const HEAD_WRAP = 'translate(0 20) rotate(-5 180 150)';

const eyesShut = `<ellipse cx="152" cy="126" rx="14" ry="10" fill="${O.lid}"/><ellipse cx="210" cy="126" rx="14" ry="10" fill="${O.lid}"/>
<path d="M138 127 Q152 134 166 127 M196 127 Q210 134 224 127" stroke="${C.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;

const eyesOpen = (look) => `<ellipse cx="152" cy="126" rx="13" ry="9" fill="#fbf5e6"/><ellipse cx="210" cy="126" rx="13" ry="9" fill="#fbf5e6"/>
<circle cx="${154 + look}" cy="129" r="5.5" fill="${O.iris}"/><circle cx="${212 + look}" cy="129" r="5.5" fill="${O.iris}"/>
<circle cx="${154 + look}" cy="129" r="2.6" fill="${C.ink}"/><circle cx="${212 + look}" cy="129" r="2.6" fill="${C.ink}"/>
<circle cx="${156 + look}" cy="128" r="1.4" fill="#fbf5e6"/><circle cx="${214 + look}" cy="128" r="1.4" fill="#fbf5e6"/>
<path d="M136 129 C138 112 166 110 168 127 Z" fill="${O.lid}"/><path d="M194 129 C196 112 224 110 226 127 Z" fill="${O.lid}"/>
<path d="M137 128 C146 123 160 122 167 126 M195 128 C204 123 218 122 225 126" stroke="${C.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;

const mouthClosed = `<path d="M170 195 C178 199 190 198 197 193 C190 195 178 196 170 195 Z" fill="#c98072"/><path d="M166 192 C176 194 189 193 201 185" stroke="#4a2a22" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;

/** The open mouth, `mouth` 0..1 (0 draws nothing). */
function mouthShape(mouth) {
  if (mouth < 0.08) return '';
  const h = 3 + 17 * Math.min(1, mouth);
  return `<ellipse cx="183" cy="${(189 + h / 2).toFixed(1)}" rx="${(13 + 3 * mouth).toFixed(1)}" ry="${(h / 2).toFixed(1)}" fill="#4a1a1e"/>
${h > 9 ? `<path d="M${(173 - 2 * mouth).toFixed(1)} 190 L${(193 + 2 * mouth).toFixed(1)} 190 L${(191 + 2 * mouth).toFixed(1)} 194 L${(175 - 2 * mouth).toFixed(1)} 194 Z" fill="#fbf5e6"/>` : ''}
<path d="M${(172 - 2 * mouth).toFixed(1)} ${(190 + h).toFixed(1)} Q183 ${(195 + h).toFixed(1)} ${(194 + 2 * mouth).toFixed(1)} ${(190 + h).toFixed(1)}" stroke="#c98072" stroke-width="4" fill="none" stroke-linecap="round"/>`;
}

const stache = `<path d="M150 182 C158 172 172 172 180 176 C188 172 202 172 210 182 C200 185 190 184 180 182 C170 184 160 185 150 182 Z" fill="${O.stache}"/>`;

/** Head, face and beard, with the eyes open or shut and a mouth that is closed or open 0..1 (the moustache on top). */
function headSvg({ blink, mouth, look }) {
  const open = mouthShape(mouth);
  return `<g transform="${HEAD_WRAP}">
<g filter="url(#oH)">
<ellipse cx="112" cy="150" rx="14" ry="22" fill="${O.skinDk}"/><ellipse cx="250" cy="150" rx="14" ry="22" fill="${O.skinDk}"/>
<path d="M180 30 C234 30 256 76 254 132 C252 184 228 226 180 230 C132 226 108 184 106 132 C104 76 126 30 180 30 Z" fill="${O.skin}"/>
<path d="M228 56 C248 82 256 118 252 150 C246 190 224 218 190 228 C220 206 236 176 238 140 C240 110 238 80 228 56 Z" fill="${O.skinDk}" opacity="0.6"/>
<ellipse cx="150" cy="58" rx="24" ry="9" fill="#fff4e8" opacity="0.6" transform="rotate(-22 150 58)"/>
<ellipse cx="136" cy="156" rx="12" ry="7" fill="${C.blush}" opacity="0.35"/><ellipse cx="224" cy="156" rx="12" ry="7" fill="${C.blush}" opacity="0.35"/>
${blink ? eyesShut : eyesOpen(look)}
<path d="M130 114 C142 106 158 106 169 113 L167 119 C156 114 144 114 132 120 Z" fill="${O.brow}"/>
<path d="M192 111 C202 104 218 103 231 110 L229 116 C216 110 204 111 194 117 Z" fill="${O.brow}"/>
<path d="M180 118 C176 138 170 152 172 160 C176 168 192 168 194 160 C194 152 186 138 180 118 Z" fill="#e3ad8f"/>
</g>
<g filter="url(#oM)">
<path d="M112 136 C112 178 128 212 152 228 C166 238 194 238 208 228 C232 212 248 178 248 136 C244 160 238 178 228 188 C220 178 210 174 200 174 C192 174 186 176 180 176 C174 176 168 174 160 174 C150 174 140 178 132 188 C122 178 116 160 112 136 Z" fill="${O.beard}"/>
<path d="M162 222 C172 230 190 230 200 222 C194 234 168 234 162 222 Z" fill="${O.beardDk}"/>
<path d="M126 192 l4 6 M140 208 l4 6 M222 192 l-4 6 M210 208 l-4 6 M176 220 l1 6 M188 220 l-1 6" stroke="${O.beardLt}" stroke-width="2.5" stroke-linecap="round"/>
${open || mouthClosed}
${stache}
</g></g>`;
}

/** The head, in rig space; `blink` closes the eyes, `mouth` 0..1 opens the mouth, `look` shifts the pupils. */
export function head({ blink = false, mouth = 0, look = 0 } = {}) {
  return headSvg({ blink, mouth, look });
}

/**
 * The head as separate layers for the live game, where the mouth and the
 * blinks are CSS on top of still images (no filters redrawn per frame):
 * the face with the mouth closed, the fully open mouth (scaled 0..1 from its
 * top lip), the moustache that sits over it, and the shut eyelids. All in
 * rig space, so they stack exactly. They use the `oI` filter (paper grain and
 * wobble without the cut-out border), defined by `ottoLayerDefs`.
 */
export const headLayers = {
  face: headSvg({ blink: false, mouth: 0, look: 0 }),
  mouth: `<g transform="${HEAD_WRAP}"><g filter="url(#oI)">${mouthShape(1)}</g></g>`,
  stache: `<g transform="${HEAD_WRAP}"><g filter="url(#oI)">${stache}</g></g>`,
  lids: `<g transform="${HEAD_WRAP}"><g filter="url(#oI)">${eyesShut}</g></g>`,
};

/** The top of the open mouth in rig space: the pivot the live mouth scales from. */
export const MOUTH_TOP = [186.4, 208.6];

/** Filters for `headLayers`' inner pieces (no border or shadow: they sit on the face). */
export function ottoLayerDefs(boil = 0) {
  return paper('oI', { seed: 43 + boil * 97, border: 0, shadow: 0, wobble: 1.5 });
}

export const frontArm = `<g transform="translate(0 20)"><g filter="url(#oR)">
<path d="M98 262 C82 290 74 330 78 366 L102 370 C106 336 112 300 124 276 Z" fill="${O.suit}"/>
<path d="M80 356 C98 346 120 334 134 322 L148 342 C128 358 106 374 90 380 Z" fill="${O.suit}"/>
<path d="M130 318 L140 314 L152 336 L144 342 Z" fill="${O.shirt}"/>
<path d="M146 344 L158 252" stroke="${C.ink}" stroke-width="8" stroke-linecap="round"/>
<path d="M150 318 L153 296" stroke="${C.mustard}" stroke-width="10"/>
<ellipse cx="160" cy="244" rx="14" ry="16" fill="#4a4550"/>
<path d="M150 238 L170 238 M149 245 L171 245 M151 252 L169 252" stroke="#6e6878" stroke-width="2"/>
<path d="M136 330 C132 316 142 306 154 308 C166 310 170 324 164 336 C158 346 142 346 136 330 Z" fill="${O.skin}"/>
</g></g>`;
