import type { HostView } from '@trivia/shared';
import { gsap } from 'gsap';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { TvStage } from '../tv/TvStage.tsx';
import { Desks } from './Desks.tsx';
import { REVEAL_BEATS, SHOTS, shotsFor, type ShotName } from './director.ts';
import { fx } from './fx.ts';
import { FxLayer } from './FxLayer.tsx';
import { OttoRig } from './OttoRig.tsx';
import { fxForcedByUrl } from '../ui/lowfx.ts';
import { measureFps, MIN_FPS } from './perfGuard.ts';
import { StudioContext } from './StudioContext.ts';
import styles from './Studio.module.css';

/** 1em in px on the TV (the TV sizes everything from the screen height). */
const em = () => window.innerHeight / 54;

/**
 * The 2.5D studio: a CSS 3D set (sunburst backdrop, question board, Otto's
 * podium, contestant desks) moved by a "camera", with a WebGL light and
 * particle layer on top. The existing screens render on the board.
 */
export function Studio({ view, lite, onTooSlow }: { view: HostView; lite: boolean; onTooSlow: () => void }) {
  const cameraRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const phase = view.stage.phase;

  useCamera(cameraRef, phase, view.round);
  useStageEffects(rootRef, shakeRef, view);
  usePerfGuard(onTooSlow, lite);

  return (
    <div className={styles.studio} ref={rootRef} data-phase={phase} data-lite={lite}>
      <div className={styles.shake} ref={shakeRef}>
        <div className={styles.camera} ref={cameraRef}>
          <div className={styles.backdrop}>
            <div className={styles.sunburst} />
            <div className={styles.arch} />
          </div>
          <div className={styles.board}>
            <div className={styles.bezel}>
              <div className={styles.screen}>
                <StudioContext.Provider value={true}>
                  <TvStage view={view} />
                </StudioContext.Provider>
              </div>
            </div>
          </div>
          <div className={styles.podiumArea}>
            <OttoRig
              line={view.otto}
              players={view.players}
              bubbleDelayMs={phase === 'reveal' ? REVEAL_BEATS.otto * 1000 : 0}
              bubbleHideMs={phase === 'question_read' || phase === 'question_open' ? 1_800 : undefined}
            />
          </div>
          <div className={styles.deskArea}>
            <Desks view={view} />
          </div>
          <div className={styles.floor} />
        </div>
      </div>
      {!lite && <FxLayer />}
      <div className={styles.grain} />
      <div className={styles.vignette} />
    </div>
  );
}

function toCamera(shot: ShotName) {
  const s = SHOTS[shot];
  const u = em();
  return { x: -s.x * u, y: -s.y * u, z: s.z * u, rotationY: s.rotationY };
}

/** Plays the phase's camera moves. */
function useCamera(ref: React.RefObject<HTMLDivElement | null>, phase: HostView['stage']['phase'], round: number) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tl = gsap.timeline();
    for (const cue of shotsFor(phase)) {
      tl.to(el, { ...toCamera(cue.shot), duration: cue.duration, ease: 'power2.inOut' }, cue.at);
    }
    return () => {
      tl.kill();
    };
  }, [ref, phase, round]);
}

const rectOf = (root: HTMLElement, selector: string) => root.querySelector(selector)?.getBoundingClientRect() ?? null;

/** Sparks, flying points, shakes and spotlights, timed to the show's beats. */
function useStageEffects(
  rootRef: React.RefObject<HTMLDivElement | null>,
  shakeRef: React.RefObject<HTMLDivElement | null>,
  view: HostView,
) {
  const { stage } = view;
  const key = `${stage.phase}-${view.round}`;
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (s: number, fn: () => void) => timers.push(setTimeout(fn, s * 1000));
    fx.spotlight(null);

    if (stage.phase === 'reveal') {
      const winners = stage.picks.filter((p) => p.correct);
      at(REVEAL_BEATS.correctFlash, () => {
        const tile = rectOf(root, '[data-testid="correct-tile"]');
        if (winners.length > 0 && tile) fx.sparks(tile);
        if (winners.length === 0) shake(shakeRef.current);
      });
      at(REVEAL_BEATS.pointsFly, () => {
        const tile = rectOf(root, '[data-testid="correct-tile"]');
        for (const w of winners) {
          const desk = rectOf(root, `[data-desk="${w.playerId}"]`);
          if (tile && desk) fx.fly(tile, desk);
        }
      });
      at(REVEAL_BEATS.otto, () => {
        const focus = view.otto?.focus[0];
        const desk = focus ? rectOf(root, `[data-desk="${focus}"]`) : null;
        fx.spotlight(desk);
      });
    }
    if (stage.phase === 'scoreboard' || stage.phase === 'final') {
      at(0.9, () => {
        const leader = stage.standings[0];
        fx.spotlight(leader ? rectOf(root, `[data-desk="${leader.playerId}"]`) : null);
      });
    }
    if (stage.phase === 'final') {
      at(2.2, () => fx.confetti());
      at(5, () => fx.confetti(80));
    }
    return () => timers.forEach(clearTimeout);
  }, [key]); // once per phase and round; the view is read as it was at that moment
}

function shake(el: HTMLElement | null) {
  if (!el) return;
  const u = em();
  gsap.fromTo(
    el,
    { x: 0, y: 0 },
    {
      keyframes: [
        { x: -0.6 * u, y: 0.3 * u },
        { x: 0.5 * u, y: -0.4 * u },
        { x: -0.35 * u, y: 0.2 * u },
        { x: 0.2 * u, y: -0.1 * u },
        { x: 0, y: 0 },
      ],
      duration: 0.45,
      ease: 'power1.out',
    },
  );
}

/**
 * Measures the frame rate once per mode per session. Too slow: step down
 * (full → lite → flat); the next mode measures itself again.
 */
function usePerfGuard(onTooSlow: () => void, lite: boolean) {
  useEffect(() => {
    const flag = `otto.fpsChecked.${lite ? 'lite' : 'full'}`;
    if (fxForcedByUrl() || sessionStorageFlag(flag)) return;
    const m = measureFps();
    m.result.then((fps) => {
      markSessionFlag(flag);
      if (fps < MIN_FPS) onTooSlow();
    });
    return () => m.cancel();
  }, [onTooSlow, lite]);
}

function sessionStorageFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function markSessionFlag(key: string): void {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    // ignore
  }
}
