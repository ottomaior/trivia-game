import { AbsoluteFill, Audio, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import { loadFont as loadShrikhand } from '@remotion/google-fonts/Shrikhand';
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo';
import type { FC } from 'react';
import voices from '../../web/public/voice/manifest.json';
import { C, paper } from '../art/paperlib.mjs';
import { ottoDefs, backUpper, backFore, neck, torso, head, frontArm } from '../art/otto-rig.mjs';

const { fontFamily: SHRIKHAND } = loadShrikhand();
const { fontFamily: ARCHIVO } = loadArchivo('normal', { weights: ['800'], subsets: ['latin', 'latin-ext'] });

export const FPS = 30;
export const DURATION = 300;
const LOGO_AT = 40;
const LOGO_MOVE_AT = 82;
const WALK_AT = 84;
const WALK_FRAMES = 30;
const VOICE_AT = 118;
/** The welcome line the clip uses, and how long it is (from the voice manifest, so a retake stays in sync). */
export const VOICE_LINE = 'welcome-1';
const VOICE_FRAMES = Math.ceil(((voices as Record<string, { durationMs: number }>)[VOICE_LINE]!.durationMs / 1000) * FPS);
const CAST_AT = 182;
const CAST = ['gomboc', 'kocka', 'bab', 'csepp', 'csillag', 'felho', 'szellem', 'bogyo'];

const CREAM = '#f6eedb';
const sticker = (px: number) =>
  [[px, 0], [-px, 0], [0, px], [0, -px], [px * 0.7, px * 0.7], [-px * 0.7, px * 0.7], [px * 0.7, -px * 0.7], [-px * 0.7, -px * 0.7]]
    .map(([x, y]) => `${x}px ${y}px 0 ${CREAM}`)
    .join(', ') + `, ${px}px ${px * 2}px ${px * 2}px rgba(18,5,8,0.5)`;

const FULL = 'filterUnits="userSpaceOnUse" x="-80" y="-80" width="1440" height="880"';
function stageDefs(boil: number): string {
  const s = boil * 53;
  return [
    paper('sRays', { seed: 71 + s, border: 0, wobble: 6, freq: 0.02, shadow: 0.35, blur: 5, dx: 0, dy: 3, region: FULL }),
    paper('sArch', { seed: 73 + s, border: 3, wobble: 5, freq: 0.03, region: FULL }),
    paper('sFloor', { seed: 79 + s, border: 2.5, wobble: 9, freq: 0.02, shadow: 0.5, blur: 6, dx: 0, dy: -3, region: FULL }),
    paper('sLip', { seed: 83 + s, border: 3, wobble: 8, freq: 0.025, shadow: 0.55, blur: 8, dx: 0, dy: -6, region: FULL }),
    paper('sBulb', { seed: 89 + s, border: 1.8, wobble: 1.5, shadow: 0.3, blur: 1.5, dx: 1, dy: 2, region: FULL }),
    `<radialGradient id="glow"><stop offset="0" stop-color="#ffd978" stop-opacity="0.85"/><stop offset="1" stop-color="#ffd978" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="spot"><stop offset="0" stop-color="#ffe3a0" stop-opacity="0.32"/><stop offset="1" stop-color="#ffe3a0" stop-opacity="0"/></radialGradient>`,
  ].join('\n');
}

const RAYS = (() => {
  let d = '';
  for (let i = 0; i < 20; i++) {
    const a0 = (i * 18 * Math.PI) / 180, a1 = ((i * 18 + 9) * Math.PI) / 180, R = 1700;
    d += `<path d="M0 0 L${(R * Math.cos(a0)).toFixed(1)} ${(R * Math.sin(a0)).toFixed(1)} L${(R * Math.cos(a1)).toFixed(1)} ${(R * Math.sin(a1)).toFixed(1)} Z" fill="#3a1823"/>`;
  }
  return d;
})();

const AX = 640, AY = 400, RO = 430, RI = 382, RB = 406;
const BULBS = Array.from({ length: 25 }, (_, i) => {
  const a = ((180 + i * 7.5) * Math.PI) / 180;
  return [AX + RB * Math.cos(a), AY + RB * Math.sin(a)] as const;
});

export const ShowOpen: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const boil = Math.floor(frame / 3) % 3;
  const voice = useAudioData(staticFile('audio/welcome-1.mp3'));

  // Stage.
  const raysIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const archDrop = spring({ frame: frame - 6, fps, config: { damping: 11, stiffness: 120 } });
  const litUntil = (frame - 20) / 1.1;

  // Logo: slam, hold, then move up to the corner.
  const slam = spring({ frame: frame - LOGO_AT, fps, config: { damping: 8, stiffness: 190 } });
  const move = spring({ frame: frame - LOGO_MOVE_AT, fps, config: { damping: 15, stiffness: 90 } });
  const logoScale = interpolate(slam, [0, 1], [2.8, 1]) * interpolate(move, [0, 1], [1.3, 0.62]);
  const logoX = interpolate(move, [0, 1], [960, 310]);
  const logoY = interpolate(move, [0, 1], [430, 140]);
  const tag = interpolate(frame, [LOGO_AT + 22, LOGO_AT + 36], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const shakeAmp = frame >= LOGO_AT + 4 && frame < LOGO_AT + 18 ? ((LOGO_AT + 18 - frame) / 14) * 14 : 0;
  const shakeX = (random(`sx${frame}`) - 0.5) * shakeAmp, shakeY = (random(`sy${frame}`) - 0.5) * shakeAmp;

  // Ottó: hop in from the right, then talk and wave.
  const walkT = interpolate(frame, [WALK_AT, WALK_AT + WALK_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const arrive = spring({ frame: frame - WALK_AT, fps, config: { damping: 14, stiffness: 70 } });
  const ottoX = interpolate(arrive, [0, 1], [1420, 430]);
  const walking = walkT > 0 && walkT < 1;
  const hop = walking ? -Math.abs(Math.sin(walkT * Math.PI * 4)) * 22 : 0;
  const land = spring({ frame: frame - (WALK_AT + WALK_FRAMES), fps, config: { damping: 7, stiffness: 200 } });
  const squash = frame >= WALK_AT + WALK_FRAMES ? 1 - 0.04 * Math.sin(land * Math.PI) : 1;
  const lean = walking ? -5 : interpolate(frame, [WALK_AT + WALK_FRAMES, WALK_AT + WALK_FRAMES + 10], [-5, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const talking = frame >= VOICE_AT && frame < VOICE_AT + VOICE_FRAMES;
  let mouth = 0;
  if (voice && talking) {
    const bins = visualizeAudio({ fps, frame: frame - VOICE_AT, audioData: voice, numberOfSamples: 32, smoothing: true });
    const amp = bins.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    mouth = Math.max(0, Math.min(1, (amp - 0.015) * 7));
  }
  const waveOn = interpolate(frame, [VOICE_AT - 4, VOICE_AT + 4, VOICE_AT + 56, VOICE_AT + 66], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const wave = Math.sin((frame - VOICE_AT) / 3.2) * 22 * waveOn + (walking ? Math.sin(walkT * Math.PI * 8) * 8 : 0);
  const tilt = talking ? Math.sin(frame / 9) * 3 + mouth * 2 : Math.sin(frame / 20) * 1.2;
  const blink = [100, 101, 176, 177, 238, 239].includes(frame);
  const look = frame > CAST_AT + 6 && frame < CAST_AT + 50 ? -3 : 0;
  const micArm = walking ? Math.sin(walkT * Math.PI * 8 + 1) * 4 : talking ? -2 - mouth * 3 : 0;
  const spotOn = interpolate(frame, [WALK_AT + 20, WALK_AT + 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const camera = interpolate(frame, [230, DURATION], [1, 1.045], { extrapolateLeft: 'clamp' });
  const fadeOut = interpolate(frame, [DURATION - 10, DURATION], [1, 0], { extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#1c0910' }}>
      <Audio src={staticFile('audio/start.mp3')} volume={0.7} />
      <Sequence from={VOICE_AT}>
        <Audio src={staticFile('audio/welcome-1.mp3')} />
      </Sequence>
      <Sequence from={CAST_AT + 6}>
        <Audio src={staticFile('audio/applause.mp3')} volume={0.4} />
      </Sequence>
      <AbsoluteFill style={{ transform: `translate(${shakeX}px, ${shakeY}px) scale(${camera})`, transformOrigin: '60% 45%', opacity: fadeOut }}>
        <svg viewBox="0 0 1280 720" width={1920} height={1080}>
          <defs dangerouslySetInnerHTML={{ __html: stageDefs(boil) + ottoDefs(boil) }} />
          <rect width="1280" height="720" fill={C.bg} />
          <g opacity={raysIn} filter="url(#sRays)">
            <g transform={`translate(${AX} ${AY - 60}) rotate(${frame * 0.12})`} dangerouslySetInnerHTML={{ __html: RAYS }} />
          </g>
          <g transform={`translate(0 ${interpolate(archDrop, [0, 1], [-560, 0])})`}>
            <g filter="url(#sArch)">
              <path d={`M${AX - RO} ${AY} A${RO} ${RO} 0 0 1 ${AX + RO} ${AY} L${AX + RI} ${AY} A${RI} ${RI} 0 0 0 ${AX - RI} ${AY} Z`} fill={C.mustard} />
            </g>
            {BULBS.map(([x, y], i) => {
              const lit = i <= litUntil;
              const chase = frame > 50 && (i + Math.floor(frame / 3)) % 4 === 0;
              return <circle key={`g${i}`} cx={x} cy={y} r={chase ? 22 : 17} fill="url(#glow)" opacity={lit ? 1 : 0} />;
            })}
            <g filter="url(#sBulb)">
              {BULBS.map(([x, y], i) => (
                <circle key={`b${i}`} cx={x} cy={y} r={7} fill={i <= litUntil ? '#fff1c2' : '#7a5a3a'} />
              ))}
            </g>
          </g>
          <ellipse cx={ottoX + 180} cy={560} rx={260} ry={300} fill="url(#spot)" opacity={spotOn} />
          <g filter="url(#sFloor)">
            <path d="M-20 574 C180 566 420 580 640 570 C860 560 1080 578 1300 566 L1300 760 L-20 760 Z" fill={C.floor} />
            <path d="M-20 612 L1300 604" stroke={C.floor2} strokeWidth="3" />
          </g>
          <g transform={`translate(${ottoX} ${250 + hop}) scale(1 ${squash}) rotate(${lean} 180 470)`}>
            <g transform="rotate(0 250 290)">
              <g dangerouslySetInnerHTML={{ __html: backUpper }} />
              <g transform={`rotate(${wave} 318 326)`} dangerouslySetInnerHTML={{ __html: backFore }} />
            </g>
            <g dangerouslySetInnerHTML={{ __html: neck }} />
            <g dangerouslySetInnerHTML={{ __html: torso }} />
            <g transform={`rotate(${tilt} 180 250)`} dangerouslySetInnerHTML={{ __html: head({ blink, mouth, look }) }} />
            <g transform={`rotate(${micArm} 104 292)`} dangerouslySetInnerHTML={{ __html: frontArm }} />
          </g>
          {CAST.map((name, i) => {
            const pop = spring({ frame: frame - (CAST_AT + i * 5), fps, config: { damping: 9, stiffness: 160 } });
            const x = i < 4 ? 14 + i * 112 : 830 + (i - 4) * 112;
            const y = interpolate(pop, [0, 1], [720, 520]) + (pop > 0.98 ? Math.sin((frame + i * 7) / 6) * 3 : 0);
            const face = frame > CAST_AT + i * 5 + 10 ? `${name}-correct.svg` : `${name}.svg`;
            return <image key={name} href={staticFile(`art/${face}`)} x={x} y={y} width={120} height={120} />;
          })}
          <g filter="url(#sLip)">
            <path d="M-20 652 C240 644 520 656 760 648 C1000 640 1160 654 1300 646 L1300 760 L-20 760 Z" fill="#3a1822" />
            <path d="M-20 652 C240 644 520 656 760 648 C1000 640 1160 654 1300 646" stroke={C.mustard} strokeWidth="7" fill="none" />
          </g>
        </svg>
        <div
          style={{
            position: 'absolute', left: logoX, top: logoY, opacity: frame < LOGO_AT ? 0 : 1,
            transform: `translate(-50%, -50%) scale(${logoScale}) rotate(${interpolate(slam, [0, 1], [-12, -3])}deg)`,
            textAlign: 'center', lineHeight: 0.92, whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontFamily: SHRIKHAND, fontSize: 70, color: '#b8553a', textShadow: sticker(5) }}>Otto's</div>
          <div style={{ fontFamily: SHRIKHAND, fontSize: 132, color: '#d9a13b', textShadow: sticker(6) }}>Quiz Show</div>
          <div style={{ clipPath: `inset(-20px ${100 - tag}% -20px 0)`, lineHeight: 1.5, fontFamily: ARCHIVO, fontWeight: 800, fontSize: 30, letterSpacing: '0.22em', color: CREAM, marginTop: 22, textShadow: '2px 3px 4px rgba(18,5,8,0.6)' }}>
            AZ ÉVSZÁZAD KVÍZMŰSORA
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
