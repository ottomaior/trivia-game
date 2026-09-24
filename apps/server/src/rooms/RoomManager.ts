import { PACK_MIN_QUESTIONS } from '@trivia/shared';
import type { Clock } from '../clock.ts';
import { loadPacks, type PackDef } from '../content/packs.ts';
import type { Rng } from '../content/select.ts';
import type { Store } from '../db/store.ts';
import { randomRoomCode } from './ids.ts';
import { Room } from './Room.ts';
import { RoomRunner } from './RoomRunner.ts';

export interface RoomManagerOptions {
  clock: Clock;
  store: Store;
  rng?: Rng;
  timingScale?: number;
  totalRounds?: number;
  /** Defaults to the bundled seed/packs.json. */
  packs?: PackDef[];
  minPackQuestions?: number;
  lobbyGraceMs: number;
  hostAbsentTtlMs: number;
  onChange: (room: Room) => void;
  onClose: (room: Room) => void;
  log: { warn: (obj: object, msg: string) => void };
  generateCode?: () => string;
}

/** Owns all live rooms in memory. There is exactly one per server process. */
export class RoomManager {
  private readonly runners = new Map<string, RoomRunner>();
  private readonly packs: PackDef[];

  constructor(private readonly opts: RoomManagerOptions) {
    this.packs = opts.packs ?? loadPacks();
  }

  create(householdId: string): RoomRunner {
    const generate = this.opts.generateCode ?? randomRoomCode;
    let code = generate();
    for (let attempt = 0; this.runners.has(code); attempt++) {
      if (attempt > 1000) throw new Error('Could not allocate a room code');
      code = generate();
    }
    const rng = this.opts.rng ?? Math.random;
    const room = new Room(code, householdId, this.opts.clock(), rng, this.opts.totalRounds);
    const runner = new RoomRunner(room, {
      store: this.opts.store,
      clock: this.opts.clock,
      rng,
      packs: this.packs,
      minPackQuestions: this.opts.minPackQuestions ?? PACK_MIN_QUESTIONS,
      timingScale: this.opts.timingScale ?? 1,
      onChange: this.opts.onChange,
      log: this.opts.log,
    });
    this.runners.set(code, runner);
    return runner;
  }

  get(code: string): RoomRunner | undefined {
    return this.runners.get(code);
  }

  get size(): number {
    return this.runners.size;
  }

  /** Periodic housekeeping: expire absent-host rooms and stale lobby seats. */
  sweep(): void {
    const now = this.opts.clock();
    for (const runner of this.runners.values()) {
      const { room } = runner;
      if (
        !room.hostConnected &&
        room.hostDisconnectedAt !== null &&
        now - room.hostDisconnectedAt >= this.opts.hostAbsentTtlMs
      ) {
        this.close(runner);
        continue;
      }
      if (room.removeStalePlayers(now, this.opts.lobbyGraceMs)) this.opts.onChange(room);
    }
  }

  close(runner: RoomRunner): void {
    if (this.runners.delete(runner.room.code)) {
      runner.dispose();
      this.opts.onClose(runner.room);
    }
  }
}
