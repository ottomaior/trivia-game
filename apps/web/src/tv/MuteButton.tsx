import { t } from '@trivia/shared';
import { audio } from '../audio/engine.ts';
import { useMuted } from '../audio/useAudioCues.ts';
import styles from './Tv.module.css';

/** Small speaker toggle in the TV corner (the M key does the same). */
export function MuteButton() {
  const muted = useMuted();
  return (
    <button
      className={styles.mute}
      onClick={() => {
        audio.unlock();
        audio.toggleMute();
      }}
      aria-pressed={muted}
      aria-label={muted ? t.soundOn : t.soundOff}
      title={`${muted ? t.soundOn : t.soundOff} (M)`}
      data-testid="mute"
    >
      <svg viewBox="0 0 24 24" width="1.6em" height="1.6em" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? (
          <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        ) : (
          <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
