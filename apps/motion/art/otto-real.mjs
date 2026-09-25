// Otto, drawn after the real Ottó. Exports the SVG body pieces for build.mjs.
export function ottoReal(C, paper) {
  const O = {
    suit: '#3a3540', suitDk: '#27232c', lapel: '#2d2933', vest: '#312c36', shirt: '#f4efe4',
    tie: '#d2bc9f', tieDk: '#b59e82', skin: '#ecbfa0', skinDk: '#d9a283', lid: '#e0ab8d',
    beard: '#5f4231', beardDk: '#4a3225', beardLt: '#7d5a42', stache: '#523727', brow: '#6a4630', iris: '#6f8a92',
  };
  const defs = [
    paper('pA', { seed: 3 }), paper('pT', { seed: 7 }), paper('pH', { seed: 13 }),
    paper('pM', { seed: 19, border: 3, dy: 3 }), paper('pF', { seed: 29 }), paper('pN', { seed: 31, border: 0, shadow: 0.25 }),
    paper('pS', { seed: 37, border: 2.5, dy: 2, blur: 2 }),
  ];
  const backArm = `<g filter="url(#pA)">
<path d="M246 262 C272 268 300 280 324 294 L314 316 C290 306 266 296 242 288 Z" fill="${O.suit}"/>
<path d="M308 302 C318 282 326 262 332 240 L352 246 C348 270 340 292 328 314 Z" fill="${O.suit}"/>
<path d="M330 244 L352 250 L354 240 L332 234 Z" fill="${O.shirt}"/>
<path d="M328 238 C320 220 324 196 338 192 L352 190 C362 190 366 200 364 214 L362 232 C360 244 350 250 340 248 Z" fill="${O.skin}"/>
<path d="M330 234 C318 232 312 220 318 214 C324 210 330 220 334 226 Z" fill="${O.skin}"/>
<path d="M344 196 L343 216 M354 194 L353 216" stroke="${O.skinDk}" stroke-width="2.5" stroke-linecap="round"/>
</g>
<g filter="url(#pS)"><path d="M327 252 L349 258 L346 268 L324 262 Z" fill="#1f1d24"/><circle cx="337" cy="260" r="10" fill="#1f1d24"/><circle cx="337" cy="260" r="6.5" fill="#5a5763"/></g>`;
  const neck = `<g filter="url(#pN)"><path d="M160 210 L200 210 L202 252 L158 252 Z" fill="${O.skinDk}"/></g>`;
  const torso = `<g filter="url(#pT)">
<path d="M100 262 C120 246 150 240 180 240 C210 240 240 246 260 262 C280 300 292 380 296 460 L64 460 C68 380 80 300 100 262 Z" fill="${O.suit}"/>
<path d="M226 250 C252 262 272 300 282 360 L288 460 L262 460 C262 380 250 300 226 250 Z" fill="${O.suitDk}" opacity="0.6"/>
<path d="M150 244 L180 336 L210 244 C196 240 164 240 150 244 Z" fill="${O.shirt}"/>
<path d="M152 244 L166 256 L180 246 M208 244 L194 256 L180 246" stroke="#ddd5c4" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
<path d="M174 262 L186 262 L193 322 L180 338 L167 322 Z" fill="${O.tie}"/>
<path d="M176 280 L190 272 M175 298 L191 290 M173 316 L192 306" stroke="${O.tieDk}" stroke-width="2" opacity="0.7"/>
<path d="M146 290 L168 290 L180 322 L192 290 L214 290 L216 400 L144 400 Z" fill="${O.vest}"/>
<circle cx="180" cy="346" r="3.5" fill="#18161b"/><circle cx="180" cy="370" r="3.5" fill="#18161b"/>
<path d="M150 244 L180 336 L160 360 L112 266 C124 254 136 247 150 244 Z" fill="${O.lapel}"/>
<path d="M210 244 L180 336 L200 360 L248 266 C236 254 224 247 210 244 Z" fill="${O.lapel}"/>
<path d="M222 304 L256 296 L258 308 L224 316 Z" fill="${O.suitDk}"/>
<path d="M130 390 L160 386 M200 386 L230 390" stroke="${O.suitDk}" stroke-width="4" stroke-linecap="round"/>
</g>
<g filter="url(#pS)"><path d="M170 244 L190 244 L188 262 L172 262 Z" fill="${O.tieDk}"/></g>
<g filter="url(#pS)"><path d="M228 302 L236 288 L243 298 L251 290 L254 300 Z" fill="${O.tie}"/></g>`;
  const head = `<g transform="rotate(-5 180 150)">
<g filter="url(#pH)">
<ellipse cx="112" cy="150" rx="14" ry="22" fill="${O.skinDk}"/>
<ellipse cx="250" cy="150" rx="14" ry="22" fill="${O.skinDk}"/>
<path d="M108 142 Q114 150 110 160 M254 142 Q248 150 252 160" stroke="#c48a6c" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M180 30 C234 30 256 76 254 132 C252 184 228 226 180 230 C132 226 108 184 106 132 C104 76 126 30 180 30 Z" fill="${O.skin}"/>
<path d="M228 56 C248 82 256 118 252 150 C246 190 224 218 190 228 C220 206 236 176 238 140 C240 110 238 80 228 56 Z" fill="${O.skinDk}" opacity="0.6"/>
<ellipse cx="150" cy="58" rx="24" ry="9" fill="#fff4e8" opacity="0.6" transform="rotate(-22 150 58)"/>
<ellipse cx="193" cy="44" rx="8" ry="4" fill="#fff4e8" opacity="0.6"/>
<path d="M152 88 C168 84 194 84 210 88" stroke="${O.skinDk}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.5"/>
<ellipse cx="136" cy="156" rx="12" ry="7" fill="${C.blush}" opacity="0.35"/>
<ellipse cx="224" cy="156" rx="12" ry="7" fill="${C.blush}" opacity="0.35"/>
<ellipse cx="152" cy="126" rx="13" ry="9" fill="#fbf5e6"/>
<ellipse cx="210" cy="126" rx="13" ry="9" fill="#fbf5e6"/>
<circle cx="154" cy="129" r="5.5" fill="${O.iris}"/><circle cx="212" cy="129" r="5.5" fill="${O.iris}"/>
<circle cx="154" cy="129" r="2.6" fill="${C.ink}"/><circle cx="212" cy="129" r="2.6" fill="${C.ink}"/>
<circle cx="156" cy="128" r="1.4" fill="#fbf5e6"/><circle cx="214" cy="128" r="1.4" fill="#fbf5e6"/>
<path d="M136 129 C138 112 166 110 168 127 Z" fill="${O.lid}"/>
<path d="M194 129 C196 112 224 110 226 127 Z" fill="${O.lid}"/>
<path d="M137 128 C146 123 160 122 167 126 M195 128 C204 123 218 122 225 126" stroke="${C.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M141 133 C148 137 158 137 164 133 M199 133 C206 137 216 137 222 133" stroke="${O.skinDk}" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M130 114 C142 106 158 106 169 113 L167 119 C156 114 144 114 132 120 Z" fill="${O.brow}"/>
<path d="M192 111 C202 104 218 103 231 110 L229 116 C216 110 204 111 194 117 Z" fill="${O.brow}"/>
<path d="M180 118 C176 138 170 152 172 160 C176 168 192 168 194 160 C194 152 186 138 180 118 Z" fill="#e3ad8f"/>
<path d="M175 160 C177 163 181 163 183 161" stroke="${O.skinDk}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</g>
<g filter="url(#pM)">
<path d="M112 136 C112 178 128 212 152 228 C166 238 194 238 208 228 C232 212 248 178 248 136 C244 160 238 178 228 188 C220 178 210 174 200 174 C192 174 186 176 180 176 C174 176 168 174 160 174 C150 174 140 178 132 188 C122 178 116 160 112 136 Z" fill="${O.beard}"/>
<path d="M162 222 C172 230 190 230 200 222 C194 234 168 234 162 222 Z" fill="${O.beardDk}"/>
<path d="M126 192 l4 6 M140 208 l4 6 M222 192 l-4 6 M210 208 l-4 6 M176 220 l1 6 M188 220 l-1 6 M120 166 l3 6 M240 166 l-3 6" stroke="${O.beardLt}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M150 182 C158 172 172 172 180 176 C188 172 202 172 210 182 C200 185 190 184 180 182 C170 184 160 185 150 182 Z" fill="${O.stache}"/>
<path d="M170 195 C178 199 190 198 197 193 C190 195 178 196 170 195 Z" fill="#c98072"/>
<path d="M166 192 C176 194 189 193 201 185" stroke="#4a2a22" stroke-width="3.5" fill="none" stroke-linecap="round"/>
</g>
</g>`;
  const frontArm = `<g filter="url(#pF)">
<path d="M98 262 C82 290 74 330 78 366 L102 370 C106 336 112 300 124 276 Z" fill="${O.suit}"/>
<path d="M80 356 C98 346 120 334 134 322 L148 342 C128 358 106 374 90 380 Z" fill="${O.suit}"/>
<path d="M130 318 L140 314 L152 336 L144 342 Z" fill="${O.shirt}"/>
<path d="M146 344 L158 252" stroke="${C.ink}" stroke-width="8" stroke-linecap="round"/>
<path d="M150 318 L153 296" stroke="${C.mustard}" stroke-width="10"/>
<ellipse cx="160" cy="244" rx="14" ry="16" fill="#4a4550"/>
<path d="M150 238 L170 238 M149 245 L171 245 M151 252 L169 252" stroke="#6e6878" stroke-width="2"/>
<path d="M136 330 C132 316 142 306 154 308 C166 310 170 324 164 336 C158 346 142 346 136 330 Z" fill="${O.skin}"/>
<path d="M142 318 C148 316 156 317 162 320" stroke="${O.skinDk}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</g>`;
  return { defs, body: `<g transform="translate(0 20)">${backArm}\n${neck}\n${torso}\n${head}\n${frontArm}</g>` };
}
