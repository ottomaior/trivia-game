import { ottoText, t, type OttoLine, type OttoLineKey, type PlayerSummary } from '@trivia/shared';
import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/engine.ts';
import { Character } from '../ui/Character.tsx';
import { moodFor } from '../ui/Otto.tsx';
import { art } from '../ui/art.ts';
import { PaperOtto, type Pose } from '../ui/PaperOtto.tsx';
import styles from './OttoRig.module.css';

const POSES: Partial<Record<OttoLineKey, Pose>> = {
  welcome: 'armsUp',
  welcomeSolo: 'armsUp',
  lastRound: 'armsUp',
  onlyOne: 'point',
  allCorrect: 'armsUp',
  streak: 'armsUp',
  lightning: 'point',
  noneCorrect: 'facepalm',
  noneCorrectAgain: 'facepalm',
  soloWrong: 'facepalm',
  newLeader: 'armsUp',
  comeback: 'point',
  closeRace: 'lean',
  winner: 'armsUp',
  tie: 'armsUp',
  soloFinalHigh: 'armsUp',
  powerGranted: 'lean',
  powerFreeze: 'point',
  powerSlime: 'facepalm',
  powerMany: 'armsUp',
  powerGangUp: 'point',
  blowout: 'point',
};

export function poseFor(line: OttoLine | null): Pose {
  return (line && POSES[line.key]) ?? 'idle';
}

/**
 * Ottó standing behind his podium: the paper puppet, whose arms, head and
 * body take poses from what he is saying. While his voice plays, the mouth
 * follows its loudness; without a voice clip it flaps for a moment instead.
 */
export function OttoRig({
  line,
  players,
  bubbleDelayMs = 0,
  bubbleHideMs,
  lively = false,
}: {
  line: OttoLine | null;
  players: PlayerSummary[];
  bubbleDelayMs?: number;
  /** Hide the bubble after this long (so it never covers the answers). */
  bubbleHideMs?: number;
  /** Ambient motion (sway, blinks, boiling edges): the full studio only. */
  lively?: boolean;
}) {
  const text = line ? ottoText(line) : null;
  const [bubbleGone, setBubbleGone] = useState(false);
  useEffect(() => {
    setBubbleGone(false);
    if (bubbleHideMs === undefined) return;
    const id = setTimeout(() => setBubbleGone(true), bubbleDelayMs + bubbleHideMs);
    return () => clearTimeout(id);
  }, [text, bubbleDelayMs, bubbleHideMs]);
  const mood = moodFor(line);
  const [pose, setPose] = useState<Pose>('idle');
  const [talking, setTalking] = useState(false);
  const rigRef = useRef<HTMLDivElement>(null);

  // Strike the pose when the line appears, then relax back to idle.
  useEffect(() => {
    if (!text) return;
    const start = setTimeout(() => {
      setPose(poseFor(line));
      setTalking(true);
    }, bubbleDelayMs);
    const relax = setTimeout(() => {
      setPose('idle');
      setTalking(false);
    }, bubbleDelayMs + 2_600);
    return () => {
      clearTimeout(start);
      clearTimeout(relax);
    };
  }, [text, bubbleDelayMs]); // `line` changes exactly when `text` does

  // Lip sync: drive the mouth from the voice level while talking.
  useEffect(() => {
    if (!talking) return;
    let frame = 0;
    const tick = () => {
      rigRef.current?.style.setProperty('--mouth', audio.voiceLevel().toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      rigRef.current?.style.setProperty('--mouth', '0');
    };
  }, [talking]);

  const focus = line ? players.filter((p) => line.focus.includes(p.id)) : [];
  return (
    <div className={styles.otto}>
      <div className={styles.rig}>
        <PaperOtto
          rootRef={rigRef}
          pose={pose}
          talking={talking}
          voiced={audio.hasVoice(line)}
          lively={lively}
          mood={mood}
          testId="otto-rig"
        />
      </div>
      <div className={styles.podium}>
        <img src={art('podium')} alt="" className={styles.podiumArt} draggable={false} />
        <span className={styles.podiumSign}>{t.ottoName}</span>
      </div>
      {text && !bubbleGone && (
        <p className={styles.bubble} key={text} data-testid="otto-line" style={{ animationDelay: `${bubbleDelayMs}ms` }}>
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
