import { ottoText, type OttoLine } from '@trivia/shared';
import styles from './Otto.module.css';

/** Otto, the host: slicked hair, big mustache, bow tie. Drawn in SVG. */
export function OttoFace({ size = '12em' }: { size?: string }) {
  const ink = 'var(--burgundy)';
  return (
    <svg viewBox="0 0 200 220" width={size} height={size} aria-hidden="true" className={styles.face}>
      {/* suit and bow tie */}
      <path d="M30 220 C34 176 66 160 100 160 C134 160 166 176 170 220 Z" fill="var(--teal)" stroke={ink} strokeWidth="5" />
      <path d="M84 160 L100 200 L116 160 Z" fill="var(--cream)" stroke={ink} strokeWidth="4" />
      <path d="M78 168 L100 178 L78 190 Z M122 168 L100 178 L122 190 Z" fill="var(--rust)" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
      <circle cx="100" cy="178" r="6" fill="var(--rust)" stroke={ink} strokeWidth="4" />
      {/* head */}
      <ellipse cx="100" cy="96" rx="62" ry="70" fill="#E9B98F" stroke={ink} strokeWidth="5" />
      <ellipse cx="38" cy="102" rx="10" ry="16" fill="#E9B98F" stroke={ink} strokeWidth="5" />
      <ellipse cx="162" cy="102" rx="10" ry="16" fill="#E9B98F" stroke={ink} strokeWidth="5" />
      {/* slicked hair with a shine */}
      <path d="M38 88 C36 40 70 20 104 22 C140 24 166 46 162 88 C150 60 124 50 96 52 C70 54 50 66 38 88 Z" fill="#3A1A10" stroke={ink} strokeWidth="5" strokeLinejoin="round" />
      <path d="M70 40 C86 32 106 30 122 34" stroke="var(--cream)" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.6" />
      {/* eyebrows and eyes */}
      <path d="M60 76 Q74 66 88 74" stroke="#3A1A10" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M112 74 Q126 66 140 76" stroke="#3A1A10" strokeWidth="7" fill="none" strokeLinecap="round" />
      <circle cx="76" cy="92" r="7" fill={ink} className={styles.eye} />
      <circle cx="124" cy="92" r="7" fill={ink} className={styles.eye} />
      {/* nose */}
      <path d="M100 96 Q112 118 98 122" stroke={ink} strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* the mustache */}
      <path
        className={styles.mustache}
        d="M100 128 C88 118 66 118 54 128 C44 136 34 132 30 124 C30 142 48 152 66 146 C80 142 92 136 100 134 C108 136 120 142 134 146 C152 152 170 142 170 124 C166 132 156 136 146 128 C134 118 112 118 100 128 Z"
        fill="#3A1A10"
        stroke={ink}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* grin */}
      <path d="M82 148 Q100 160 118 148" stroke={ink} strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Otto with a speech bubble. The bubble hides when there's nothing to say. */
export function Otto({ line, size }: { line: OttoLine | null; size?: string }) {
  const text = line ? ottoText(line) : null;
  return (
    <div className={styles.otto}>
      <OttoFace size={size} />
      {text && (
        <p className={styles.bubble} key={text} data-testid="otto-line">
          {text}
        </p>
      )}
    </div>
  );
}
