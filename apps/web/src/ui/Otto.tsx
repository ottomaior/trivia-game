import { ottoText, type OttoLine, type OttoLineKey, type PlayerSummary } from '@trivia/shared';
import { Character } from './Character.tsx';
import { useEffect, useState } from 'react';
import { PaperOtto } from './PaperOtto.tsx';
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

/** Ottó, the host, as a bust: the paper puppet cropped at the chest (flat-mode screens). */
export function OttoFace({
  size = '12em',
  mood = 'neutral',
  talking = false,
}: {
  size?: string;
  mood?: OttoMood;
  talking?: boolean;
}) {
  return (
    <div className={styles.face} style={{ width: size }}>
      <PaperOtto bust talking={talking} voiced={false} mood={mood} pose={mood === 'shocked' ? 'facepalm' : 'idle'} />
    </div>
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
