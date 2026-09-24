import { OTTO_REVEAL_DELAY_MS, type Phase } from '@trivia/shared';

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

export type ShotName = 'wide' | 'board' | 'contestants' | 'scores' | 'otto' | 'podium' | 'orbitLeft' | 'orbitRight';

export const SHOTS: Record<ShotName, Shot> = {
  wide: { x: 0, y: 0, z: 0, rotationY: 0 },
  // Push in on the question board (it hangs high, so look up a little).
  board: { x: 0, y: -3, z: 14, rotationY: 0 },
  // Look down at the contestant desks.
  contestants: { x: 6, y: 12, z: 12, rotationY: 0 },
  // Close on Otto at his podium (bottom left).
  otto: { x: -24, y: 8, z: 22, rotationY: 5 },
  // The standings on the board and the desks re-sorting below it, together.
  scores: { x: 2, y: 2, z: 3, rotationY: 0 },
  // The final: the winners' podium rising at centre stage, then a slow drift around it.
  podium: { x: 2, y: 1, z: 2, rotationY: 0 },
  orbitLeft: { x: 0, y: 1.5, z: 3, rotationY: 3 },
  orbitRight: { x: 5, y: 1, z: 3, rotationY: -3 },
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
      // Push in on the title card, then back out to the whole studio.
      return [
        { at: 0, shot: 'board', duration: 1 },
        { at: 2.5, shot: 'wide', duration: 1.3 },
      ];
    case 'vote':
    case 'vote_result':
    case 'ladder_step':
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
      return [{ at: 0, shot: 'scores', duration: 0.9 }];
    case 'final':
      // The final screen stays up until the VIP acts, so the camera keeps drifting.
      return [
        { at: 0, shot: 'podium', duration: 1.5 },
        { at: 4, shot: 'orbitLeft', duration: 5 },
        { at: 9, shot: 'orbitRight', duration: 6 },
        { at: 15, shot: 'podium', duration: 5 },
      ];
  }
}

/** Seconds into the reveal when each beat happens; CSS and particles use the same times. */
export const REVEAL_BEATS = {
  wrongDropStart: 0.1,
  wrongDropStep: 0.15,
  correctFlash: 0.75,
  toContestants: 1.5,
  pointsFly: 1.9,
  /** Otto comments (the server holds the reveal until he's done). */
  otto: OTTO_REVEAL_DELAY_MS / 1000,
} as const;
