/**
 * Plays a one-shot entrance on each element in turn: from `from(i)` to its
 * resting state. They are Web Animations of transform and opacity only, which
 * the browser runs on its compositor, so a TV's main thread does no work per
 * frame while the letters or words land. Returns a function that stops them.
 */
export function staggerIn(
  elements: Element[],
  from: (i: number) => Keyframe,
  { duration, stagger, delay, easing }: { duration: number; stagger: number; delay: number; easing: string },
): () => void {
  const anims = elements.map((el, i) =>
    el.animate([from(i), { transform: 'none', opacity: 1 }], {
      duration: duration * 1000,
      delay: (delay + i * stagger) * 1000,
      easing,
      fill: 'backwards',
    }),
  );
  return () => anims.forEach((a) => a.cancel());
}

/** A springy ease-out that overshoots a little and settles (like GSAP's back.out). */
export const BACK_OUT = 'cubic-bezier(0.3, 1.7, 0.6, 1)';
