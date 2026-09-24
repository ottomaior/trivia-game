import { t, type HostView, type Standing } from '@trivia/shared';
import { Blob } from '../../ui/Blob.tsx';
import { Otto } from '../../ui/Otto.tsx';
import styles from '../Tv.module.css';
import { RoundLabel } from './common.tsx';

export function Scoreboard({ view, standings }: { view: HostView; standings: Standing[] }) {
  const byId = new Map(view.players.map((p) => [p.id, p]));
  const top = Math.max(1, ...standings.map((s) => s.score));
  return (
    <div className={styles.game}>
      <header className={styles.gameHeader}>
        <RoundLabel view={view} />
        <h2 className={styles.gameTitle}>{t.scores}</h2>
        <span />
      </header>
      <ol className={styles.standings}>
        {standings.map((s) => {
          const p = byId.get(s.playerId);
          if (!p) return null;
          const moved = s.prevRank - s.rank;
          return (
            <li key={s.playerId} className={styles.standingRow}>
              <span className={styles.rank}>{s.rank}.</span>
              <Blob avatar={p.avatar} size="3.6em" dimmed={!p.connected} />
              <span className={styles.standingName}>{p.name}</span>
              <span className={styles.bar}>
                <span className={styles.barFill} style={{ width: `${(s.score / top) * 100}%` }} />
              </span>
              <span className={styles.standingScore}>{t.points(s.score)}</span>
              <span className={styles.delta}>{s.delta > 0 ? t.plusPoints(s.delta) : ''}</span>
              <span className={styles.moved} aria-hidden="true">
                {moved > 0 ? '▲' : moved < 0 ? '▼' : ''}
              </span>
            </li>
          );
        })}
      </ol>
      <footer className={styles.gameFooter}>
        <Otto line={view.otto} size="9em" />
      </footer>
    </div>
  );
}
