import type { Phase } from '@trivia/shared';

// The studio "camera": named shots and which one each moment of the show
// uses. Pure data here (unit-tested); Studio.tsx animates between them.

/**
 * Where the camera looks, in em (1em = 1/54 of the screen height): +x looks
 * right, +y looks down, +z moves closer; plus a slight turn in degrees.
 */
export interface Shot {
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

export type ShotName = 'wide' | 'board' | 'contestants' | 'otto' | 'podium';

export const SHOTS: Record<ShotName, Shot> = {
  wide: { x: 0, y: 0, z: 0, rotationY: 0 },
  // Push in on the question board (it hangs high, so look up a little).
  board: { x: 0, y: -3, z: 14, rotationY: 0 },
  // Look down at the contestant desks.
  contestants: { x: 6, y: 12, z: 12, rotationY: 0 },
  // Close on Otto at his podium (bottom left).
  otto: { x: -24, y: 8, z: 22, rotationY: 5 },
  podium: { x: 0, y: -1, z: 6, rotationY: -2 },
};

export interface CameraCue {
  /** Seconds after the phase starts. */
  at: number;
  shot: ShotName;
  /** Seconds the move takes. */
  duration: number;
}

/** The camera moves for a phase, in order. */
export function shotsFor(phase: Phase): CameraCue[] {
  switch (phase) {
    case 'lobby':
      return [{ at: 0, shot: 'wide', duration: 1.2 }];
    case 'intro':
      return [
        { at: 0, shot: 'otto', duration: 1.2 },
        { at: 2.8, shot: 'wide', duration: 1 },
      ];
    case 'vote':
    case 'vote_result':
    case 'question_read':
      return [{ at: 0, shot: 'board', duration: 1 }];
    case 'question_open':
      // Pull back so the desks' "locked in" lamps are in view.
      return [{ at: 0.2, shot: 'wide', duration: 1.4 }];
    case 'reveal':
      return [
        { at: 0, shot: 'board', duration: 0.6 },
        { at: 1.5, shot: 'contestants', duration: 0.9 },
        { at: 3.6, shot: 'wide', duration: 1.2 },
      ];
    case 'scoreboard':
      return [{ at: 0, shot: 'contestants', duration: 0.9 }];
    case 'final':
      return [{ at: 0, shot: 'podium', duration: 1.5 }];
  }
}

/** Seconds into the reveal when each beat happens; CSS and particles use the same times. */
export const REVEAL_BEATS = {
  wrongDropStart: 0.1,
  wrongDropStep: 0.15,
  correctFlash: 0.75,
  toContestants: 1.5,
  pointsFly: 1.9,
  otto: 3.2,
} as const;
