// Shared palette and paper-cutout filter.
export const C = {
  bg: '#2c121a', bgRay: '#3a1823', floor: '#4a2130', floor2: '#381720',
  mustard: '#d9a13b', mustardDk: '#b8832a', mustardLt: '#ebc26a',
  teal: '#3f7d74', tealDk: '#2e5f58', tealLt: '#5a988d',
  rust: '#b8553a', rustDk: '#96432d',
  plum: '#6e4b72', plumDk: '#553858',
  ice: '#9fc7cc', cream: '#efe3c8', paper: '#f6eedb',
  skin: '#e8b890', skinDk: '#d49a74', skinLid: '#d8a07c',
  hair: '#4a2a1c', hairLt: '#6e4330', brow: '#3a2016',
  ink: '#2a1a14', mouth: '#5a1f22', blush: '#d97a64',
};

/**
 * A paper-cutout filter: wobbles the outline, adds paper grain, a cream
 * cut-out border and a soft drop shadow. `border` 0 = no border.
 */
export function paper(id, { seed = 1, wobble = 3.5, freq = 0.035, border = 3.5, shadow = 0.42, blur = 3, dx = 2, dy = 4, grain = 1.4, region = null } = {}) {
  const reg = region ?? 'x="-20%" y="-20%" width="140%" height="145%"';
  const slope = (0.42 * grain).toFixed(3);
  const icpt = (1 - 0.42 * grain * 0.62).toFixed(3);
  const ft = (ch) => `<feFunc${ch} type="linear" slope="${slope}" intercept="${icpt}"/>`;
  const borderPart = border > 0
    ? `<feMorphology in="wob" operator="dilate" radius="${border}" result="thick"/>
<feFlood flood-color="${C.paper}"/><feComposite in2="thick" operator="in" result="rim"/>
<feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="${seed + 5}" result="rn"/>
<feColorMatrix in="rn" type="saturate" values="0" result="rng"/>
<feComponentTransfer in="rng" result="rns"><feFuncR type="linear" slope="0.25" intercept="0.82"/><feFuncG type="linear" slope="0.25" intercept="0.82"/><feFuncB type="linear" slope="0.25" intercept="0.82"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>
<feBlend in="rim" in2="rns" mode="multiply" result="rimg"/><feComposite in="rimg" in2="thick" operator="in" result="border"/>`
    : `<feMerge result="thick"><feMergeNode in="wob"/></feMerge>`;
  return `<filter id="${id}" ${reg} color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${seed}" result="warp"/>
<feDisplacementMap in="SourceGraphic" in2="warp" scale="${wobble}" xChannelSelector="R" yChannelSelector="G" result="wob"/>
<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="${seed + 11}" result="n1"/>
<feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="${seed + 23}" result="n2"/>
<feBlend in="n1" in2="n2" mode="multiply" result="n"/>
<feColorMatrix in="n" type="saturate" values="0" result="ng"/>
<feComponentTransfer in="ng" result="ns">${ft('R')}${ft('G')}${ft('B')}<feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>
<feBlend in="wob" in2="ns" mode="multiply" result="mul"/>
<feComposite in="mul" in2="wob" operator="in" result="tex"/>
${borderPart}
<feGaussianBlur in="thick" stdDeviation="${blur}" result="sblur"/>
<feOffset in="sblur" dx="${dx}" dy="${dy}" result="soff"/>
<feFlood flood-color="#120508" flood-opacity="${shadow}"/>
<feComposite in2="soff" operator="in" result="shadow"/>
<feMerge><feMergeNode in="shadow"/>${border > 0 ? '<feMergeNode in="border"/>' : ''}<feMergeNode in="tex"/></feMerge>
</filter>`;
}

