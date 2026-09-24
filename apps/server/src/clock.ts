/** Injectable time source so the engine can be tested with fake time. */
export type Clock = () => number;

export const systemClock: Clock = () => Date.now();
