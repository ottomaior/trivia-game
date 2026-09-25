// The studio talks to its light and particle layer through this handle, so
// the layer's WebGL engine (Pixi, a big chunk) is only downloaded when the
// full studio mounts FxLayer, and never in the lite or flat modes.

export interface FxApi {
  sparks(rect: DOMRect, count?: number): void;
  confetti(count?: number): void;
  fly(from: DOMRect, to: DOMRect, count?: number): void;
  spotlight(rect: DOMRect | null): void;
}

let live: FxApi | null = null;

/** Called by FxLayer with the real engine once mounted, and with null when it unmounts. */
export function setFx(api: FxApi | null): void {
  live = api;
}

/** The effects, or silent no-ops while there is no layer (lite/flat modes, or before it mounted). */
export const fx: FxApi = {
  sparks: (rect, count) => live?.sparks(rect, count),
  confetti: (count) => live?.confetti(count),
  fly: (from, to, count) => live?.fly(from, to, count),
  spotlight: (rect) => live?.spotlight(rect),
};
