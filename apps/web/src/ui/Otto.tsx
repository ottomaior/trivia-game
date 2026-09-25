import { ottoText, type OttoLine, type OttoLineKey, type PlayerSummary } from '@trivia/shared';
import { Character } from './Character.tsx';
import { useEffect, useState } from 'react';
import styles from './Otto.module.css';

export type OttoMood = 'neutral' | 'happy' | 'shocked';

const MOODS: Partial<Record<OttoLineKey, OttoMood>> = {
  noneCorrect: 'shocked',
  noneCorrectAgain: 'shocked',
  soloWrong: 'shocked',
  closeRace: 'shocked',
  allCorrect: 'happy',
  onlyOne: 'shocked',
  lastRound: 'shocked',
  streak: 'happy',
  lightning: 'happy',
  soloCorrect: 'happy',
  newLeader: 'happy',
  comeback: 'happy',
  winner: 'happy',
  tie: 'happy',
  soloFinalHigh: 'happy',
  welcome: 'happy',
  welcomeSolo: 'happy',
  powerGranted: 'happy',
  powerSlime: 'shocked',
  powerGangUp: 'shocked',
  powerMany: 'happy',
};

export function moodFor(line: OttoLine | null): OttoMood {
  return (line && MOODS[line.key]) ?? 'neutral';
}

/** Otto's head (ears to mustache) in a 200×220 box; shared by the bust and the full rig. */
export function OttoHead({ mood = 'neutral' }: { mood?: OttoMood }) {
  const ink = 'var(--burgundy)';
  return (
    <>
      <ellipse cx="100" cy="96" rx="62" ry="70" fill="#E9B98F" stroke={ink} strokeWidth="5" />
      <ellipse cx="38" cy="102" rx="10" ry="16" fill="#E9B98F" stroke={ink} strokeWidth="5" />
      <ellipse cx="162" cy="102" rx="10" ry="16" fill="#E9B98F" stroke={ink} strokeWidth="5" />
      {/* slicked hair with a shine */}
      <path d="M38 88 C36 40 70 20 104 22 C140 24 166 46 162 88 C150 60 124 50 96 52 C70 54 50 66 38 88 Z" fill="#3A1A10" stroke={ink} strokeWidth="5" strokeLinejoin="round" />
      <path d="M70 40 C86 32 106 30 122 34" stroke="var(--cream)" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.6" />
      {/* eyebrows (raised when shocked) and eyes */}
      <g className={styles.brows}>
        <path d="M60 76 Q74 66 88 74" stroke="#3A1A10" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M112 74 Q126 66 140 76" stroke="#3A1A10" strokeWidth="7" fill="none" strokeLinecap="round" />
      </g>
      <circle cx="76" cy="92" r="7" fill={ink} className={styles.eye} />
      <circle cx="124" cy="92" r="7" fill={ink} className={styles.eye} />
      {/* nose */}
      <path d="M100 96 Q112 118 98 122" stroke={ink} strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* mouth, drawn before the mustache so the mustache overlaps it */}
      <g className={styles.mouth}>
        {mood === 'shocked' ? (
          <ellipse cx="100" cy="152" rx="9" ry="11" fill={ink} />
        ) : mood === 'happy' ? (
          <path d="M78 144 Q100 170 122 144 Z" fill={ink} stroke={ink} strokeWidth="4" strokeLinejoin="round" />
        ) : (
          <path d="M82 148 Q100 160 118 148" stroke={ink} strokeWidth="5" fill="none" strokeLinecap="round" />
        )}
      </g>
      {/* the mustache */}
      <path
        className={styles.mustache}
        d="M100 128 C88 118 66 118 54 128 C44 136 34 132 30 124 C30 142 48 152 66 146 C80 142 92 136 100 134 C108 136 120 142 134 146 C152 152 170 142 170 124 C166 132 156 136 146 128 C134 118 112 118 100 128 Z"
        fill="#3A1A10"
        stroke={ink}
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </>
  );
}

/** Otto, the host, as a bust: slicked hair, big mustache, bow tie. */
export function OttoFace({
  size = '12em',
  mood = 'neutral',
  talking = false,
}: {
  size?: string;
  mood?: OttoMood;
  talking?: boolean;
}) {
  const ink = 'var(--burgundy)';
  return (
    <svg
      viewBox="0 0 200 220"
      width={size}
      height={size}
      aria-hidden="true"
      className={`${styles.face} ${talking ? styles.talking : ''}`}
      data-mood={mood}
    >
      {/* suit and bow tie */}
      <path d="M30 220 C34 176 66 160 100 160 C134 160 166 176 170 220 Z" fill="var(--teal)" stroke={ink} strokeWidth="5" />
      <path d="M84 160 L100 200 L116 160 Z" fill="var(--cream)" stroke={ink} strokeWidth="4" />
      <path d="M78 168 L100 178 L78 190 Z M122 168 L100 178 L122 190 Z" fill="var(--rust)" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
      <circle cx="100" cy="178" r="6" fill="var(--rust)" stroke={ink} strokeWidth="4" />
      <OttoHead mood={mood} />
    </svg>
  );
}

/** How long Otto's mouth moves after a new line appears. */
const TALK_MS = 1600;

/** Otto with a speech bubble. The bubble hides when there's nothing to say. */
export function Otto({
  line,
  size,
  bubbleDelay,
  players = [],
}: {
  line: OttoLine | null;
  size?: string;
  bubbleDelay?: string;
  /** To show who the line is about (lines never contain names themselves). */
  players?: PlayerSummary[];
}) {
  const focus = line ? players.filter((p) => line.focus.includes(p.id)) : [];
  const text = line ? ottoText(line) : null;
  const [talking, setTalking] = useState(false);
  // Talk while the bubble appears; if the bubble is delayed, so is the talking.
  const delayMs = bubbleDelay ? parseFloat(bubbleDelay) * 1000 : 0;
  useEffect(() => {
    if (!text) return;
    const start = setTimeout(() => setTalking(true), delayMs);
    const stop = setTimeout(() => setTalking(false), delayMs + TALK_MS);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
      setTalking(false);
    };
  }, [text, delayMs]);

  return (
    <div className={styles.otto}>
      <OttoFace size={size} mood={moodFor(line)} talking={talking} />
      {text && (
        <p className={styles.bubble} key={text} data-testid="otto-line" style={bubbleDelay ? { animationDelay: bubbleDelay } : undefined}>
          {text}
          {focus.length > 0 && (
            <span className={styles.focus}>
              {focus.map((p) => (
                <span key={p.id} className={styles.chip}>
                  <Character id={p.avatar.character} size="1.4em" />
                  {p.name}
                </span>
              ))}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
