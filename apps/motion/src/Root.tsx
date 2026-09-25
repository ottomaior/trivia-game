import type { FC } from 'react';
import { Composition } from 'remotion';
import { DURATION, FPS, ShowOpen } from './ShowOpen.tsx';

export const Root: FC = () => (
  <Composition id="ShowOpen" component={ShowOpen} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
);
