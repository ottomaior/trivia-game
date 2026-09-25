import type { Ref } from 'react';
import styles from './PaperOtto.module.css';

export type Pose = 'idle' | 'point' | 'armsUp' | 'facepalm' | 'lean';

/** One layer of the rig; the layers that "boil" stack three hand-cut versions and flick between them. */
function Layer({ name, boil, className }: { name: string; boil?: boolean; className?: string }) {
  if (!boil) return <img src={`/art/otto-${name}.svg`} alt="" draggable={false} className={className} />;
  return (
    <span className={`${styles.boil} ${className ?? ''}`}>
      <img src={`/art/otto-${name}.svg`} alt="" draggable={false} />
      <img src={`/art/otto-${name}-1.svg`} alt="" draggable={false} />
      <img src={`/art/otto-${name}-2.svg`} alt="" draggable={false} />
    </span>
  );
}

/**
 * Ottó as a paper puppet: still images for each piece (drawn in
 * apps/motion/art/otto-rig.mjs, all in one 380x490 space), turned at their
 * joints by CSS. `pose` strikes a gesture, `talking` bobs the head, and the
 * mouth opens with the `--mouth` CSS variable (0–1, set on the root by the
 * caller for lip sync) or flaps when the line has no recording. `lively`
 * (the full studio only) adds the ambient motion: sway, blinks and edges
 * that redraw. `bust` crops him at the chest.
 */
export function PaperOtto({
  pose = 'idle',
  talking = false,
  voiced = true,
  lively = false,
  bust = false,
  mood,
  rootRef,
  className,
  testId,
}: {
  pose?: Pose;
  talking?: boolean;
  voiced?: boolean;
  lively?: boolean;
  bust?: boolean;
  mood?: string;
  rootRef?: Ref<HTMLDivElement>;
  className?: string;
  testId?: string;
}) {
  const boil = lively;
  return (
    <div
      ref={rootRef}
      className={`${styles.otto} ${bust ? styles.bust : ''} ${className ?? ''}`}
      data-pose={pose}
      data-talking={talking}
      data-voiced={voiced}
      data-lively={lively}
      data-mood={mood}
      data-testid={testId}
      aria-hidden="true"
    >
      <div className={styles.rig}>
        <div className={styles.hips}>
          <div className={styles.armBack}>
            <Layer name="back-upper" />
            <div className={styles.fore}>
              <Layer name="back-fore" />
            </div>
          </div>
          <Layer name="neck" />
          <Layer name="torso" boil={boil} />
          <div className={styles.head}>
            <div className={styles.bob}>
              <Layer name="head" boil={boil} />
              <Layer name="mouth" className={styles.mouth} />
              <Layer name="stache" />
              <Layer name="lids" className={styles.lids} />
            </div>
          </div>
          <div className={styles.armFront}>
            <Layer name="front-arm" boil={boil} />
          </div>
        </div>
      </div>
    </div>
  );
}
