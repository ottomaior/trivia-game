import { NAME_MAX_LENGTH, ROOM_CODE_LENGTH, type Strings } from '@trivia/shared';
import { useState, type FormEvent } from 'react';
import { Logo } from '../ui/Logo.tsx';
import styles from './Phone.module.css';

interface Props {
  initialCode: string;
  onJoin: (code: string, name: string) => void;
  busy: boolean;
  error: string | null;
  t: Strings;
}

export function JoinForm({ initialCode, onJoin, busy, error, t }: Props) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (code.trim() && name.trim()) onJoin(code, name);
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <Logo small />
      <label className={styles.field}>
        <span>{t.enterCode}</span>
        <input
          className={`${styles.input} ${styles.codeInput}`}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={ROOM_CODE_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          name="code"
        />
      </label>
      <label className={styles.field}>
        <span>{t.enterName}</span>
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="nickname"
          autoFocus={Boolean(initialCode)}
          name="name"
        />
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button className={styles.primary} type="submit" disabled={busy || !code.trim() || !name.trim()}>
        {t.join}
      </button>
    </form>
  );
}
