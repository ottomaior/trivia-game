import { useEffect, useState } from 'react';

// Who voiced Otto, when the voice service asks to be credited (written by
// `pnpm voice:generate` next to the recordings). Fetched once per page.

let pending: Promise<string | null> | null = null;

function load(): Promise<string | null> {
  pending ??= fetch('/voice/credit.json')
    .then((r) => (r.ok ? (r.json() as Promise<{ voice?: unknown }>) : null))
    .then((c) => (c && typeof c.voice === 'string' ? c.voice : null))
    .catch(() => null);
  return pending;
}

export function useVoiceCredit(): string | null {
  const [credit, setCredit] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void load().then((c) => live && setCredit(c));
    return () => {
      live = false;
    };
  }, []);
  return credit;
}
