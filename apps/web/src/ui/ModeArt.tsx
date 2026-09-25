import type { GameMode } from '@trivia/shared';
import styles from './ModeArt.module.css';

// The lobby's section cards, on the phone and the TV, each carry a piece of
// the game's own paper props: the answer tiles for the quiz, the ladder, the
// bluffer's mask, Időrend's clothes-peg and a betting chip.

const ART: Record<Exclude<GameMode, 'classic'>, string> = {
  ladder: '/art/ladder.svg',
  bluff: '/art/mask.svg',
  timeline: '/art/peg.svg',
  guess: '/art/chip-teal.svg',
};

/** The icon of a game mode; `size` (a CSS length) is the box it fills. */
export function ModeArt({ mode, size = '3em' }: { mode: GameMode; size?: string }) {
  if (mode === 'classic') {
    return (
      <span className={styles.tiles} style={{ width: size, height: size }} aria-hidden="true">
        {['a', 'b', 'c', 'd'].map((letter) => (
          <img key={letter} src={`/art/tile-${letter}.svg`} alt="" draggable={false} />
        ))}
      </span>
    );
  }
  return <img className={styles.art} src={ART[mode]} alt="" aria-hidden="true" draggable={false} style={{ width: size, height: size }} />;
}
