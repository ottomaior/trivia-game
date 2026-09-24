import { createContext, useContext } from 'react';

/**
 * True when a screen renders on the studio's board rather than full screen.
 * Screens then leave out what the studio already shows around the board:
 * Otto (he stands at his podium) and the player row (players sit at desks).
 */
export const StudioContext = createContext(false);

export function useInStudio(): boolean {
  return useContext(StudioContext);
}
