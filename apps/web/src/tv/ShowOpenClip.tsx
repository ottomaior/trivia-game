import { useEffect, useRef } from 'react';
import { useMuted } from '../audio/useAudioCues.ts';
import { SHOW_OPEN_SRC } from './showOpen.ts';
import styles from './Tv.module.css';

/**
 * The show open, full-screen inside the bulb frame, for the length of the
 * intro. It follows the mute button, holds while the game is paused, and
 * reports a clip that won't load or play (autoplay refused, say) so the TV
 * falls back to the title card and its sounds.
 */
export function ShowOpenClip({ paused, onFail }: { paused: boolean; onFail: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const muted = useMuted();
  const failed = useRef(false);
  const fail = () => {
    if (failed.current) return;
    failed.current = true;
    onFail();
  };

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (paused) video.pause();
    else video.play().catch(fail);
  }, [paused]); // `fail` only reports once, so it needn't be a dependency

  return (
    <video
      ref={ref}
      className={styles.showOpen}
      src={SHOW_OPEN_SRC}
      playsInline
      preload="auto"
      onError={fail}
      aria-hidden="true"
      data-testid="show-open"
    />
  );
}
