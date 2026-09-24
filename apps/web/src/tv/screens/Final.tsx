import { t, type HostView, type Standing } from '@trivia/shared';
import type { CSSProperties } from 'react';
import { Blob } from '../../ui/Blob.tsx';
import { useLowFx } from '../../ui/lowfx.ts';
import { Otto } from '../../ui/Otto.tsx';
import styles from '../Tv.module.css';

const PODIUM_ORDER = [1, 0, 2]; // second, first, third from left to right
/** Podium blocks rise third place first, the winner last (seconds). */
const RISE_DELAY: Record<number, number> = { 3: 0.4, 2: 1.2, 1: 2.2 };

export function Final({ view, standings }: { view: HostView; standings: Standing[] }) {
  const lowFx = useLowFx();
  const byId = new Map(view.players.map((p) => [p.id, p]));
  const podium = PODIUM_ORDER.map((i) => standings[i]).filter((s): s is Standing => Boolean(s));
  const rest = standings.slice(3);
  return (
    <div className={styles.final}>
      {!lowFx && <Confetti />}
      <h2 className={styles.gameTitle}>{t.finalResults}</h2>
      <div className={styles.finalBody}>
        <Otto line={view.otto} players={view.players} size="13em" />
        <ol className={styles.podium}>
          {podium.map((s) => {
            const p = byId.get(s.playerId)!;
            const rank = Math.min(s.rank, 3);
            return (
              <li
                key={s.playerId}
                className={styles.podiumSpot}
                data-rank={rank}
                data-testid="podium"
                style={{ '--d': `${RISE_DELAY[rank]}s` } as CSSProperties}
              >
                <Blob avatar={p.avatar} size={s.rank === 1 ? '7em' : '5em'} />
                <span className={styles.podiumName}>{p.name}</span>
                <span className={styles.podiumScore}>{t.points(s.score)}</span>
                <span className={styles.podiumBlock}>{s.rank}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {rest.length > 0 && (
        <ol className={styles.finalRest}>
          {rest.map((s) => (
            <li key={s.playerId}>
              {s.rank}. {byId.get(s.playerId)?.name} — {t.points(s.score)}
            </li>
          ))}
        </ol>
      )}
      <p className={styles.status}>{t.playAgainOnPhone}</p>
    </div>
  );
}

const CONFETTI_COLORS = ['var(--mustard)', 'var(--teal)', 'var(--cream)', 'var(--ice)', 'var(--rust)', 'var(--plum)'];

/** Paper confetti in the show's colors; positions are fixed per index so re-renders don't jump. */
function Confetti() {
  return (
    <div className={styles.confetti} aria-hidden="true">
      {Array.from({ length: 42 }, (_, i) => {
        // Deterministic hash noise, independent per property.
        const r = (n: number) => {
          const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
          return x - Math.floor(x);
        };
        const style = {
          left: `${r(1) * 100}%`,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          '--delay': `${2.3 + r(2) * 1.8}s`,
          '--dur': `${2.6 + r(3) * 1.6}s`,
          '--drift': `${(r(4) - 0.5) * 12}em`,
          '--spin': `${(r(5) > 0.5 ? 1 : -1) * (360 + r(6) * 540)}deg`,
        } as CSSProperties;
        return <span key={i} style={style} />;
      })}
    </div>
  );
}
