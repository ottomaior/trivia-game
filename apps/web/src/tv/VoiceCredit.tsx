import { t } from '@trivia/shared';
import { useVoiceCredit } from '../audio/voiceCredit.ts';
import styles from './Tv.module.css';

/** "Ottó hangja: …", shown only when the voice service asks for a credit. */
export function VoiceCredit({ className = '' }: { className?: string }) {
  const credit = useVoiceCredit();
  if (!credit) return null;
  return (
    <p className={`${styles.voiceCredit} ${className}`} data-testid="voice-credit">
      {t.voiceCredit(credit)}
    </p>
  );
}
