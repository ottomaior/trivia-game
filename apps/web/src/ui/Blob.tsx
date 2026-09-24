import type { Avatar, AvatarColor, AvatarFace } from '@trivia/shared';

const FILL: Record<AvatarColor, string> = {
  mustard: 'var(--mustard)',
  teal: 'var(--teal)',
  ice: 'var(--ice)',
  rust: 'var(--rust)',
  plum: 'var(--plum)',
  cream: 'var(--cream)',
};

const INK = 'var(--burgundy)';

export type Expression = 'happy' | 'sad';

function Face({ face }: { face: AvatarFace | Expression }) {
  switch (face) {
    case 'happy':
      return (
        <>
          <path d="M30 46 Q38 38 46 46" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M54 46 Q62 38 70 46" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M32 58 Q50 82 68 58 Z" fill={INK} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        </>
      );
    case 'sad':
      return (
        <>
          <path d="M30 40 L44 45" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <path d="M70 40 L56 45" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <circle cx="38" cy="50" r="4" fill={INK} />
          <circle cx="62" cy="50" r="4" fill={INK} />
          <path d="M36 70 Q50 58 64 70" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      );
    case 'grin':
      return (
        <>
          <circle cx="38" cy="44" r="5" fill={INK} />
          <circle cx="62" cy="44" r="5" fill={INK} />
          <path d="M34 60 Q50 76 66 60" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      );
    case 'wink':
      return (
        <>
          <path d="M32 45 L44 45" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <circle cx="62" cy="44" r="5" fill={INK} />
          <path d="M38 62 Q50 70 62 62" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      );
    case 'shades':
      return (
        <>
          <rect x="26" y="38" width="20" height="12" rx="4" fill={INK} />
          <rect x="54" y="38" width="20" height="12" rx="4" fill={INK} />
          <path d="M46 42 L54 42" stroke={INK} strokeWidth="4" />
          <path d="M40 64 L60 62" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        </>
      );
    case 'shock':
      return (
        <>
          <circle cx="38" cy="42" r="7" fill="var(--cream)" stroke={INK} strokeWidth="3" />
          <circle cx="62" cy="42" r="7" fill="var(--cream)" stroke={INK} strokeWidth="3" />
          <circle cx="38" cy="42" r="3" fill={INK} />
          <circle cx="62" cy="42" r="3" fill={INK} />
          <ellipse cx="50" cy="66" rx="7" ry="9" fill={INK} />
        </>
      );
    case 'sleepy':
      return (
        <>
          <path d="M32 46 Q38 50 44 46" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M56 46 Q62 50 68 46" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <circle cx="50" cy="64" r="4" fill={INK} />
        </>
      );
    case 'smug':
      return (
        <>
          <path d="M32 44 L44 42" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <path d="M56 42 L68 44" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <path d="M40 64 Q56 68 64 58" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      );
  }
}

/** A player's blob avatar. Size is in CSS units; `expression` overrides the chosen face for a moment. */
export function Blob({
  avatar,
  size = '4em',
  dimmed = false,
  expression,
}: {
  avatar: Avatar;
  size?: string;
  dimmed?: boolean;
  expression?: Expression;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ opacity: dimmed ? 0.35 : 1, overflow: 'visible' }}
    >
      <path
        d="M50 6 C74 6 94 24 92 52 C90 78 74 94 50 94 C24 94 8 80 8 54 C8 28 26 6 50 6 Z"
        fill={FILL[avatar.color]}
        stroke={INK}
        strokeWidth="4"
      />
      <Face face={expression ?? avatar.face} />
    </svg>
  );
}
