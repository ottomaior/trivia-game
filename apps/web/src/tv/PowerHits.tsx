import { t, type PlayerSummary, type PowerHit } from '@trivia/shared';
import { Character } from '../ui/Character.tsx';
import { PowerIcon } from '../ui/PowerIcon.tsx';
import styles from './Tv.module.css';

/** Who threw what at whom this round, as it happens. */
export function PowerHits({ hits, players, waiting }: { hits: PowerHit[]; players: PlayerSummary[]; waiting: boolean }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  if (hits.length === 0) {
    return waiting ? (
      <p className={styles.powerWaiting}>
        <PowerIcon power="freeze" /> {t.powerOnPhone} <PowerIcon power="slime" />
      </p>
    ) : null;
  }
  return (
    <ul className={styles.powerHits} data-testid="power-hits">
      {hits.map((h, i) => {
        const by = byId.get(h.by);
        const target = byId.get(h.target);
        if (!by || !target) return null;
        return (
          <li key={i} className={`${styles.powerHit} ${styles[`hit_${h.power}`]}`}>
            <Character id={by.avatar.character} size="2.4em" />
            <span>{by.name}</span>
            <span className={styles.powerArrow}>
              <PowerIcon power={h.power} size="1.6em" />
            </span>
            <Character id={target.avatar.character} size="2.4em" expression={h.power === 'freeze' ? 'frozen' : 'slimed'} />
            <span>{target.name}</span>
          </li>
        );
      })}
    </ul>
  );
}
