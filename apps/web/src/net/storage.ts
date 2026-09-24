// localStorage can throw (private mode, blocked storage) or be wiped at any
// time; every access is guarded and callers must cope with null.

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-fatal: the game works, it just can't resume after a refresh.
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** RFC 4122 v4. crypto.randomUUID only exists in secure contexts (not LAN http). */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const KEYS = {
  household: 'otto.household',
  hostSession: 'otto.hostSession',
  playerSession: 'otto.playerSession',
  audio: 'otto.audio',
  fxMode: 'otto.fxmode',
} as const;
