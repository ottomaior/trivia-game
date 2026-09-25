import { actedIds, MAX_PLAYERS, scoreText, t, type GameMode, type HostView, type Pick, type PlayerSummary, type PowerHit } from '@trivia/shared';
import { useEffect, useState, type CSSProperties } from 'react';
import { Blob, type Expression } from '../ui/Blob.tsx';
import { useCountUp } from '../ui/countUp.ts';
import { PowerIcon } from '../ui/PowerIcon.tsx';
import { REVEAL_BEATS } from './director.ts';
import styles from './Studio.module.css';

/** Width of one desk slot, in em. Desks slide between slots when the order changes. */
const SLOT = 12.4;

/** Podium block heights (em) and when each rises in the final: third, then second, then the winner. */
const RISER: Record<number, { height: number; delay: number }> = {
  1: { height: 6, delay: 2.2 },
  2: { height: 3.8, delay: 1.2 },
  3: { height: 2, delay: 0.4 },
};

/** More than five desks are drawn smaller so the row still fits the stage. */
export function deskScale(slots: number): number {
  return Math.min(1, 5 / Math.max(1, slots));
}

/**
 * Final-screen slot for each place, podium style: the winner in the middle,
 * second on their left, third on their right, the rest further out.
 * Returns ranks-index → slot, e.g. 3 players → [1, 0, 2].
 */
export function podiumSlots(count: number): number[] {
  const slots: number[] = [];
  const middle = Math.floor((count - 1) / 2) + (count % 2 === 0 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    // 0 → middle, 1 → left, 2 → right, 3 → further left, …
    const step = Math.ceil(i / 2);
    slots.push(i % 2 === 1 ? middle - step : middle + step);
  }
  return slots;
}

/**
 * The contestants' desks along the front of the stage. They are the seats in
 * the lobby, show who has locked in, react to the reveal, carry the running
 * score, and re-sort by rank on the scoreboard (sliding between slots).
 */
export function Desks({ view }: { view: HostView }) {
  const { stage } = view;
  const ranked = stage.phase === 'scoreboard' || stage.phase === 'final' ? stage.standings : null;
  const final = stage.phase === 'final';
  const order = ranked ? ranked.map((s) => s.playerId) : view.players.map((p) => p.id);
  const podium = final ? podiumSlots(order.length) : null;
  const rankOf = new Map(ranked?.map((s) => [s.playerId, s.rank]) ?? []);
  const leaders = ranked ? new Set(ranked.filter((s) => s.rank === 1 && s.score > 0).map((s) => s.playerId)) : new Set<string>();
  const picks = stage.phase === 'reveal' ? new Map(stage.picks.map((p) => [p.playerId, p])) : null;
  const answered = new Set(actedIds(stage));
  // On the ladder, those who fell or stopped sit back from the rest.
  const offLadder = new Set(view.ladder?.seats.filter((s) => s.status === 'out' || s.status === 'walked').map((s) => s.playerId));
  const hits = 'hits' in stage ? stage.hits : [];
  // Held power plays show on the desks during the game, not in the lobby or on the podium.
  const showPowers = stage.phase !== 'lobby' && stage.phase !== 'final';

  // In the lobby, empty desks wait for the rest of the players.
  const empty = stage.phase === 'lobby' ? Math.max(0, MAX_PLAYERS - view.players.length) : 0;
  const slots = view.players.length + empty;
  return (
    <div className={styles.desks} style={{ width: `${slots * SLOT}em`, fontSize: `${deskScale(slots)}em` }}>
      {Array.from({ length: empty }, (_, i) => (
        <div key={`empty-${i}`} className={`${styles.desk} ${styles.deskEmpty}`} style={{ '--slot': view.players.length + i } as CSSProperties}>
          <div className={styles.deskFront}>
            <span className={styles.nameplate}>?</span>
          </div>
        </div>
      ))}
      {view.players.map((p) => (
        <Desk
          key={p.id}
          player={p}
          slot={podium ? podium[order.indexOf(p.id)]! : order.indexOf(p.id)}
          place={final ? (rankOf.get(p.id) ?? null) : null}
          locked={answered.has(p.id)}
          pick={picks?.get(p.id) ?? null}
          leader={leaders.has(p.id)}
          hits={hits.filter((h) => h.target === p.id)}
          holdsPower={showPowers && p.hasPower}
          phaseKey={`${stage.phase}-${view.round}`}
          mode={view.mode}
          off={offLadder.has(p.id)}
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
  hits,
  holdsPower,
  phaseKey,
  place,
  mode,
  off,
}: {
  player: PlayerSummary;
  slot: number;
  /** Final placing, when the desks stand on the podium. */
  place: number | null;
  locked: boolean;
  pick: Pick | null;
  leader: boolean;
  /** Power plays thrown at this player this round. */
  hits: PowerHit[];
  holdsPower: boolean;
  phaseKey: string;
  mode: GameMode;
  /** Off the ladder (fell or stopped). */
  off: boolean;
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
  const riser = place !== null ? RISER[place] : undefined;

  return (
    <div
      className={`${styles.desk} ${locked ? styles.locked : ''} ${reaction} ${place !== null ? styles.onPodium : ''}`}
      style={{ '--slot': slot, '--d': riser ? `${riser.delay}s` : undefined } as CSSProperties}
      data-testid="seat"
      data-desk={player.id}
    >
      <div className={styles.deskBlob}>
        {leader && (
          <svg className={styles.crown} viewBox="0 0 40 24" aria-hidden="true">
            <path d="M2 22 L6 4 L14 14 L20 2 L26 14 L34 4 L38 22 Z" fill="var(--mustard)" stroke="var(--burgundy-deep)" strokeWidth="2.5" strokeLinejoin="round" />
          </svg>
        )}
        <Blob avatar={player.avatar} size="6em" dimmed={!player.connected || off} expression={expression} />
        {(['freeze', 'slime'] as const).map((power) => {
          const mine = hits.filter((h) => h.power === power);
          if (mine.length === 0) return null;
          // Stays mounted once cleared, so the shatter/drip-off animation can play.
          const cleared = mine.every((h) => h.cleared);
          return (
            <span
              key={power}
              className={`${styles.deskHit} ${styles[`deskHit_${power}`]} ${cleared ? styles.deskHitCleared : ''}`}
              data-testid={`desk-${power}`}
              data-cleared={cleared}
            />
          );
        })}
      </div>
      <div className={styles.deskFront}>
        <span className={styles.lamp} />
        {holdsPower && (
          <span className={styles.powerBadge} title={t.powerHasOne}>
            <PowerIcon power="freeze" />
            <PowerIcon power="slime" />
          </span>
        )}
        <span className={styles.nameplate}>{player.name}</span>
        <span className={styles.score}>{scoreText(mode, score)}</span>
        {mode !== 'ladder' && gained > 0 && <span className={styles.gain}>{t.plusPoints(gained)}</span>}
      </div>
      {riser && (
        <div
          className={styles.riser}
          data-place={place}
          data-testid="podium"
          style={{ '--h': `${riser.height}em` } as CSSProperties}
        >
          <span className={styles.riserNumber} aria-label={`${place}. ${player.name}`}>
            {place}
          </span>
        </div>
      )}
    </div>
  );
}
