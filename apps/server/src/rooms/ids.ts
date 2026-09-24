import { randomBytes, randomInt } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@trivia/shared';

export function randomRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Unguessable secret proving a client owns a seat (or the TV). */
export function randomToken(): string {
  return randomBytes(24).toString('base64url');
}

export function randomId(): string {
  return randomBytes(8).toString('base64url');
}
