import { strings, type Lang } from '@trivia/shared';
import { Logo } from '../ui/Logo.tsx';
import styles from './Tv.module.css';

/**
 * The first screen on the TV. Picking a language is also the click that
 * unlocks audio in the browser (needed from Phase 2 on).
 */
export function LanguagePicker({ onPick, disabled }: { onPick: (lang: Lang) => void; disabled: boolean }) {
  return (
    <div className={styles.picker}>
      <Logo />
      <p className={styles.tagline}>
        {strings('hu').chooseLanguage} · {strings('en').chooseLanguage}
      </p>
      <div className={styles.langButtons}>
        <button className={styles.langButton} onClick={() => onPick('hu')} disabled={disabled} autoFocus>
          Magyar
        </button>
        <button className={styles.langButton} onClick={() => onPick('en')} disabled={disabled}>
          English
        </button>
      </div>
    </div>
  );
}
