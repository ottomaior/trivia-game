import { FREEZE_TAPS, SLIME_CLEAR_SHARE, t } from '@trivia/shared';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import styles from './Phone.module.css';

// What a power play does to its target's phone: the answer buttons disappear
// under ice (tap it to pieces) or slime (wipe it off). Until `active` (answers
// open) the cover only sits there. `onCleared` fires once, after the cover's
// exit animation.

interface CoverProps {
  active: boolean;
  /** Who threw it, shown on the cover. */
  byline: string;
  onCleared: () => void;
}

const EXIT_MS = 380;

/** Crack lines (from the middle outwards) revealed as the ice weakens. */
const CRACKS = [
  'M50 50 L38 30 L30 8',
  'M50 50 L66 36 L80 12',
  'M50 50 L74 56 L96 52',
  'M50 50 L60 72 L66 96',
  'M50 50 L34 66 L18 88',
  'M50 50 L26 48 L4 40',
  'M38 30 L20 26',
  'M66 36 L84 38',
  'M60 72 L78 80',
  'M34 66 L30 84',
  'M26 48 L16 60',
  'M74 56 L86 70',
];

export function FreezeCover({ active, byline, onCleared }: CoverProps) {
  const [taps, setTaps] = useState(0);
  const broken = taps >= FREEZE_TAPS;
  useClearedAfterExit(broken, onCleared);

  const tap = () => {
    if (!active || broken) return;
    navigator.vibrate?.(taps + 1 >= FREEZE_TAPS ? [30, 30, 60] : 12);
    setTaps((n) => n + 1);
  };
  const shown = Math.ceil((taps / FREEZE_TAPS) * CRACKS.length);
  return (
    <div
      className={`${styles.cover} ${styles.ice} ${broken ? styles.coverGone : ''}`}
      onPointerDown={tap}
      role="button"
      aria-label={t.powerTapToBreak(FREEZE_TAPS - taps)}
      data-testid="ice"
      style={{ '--wobble': taps % 2 ? '1' : '-1' } as CSSProperties}
    >
      <svg className={styles.cracks} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {CRACKS.slice(0, shown).map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
      <span className={styles.coverBy}>{byline}</span>
      <span className={styles.coverLabel}>{active ? t.powerTapToBreak(FREEZE_TAPS - taps) : t.getReady}</span>
    </div>
  );
}

/** Coverage is tracked on a coarse grid rather than read back from the canvas. */
const COLS = 10;
const ROWS = 14;

export function SlimeCover({ active, byline, onCleared }: CoverProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grid = useRef(new Uint8Array(COLS * ROWS));
  const last = useRef<{ x: number; y: number } | null>(null);
  const [wiped, setWiped] = useState(0);
  const done = wiped >= SLIME_CLEAR_SHARE;
  useClearedAfterExit(done, onCleared);

  // Paint the goo once, at the canvas's real pixel size.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const g = canvas.getContext('2d');
    if (!g) return;
    g.scale(dpr, dpr);
    paintSlime(g, width, height);
  }, []);

  function wipe(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const g = canvas?.getContext('2d');
    if (!active || done || !canvas || !g) return;
    const rect = canvas.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const from = last.current ?? p;
    last.current = p;
    const brush = Math.max(rect.width, rect.height) * 0.16;

    const dpr = canvas.width / rect.width;
    g.save();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    g.lineCap = 'round';
    g.lineWidth = brush;
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(p.x + 0.01, p.y);
    g.stroke();
    g.restore();

    // Mark every grid cell the brush passed over.
    const cellW = rect.width / COLS;
    const cellH = rect.height / ROWS;
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - from.x, p.y - from.y) / (brush / 4)));
    for (let s = 0; s <= steps; s++) {
      const x = from.x + ((p.x - from.x) * s) / steps;
      const y = from.y + ((p.y - from.y) * s) / steps;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (Math.hypot((c + 0.5) * cellW - x, (r + 0.5) * cellH - y) <= brush / 2) grid.current[r * COLS + c] = 1;
        }
      }
    }
    const share = grid.current.reduce((n, v) => n + v, 0) / grid.current.length;
    if (share !== wiped) setWiped(share);
  }

  return (
    <div className={`${styles.cover} ${styles.slime} ${done ? styles.coverGone : ''}`} data-testid="slime">
      <canvas
        ref={canvasRef}
        className={styles.slimeCanvas}
        onPointerDown={(e) => {
          last.current = null;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          wipe(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'touch') wipe(e);
        }}
        onPointerUp={() => (last.current = null)}
      />
      <span className={styles.coverBy}>{byline}</span>
      <span className={styles.coverLabel}>{active ? t.powerWipe : t.getReady}</span>
    </div>
  );
}

function useClearedAfterExit(gone: boolean, onCleared: () => void) {
  const callback = useRef(onCleared);
  callback.current = onCleared;
  useEffect(() => {
    if (!gone) return;
    const id = setTimeout(() => callback.current(), EXIT_MS);
    return () => clearTimeout(id);
  }, [gone]);
}

/** Green goo with darker lumps, shiny bubbles and drips. */
function paintSlime(g: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#c4e07a');
  grad.addColorStop(0.5, '#9cc24a');
  grad.addColorStop(1, '#6f9a30');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const r = Math.min(w, h);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = i % 3 === 0 ? 'rgba(63, 110, 28, 0.55)' : 'rgba(170, 222, 96, 0.5)';
    g.beginPath();
    g.ellipse(Math.random() * w, Math.random() * h, r * (0.05 + Math.random() * 0.12), r * (0.04 + Math.random() * 0.1), Math.random() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const br = r * (0.012 + Math.random() * 0.03);
    g.fillStyle = 'rgba(255, 255, 255, 0.35)';
    g.beginPath();
    g.arc(x, y, br, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255, 255, 255, 0.7)';
    g.beginPath();
    g.arc(x - br * 0.35, y - br * 0.35, br * 0.3, 0, Math.PI * 2);
    g.fill();
  }
}
