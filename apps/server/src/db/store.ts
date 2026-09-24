import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

/**
 * Everything the game needs from persistence. The in-memory implementation
 * lets the server (and tests) run without a database.
 */
export interface Store {
  touchHousehold(householdId: string): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export class MemoryStore implements Store {
  readonly households = new Set<string>();

  async touchHousehold(householdId: string): Promise<void> {
    this.households.add(householdId);
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {}
}

export class PgStore implements Store {
  private readonly client: postgres.Sql;
  readonly db;

  constructor(url: string) {
    this.client = postgres(url, { max: 5 });
    this.db = drizzle(this.client, { schema });
  }

  async touchHousehold(householdId: string): Promise<void> {
    await this.db
      .insert(schema.households)
      .values({ id: householdId })
      .onConflictDoUpdate({ target: schema.households.id, set: { lastSeenAt: sql`now()` } });
  }

  async ping(): Promise<boolean> {
    try {
      await this.client`select 1`;
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
