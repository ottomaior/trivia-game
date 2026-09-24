import { t, type HostView, type Standing } from '@trivia/shared';
import { Blob } from '../../ui/Blob.tsx';
import { Otto } from '../../ui/Otto.tsx';
import styles from '../Tv.module.css';

const PODIUM_ORDER = [1, 0, 2]; // second, first, third from left to right

export function Final({ view, standings }: { view: HostView; standings: Standing[] }) {
  const byId = new Map(view.players.map((p) => [p.id, p]));
  const podium = PODIUM_ORDER.map((i) => standings[i]).filter((s): s is Standing => Boolean(s));
  const rest = standings.slice(3);
  return (
    <div className={styles.final}>
      <h2 className={styles.gameTitle}>{t.finalResults}</h2>
      <div className={styles.finalBody}>
        <Otto line={view.otto} size="13em" />
        <ol className={styles.podium}>
          {podium.map((s) => {
            const p = byId.get(s.playerId)!;
            return (
              <li key={s.playerId} className={styles.podiumSpot} data-rank={Math.min(s.rank, 3)} data-testid="podium">
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
