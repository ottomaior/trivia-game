// The other six contestants in the paper style. Each is a 220x220 SVG.
export function buildCast6(C, paper, svg) {
  const P = {
    teal: '#3f7d74', tealDk: '#2e5f58', tealLt: '#5a988d',
    ice: '#9fc7cc', iceDk: '#7eaab0', iceLt: '#cde6e8',
    plum: '#6e4b72', plumDk: '#553858', plumLt: '#8b6a8f',
    cloud: '#efe3c8', cloudDk: '#d6c6a4',
    green: '#8fb04a', greenDk: '#6f8f36', greenLt: '#aac86a',
    rose: '#d98a8f', roseDk: '#b86a72', roseLt: '#eab0b2',
    white: '#fbf5e6', tongue: '#d9707e',
  };
  const piece = (id, seed) => paper(id, { seed, border: 2.5, dy: 2, blur: 2 });
  const eye = (cx, cy, rx, ry, px, py, pr, glint = true) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${P.white}"/><circle cx="${px}" cy="${py}" r="${pr}" fill="${C.ink}"/>` +
    (glint ? `<circle cx="${px + pr * 0.35}" cy="${py - pr * 0.4}" r="${Math.max(1.4, pr * 0.3)}" fill="${P.white}"/>` : '');

  /* Bab: lost in the music */
  svg('bab.svg', 220, 220, [paper('b1', { seed: 201 }), piece('b2', 203), piece('b3', 205)], `<g transform="translate(10 14) rotate(8 100 110)">
<g filter="url(#b1)">
<path d="M100 18 C130 18 146 38 146 64 L146 140 C146 168 128 186 100 186 C72 186 54 168 54 140 L54 64 C54 38 70 18 100 18 Z" fill="${P.teal}"/>
<path d="M132 30 C142 40 146 52 146 64 L146 140 C146 168 128 186 100 186 C124 176 134 160 134 138 L134 64 C134 52 134 40 132 30 Z" fill="${P.tealDk}" opacity="0.75"/>
<path d="M66 54 C68 42 74 34 84 30" stroke="${P.tealLt}" stroke-width="6" fill="none" stroke-linecap="round"/>
<ellipse cx="72" cy="120" rx="9" ry="5" fill="${C.blush}" opacity="0.4"/><ellipse cx="128" cy="120" rx="9" ry="5" fill="${C.blush}" opacity="0.4"/>
<path d="M72 102 Q83 90 94 102 M106 102 Q117 90 128 102" stroke="${C.ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
<path d="M86 130 Q100 142 116 128" stroke="${C.ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
</g>
<g filter="url(#b2)">
<path d="M48 92 C44 18 156 18 152 92" stroke="${C.ink}" stroke-width="10" fill="none"/>
<path d="M48 92 C44 18 156 18 152 92" stroke="${C.mustard}" stroke-width="4" fill="none"/>
<rect x="34" y="78" width="24" height="40" rx="10" fill="${C.mustard}"/><rect x="142" y="78" width="24" height="40" rx="10" fill="${C.mustard}"/>
<rect x="40" y="86" width="8" height="24" rx="4" fill="${C.mustardDk}"/><rect x="152" y="86" width="8" height="24" rx="4" fill="${C.mustardDk}"/>
</g>
</g>
<g filter="url(#b3)" transform="translate(172 22) rotate(12)">
<path d="M0 22 L0 2 L14 -2 L14 18" stroke="${C.cream}" stroke-width="4" fill="none" stroke-linejoin="round"/>
<ellipse cx="-4" cy="22" rx="6" ry="5" fill="${C.cream}"/><ellipse cx="10" cy="18" rx="6" ry="5" fill="${C.cream}"/>
</g>
<g filter="url(#b3)" transform="translate(20 34) rotate(-14)">
<path d="M0 18 L0 0" stroke="${C.cream}" stroke-width="4" stroke-linecap="round"/><path d="M0 0 C6 4 10 6 10 12" stroke="${C.cream}" stroke-width="4" fill="none" stroke-linecap="round"/>
<ellipse cx="-4" cy="18" rx="6" ry="5" fill="${C.cream}"/>
</g>`);

  /* Csepp: believes everything */
  svg('csepp.svg', 220, 220, [paper('c1', { seed: 211 }), piece('c2', 213)], `<g transform="translate(10 12)">
<g filter="url(#c1)">
<path d="M100 12 C114 40 158 76 158 122 C158 160 132 186 100 186 C68 186 42 160 42 122 C42 76 86 40 100 12 Z" fill="${P.ice}"/>
<path d="M130 60 C150 82 158 104 158 122 C158 160 132 186 100 186 C130 172 146 150 146 122 C146 102 140 80 130 60 Z" fill="${P.iceDk}" opacity="0.8"/>
<ellipse cx="66" cy="96" rx="6" ry="14" fill="${P.iceLt}" transform="rotate(22 66 96)"/>
<path d="M64 96 Q74 88 86 93 M114 93 Q126 88 136 96" stroke="${C.ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
${eye(80, 122, 16, 19, 83, 126, 10)}${eye(120, 122, 16, 19, 117, 126, 10)}
<circle cx="79" cy="131" r="2" fill="${P.white}"/><circle cx="113" cy="131" r="2" fill="${P.white}"/>
<circle cx="62" cy="148" r="2" fill="${P.iceDk}"/><circle cx="68" cy="152" r="2" fill="${P.iceDk}"/><circle cx="132" cy="152" r="2" fill="${P.iceDk}"/><circle cx="138" cy="148" r="2" fill="${P.iceDk}"/>
<ellipse cx="100" cy="160" rx="6" ry="7" fill="${C.mouth}"/>
</g>
<g filter="url(#c2)">
<path d="M150 30 L154 42 L166 46 L154 50 L150 62 L146 50 L134 46 L146 42 Z" fill="${C.mustardLt}"/>
<path d="M168 70 L170 76 L176 78 L170 80 L168 86 L166 80 L160 78 L166 76 Z" fill="${C.mustardLt}"/>
</g>
</g>`);

  /* Csillag: the diva */
  const R = 88, r = 46, cx = 100, cy = 106;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (-90 + i * 36) * Math.PI / 180, rad = i % 2 ? r : R;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  const star = `M${pts.join(' L')} Z`;
  svg('csillag.svg', 220, 220, [paper('s1', { seed: 221 }), piece('s2', 223)], `<g transform="translate(10 10) rotate(-8 100 106)">
<g filter="url(#s1)">
<path d="${star}" fill="${P.plum}" stroke="${P.plum}" stroke-width="16" stroke-linejoin="round"/>
<path d="M${pts[4]} L${pts[5]} L${pts[6]} Z" fill="${P.plumDk}" stroke="${P.plumDk}" stroke-width="6" stroke-linejoin="round" opacity="0.8"/>
<path d="M92 34 C94 28 98 24 102 22" stroke="${P.plumLt}" stroke-width="5" fill="none" stroke-linecap="round"/>
<g transform="translate(100 114) scale(1.4) translate(-100 -114)"><ellipse cx="70" cy="126" rx="9" ry="5" fill="${C.blush}" opacity="0.45"/><ellipse cx="132" cy="124" rx="9" ry="5" fill="${C.blush}" opacity="0.45"/>
${eye(82, 104, 11, 12, 84, 105, 5.5)}
<path d="M70 96 L66 90 M76 93 L74 86 M83 92 L83 85" stroke="${C.ink}" stroke-width="2.8" stroke-linecap="round"/>
<path d="M106 106 Q117 97 128 106" stroke="${C.ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
<path d="M124 102 L130 97 M118 99 L120 92" stroke="${C.ink}" stroke-width="2.8" stroke-linecap="round"/>
<path d="M78 124 Q100 150 126 122 Z" fill="${C.mouth}"/>
<path d="M82 126 Q100 132 122 124 L120 130 Q100 137 84 131 Z" fill="${P.white}"/>
<circle cx="130" cy="136" r="2.6" fill="${C.ink}"/></g>
</g>
<g filter="url(#s2)"><path d="M100 2 L104 12 L114 14 L104 17 L100 28 L96 17 L86 14 L96 12 Z" fill="${C.mustardLt}"/></g>
</g>`);

  /* Felhő: half asleep */
  svg('felho.svg', 220, 220, [paper('f1', { seed: 231 }), piece('f2', 233), piece('f3', 235)], `<g transform="translate(10 14)">
<g filter="url(#f2)"><path d="M104 62 C112 34 150 18 180 34 C188 38 194 46 196 56 C180 52 166 58 156 72 Z" fill="${P.plum}"/><path d="M110 60 C130 52 150 58 160 72" stroke="${P.plumDk}" stroke-width="5" fill="none"/></g>
<g filter="url(#f1)">
<path d="M50 172 C24 172 12 148 26 130 C10 112 22 82 48 86 C48 58 80 42 104 54 C120 32 160 42 158 74 C180 82 186 114 166 126 C180 148 164 174 140 172 Z" fill="${P.cloud}"/>
<path d="M166 126 C180 148 164 174 140 172 L50 172 C34 172 22 162 22 150 C60 162 110 164 146 146 C156 140 162 134 166 126 Z" fill="${P.cloudDk}" opacity="0.8"/>
<ellipse cx="66" cy="136" rx="9" ry="5" fill="${C.blush}" opacity="0.35"/><ellipse cx="138" cy="136" rx="9" ry="5" fill="${C.blush}" opacity="0.35"/>
${eye(80, 116, 12, 9, 80, 120, 4.5, false)}${eye(124, 116, 12, 9, 124, 120, 4.5, false)}
<path d="M67 118 C68 104 92 104 93 117 Z M111 118 C112 104 136 104 137 117 Z" fill="${P.cloudDk}"/>
<path d="M67 117 Q80 112 93 116 M111 117 Q124 112 137 116" stroke="${C.ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
<ellipse cx="102" cy="146" rx="8" ry="7" fill="${C.mouth}"/>
<path d="M112 148 C114 154 114 158 111 160 C108 158 108 154 112 148 Z" fill="${P.ice}"/>
</g>
<g filter="url(#f3)"><circle cx="198" cy="58" r="9" fill="${C.mustard}"/></g>
<g filter="url(#f3)"><path d="M150 2 L166 2 L150 20 L166 20 M176 -8 L186 -8 L176 4 L186 4" stroke="${C.mustardLt}" stroke-width="4" fill="none" stroke-linejoin="round" stroke-linecap="round"/></g>
</g>`);

  /* Szellem: the prankster */
  svg('szellem.svg', 220, 220, [paper('g1', { seed: 241 }), piece('g2', 243)], `<g transform="translate(10 18)">
<g filter="url(#g1)">
<path d="M100 20 C140 20 164 50 164 94 L164 164 C158 176 150 166 142 166 C134 166 128 180 118 180 C108 180 104 166 96 166 C88 166 84 180 74 180 C62 180 56 166 48 166 C42 166 36 174 36 164 L36 94 C36 50 60 20 100 20 Z" fill="${P.green}"/>
<path d="M146 42 C158 56 164 74 164 94 L164 164 C158 176 150 166 142 166 C148 150 152 128 152 100 C152 78 150 58 146 42 Z" fill="${P.greenDk}" opacity="0.75"/>
<path d="M52 70 C56 54 66 42 80 36" stroke="${P.greenLt}" stroke-width="6" fill="none" stroke-linecap="round"/>
<path d="M64 78 Q76 62 90 74 M110 84 L134 78" stroke="${C.ink}" stroke-width="5" fill="none" stroke-linecap="round"/>
${eye(78, 96, 11, 13, 83, 98, 5.5)}
${eye(122, 98, 11, 8, 126, 100, 5, false)}
<path d="M110 97 C112 88 132 88 134 96 Z" fill="${P.greenDk}"/><path d="M110 96 Q122 92 134 95" stroke="${C.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M68 120 Q100 152 134 116 Q104 130 68 120 Z" fill="${C.mouth}"/>
<path d="M98 130 Q104 152 116 128 Z" fill="${P.tongue}"/>
</g>
<g filter="url(#g2)" transform="rotate(-14 100 22)">
<path d="M78 30 L102 -22 L124 28 Z" fill="${C.mustard}"/>
<path d="M86 14 L114 8 M93 -2 L108 -6" stroke="${C.rust}" stroke-width="5" stroke-linecap="round"/>
<circle cx="102" cy="-22" r="8" fill="${C.rust}"/>
</g>
</g>`);

  /* Bogyó: here to win */
  svg('bogyo.svg', 220, 220, [paper('r1', { seed: 251 }), piece('r2', 253), piece('r3', 255)], `<g transform="translate(10 10)">
<g filter="url(#r3)"><path d="M100 34 C100 24 104 14 112 8" stroke="#5a3a24" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M108 18 C120 2 144 6 150 16 C138 26 118 28 108 18 Z" fill="${P.teal}"/></g>
<g filter="url(#r1)">
<path d="M100 30 C124 30 132 56 134 72 C154 88 164 112 162 138 C160 170 134 188 100 188 C66 188 40 170 38 138 C36 112 46 88 66 72 C68 56 76 30 100 30 Z" fill="${P.rose}"/>
<path d="M134 72 C154 88 164 112 162 138 C160 170 134 188 100 188 C132 176 150 156 150 132 C150 108 144 88 134 72 Z" fill="${P.roseDk}" opacity="0.75"/>
<path d="M76 58 C80 48 86 40 94 36" stroke="${P.roseLt}" stroke-width="6" fill="none" stroke-linecap="round"/>
${eye(82, 138, 11, 10, 84, 140, 5.5)}${eye(120, 138, 11, 10, 118, 140, 5.5)}
<path d="M64 120 L94 132 M106 132 L136 120" stroke="${C.ink}" stroke-width="7" stroke-linecap="round"/>
<path d="M78 158 L124 158 C131 158 131 172 124 172 L78 172 C71 172 71 158 78 158 Z" fill="${P.white}"/>
<path d="M78 158 L124 158 C131 158 131 172 124 172 L78 172 C71 172 71 158 78 158 Z M74 165 L128 165 M92 158 L92 172 M110 158 L110 172" stroke="${C.ink}" stroke-width="3" fill="none" stroke-linejoin="round"/>
</g>
<g filter="url(#r2)">
<path d="M46 100 C78 88 122 88 154 100 L152 116 C122 104 78 104 48 116 Z" fill="${C.cream}"/>
<path d="M47 108 C78 96 122 96 153 108" stroke="${P.teal}" stroke-width="5" fill="none"/>
</g>
</g>`);
}
