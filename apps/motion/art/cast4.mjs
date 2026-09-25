// The four animal (and vegetable) contestants in the paper style, each a
// 220x220 SVG. Their expression faces live in expr.mjs, which redraws the
// same bodies without the idle face.
export const P4 = {
  white: '#fbf5e6',
  // Tacskó: a red dachshund
  dach: '#b9713f', dachDk: '#8f5229', dachLt: '#d6935f', muzzle: '#e6c092', ear: '#6e3d22', earDk: '#552d18',
  // Majmi: a cocoa baby monkey with a cream face
  cocoa: '#7d4d38', cocoaDk: '#5d3628', cocoaLt: '#9c6a50', face: '#f0dcb8', faceDk: '#dcc094', nappy: '#e8dcc4',
  // Süni: a hedgehog
  spike: '#5c3b33', spikeDk: '#432a25', spikeLt: '#8a5f4d', tan: '#e9cfa6', tanDk: '#d2b283',
  // Uborka: a cucumber
  cuke: '#5d9140', cukeDk: '#41702c', cukeLt: '#8cc060', bump: '#4a7d32',
};

/**
 * The parts of each body, shared with expr.mjs: `behind` is drawn before the
 * face-bearing body (own paper pieces), `body` gets the face drawn on top,
 * `after` goes over everything. Each is a function of the palette C.
 */
export function cast4Parts(C) {
  const P = P4;
  const spikes = (() => {
    const cx = 100, cy = 106, pts = [];
    for (let i = 0; i <= 26; i++) {
      const a = (176 + i * (188 / 26)) * Math.PI / 180, rad = i % 2 ? 72 : 94;
      pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`);
    }
    let lines = '';
    for (let i = 0; i < 11; i++) {
      const a = (190 + i * 16) * Math.PI / 180;
      lines += `<path d="M${(cx + 62 * Math.cos(a)).toFixed(1)} ${(cy + 62 * Math.sin(a)).toFixed(1)} L${(cx + 80 * Math.cos(a)).toFixed(1)} ${(cy + 80 * Math.sin(a)).toFixed(1)}" stroke="${P.spikeLt}" stroke-width="4" stroke-linecap="round"/>`;
    }
    return { d: `M${pts.join(' L')} L168 160 C168 184 140 194 100 194 C60 194 32 184 32 160 Z`, lines };
  })();

  return {
    tacsko: {
      wrap: 'translate(10 10) rotate(-3 100 120)',
      // Legs and tail, then the long body with its collar, then the ears.
      behind: (f) => `<g filter="url(#${f})">
<path d="M82 158 L82 176 C82 182 102 182 102 176 L102 158 Z M154 158 L154 176 C154 182 174 182 174 176 L174 158 Z M110 160 L110 174 C110 180 128 180 128 174 L128 160 Z M178 160 L178 174 C178 180 196 180 196 174 L196 160 Z" fill="${P.dachDk}"/>
<path d="M198 128 C218 122 222 100 210 90" stroke="${P.dach}" stroke-width="9" fill="none" stroke-linecap="round"/>
</g>
<g filter="url(#${f})">
<path d="M90 104 L172 104 C190 104 200 116 200 134 C200 152 190 164 172 164 L90 164 Z" fill="${P.dach}"/>
<path d="M90 144 L172 144 C186 144 196 150 198 140 C200 152 190 164 172 164 L90 164 Z" fill="${P.dachDk}" opacity="0.6"/>
<path d="M124 104 L136 104 L136 164 L124 164 Z" fill="${C.rust}"/><circle cx="130" cy="152" r="6" fill="${C.mustard}"/>
</g>
<g filter="url(#${f})">
<path d="M46 58 C22 62 12 104 20 142 C24 160 48 160 50 142 C54 116 50 86 46 58 Z" fill="${P.ear}"/>
<path d="M114 58 C138 62 148 104 140 142 C136 160 112 160 110 142 C106 116 110 86 114 58 Z" fill="${P.ear}"/>
<path d="M140 142 C136 160 112 160 110 142 C120 152 132 150 134 138 C138 116 134 92 126 70 C140 92 144 120 140 142 Z" fill="${P.earDk}" opacity="0.7"/>
</g>`,
      body: `<path d="M80 30 C114 30 130 58 130 92 C130 124 112 140 80 140 C48 140 30 124 30 92 C30 58 46 30 80 30 Z" fill="${P.dach}"/>
<path d="M118 48 C126 60 130 76 130 92 C130 124 112 140 80 140 C106 130 118 112 118 90 C118 74 120 60 118 48 Z" fill="${P.dachDk}" opacity="0.7"/>
<path d="M42 62 C46 50 54 42 66 36" stroke="${P.dachLt}" stroke-width="6" fill="none" stroke-linecap="round"/>
<ellipse cx="80" cy="116" rx="26" ry="19" fill="${P.muzzle}"/>
<ellipse cx="62" cy="68" rx="7" ry="4" fill="${P.muzzle}" opacity="0.7"/><ellipse cx="98" cy="68" rx="7" ry="4" fill="${P.muzzle}" opacity="0.7"/>
<ellipse cx="46" cy="104" rx="8" ry="5" fill="${C.blush}" opacity="0.5"/><ellipse cx="114" cy="104" rx="8" ry="5" fill="${C.blush}" opacity="0.5"/>
<ellipse cx="80" cy="108" rx="9" ry="7" fill="${C.ink}"/><ellipse cx="77" cy="106" rx="3" ry="2" fill="${P.white}" opacity="0.7"/>`,
      L: [64, 86], R: [96, 86], M: [80, 124], e: 11, lid: P.dachDk, top: 30, cx: 80, w: 100, box: [10, 22, 200, 172],
    },
    majmi: {
      wrap: 'translate(10 8)',
      // Tail, arms and feet; the torso in its nappy; the ears and hair tuft.
      behind: (f) => `<g filter="url(#${f})">
<path d="M136 182 C172 186 188 158 172 146" stroke="${P.cocoa}" stroke-width="8" fill="none" stroke-linecap="round"/>
<path d="M66 130 C46 136 34 152 38 168" stroke="${P.cocoa}" stroke-width="15" fill="none" stroke-linecap="round"/>
<path d="M134 130 C154 136 166 152 162 168" stroke="${P.cocoa}" stroke-width="15" fill="none" stroke-linecap="round"/>
<circle cx="38" cy="170" r="9" fill="${P.face}"/><circle cx="162" cy="170" r="9" fill="${P.face}"/>
<ellipse cx="84" cy="194" rx="13" ry="8" fill="${P.face}"/><ellipse cx="116" cy="194" rx="13" ry="8" fill="${P.face}"/>
</g>
<g filter="url(#${f})">
<path d="M100 110 C130 110 144 132 144 158 C144 180 126 190 100 190 C74 190 56 180 56 158 C56 132 70 110 100 110 Z" fill="${P.cocoa}"/>
<path d="M130 122 C140 132 144 144 144 158 C144 180 126 190 100 190 C122 184 134 172 134 154 C134 142 132 130 130 122 Z" fill="${P.cocoaDk}" opacity="0.6"/>
<ellipse cx="100" cy="146" rx="24" ry="18" fill="${P.face}"/>
<path d="M60 162 C80 156 120 156 140 162 L136 186 C120 194 80 194 64 186 Z" fill="${P.white}"/>
<path d="M60 162 C80 156 120 156 140 162 L139 168 C120 162 80 162 61 168 Z" fill="${P.nappy}"/>
<path d="M118 176 L128 174" stroke="${C.mustard}" stroke-width="4" stroke-linecap="round"/>
</g>
<g filter="url(#${f})">
<circle cx="52" cy="72" r="19" fill="${P.cocoa}"/><circle cx="54" cy="73" r="11" fill="${P.face}"/>
<circle cx="148" cy="72" r="19" fill="${P.cocoa}"/><circle cx="146" cy="73" r="11" fill="${P.face}"/>
<path d="M92 26 C88 12 96 6 100 16 C104 6 114 10 108 26 M100 16 C100 8 110 4 114 10" stroke="${P.cocoaDk}" stroke-width="6" fill="none" stroke-linecap="round"/>
</g>`,
      body: `<path d="M100 22 C134 22 150 48 150 74 C150 102 130 120 100 120 C70 120 50 102 50 74 C50 48 66 22 100 22 Z" fill="${P.cocoa}"/>
<path d="M132 36 C144 46 150 60 150 74 C150 102 130 120 100 120 C124 112 138 96 138 76 C138 60 136 46 132 36 Z" fill="${P.cocoaDk}" opacity="0.7"/>
<path d="M60 56 C64 46 72 38 82 32" stroke="${P.cocoaLt}" stroke-width="5" fill="none" stroke-linecap="round"/>
<path d="M100 60 C108 46 138 48 138 82 C138 106 122 116 100 116 C78 116 62 106 62 82 C62 48 92 46 100 60 Z" fill="${P.face}"/>
<ellipse cx="74" cy="94" rx="7" ry="4" fill="${C.blush}" opacity="0.45"/><ellipse cx="126" cy="94" rx="7" ry="4" fill="${C.blush}" opacity="0.45"/>
<circle cx="96" cy="95" r="2.2" fill="${C.ink}"/><circle cx="104" cy="95" r="2.2" fill="${C.ink}"/>`,
      L: [86, 78], R: [114, 78], M: [100, 102], e: 11, lid: P.faceDk, top: 22, cx: 100, w: 100, box: [24, 12, 152, 190],
    },
    suni: {
      wrap: 'translate(10 8)',
      body: `<path d="${spikes.d}" fill="${P.spike}"/>
<path d="M150 50 C172 80 178 130 168 160 C168 184 140 194 100 194 C136 186 156 168 158 140 C160 108 158 78 150 50 Z" fill="${P.spikeDk}" opacity="0.6"/>
${spikes.lines}
<path d="M58 84 C74 70 126 70 142 84 C156 104 154 150 146 172 C140 190 60 190 54 172 C46 150 44 104 58 84 Z" fill="${P.tan}"/>
<path d="M66 92 Q72 84 82 82" stroke="${P.white}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.7"/>
<ellipse cx="68" cy="118" rx="8" ry="5" fill="${C.blush}" opacity="0.55"/><ellipse cx="132" cy="118" rx="8" ry="5" fill="${C.blush}" opacity="0.55"/>
<ellipse cx="100" cy="126" rx="8" ry="6.5" fill="${C.ink}"/><ellipse cx="97" cy="124" rx="2.6" ry="1.8" fill="${P.white}" opacity="0.7"/>
<path d="M62 150 C70 160 82 164 96 162 M138 150 C130 160 118 164 104 162" stroke="${P.tanDk}" stroke-width="9" fill="none" stroke-linecap="round"/>`,
      after: (f) => `<g filter="url(#${f})"><ellipse cx="80" cy="192" rx="14" ry="7" fill="${P.tanDk}"/><ellipse cx="120" cy="192" rx="14" ry="7" fill="${P.tanDk}"/></g>`,
      L: [82, 104], R: [118, 104], M: [100, 140], e: 10, lid: P.tanDk, top: 18, cx: 100, w: 150, box: [4, 10, 192, 190],
    },
    uborka: {
      wrap: 'translate(10 12) rotate(10 100 110)',
      behind: (f) => `<g filter="url(#${f})"><path d="M94 14 C98 2 110 0 114 8 L112 22 L96 24 Z" fill="${C.mustardDk}"/></g>`,
      body: `<path d="M104 12 C134 14 148 46 144 90 C140 134 136 166 116 186 C104 198 84 198 72 186 C54 168 56 122 62 82 C68 42 82 10 104 12 Z" fill="${P.cuke}"/>
<path d="M126 26 C142 44 148 66 144 90 C140 134 136 166 116 186 C108 194 98 198 90 196 C112 178 124 148 128 110 C132 76 132 48 126 26 Z" fill="${P.cukeDk}" opacity="0.75"/>
<path d="M74 60 C76 44 82 30 92 22" stroke="${P.cukeLt}" stroke-width="6" fill="none" stroke-linecap="round"/>
<path d="M70 150 C68 124 70 100 74 80" stroke="${P.cukeLt}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.7"/>
<circle cx="80" cy="46" r="3" fill="${P.bump}"/><circle cx="118" cy="38" r="3" fill="${P.bump}"/><circle cx="70" cy="118" r="3" fill="${P.bump}"/><circle cx="132" cy="140" r="3" fill="${P.bump}"/><circle cx="90" cy="168" r="3" fill="${P.bump}"/><circle cx="126" cy="70" r="3" fill="${P.bump}"/><circle cx="118" cy="172" r="3" fill="${P.bump}"/><circle cx="66" cy="152" r="3" fill="${P.bump}"/>
<ellipse cx="72" cy="112" rx="8" ry="5" fill="${C.blush}" opacity="0.35"/><ellipse cx="132" cy="108" rx="8" ry="5" fill="${C.blush}" opacity="0.35"/>`,
      // Sunglasses pushed up on the forehead.
      after: (f) => `<g filter="url(#${f})">
<path d="M70 52 L138 44" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/>
<rect x="72" y="36" width="28" height="18" rx="8" fill="${C.ink}"/><rect x="108" y="32" width="28" height="18" rx="8" fill="${C.ink}"/>
<path d="M78 42 L88 40" stroke="${P.white}" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/><path d="M114 38 L124 36" stroke="${P.white}" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
</g>`,
      L: [86, 94], R: [120, 92], M: [102, 128], e: 12, lid: P.cukeDk, top: 12, cx: 102, w: 84, box: [50, 6, 108, 200],
    },
  };
}

/** The idle drawings: each body with its own face. */
export function buildCast4(C, paper, svg) {
  const P = P4;
  const parts = cast4Parts(C);
  const eye = (cx, cy, rx, ry, px, py, pr) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${P.white}"/><circle cx="${px}" cy="${py}" r="${pr}" fill="${C.ink}"/><circle cx="${px + pr * 0.35}" cy="${py - pr * 0.4}" r="${Math.max(1.4, pr * 0.3)}" fill="${P.white}"/>`;

  const faces = {
    /* Tacskó: the cute one */
    tacsko: `<path d="M54 70 Q64 64 74 70 M86 70 Q96 64 106 70" stroke="${C.ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
${eye(64, 86, 11, 12, 65, 87, 6)}${eye(96, 86, 11, 12, 97, 87, 6)}
<path d="M80 115 L80 121 M70 121 Q75 128 80 121 Q85 128 90 121" stroke="${C.ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
    /* Majmi: the baby */
    majmi: `<path d="M76 66 Q86 60 94 66 M106 64 Q114 58 124 64" stroke="${C.ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
${eye(86, 78, 11, 12, 88, 79, 5.5)}${eye(114, 78, 11, 12, 116, 79, 5.5)}
<path d="M84 102 Q100 118 116 102 Q100 108 84 102 Z" fill="${C.mouth}"/>`,
    /* Süni: shy */
    suni: `<path d="M72 92 Q80 86 90 90 M110 90 Q120 86 128 92" stroke="${C.ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
${eye(82, 104, 9.5, 10.5, 83, 102, 5)}${eye(118, 104, 9.5, 10.5, 117, 102, 5)}
<path d="M93 140 Q100 145 107 140" stroke="${C.ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
    /* Uborka: cool as a cucumber */
    uborka: `<path d="M74 78 Q84 72 94 78 M110 74 Q120 64 132 72" stroke="${C.ink}" stroke-width="4" fill="none" stroke-linecap="round"/>
${eye(86, 94, 12, 11, 89, 96, 6)}${eye(120, 92, 12, 11, 123, 94, 6)}
<path d="M74 93 C76 82 96 82 98 92 Z M108 91 C110 80 130 80 132 90 Z" fill="${P.cukeDk}"/>
<path d="M74 92 Q86 89 98 92 M108 90 Q120 87 132 90" stroke="${C.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M84 128 Q102 140 122 124" stroke="${C.ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`,
  };

  let seed = 261;
  for (const [name, c] of Object.entries(parts)) {
    const body = `${name[0]}1`, piece = `${name[0]}2`;
    const defs = [paper(body, { seed: seed++ }), paper(piece, { seed: seed++, border: 2.5, dy: 2, blur: 2 })];
    svg(`${name}.svg`, 220, 220, defs, `<g transform="${c.wrap}">${c.behind?.(piece) ?? ''}<g filter="url(#${body})">${c.body}${faces[name]}</g>${c.after?.(piece) ?? ''}</g>`);
  }
}
