import { t, type HostView, type Pick, type PlayerSummary } from '@trivia/shared';
import { useEffect, useState, type CSSProperties } from 'react';
import { Blob, type Expression } from '../ui/Blob.tsx';
import { useCountUp } from '../ui/countUp.ts';
import { REVEAL_BEATS } from './director.ts';
import styles from './Studio.module.css';

/** Width of one desk slot, in em. Desks slide between slots when the order changes. */
const SLOT = 12.4;

/**
 * The contestants' desks along the front of the stage. They are the seats in
 * the lobby, show who has locked in, react to the reveal, carry the running
 * score, and re-sort by rank on the scoreboard (sliding between slots).
 */
export function Desks({ view }: { view: HostView }) {
  const { stage } = view;
  const ranked = stage.phase === 'scoreboard' || stage.phase === 'final' ? stage.standings : null;
  const order = ranked ? ranked.map((s) => s.playerId) : view.players.map((p) => p.id);
  const leaders = ranked ? new Set(ranked.filter((s) => s.rank === 1 && s.score > 0).map((s) => s.playerId)) : new Set<string>();
  const picks = stage.phase === 'reveal' ? new Map(stage.picks.map((p) => [p.playerId, p])) : null;
  const answered = stage.phase === 'question_open' ? new Set(stage.answered) : new Set<string>();

  return (
    <div className={styles.desks} style={{ width: `${view.players.length * SLOT}em` }}>
      {view.players.map((p) => (
        <Desk
          key={p.id}
          player={p}
          slot={order.indexOf(p.id)}
          locked={answered.has(p.id)}
          pick={picks?.get(p.id) ?? null}
          leader={leaders.has(p.id)}
          phaseKey={`${stage.phase}-${view.round}`}
        />
      ))}
    </div>
  );
}

function Desk({
  player,
  slot,
  locked,
  pick,
  leader,
  phaseKey,
}: {
  player: PlayerSummary;
  slot: number;
  locked: boolean;
  pick: Pick | null;
  leader: boolean;
  phaseKey: string;
}) {
  // Faces change on the reveal beat when the camera reaches the desks.
  const [expression, setExpression] = useState<Expression | undefined>();
  const verdict = pick ? (pick.correct ? 'happy' : 'sad') : null;
  useEffect(() => {
    setExpression(undefined);
    if (!verdict) return;
    const id = setTimeout(() => setExpression(verdict), REVEAL_BEATS.toContestants * 1000);
    return () => clearTimeout(id);
  }, [verdict, phaseKey]);

  const gained = pick?.points ?? 0;
  const score = useCountUp(player.score, player.score - gained, 900, (REVEAL_BEATS.pointsFly + 0.5) * 1000);
  const reaction = pick ? (pick.correct ? styles.cheer : styles.deflate) : '';

  return (
    <div
      className={`${styles.desk} ${locked ? styles.locked : ''} ${reaction}`}
      style={{ '--slot': slot } as CSSProperties}
      data-testid="seat"
      data-desk={player.id}
    >
      <div className={styles.deskBlob}>
        {leader && (
          <svg className={styles.crown} viewBox="0 0 40 24" aria-hidden="true">
            <path d="M2 22 L6 4 L14 14 L20 2 L26 14 L34 4 L38 22 Z" fill="var(--mustard)" stroke="var(--burgundy-deep)" strokeWidth="2.5" strokeLinejoin="round" />
          </svg>
        )}
        <Blob avatar={player.avatar} size="6em" dimmed={!player.connected} expression={expression} />
      </div>
      <div className={styles.deskFront}>
        <span className={styles.lamp} />
        <span className={styles.nameplate}>{player.name}</span>
        <span className={styles.score}>{t.points(score)}</span>
        {gained > 0 && <span className={styles.gain}>{t.plusPoints(gained)}</span>}
      </div>
    </div>
  );
}
