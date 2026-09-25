import { POWER_PLAYS, t, type PlayerView, type PowerHit, type PowerPlay, type Stage } from '@trivia/shared';
import { useState } from 'react';
import { send } from '../../net/send.ts';
import type { GameSocket } from '../../net/socket.ts';
import { Character } from '../../ui/Character.tsx';
import { PowerIcon } from '../../ui/PowerIcon.tsx';
import { phoneAnswerStyle } from '../../ui/answers.ts';
import styles from '../Phone.module.css';

type VoteStage = Extract<Stage, { phase: 'vote' }>;

export function VoteScreen({ view, stage, socket }: { view: PlayerView; stage: VoteStage; socket: GameSocket }) {
  const mine = view.mine.vote;
  // Vote first; then, holding a power play, decide whether to throw it.
  if (mine !== null && view.mine.power === 'ready') return <PowerPicker view={view} socket={socket} />;
  return (
    <div className={styles.column}>
      <h2 className={styles.screenTitle}>{mine === null ? t.voteTitle : t.voted}</h2>
      {stage.options.map((o, i) => (
        <button
          key={o.id}
          className={`${styles.choice} ${mine === i ? styles.choiceMine : ''} ${mine !== null && mine !== i ? styles.choiceDim : ''}`}
          style={phoneAnswerStyle(i)}
          onClick={() => {
            navigator.vibrate?.(30);
            void send(socket, 'vote:cast', { option: i });
          }}
        >
          <span className={styles.choiceText}>{o.name}</span>
        </button>
      ))}
      <PowerNotes view={view} stage={stage} />
    </div>
  );
}

/** Pick a power play, then a target; or keep it for later. */
function PowerPicker({ view, socket }: { view: PlayerView; socket: GameSocket }) {
  const [power, setPower] = useState<PowerPlay | null>(null);
  const targets = view.players.filter((p) => p.id !== view.me.id && p.connected);

  if (!power) {
    return (
      <div className={styles.column}>
        <h2 className={styles.screenTitle}>{t.powerTitle}</h2>
        {POWER_PLAYS.map((p) => (
          <button key={p} className={`${styles.powerButton} ${styles[`power_${p}`]}`} onClick={() => setPower(p)}>
            <PowerIcon power={p} size="3rem" />
            <span className={styles.powerText}>
              <span className={styles.powerName}>{t.powerNames[p]}</span>
              <span className={styles.powerHelp}>{t.powerHelp[p]}</span>
            </span>
          </button>
        ))}
        <button className={styles.textButton} onClick={() => void send(socket, 'power:pass', {})}>
          {t.powerKeep}
        </button>
      </div>
    );
  }
  return (
    <div className={styles.column}>
      <h2 className={styles.screenTitle}>
        <PowerIcon power={power} size="1.6rem" /> {t.powerPickTarget}
      </h2>
      {targets.map((p) => (
        <button
          key={p.id}
          className={styles.targetButton}
          onClick={() => {
            navigator.vibrate?.([20, 30, 20]);
            void send(socket, 'power:choose', { power, targetId: p.id });
          }}
        >
          <Character id={p.avatar.character} size="3rem" />
          <span>{p.name}</span>
        </button>
      ))}
      <button className={styles.textButton} onClick={() => setPower(null)}>
        {t.back}
      </button>
    </div>
  );
}

/** What I threw (or kept) this round, and what is coming my way. */
export function PowerNotes({ view, stage }: { view: PlayerView; stage: { hits: PowerHit[] } }) {
  const name = (id: string) => view.players.find((p) => p.id === id)?.name ?? '?';
  const thrown = stage.hits.find((h) => h.by === view.me.id);
  const incoming = stage.hits.filter((h) => h.target === view.me.id);
  if (!thrown && incoming.length === 0 && view.mine.power !== 'passed') return null;
  return (
    <div className={styles.powerNotes}>
      {thrown && (
        <p>
          <PowerIcon power={thrown.power} /> {t.powerSent(t.powerNames[thrown.power]!, name(thrown.target))}
        </p>
      )}
      {!thrown && view.mine.power === 'passed' && <p>{t.powerKept}</p>}
      {incoming.map((h, i) => (
        <p key={i} className={styles.powerIncoming}>
          <PowerIcon power={h.power} /> {t.powerHitYou(name(h.by), h.power)}
        </p>
      ))}
    </div>
  );
}
