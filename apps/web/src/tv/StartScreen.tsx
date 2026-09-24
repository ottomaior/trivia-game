import { t } from '@trivia/shared';
import { Logo } from '../ui/Logo.tsx';
import { OttoFace } from '../ui/Otto.tsx';
import styles from './Tv.module.css';
import { VoiceCredit } from './VoiceCredit.tsx';

/**
 * The TV's first screen. The click is required anyway: it unlocks sound and
 * fullscreen, which browsers only allow after a user gesture.
 */
export function StartScreen({ onStart, disabled }: { onStart: () => void; disabled: boolean }) {
  return (
    <div className={styles.start}>
      <OttoFace size="16em" />
      <div className={styles.startRight}>
        <Logo />
        <p className={styles.tagline}>{t.tagline}</p>
        <button className={styles.bigButton} onClick={onStart} disabled={disabled} autoFocus>
          {t.start}
        </button>
      </div>
      <VoiceCredit className={styles.voiceCreditCorner} />
    </div>
  );
}
