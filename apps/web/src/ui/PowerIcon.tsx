import type { PowerPlay } from '@trivia/shared';

/** The power plays' symbols: a snowflake for the ice, a dripping blob for the slime. */
export function PowerIcon({ power, size = '1em' }: { power: PowerPlay; size?: string }) {
  if (power === 'freeze') {
    return (
      <svg viewBox="-12 -12 24 24" width={size} height={size} aria-hidden="true">
        <g stroke="var(--burgundy-deep)" strokeWidth="4.4" strokeLinecap="round">
          <Flake />
        </g>
        <g stroke="var(--ice)" strokeWidth="2.2" strokeLinecap="round">
          <Flake />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M3 10c0-4.5 4-7 9-7s9 2.5 9 7v2.5c0 1.8-.9 2.8-1.9 2.8s-1.5-.9-1.5-1.9-.5-1.4-1-1.4-1 .8-1 3-1.1 5-2.6 5-2.2-2.8-2.2-5-.5-2.1-1-2.1-1 .9-1 2.3-.9 2.9-2.3 2.9S3 14.8 3 13.2z"
        fill="var(--slime)"
        stroke="var(--burgundy-deep)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <ellipse cx="8.5" cy="7.5" rx="2.2" ry="1.3" fill="#fff" opacity="0.55" />
    </svg>
  );
}

function Flake() {
  return (
    <>
      {[0, 60, 120].map((deg) => (
        <g key={deg} transform={`rotate(${deg})`}>
          <line x1="0" y1="-9" x2="0" y2="9" />
          <polyline points="-3,-9 0,-6 3,-9" fill="none" />
          <polyline points="-3,9 0,6 3,9" fill="none" />
        </g>
      ))}
    </>
  );
}
