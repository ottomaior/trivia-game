import { t, type HostView, type PlayerSummary, type Standing } from '@trivia/shared';
import type { CSSProperties } from 'react';
import { Blob } from '../../ui/Blob.tsx';
import { useCountUp } from '../../ui/countUp.ts';
import { Otto } from '../../ui/Otto.tsx';
import styles from '../Tv.module.css';
import { RoundLabel } from './common.tsx';

/** Rows start in last round's order and slide into the new one (FLIP). */
export function Scoreboard({ view, standings }: { view: HostView; standings: Standing[] }) {
  const byId = new Map(view.players.map((p) => [p.id, p]));
  const top = Math.max(1, ...standings.map((s) => s.score));
  const before = [...standings].sort((a, b) => a.prevRank - b.prevRank || b.score - b.delta - (a.score - a.delta));
  return (
    <div className={styles.game}>
      <header className={styles.gameHeader}>
        <RoundLabel view={view} />
        <h2 className={styles.gameTitle}>{t.scores}</h2>
        <span />
      </header>
      <ol className={styles.standings}>
        {standings.map((s, i) => {
          const p = byId.get(s.playerId);
          if (!p) return null;
          return <Row key={s.playerId} standing={s} player={p} top={top} from={before.indexOf(s) - i} />;
        })}
      </ol>
      <footer className={styles.gameFooter}>
        <Otto line={view.otto} size="9em" />
      </footer>
    </div>
  );
}

function Row({ standing: s, player: p, top, from }: { standing: Standing; player: PlayerSummary; top: number; from: number }) {
  const score = useCountUp(s.score, s.score - s.delta, 900, 900);
  const moved = s.prevRank - s.rank;
  const style = {
    '--from': from,
    '--w0': `${((s.score - s.delta) / top) * 100}%`,
    '--w': `${(s.score / top) * 100}%`,
  } as CSSProperties;
  return (
    <li className={styles.standingRow} style={style}>
      <span className={styles.rank}>{s.rank}.</span>
      <Blob avatar={p.avatar} size="3.6em" dimmed={!p.connected} />
      <span className={styles.standingName}>{p.name}</span>
      <span className={styles.bar}>
        <span className={styles.barFill} />
      </span>
      <span className={styles.standingScore}>{t.points(score)}</span>
      <span className={styles.delta}>{s.delta > 0 ? t.plusPoints(s.delta) : ''}</span>
      <span className={styles.moved} aria-hidden="true">
        {moved > 0 ? '▲' : moved < 0 ? '▼' : ''}
      </span>
    </li>
  );
}
