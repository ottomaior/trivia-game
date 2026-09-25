import { useEffect, useRef } from 'react';
import { fx } from './fx.ts';
import { setFx } from './fxHandle.ts';
import styles from './Studio.module.css';

/**
 * Hosts the studio's WebGL light/particle canvas. Without WebGL the show
 * simply has no FX. Loaded lazily by the full studio (see fxHandle.ts).
 */
export function FxLayer() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    setFx(fx);
    fx.mount(host).catch(() => {
      // No WebGL (or it failed): the studio works without lights and particles.
    });
    return () => {
      setFx(null);
      fx.destroy();
    };
  }, []);
  return <div ref={ref} className={styles.fx} aria-hidden="true" />;
}
