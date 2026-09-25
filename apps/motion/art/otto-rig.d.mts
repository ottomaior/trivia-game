/** Pivot points of Ottó's rig, in its 380x490 space. */
export const PIVOTS: Record<'elbow' | 'shoulderBack' | 'shoulderFront' | 'neck' | 'hips', [number, number]>;

/** The rig's filters; `boil` 0–2 shifts their seeds so the edges redraw. */
export function ottoDefs(boil?: number): string;

export const backUpper: string;
export const backFore: string;
export const neck: string;
export const torso: string;
export const frontArm: string;

/** The head with the eyes open or shut, the mouth open 0–1, and the pupils shifted by `look`. */
export function head(options?: { blink?: boolean; mouth?: number; look?: number }): string;
