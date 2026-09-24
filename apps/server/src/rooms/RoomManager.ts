import type { Lang } from '@trivia/shared';
import type { Clock } from '../clock.ts';
import { randomRoomCode } from './ids.ts';
import { Room } from './Room.ts';

export interface RoomManagerOptions {
  clock: Clock;
  lobbyGraceMs: number;
  hostAbsentTtlMs: number;
  onChange: (room: Room) => void;
  onClose: (room: Room) => void;
  generateCode?: () => string;
}

/** Owns all live rooms in memory. There is exactly one per server process. */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(private readonly opts: RoomManagerOptions) {}

  create(householdId: string, lang: Lang): Room {
    const generate = this.opts.generateCode ?? randomRoomCode;
    let code = generate();
    for (let attempt = 0; this.rooms.has(code); attempt++) {
      if (attempt > 1000) throw new Error('Could not allocate a room code');
      code = generate();
    }
    const room = new Room(code, householdId, lang, this.opts.clock());
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  get size(): number {
    return this.rooms.size;
  }

  /** Periodic housekeeping: expire absent-host rooms and stale lobby seats. */
  sweep(): void {
    const now = this.opts.clock();
    for (const room of this.rooms.values()) {
      if (
        !room.hostConnected &&
        room.hostDisconnectedAt !== null &&
        now - room.hostDisconnectedAt >= this.opts.hostAbsentTtlMs
      ) {
        this.close(room);
        continue;
      }
      if (room.removeStalePlayers(now, this.opts.lobbyGraceMs)) this.opts.onChange(room);
    }
  }

  close(room: Room): void {
    if (this.rooms.delete(room.code)) this.opts.onClose(room);
  }
}
