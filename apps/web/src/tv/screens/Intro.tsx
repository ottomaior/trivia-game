import { roundText, type HostView } from '@trivia/shared';
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useLayoutEffect, useRef } from 'react';
import { Blob } from '../../ui/Blob.tsx';
import { Logo } from '../../ui/Logo.tsx';
import { useInStudio } from '../../stage/StudioContext.ts';
import { Otto } from '../../ui/Otto.tsx';
import styles from '../Tv.module.css';

gsap.registerPlugin(SplitText);

export function Intro({ view }: { view: HostView }) {
  const inStudio = useInStudio();
  if (inStudio) return <TitleCard view={view} />;
  return (
    <div className={styles.intro}>
      <Logo />
      <Otto line={view.otto} players={view.players} size="18em" />
      <ul className={styles.blobRow}>
        {view.players.map((p) => (
          <li key={p.id} className={styles.blobRowItem}>
            <Blob avatar={p.avatar} size="4.5em" dimmed={!p.connected} />
            <span>{p.name}</span>
          </li>
        ))}
      </ul>
      <p className={styles.status}>{roundText(view.mode, 1, view.totalRounds)}</p>
    </div>
  );
}

/** The show's opening title on the studio board: the logo's letters bounce in over a spinning sunburst. */
function TitleCard({ view }: { view: HostView }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current?.querySelector('h1');
    if (!el) return;
    const split = SplitText.create(el.querySelectorAll('span'), { type: 'chars' });
    const tween = gsap.from(split.chars, {
      y: '-1.2em',
      scale: 0.2,
      rotation: () => gsap.utils.random(-40, 40),
      opacity: 0,
      duration: 0.55,
      stagger: 0.045,
      delay: 0.3,
      ease: 'back.out(2.2)',
    });
    return () => {
      tween.kill();
      split.revert();
    };
  }, []);
  return (
    <div className={styles.titleCard} ref={ref}>
      <div className={styles.titleBurst} aria-hidden="true" />
      <div className={styles.titleLogo}>
        <Logo />
      </div>
      <p className={styles.titleRibbon}>{roundText(view.mode, 1, view.totalRounds)}</p>
    </div>
  );
}
