import { ottoText, type OttoLine, type OttoLineKey, type PlayerSummary } from '@trivia/shared';
import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/engine.ts';
import { Blob } from '../ui/Blob.tsx';
import { moodFor, OttoHead } from '../ui/Otto.tsx';
import styles from './OttoRig.module.css';

export type Pose = 'idle' | 'point' | 'armsUp' | 'facepalm' | 'lean';

const POSES: Partial<Record<OttoLineKey, Pose>> = {
  welcome: 'armsUp',
  welcomeSolo: 'armsUp',
  pickCategory: 'point',
  lastRound: 'point',
  question: 'point',
  allCorrect: 'armsUp',
  streak: 'armsUp',
  lightning: 'point',
  fastest: 'point',
  noneCorrect: 'facepalm',
  noneCorrectAgain: 'facepalm',
  soloWrong: 'facepalm',
  newLeader: 'armsUp',
  comeback: 'point',
  closeRace: 'lean',
  standings: 'lean',
  winner: 'armsUp',
  tie: 'armsUp',
  soloFinalHigh: 'armsUp',
};

export function poseFor(line: OttoLine | null): Pose {
  return (line && POSES[line.key]) ?? 'idle';
}

const INK = 'var(--burgundy)';

/**
 * Otto standing behind his podium: a paper-cutout rig whose arms, head and
 * body take poses from what he is saying. While his voice plays, the mouth
 * follows its loudness; without a voice clip it flaps for a moment instead.
 */
export function OttoRig({
  line,
  players,
  bubbleDelayMs = 0,
  bubbleHideMs,
}: {
  line: OttoLine | null;
  players: PlayerSummary[];
  bubbleDelayMs?: number;
  /** Hide the bubble after this long (so it never covers the answers). */
  bubbleHideMs?: number;
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
  const rigRef = useRef<SVGSVGElement>(null);

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
      <svg
        ref={rigRef}
        viewBox="0 0 240 400"
        className={`${styles.rig} ${talking ? styles.talking : ''}`}
        data-pose={pose}
        data-mood={mood}
        data-voiced={audio.hasVoice(line) ? 'true' : 'false'}
        aria-hidden="true"
        data-testid="otto-rig"
      >
        <g className={styles.body}>
          {/* Otto's right arm (viewer's left) */}
          <g className={styles.armL}>
            <path d="M52 222 L40 330" stroke="var(--teal)" strokeWidth="30" strokeLinecap="round" />
            <path d="M52 222 L40 330" stroke={INK} strokeWidth="36" strokeLinecap="round" opacity="0.25" />
            <circle cx="40" cy="338" r="16" fill="#E9B98F" stroke={INK} strokeWidth="5" />
          </g>
          {/* jacket, shirt and bow tie */}
          <path d="M34 400 C34 300 44 230 70 212 C90 202 150 202 170 212 C196 230 206 300 206 400 Z" fill="var(--teal)" stroke={INK} strokeWidth="5" />
          <path d="M100 206 L120 280 L140 206 Z" fill="var(--cream)" stroke={INK} strokeWidth="4" />
          <path d="M96 214 L120 226 L96 240 Z M144 214 L120 226 L144 240 Z" fill="var(--rust)" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <circle cx="120" cy="226" r="7" fill="var(--rust)" stroke={INK} strokeWidth="4" />
          <path d="M100 206 L86 300 M140 206 L154 300" stroke={INK} strokeWidth="4" fill="none" />
          {/* Otto's left arm (viewer's right): the pointing one */}
          <g className={styles.armR}>
            <path d="M188 222 L200 330" stroke="var(--teal)" strokeWidth="30" strokeLinecap="round" />
            <circle cx="200" cy="338" r="16" fill="#E9B98F" stroke={INK} strokeWidth="5" />
            <path d="M200 338 L204 360" stroke={INK} strokeWidth="6" strokeLinecap="round" className={styles.finger} />
          </g>
          <g className={styles.head}>
            <g transform="translate(20 0)">
              <OttoHead mood={mood} />
            </g>
          </g>
        </g>
      </svg>
      <div className={styles.podium}>
        <span className={styles.podiumSign}>Otto</span>
      </div>
      {text && !bubbleGone && (
        <p className={styles.bubble} key={text} data-testid="otto-line" style={{ animationDelay: `${bubbleDelayMs}ms` }}>
          {text}
          {focus.length > 0 && (
            <span className={styles.focus}>
              {focus.map((p) => (
                <span key={p.id} className={styles.chip}>
                  <Blob avatar={p.avatar} size="1.4em" />
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
