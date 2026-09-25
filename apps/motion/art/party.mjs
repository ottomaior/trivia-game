// Paper props and cards for the party modes and the ladder.
export function buildParty(C, paper, svg) {
  const wob = (seed, extra = {}) => paper(`p${seed}`, { seed, border: 3, wobble: 3, freq: 0.03, ...extra });
  const id = (seed) => `url(#p${seed})`;

  /** A paper card sized w×h (drawn inside a small margin for the border and shadow). */
  function card(name, w, h, fill, seed, { strip = null, lines = false, margin = 'red' } = {}) {
    const x0 = 8, y0 = 6, x1 = w - 8, y1 = h - 12;
    let extra = '';
    if (strip) extra += `<path d="M${x0} ${y1 - 12} L${x1} ${y1 - 13} L${x1} ${y1} L${x0} ${y1} Z" fill="${strip}"/>`;
    if (lines) {
      for (let y = y0 + 34; y < y1 - 8; y += 30) extra += `<path d="M${x0 + 4} ${y} L${x1 - 4} ${y}" stroke="#9fc7cc" stroke-width="1.6"/>`;
      if (margin) extra += `<path d="M${x0 + 34} ${y0 + 4} L${x0 + 34} ${y1 - 4}" stroke="#d98a8f" stroke-width="2"/>`;
    }
    svg(name, w, h, [wob(seed)], `<g filter="${id(seed)}"><path d="M${x0} ${y0 + 2} L${x1} ${y0} L${x1 + 1} ${y1} L${x0 - 1} ${y1 + 1} Z" fill="${fill}"/>${extra}</g>`);
  }

  // Generic cards for the boards and phone screens.
  card('pcard-prompt.svg', 980, 140, C.cream, 301);
  card('pcard-prompt-s.svg', 980, 118, C.cream, 302);
  card('pcard-opt.svg', 300, 196, C.cream, 303);
  card('pcard-opt-truth.svg', 300, 196, C.mustardLt, 305);
  card('pcard-hang.svg', 172, 128, C.cream, 307);
  card('pcard-year.svg', 104, 54, C.mustard, 309);
  card('pcard-value.svg', 96, 50, C.cream, 311);
  card('pcard-q.svg', 700, 170, C.cream, 313);
  card('pcard-tile-a.svg', 346, 80, C.rust, 315, { strip: C.rustDk });
  card('pcard-tile-b.svg', 346, 80, C.teal, 317, { strip: C.tealDk });
  card('pcard-tile-c.svg', 346, 80, C.plum, 319, { strip: C.plumDk });
  card('pcard-tile-d.svg', 346, 80, C.mustard, 321, { strip: C.mustardDk });
  card('pcard-result.svg', 150, 58, C.cream, 323);
  // Phone pieces.
  card('ph-prompt.svg', 360, 150, C.cream, 331);
  card('ph-prompt-s.svg', 360, 120, C.cream, 332);
  card('ph-note.svg', 360, 200, '#fbf6e9', 333, { lines: true });
  card('ph-button.svg', 360, 84, C.mustard, 335, { strip: C.mustardDk });
  card('ph-strip.svg', 360, 76, C.cream, 337);
  card('ph-row.svg', 360, 82, C.cream, 339);
  card('ph-tile-a.svg', 360, 84, C.rust, 341, { strip: C.rustDk });
  card('ph-tile-b.svg', 360, 84, C.teal, 343, { strip: C.tealDk });
  card('ph-tile-c.svg', 360, 84, C.plum, 345, { strip: C.plumDk });
  card('ph-tile-d.svg', 360, 84, C.mustard, 347, { strip: C.mustardDk });
  card('ph-header.svg', 370, 70, '#5a2533', 349);

  // Mode ribbon: a banner with notched ends.
  svg('ribbon.svg', 240, 60, [wob(351)], `<g filter="${id(351)}">
<path d="M6 12 L28 12 L28 50 L6 50 L16 31 Z" fill="${C.rustDk}"/><path d="M234 12 L212 12 L212 50 L234 50 L224 31 Z" fill="${C.rustDk}"/>
<path d="M22 6 L218 8 L218 46 L22 46 Z" fill="${C.rust}"/></g>`);

  // Blöffölő: the bluffer's domino mask.
  svg('mask.svg', 120, 50, [wob(353, { border: 2.5, wobble: 2 })], `<g filter="${id(353)}">
<path fill-rule="evenodd" fill="#231a20" d="M14 20 C24 6 50 8 60 16 C70 8 96 6 106 20 C112 30 106 42 94 42 C80 42 70 34 60 30 C50 34 40 42 26 42 C14 42 8 30 14 20 Z M26 24 C30 18 42 18 46 24 C42 30 30 30 26 24 Z M74 24 C78 18 90 18 94 24 C90 30 78 30 74 24 Z"/>
<path d="M14 22 L2 16 M106 22 L118 16" stroke="#231a20" stroke-width="3" stroke-linecap="round"/></g>`);

  // Blöffölő: the truth rosette.
  let petals = '';
  for (let i = 0; i < 16; i++) {
    const a = (i * 22.5) * Math.PI / 180;
    petals += `<circle cx="${(50 + 30 * Math.cos(a)).toFixed(1)}" cy="${(46 + 30 * Math.sin(a)).toFixed(1)}" r="10" fill="${C.mustard}"/>`;
  }
  svg('rosette.svg', 100, 110, [wob(355, { border: 2.5 })], `<g filter="${id(355)}">
<path d="M34 70 L24 106 L38 98 L46 108 L50 72 Z M66 70 L76 106 L62 98 L54 108 L50 72 Z" fill="${C.rust}"/>
${petals}<circle cx="50" cy="46" r="28" fill="${C.mustardLt}"/><circle cx="50" cy="46" r="22" fill="none" stroke="${C.mustardDk}" stroke-width="2" stroke-dasharray="3 3"/></g>`);

  // Időrend: the clothesline and a wooden peg.
  svg('rope.svg', 1000, 90, [paper('p357', { seed: 357, border: 0, wobble: 2, shadow: 0.35, blur: 2, dx: 0, dy: 4 })],
    `<g filter="url(#p357)"><path d="M0 20 Q500 90 1000 20" stroke="#cdb48a" stroke-width="6" fill="none"/><path d="M0 20 Q500 90 1000 20" stroke="#a88e62" stroke-width="2" stroke-dasharray="6 5" fill="none"/></g>`);
  svg('peg.svg', 30, 64, [wob(359, { border: 2, wobble: 1.5, blur: 1.5, dy: 2 })], `<g filter="${id(359)}">
<path d="M8 4 L14 4 L14 60 L9 60 Z" fill="#c9955a"/><path d="M16 4 L22 4 L21 60 L16 60 Z" fill="#b07e46"/><rect x="6" y="24" width="18" height="7" rx="2" fill="#8c8c96"/></g>`);
  // A timeline strip with an arrow head.
  svg('timeline.svg', 980, 60, [wob(361)], `<g filter="${id(361)}"><path d="M8 18 L920 16 L920 6 L972 30 L920 54 L920 44 L8 44 Z" fill="${C.teal}"/></g>`);

  // Tippelj!: a paper measuring tape from 30 to 60.
  let ticks = '';
  for (let v = 30; v <= 60; v++) {
    const x = 20 + (v - 30) * 31;
    const big = v % 5 === 0;
    ticks += `<path d="M${x} 8 L${x} ${big ? 30 : 20}" stroke="#3a2a14" stroke-width="${big ? 2.5 : 1.5}"/>`;
    if (big) ticks += `<text x="${x}" y="52" font-family="Arial, sans-serif" font-weight="700" font-size="18" fill="#3a2a14" text-anchor="middle">${v}</text>`;
  }
  svg('tape.svg', 970, 72, [wob(363)], `<g filter="${id(363)}"><path d="M4 6 L966 4 L966 66 L4 68 Z" fill="#e8c24a"/>${ticks}</g>`);
  // The same tape blank, for the game, which prints its own scale on it.
  svg('tape-plain.svg', 970, 72, [wob(364)], `<g filter="${id(364)}"><path d="M4 6 L966 4 L966 66 L4 68 Z" fill="#e8c24a"/></g>`);
  svg('pin.svg', 40, 56, [wob(365, { border: 2, wobble: 1.5, blur: 1.5 })], `<g filter="${id(365)}">
<path d="M19 26 L20 54 L21 26 Z" stroke="#8c8c96" stroke-width="3"/><circle cx="20" cy="18" r="14" fill="${C.rust}"/><ellipse cx="15" cy="13" rx="4" ry="3" fill="#e8a08a"/></g>`);
  const chip = (name, fill, seed) => svg(name, 64, 64, [wob(seed, { border: 2, wobble: 1.5, blur: 2, dy: 3 })], `<g filter="${id(seed)}">
<circle cx="32" cy="31" r="25" fill="${fill}"/><circle cx="32" cy="31" r="25" fill="none" stroke="${C.paper}" stroke-width="6" stroke-dasharray="7 9.7"/><circle cx="32" cy="31" r="15" fill="none" stroke="${C.paper}" stroke-width="2"/></g>`);
  chip('chip-rust.svg', C.rust, 367);
  chip('chip-teal.svg', C.teal, 369);
  chip('chip-empty.svg', '#5a2533', 371);

  // Milliomos-létra: a tall paper ladder with 15 rungs.
  let rungs = '';
  for (let i = 0; i < 15; i++) {
    const y = 620 - i * 40;
    rungs += `<path d="M34 ${y} L166 ${y - 2} L166 ${y + 10} L34 ${y + 12} Z" fill="${i === 4 || i === 9 ? C.mustard : '#c9955a'}"/>`;
  }
  svg('ladder.svg', 200, 660, [wob(373, { wobble: 4, freq: 0.02 })], `<g filter="${id(373)}">
<path d="M22 20 L40 18 L42 650 L20 652 Z" fill="#b07e46"/><path d="M160 18 L178 20 L180 652 L158 650 Z" fill="#9a6b3a"/>${rungs}</g>`);
  // Lifeline badges.
  const badge = (name, seed, inner, used = false) => svg(name, 96, 96, [wob(seed, { border: 3, wobble: 2 })], `<g filter="${id(seed)}">
<circle cx="48" cy="46" r="38" fill="${used ? '#6b5a58' : C.teal}"/>${inner}
${used ? `<path d="M22 20 L74 72 M74 20 L22 72" stroke="${C.rust}" stroke-width="9" stroke-linecap="round"/>` : ''}</g>`);
  // Each lifeline, fresh and used (greyed and crossed out).
  const lifelines = {
    fifty: `<text x="48" y="55" font-family="Arial, sans-serif" font-weight="900" font-size="24" fill="${C.paper}" text-anchor="middle">50:50</text>`,
    audience: `<circle cx="34" cy="40" r="8" fill="${C.paper}"/><circle cx="62" cy="40" r="8" fill="${C.paper}"/><circle cx="48" cy="34" r="9" fill="${C.paper}"/><path d="M20 66 C22 52 46 52 48 66 Z M48 66 C50 52 74 52 76 66 Z M32 62 C34 46 62 46 64 62 Z" fill="${C.paper}"/>`,
    phone: `<path d="M30 30 C28 26 34 22 38 26 L44 34 C46 38 42 42 40 44 C44 52 50 58 56 60 C58 58 62 54 66 56 L72 62 C76 66 72 72 68 70 C46 66 32 52 30 30 Z" fill="${C.paper}"/>`,
  };
  let seed = 375;
  for (const [name, inner] of Object.entries(lifelines)) {
    badge(`life-${name}.svg`, seed++, inner);
    badge(`life-${name}-used.svg`, seed++, inner, true);
  }
  // A "stuck on" paper tag for statuses.
  card('tag.svg', 120, 40, C.cream, 381);
  card('tag-wide.svg', 170, 40, C.cream, 383);
  // Label tags for the board's header: the round (dark) and the category (plum).
  card('tag-dark.svg', 170, 48, '#5a2533', 385);
  card('tag-plum.svg', 170, 48, C.plum, 387);
}
