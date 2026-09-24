// Single source of truth for game limits and timings. Server and clients both
// import from here so the numbers can never drift apart.

export const LANGS = ['hu', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const NAME_MAX_LENGTH = 12;

// Consonants only, so a random code can't spell a real word in HU or EN.
export const ROOM_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';
export const ROOM_CODE_LENGTH = 4;

/** A lobby player who has been disconnected this long loses their seat. */
export const LOBBY_DISCONNECT_GRACE_MS = 60_000;
/** A room whose TV has been gone this long is closed. */
export const HOST_ABSENT_ROOM_TTL_MS = 10 * 60_000;

export const AVATAR_COLORS = ['mustard', 'teal', 'ice', 'rust', 'plum', 'cream'] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const AVATAR_FACES = ['grin', 'wink', 'shades', 'shock', 'sleepy', 'smug'] as const;
export type AvatarFace = (typeof AVATAR_FACES)[number];

export interface Avatar {
  color: AvatarColor;
  face: AvatarFace;
}

/** Trim, collapse inner whitespace, clamp length. */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX_LENGTH);
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  return true;
}
