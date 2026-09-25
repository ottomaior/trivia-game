// Expressions for the twelve contestants: each body is drawn without a face,
// and each expression is a face recipe placed on the body's anchors
// (eye centres L and R, mouth M, eye size e), plus an optional overlay.
import { cast4Parts } from './cast4.mjs';

export const EXPRESSIONS = ['correct', 'wrong', 'fooled', 'sneaky', 'out', 'frozen', 'slimed'];

export function buildExpressions(C, paper, svg) {
  const K = {
    ink: C.ink, white: '#fbf5e6', mouth: C.mouth, tongue: '#d9707e', blush: C.blush, ice: '#9fc7cc',
    teal: '#3f7d74', tealDk: '#2e5f58', tealLt: '#5a988d', ice2: '#7eaab0', iceLt: '#cde6e8',
    plum: '#6e4b72', plumDk: '#553858', plumLt: '#8b6a8f', cloud: '#efe3c8', cloudDk: '#d6c6a4',
    green: '#8fb04a', greenDk: '#6f8f36', greenLt: '#aac86a', rose: '#d98a8f', roseDk: '#b86a72', roseLt: '#eab0b2',
    slime: '#9cc24a', slimeDk: '#6f9a30', slimeLt: '#c4e07a',
  };
  const piece = (id, seed) => paper(id, { seed, border: 2.5, dy: 2, blur: 2 });

  // Each character: wrap transform, body (inside the body filter, face goes on top), parts behind/after, anchors.
  const CH = {
    gomboc: {
      wrap: 'translate(10 14)', lid: C.mustardDk,
      behind: `<g filter="url(#xa)"><path d="M88 34 C80 12 96 2 102 16 C106 2 124 6 116 34 Z" fill="${C.mustardDk}"/></g>`,
      body: `<path d="M96 28 C140 24 176 56 178 106 C180 154 150 186 104 186 C58 186 24 162 22 118 C20 74 50 32 96 28 Z" fill="${C.mustard}"/>
<path d="M150 58 C174 84 182 128 168 158 C152 182 122 190 98 186 C134 176 160 150 164 112 C166 94 160 74 150 58 Z" fill="${C.mustardDk}" opacity="0.7"/>
<path d="M44 70 C52 56 64 46 78 42" stroke="${C.mustardLt}" stroke-width="7" fill="none" stroke-linecap="round"/>
<ellipse cx="58" cy="130" rx="11" ry="6" fill="${K.blush}" opacity="0.35"/><ellipse cx="146" cy="128" rx="11" ry="6" fill="${K.blush}" opacity="0.35"/>`,
      L: [78, 100], R: [126, 98], M: [100, 140], e: 17, top: 28, cx: 100, w: 150, box: [14, 18, 172, 176],
    },
    kocka: {
      wrap: 'translate(10 12) rotate(-4 100 110)', lid: C.rustDk, glasses: true,
      body: `<path d="M44 40 L156 36 C170 36 176 44 176 58 L178 162 C178 176 170 182 156 182 L48 184 C34 184 26 176 26 162 L24 60 C24 46 32 40 44 40 Z" fill="${C.rust}"/>
<path d="M160 40 C170 42 176 48 176 58 L178 162 C178 176 170 182 156 182 L150 182 C158 176 162 170 162 160 L160 40 Z" fill="${C.rustDk}"/>
<path d="M36 58 C38 50 44 46 54 46" stroke="#cf7456" stroke-width="6" fill="none" stroke-linecap="round"/>
<circle cx="78" cy="98" r="23" fill="#f6f0e0"/><circle cx="132" cy="92" r="23" fill="#f6f0e0"/>`,
      after: `<g filter="url(#xb)"><circle cx="78" cy="98" r="23" fill="none" stroke="${K.ink}" stroke-width="5.5"/><circle cx="132" cy="92" r="23" fill="none" stroke="${K.ink}" stroke-width="5.5"/><path d="M100 96 C104 90 108 90 110 92" stroke="${K.ink}" stroke-width="5" fill="none" stroke-linecap="round"/></g>`,
      L: [78, 98], R: [132, 92], M: [104, 146], e: 17, browLift: 14, top: 36, cx: 101, w: 150, box: [16, 28, 170, 164],
    },
    bab: {
      wrap: 'translate(10 14) rotate(8 100 110)', lid: K.tealDk,
      body: `<path d="M100 18 C130 18 146 38 146 64 L146 140 C146 168 128 186 100 186 C72 186 54 168 54 140 L54 64 C54 38 70 18 100 18 Z" fill="${K.teal}"/>
<path d="M132 30 C142 40 146 52 146 64 L146 140 C146 168 128 186 100 186 C124 176 134 160 134 138 L134 64 C134 52 134 40 132 30 Z" fill="${K.tealDk}" opacity="0.75"/>
<path d="M66 54 C68 42 74 34 84 30" stroke="${K.tealLt}" stroke-width="6" fill="none" stroke-linecap="round"/>
<ellipse cx="72" cy="122" rx="9" ry="5" fill="${K.blush}" opacity="0.4"/><ellipse cx="128" cy="122" rx="9" ry="5" fill="${K.blush}" opacity="0.4"/>`,
      after: `<g filter="url(#xb)"><path d="M48 92 C44 18 156 18 152 92" stroke="${K.ink}" stroke-width="10" fill="none"/><path d="M48 92 C44 18 156 18 152 92" stroke="${C.mustard}" stroke-width="4" fill="none"/>
<rect x="34" y="78" width="24" height="40" rx="10" fill="${C.mustard}"/><rect x="142" y="78" width="24" height="40" rx="10" fill="${C.mustard}"/>
<rect x="40" y="86" width="8" height="24" rx="4" fill="${C.mustardDk}"/><rect x="152" y="86" width="8" height="24" rx="4" fill="${C.mustardDk}"/></g>`,
      L: [82, 102], R: [118, 102], M: [100, 132], e: 12, top: 18, cx: 100, w: 96, box: [26, 6, 148, 190],
    },
    csepp: {
      wrap: 'translate(10 12)', lid: K.ice2,
      body: `<path d="M100 12 C114 40 158 76 158 122 C158 160 132 186 100 186 C68 186 42 160 42 122 C42 76 86 40 100 12 Z" fill="${K.ice}"/>
<path d="M130 60 C150 82 158 104 158 122 C158 160 132 186 100 186 C130 172 146 150 146 122 C146 102 140 80 130 60 Z" fill="${K.ice2}" opacity="0.8"/>
<ellipse cx="66" cy="96" rx="6" ry="14" fill="${K.iceLt}" transform="rotate(22 66 96)"/>
<circle cx="62" cy="150" r="2" fill="${K.ice2}"/><circle cx="68" cy="154" r="2" fill="${K.ice2}"/><circle cx="132" cy="154" r="2" fill="${K.ice2}"/><circle cx="138" cy="150" r="2" fill="${K.ice2}"/>`,
      L: [80, 124], R: [120, 124], M: [100, 160], e: 15, top: 30, cx: 100, w: 64, box: [34, 2, 132, 194],
    },
    csillag: {
      wrap: 'translate(10 10) rotate(-8 100 106)', lid: K.plumDk,
      body: (() => {
        const R = 88, r = 46, cx = 100, cy = 106, pts = [];
        for (let i = 0; i < 10; i++) { const a = (-90 + i * 36) * Math.PI / 180, rad = i % 2 ? r : R; pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`); }
        return `<path d="M${pts.join(' L')} Z" fill="${K.plum}" stroke="${K.plum}" stroke-width="16" stroke-linejoin="round"/>
<path d="M${pts[4]} L${pts[5]} L${pts[6]} Z" fill="${K.plumDk}" stroke="${K.plumDk}" stroke-width="6" stroke-linejoin="round" opacity="0.8"/>
<path d="M92 34 C94 28 98 24 102 22" stroke="${K.plumLt}" stroke-width="5" fill="none" stroke-linecap="round"/>
<ellipse cx="62" cy="130" rx="11" ry="6" fill="${K.blush}" opacity="0.45"/><ellipse cx="140" cy="128" rx="11" ry="6" fill="${K.blush}" opacity="0.45"/>`;
      })(),
      after: `<g filter="url(#xb)"><path d="M100 2 L104 12 L114 14 L104 17 L100 28 L96 17 L86 14 L96 12 Z" fill="${C.mustardLt}"/></g>`,
      L: [76, 104], R: [124, 104], M: [100, 138], e: 15, top: 14, cx: 100, w: 64, box: [6, 8, 188, 186],
    },
    felho: {
      wrap: 'translate(10 14)', lid: K.cloudDk,
      behind: `<g filter="url(#xa)"><path d="M104 62 C112 34 150 18 180 34 C188 38 194 46 196 56 C180 52 166 58 156 72 Z" fill="${K.plum}"/><path d="M110 60 C130 52 150 58 160 72" stroke="${K.plumDk}" stroke-width="5" fill="none"/></g>`,
      body: `<path d="M50 172 C24 172 12 148 26 130 C10 112 22 82 48 86 C48 58 80 42 104 54 C120 32 160 42 158 74 C180 82 186 114 166 126 C180 148 164 174 140 172 Z" fill="${K.cloud}"/>
<path d="M166 126 C180 148 164 174 140 172 L50 172 C34 172 22 162 22 150 C60 162 110 164 146 146 C156 140 162 134 166 126 Z" fill="${K.cloudDk}" opacity="0.8"/>
<ellipse cx="62" cy="138" rx="10" ry="5" fill="${K.blush}" opacity="0.35"/><ellipse cx="142" cy="138" rx="10" ry="5" fill="${K.blush}" opacity="0.35"/>`,
      after: `<g filter="url(#xb)"><circle cx="198" cy="58" r="9" fill="${C.mustard}"/></g>`,
      L: [80, 116], R: [124, 116], M: [102, 146], e: 13, top: 48, cx: 92, w: 130, box: [4, 16, 200, 166],
    },
    szellem: {
      wrap: 'translate(10 18)', lid: K.greenDk,
      body: `<path d="M100 20 C140 20 164 50 164 94 L164 164 C158 176 150 166 142 166 C134 166 128 180 118 180 C108 180 104 166 96 166 C88 166 84 180 74 180 C62 180 56 166 48 166 C42 166 36 174 36 164 L36 94 C36 50 60 20 100 20 Z" fill="${K.green}"/>
<path d="M146 42 C158 56 164 74 164 94 L164 164 C158 176 150 166 142 166 C148 150 152 128 152 100 C152 78 150 58 146 42 Z" fill="${K.greenDk}" opacity="0.75"/>
<path d="M52 70 C56 54 66 42 80 36" stroke="${K.greenLt}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
      after: `<g filter="url(#xb)" transform="rotate(-14 100 22)"><path d="M78 30 L102 -22 L124 28 Z" fill="${C.mustard}"/><path d="M86 14 L114 8 M93 -2 L108 -6" stroke="${C.rust}" stroke-width="5" stroke-linecap="round"/><circle cx="102" cy="-22" r="8" fill="${C.rust}"/></g>`,
      L: [78, 96], R: [122, 98], M: [100, 128], e: 12, top: 22, cx: 100, w: 124, box: [28, -12, 144, 198],
    },
    bogyo: {
      wrap: 'translate(10 10)', lid: K.roseDk, browCap: 120,
      behind: `<g filter="url(#xa)"><path d="M100 34 C100 24 104 14 112 8" stroke="#5a3a24" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M108 18 C120 2 144 6 150 16 C138 26 118 28 108 18 Z" fill="${K.teal}"/></g>`,
      body: `<path d="M100 30 C124 30 132 56 134 72 C154 88 164 112 162 138 C160 170 134 188 100 188 C66 188 40 170 38 138 C36 112 46 88 66 72 C68 56 76 30 100 30 Z" fill="${K.rose}"/>
<path d="M134 72 C154 88 164 112 162 138 C160 170 134 188 100 188 C132 176 150 156 150 132 C150 108 144 88 134 72 Z" fill="${K.roseDk}" opacity="0.75"/>
<path d="M76 58 C80 48 86 40 94 36" stroke="${K.roseLt}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
      after: `<g filter="url(#xb)"><path d="M46 100 C78 88 122 88 154 100 L152 116 C122 104 78 104 48 116 Z" fill="${C.cream}"/><path d="M47 108 C78 96 122 96 153 108" stroke="${K.teal}" stroke-width="5" fill="none"/></g>`,
      L: [82, 140], R: [120, 140], M: [101, 168], e: 12, top: 32, cx: 100, w: 64, box: [30, -2, 140, 200],
    },
  };
  // The animals share their bodies with the idle drawings in cast4.mjs.
  for (const [name, c] of Object.entries(cast4Parts(C))) {
    CH[name] = { ...c, behind: c.behind?.('xa'), after: c.after?.('xb') };
  }

  const f = (n) => n.toFixed(1);
  // Eye whites, unless the character's eyes sit in its glasses (the lenses are the whites).
  const whites = (c, rx, ry) => c.glasses ? '' : [c.L, c.R].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="${f(rx)}" ry="${f(ry)}" fill="${K.white}"/>`).join('');
  const browY = (c, y, lift) => { const b = y - c.e - lift; return c.browCap ? Math.max(b, c.browCap - 6) : b; };

  const FACE = {
    correct(c) {
      const k = c.e / 15, lift = c.browLift ?? 8 * k;
      let s = [c.L, c.R].map(([x, y]) => `<path d="M${f(x - 10 * k)} ${f(browY(c, y, lift + 6 * k))} Q${x} ${f(browY(c, y, lift + 14 * k))} ${f(x + 10 * k)} ${f(browY(c, y, lift + 6 * k))}" stroke="${K.ink}" stroke-width="${f(4 * k)}" fill="none" stroke-linecap="round"/>
<path d="M${f(x - 10 * k)} ${f(y + 3 * k)} Q${x} ${f(y - 11 * k)} ${f(x + 10 * k)} ${f(y + 3 * k)}" stroke="${K.ink}" stroke-width="${f(5 * k)}" fill="none" stroke-linecap="round"/>`).join('');
      const [mx, my] = c.M;
      s += `<path d="M${f(mx - 18 * k)} ${f(my - 6 * k)} Q${mx} ${f(my + 24 * k)} ${f(mx + 18 * k)} ${f(my - 6 * k)} Z" fill="${K.mouth}"/>
<path d="M${f(mx - 8 * k)} ${f(my + 6 * k)} Q${mx} ${f(my + 15 * k)} ${f(mx + 8 * k)} ${f(my + 6 * k)} Q${mx} ${f(my + 1 * k)} ${f(mx - 8 * k)} ${f(my + 6 * k)} Z" fill="${K.tongue}"/>`;
      return s;
    },
    wrong(c) {
      const k = c.e / 15, lift = c.browLift ?? 2 * k;
      const [lx, ly] = c.L, [rx, ry] = c.R, [mx, my] = c.M;
      let s = whites(c, c.e * 0.8, c.e * 0.85);
      s += `<path d="M${f(lx - 11 * k)} ${f(browY(c, ly, lift))} L${f(lx + 8 * k)} ${f(browY(c, ly, lift + 8 * k))} M${f(rx + 11 * k)} ${f(browY(c, ry, lift))} L${f(rx - 8 * k)} ${f(browY(c, ry, lift + 8 * k))}" stroke="${K.ink}" stroke-width="${f(4.5 * k)}" stroke-linecap="round"/>`;
      s += [c.L, c.R].map(([x, y]) => `<circle cx="${x}" cy="${f(y + c.e * 0.32)}" r="${f(c.e * 0.42)}" fill="${K.ink}"/><circle cx="${f(x + c.e * 0.14)}" cy="${f(y + c.e * 0.18)}" r="${f(Math.max(1.4, c.e * 0.12))}" fill="${K.white}"/>`).join('');
      s += `<path d="M${f(mx - 14 * k)} ${f(my + 7 * k)} Q${mx} ${f(my - 8 * k)} ${f(mx + 14 * k)} ${f(my + 7 * k)}" stroke="${K.ink}" stroke-width="${f(4.5 * k)}" fill="none" stroke-linecap="round"/>`;
      s += `<path d="M${f(lx - 8 * k)} ${f(ly + c.e + 2 * k)} C${f(lx - 3 * k)} ${f(ly + c.e + 10 * k)} ${f(lx - 2 * k)} ${f(ly + c.e + 16 * k)} ${f(lx - 8 * k)} ${f(ly + c.e + 17 * k)} C${f(lx - 14 * k)} ${f(ly + c.e + 16 * k)} ${f(lx - 13 * k)} ${f(ly + c.e + 10 * k)} ${f(lx - 8 * k)} ${f(ly + c.e + 2 * k)} Z" fill="${K.ice}"/>`;
      return s;
    },
    fooled(c) {
      const k = c.e / 15, lift = c.browLift ?? 12 * k;
      const [mx, my] = c.M;
      let s = whites(c, c.e * 1.05, c.e * 1.15);
      s += [c.L, c.R].map(([x, y]) => `<path d="M${f(x - 10 * k)} ${f(browY(c, y, lift))} Q${x} ${f(browY(c, y, lift + 9 * k))} ${f(x + 10 * k)} ${f(browY(c, y, lift))}" stroke="${K.ink}" stroke-width="${f(4 * k)}" fill="none" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="${f(c.e * 0.24)}" fill="${K.ink}"/>`).join('');
      s += `<ellipse cx="${mx}" cy="${f(my + 4 * k)}" rx="${f(8 * k)}" ry="${f(11 * k)}" fill="${K.mouth}"/>`;
      return s;
    },
    sneaky(c) {
      const k = c.e / 15;
      const [lx, ly] = c.L, [rx, ry] = c.R, [mx, my] = c.M;
      let s = whites(c, c.e * 0.9, c.e * 0.75);
      s += [c.L, c.R].map(([x, y]) => `<circle cx="${f(x + c.e * 0.4)}" cy="${f(y + 2 * k)}" r="${f(c.e * 0.38)}" fill="${K.ink}"/>
<path d="M${f(x - c.e * 0.98)} ${f(y + 1 * k)} C${f(x - c.e * 0.9)} ${f(y - c.e * 1.05)} ${f(x + c.e * 0.9)} ${f(y - c.e * 1.05)} ${f(x + c.e * 0.98)} ${f(y + 1 * k)} Z" fill="${c.lid}"/>
<path d="M${f(x - c.e * 0.98)} ${f(y + 1 * k)} L${f(x + c.e * 0.98)} ${f(y + 1 * k)}" stroke="${K.ink}" stroke-width="${f(3.2 * k)}" stroke-linecap="round"/>`).join('');
      const lift = c.browLift ?? 0;
      s += `<path d="M${f(lx - 10 * k)} ${f(browY(c, ly, lift - 2 * k))} L${f(lx + 10 * k)} ${f(browY(c, ly, lift + 1 * k))}" stroke="${K.ink}" stroke-width="${f(4.5 * k)}" stroke-linecap="round"/>
<path d="M${f(rx - 10 * k)} ${f(browY(c, ry, lift + 8 * k))} Q${rx} ${f(browY(c, ry, lift + 17 * k))} ${f(rx + 10 * k)} ${f(browY(c, ry, lift + 6 * k))}" stroke="${K.ink}" stroke-width="${f(4.5 * k)}" fill="none" stroke-linecap="round"/>`;
      s += `<path d="M${f(mx - 15 * k)} ${f(my + 2 * k)} Q${f(mx + 2 * k)} ${f(my + 9 * k)} ${f(mx + 16 * k)} ${f(my - 7 * k)}" stroke="${K.ink}" stroke-width="${f(4.5 * k)}" fill="none" stroke-linecap="round"/>`;
      return s;
    },
    out(c) {
      const k = c.e / 15;
      const [mx, my] = c.M;
      let s = whites(c, c.e * 0.95, c.e * 0.95);
      s += [c.L, c.R].map(([x, y], side) => {
        const pts = [];
        for (let t = 0; t <= Math.PI * 4; t += 0.25) { const r = c.e * 0.8 * t / (Math.PI * 4); pts.push(`${f(x + r * Math.cos(side ? t : -t))} ${f(y + r * Math.sin(side ? t : -t))}`); }
        return `<path d="M${pts.join(' L')}" stroke="${K.ink}" stroke-width="${f(2.8 * k)}" fill="none" stroke-linecap="round"/>`;
      }).join('');
      s += `<path d="M${f(mx - 15 * k)} ${my} Q${f(mx - 7.5 * k)} ${f(my - 7 * k)} ${mx} ${my} Q${f(mx + 7.5 * k)} ${f(my + 7 * k)} ${f(mx + 15 * k)} ${my}" stroke="${K.ink}" stroke-width="${f(4 * k)}" fill="none" stroke-linecap="round"/>`;
      return s;
    },
    frozen(c) {
      const k = c.e / 15, lift = c.browLift ?? 4 * k;
      const [lx, ly] = c.L, [rx, ry] = c.R, [mx, my] = c.M;
      let s = whites(c, c.e * 0.9, c.e);
      s += [c.L, c.R].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${f(c.e * 0.34)}" fill="${K.ink}"/>`).join('');
      s += `<path d="M${f(lx - 11 * k)} ${f(browY(c, ly, lift))} L${f(lx + 8 * k)} ${f(browY(c, ly, lift + 8 * k))} M${f(rx + 11 * k)} ${f(browY(c, ry, lift))} L${f(rx - 8 * k)} ${f(browY(c, ry, lift + 8 * k))}" stroke="${K.ink}" stroke-width="${f(4 * k)}" stroke-linecap="round"/>`;
      const w = 20 * k, h = 9 * k;
      let zig = `M${f(mx - w)} ${my}`;
      for (let i = 1; i <= 8; i++) zig += ` L${f(mx - w + (i * 2 * w) / 8)} ${f(my + (i % 2 ? -h / 3 : h / 3))}`;
      s += `<rect x="${f(mx - w)} " y="${f(my - h)}" width="${f(2 * w)}" height="${f(2 * h)}" rx="${f(4 * k)}" fill="${K.white}" stroke="${K.ink}" stroke-width="${f(3 * k)}"/><path d="${zig}" stroke="${K.ink}" stroke-width="${f(2.2 * k)}" fill="none" stroke-linejoin="round"/>`;
      return s;
    },
    slimed(c) {
      const k = c.e / 15;
      const [lx, ly] = c.L, [rx, ry] = c.R, [mx, my] = c.M;
      let s = `<path d="M${f(lx - 9 * k)} ${f(ly - 8 * k)} L${f(lx + 7 * k)} ${ly} L${f(lx - 9 * k)} ${f(ly + 8 * k)} M${f(rx + 9 * k)} ${f(ry - 8 * k)} L${f(rx - 7 * k)} ${ry} L${f(rx + 9 * k)} ${f(ry + 8 * k)}" stroke="${K.ink}" stroke-width="${f(4.5 * k)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      s += `<path d="M${f(mx - 16 * k)} ${f(my - 2 * k)} Q${f(mx - 8 * k)} ${f(my + 5 * k)} ${mx} ${f(my - 1 * k)} Q${f(mx + 8 * k)} ${f(my - 6 * k)} ${f(mx + 16 * k)} ${f(my + 1 * k)}" stroke="${K.ink}" stroke-width="${f(4.5 * k)}" fill="none" stroke-linecap="round"/>
<path d="M${f(mx - 6 * k)} ${f(my + 1 * k)} L${f(mx - 6 * k)} ${f(my + 10 * k)} Q${mx} ${f(my + 18 * k)} ${f(mx + 6 * k)} ${f(my + 10 * k)} L${f(mx + 6 * k)} ${f(my - 2 * k)} Z" fill="${K.tongue}"/>`;
      return s;
    },
  };

  const OVERLAY = {
    correct(c) {
      return `<g filter="url(#xo)"><path d="M${c.cx + c.w / 2 + 4} ${c.top + 6} l4 10 l10 3 l-10 3 l-4 10 l-4 -10 l-10 -3 l10 -3 Z" fill="${C.mustardLt}"/></g>`;
    },
    fooled(c) {
      const x = c.cx + c.w / 2 - 6, y = c.top - 4;
      return `<g filter="url(#xo)"><path d="M${x} ${y + 14} l10 -12 M${x + 8} ${y + 22} l16 -6 M${x - 8} ${y + 8} l2 -16" stroke="${C.cream}" stroke-width="5" stroke-linecap="round"/></g>`;
    },
    out(c) {
      const y = c.top - 18, cx = c.cx;
      const star = (x, yy, r) => {
        let d = '';
        for (let i = 0; i < 10; i++) { const a = (-90 + i * 36) * Math.PI / 180, rad = i % 2 ? r * 0.45 : r; d += `${i ? 'L' : 'M'}${f(x + rad * Math.cos(a))} ${f(yy + rad * Math.sin(a))} `; }
        return `<path d="${d}Z" fill="${C.mustardLt}"/>`;
      };
      return `<g filter="url(#xo)"><ellipse cx="${cx}" cy="${y}" rx="48" ry="11" fill="none" stroke="${C.cream}" stroke-width="2.5" stroke-dasharray="6 6"/>${star(cx - 44, y + 2, 11)}${star(cx + 6, y - 11, 9)}${star(cx + 44, y + 4, 10)}</g>`;
    },
    frozen(c) {
      const [x, y, w, h] = c.box;
      let icicles = '';
      for (let i = 0; i < 5; i++) { const ix = x + 16 + i * (w - 32) / 4, len = 12 + (i % 2) * 10; icicles += `<path d="M${f(ix - 7)} ${y + h - 2} L${f(ix)} ${y + h + len} L${f(ix + 7)} ${y + h - 2} Z" fill="#cfeaf0"/>`; }
      return `<g filter="url(#xi)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#bfe3ea" opacity="0.32"/>${icicles}
<path d="M${x + 16} ${y + 34} L${x + 44} ${y + 12} M${x + 16} ${y + 58} L${x + 64} ${y + 18} M${x + w - 30} ${y + h - 20} L${x + w - 12} ${y + h - 38}" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.8"/>
<path d="M${x + 6} ${y + 10} Q${x + w / 2} ${y - 6} ${x + w - 6} ${y + 10}" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.7"/></g>`;
    },
    slimed(c) {
      const { cx, top } = c, w = c.w;
      const L = cx - w / 2, Rr = cx + w / 2;
      const d = `M${f(L)} ${top + 16} C${f(L)} ${top - 10} ${f(Rr)} ${top - 10} ${f(Rr)} ${top + 16} L${f(Rr)} ${top + 30} Q${f(Rr - 8)} ${top + 42} ${f(cx + w * 0.3)} ${top + 32} L${f(cx + w * 0.3)} ${top + 60} Q${f(cx + w * 0.3 - 7)} ${top + 72} ${f(cx + w * 0.3 - 14)} ${top + 60} L${f(cx + w * 0.3 - 14)} ${top + 36} Q${cx} ${top + 46} ${f(cx - w * 0.12)} ${top + 34} L${f(cx - w * 0.12)} ${top + 46} Q${f(cx - w * 0.12 - 7)} ${top + 56} ${f(cx - w * 0.12 - 14)} ${top + 46} L${f(cx - w * 0.12 - 14)} ${top + 34} Q${f(cx - w * 0.36)} ${top + 44} ${f(L)} ${top + 30} Z`;
      return `<g filter="url(#xs)"><path d="${d}" fill="${K.slime}"/><path d="M${f(L + 10)} ${top + 12} Q${cx} ${top - 4} ${f(Rr - 20)} ${top + 6}" stroke="${K.slimeLt}" stroke-width="5" fill="none" stroke-linecap="round"/>
<circle cx="${f(Rr + 10)}" cy="${top + 8}" r="5" fill="${K.slime}"/><circle cx="${f(L - 8)}" cy="${top + 22}" r="4" fill="${K.slime}"/></g>`;
    },
  };

  const defs = [
    paper('xa', { seed: 401, border: 2.5, dy: 2, blur: 2 }), paper('xb', { seed: 403, border: 2.5, dy: 2, blur: 2 }),
    paper('xo', { seed: 407, border: 2, wobble: 1.5, blur: 1.5, dy: 2 }),
    paper('xi', { seed: 409, border: 2.5, wobble: 3, shadow: 0.25 }), paper('xs', { seed: 411, border: 2.5, wobble: 3 }),
  ];
  let seed = 421;
  for (const [name, c] of Object.entries(CH)) {
    for (const ex of EXPRESSIONS) {
      const bodyId = `xf${seed}`;
      const d = [...defs, paper(bodyId, { seed: seed++ })];
      const overlay = OVERLAY[ex] ? OVERLAY[ex](c) : '';
      const behindOverlay = ex === 'out' ? overlay : '';
      svg(`${name}-${ex}.svg`, 220, 220, d, `<g transform="${c.wrap}">${behindOverlay}${c.behind ?? ''}<g filter="url(#${bodyId})">${c.body}${FACE[ex](c)}</g>${c.after ?? ''}${ex === 'out' ? '' : overlay}</g>`);
    }
  }
  return Object.keys(CH);
}
