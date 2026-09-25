import { isInputPhase, type HostView } from '@trivia/shared';
import { gsap } from 'gsap';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { TvStage } from '../tv/TvStage.tsx';
import { Desks } from './Desks.tsx';
import { REVEAL_BEATS, SHOTS, shotsFor, type ShotName } from './director.ts';
import { fx } from './fx.ts';
import { FxLayer } from './FxLayer.tsx';
import { OttoRig } from './OttoRig.tsx';
import { fxForcedByUrl } from '../ui/lowfx.ts';
import { measureFps, tooSlow, type FpsSample, type SampleKind } from './perfGuard.ts';
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
  usePowerEffects(rootRef, view);
  usePerfGuard(onTooSlow, lite, phase);

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
              bubbleHideMs={phase === 'question_read' || isInputPhase(phase) ? 1_800 : phase === 'scoreboard' ? 2_600 : phase === 'reveal' ? 4_500 : phase === 'ladder_step' ? 3_000 : undefined}
              lively={!lite}
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
      // In the final, wait for the winner's podium block to finish rising.
      at(stage.phase === 'final' ? 3.2 : 0.9, () => {
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

/** A projectile from thrower to target as each power play lands; sparks as its target breaks free. */
function usePowerEffects(rootRef: React.RefObject<HTMLDivElement | null>, view: HostView) {
  const hits = 'hits' in view.stage ? view.stage.hits : [];
  const seen = useRef({ round: view.round, thrown: 0, cleared: new Set<number>() });
  const thrown = hits.length;
  const clearedKey = hits.map((h) => (h.cleared ? 1 : 0)).join('');
  useEffect(() => {
    const root = rootRef.current;
    if (seen.current.round !== view.round) seen.current = { round: view.round, thrown: 0, cleared: new Set() };
    const before = seen.current;
    const desk = (id: string) => (root ? rectOf(root, `[data-desk="${id}"]`) : null);
    hits.forEach((h, i) => {
      if (i >= before.thrown) {
        const from = desk(h.by);
        const to = desk(h.target);
        if (from && to) fx.fly(from, to, 10);
      }
      if (h.cleared && !before.cleared.has(i)) {
        before.cleared.add(i);
        const at = desk(h.target);
        if (at) fx.sparks(at, 25);
      }
    });
    before.thrown = thrown;
  }, [view.round, thrown, clearedKey]); // only when a hit lands or clears; the view is read as it was then
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
/** Phases with a lot going on, where an idle sample would be unfair. */
const BUSY_PHASES: ReadonlySet<HostView['stage']['phase']> = new Set(['intro', 'reveal', 'scoreboard', 'final']);

/**
 * Measures the frame rate twice per mode per session: once while the studio
 * idles (also the browser's own ceiling), and once in the first reveal, the
 * busiest moment. Too slow: step down (full → lite → flat); the next mode
 * measures itself again.
 */
function usePerfGuard(onTooSlow: () => void, lite: boolean, phase: HostView['stage']['phase']) {
  const mode = lite ? 'lite' : 'full';
  const calm = !BUSY_PHASES.has(phase);
  const busy = phase === 'reveal';

  useEffect(() => {
    if (!calm || fxForcedByUrl() || sessionSample(mode, 'idle')) return;
    const m = measureFps('idle', mode);
    m.result.then((sample) => {
      rememberSample(mode, 'idle', sample);
      if (tooSlow(sample)) onTooSlow();
    });
    return () => m.cancel();
  }, [onTooSlow, mode, calm]);

  useEffect(() => {
    if (!busy || fxForcedByUrl() || sessionSample(mode, 'reveal')) return;
    let m: ReturnType<typeof measureFps> | null = null;
    // From the correct tile's flash on: the sparks, the flying points and the faces.
    const timer = setTimeout(() => {
      m = measureFps('reveal', mode);
      m.result.then((sample) => {
        rememberSample(mode, 'reveal', sample);
        if (tooSlow(sample, sessionSample(mode, 'idle') ?? undefined)) onTooSlow();
      });
    }, REVEAL_BEATS.correctFlash * 1000);
    return () => {
      clearTimeout(timer);
      m?.cancel();
    };
  }, [onTooSlow, mode, busy]);
}

function sessionSample(mode: string, kind: SampleKind): FpsSample | null {
  try {
    const raw = sessionStorage.getItem(`otto.fps.${mode}.${kind}`);
    return raw ? (JSON.parse(raw) as FpsSample) : null;
  } catch {
    return null;
  }
}

function rememberSample(mode: string, kind: SampleKind, sample: FpsSample): void {
  try {
    sessionStorage.setItem(`otto.fps.${mode}.${kind}`, JSON.stringify(sample));
  } catch {
    // ignore
  }
}
