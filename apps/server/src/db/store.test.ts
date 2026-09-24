import { afterAll, describe, expect, it } from 'vitest';
import { PgStore } from './store.ts';

// Runs only when a migrated test database is provided, e.g.
// TEST_DATABASE_URL=postgres://trivia:trivia@localhost:5432/trivia_test
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('PgStore', () => {
  const store = url ? new PgStore(url) : null;
  afterAll(() => store?.close());

  it('upserts households', async () => {
    const id = crypto.randomUUID();
    await store!.touchHousehold(id);
    await store!.touchHousehold(id);
    expect(await store!.ping()).toBe(true);
  });
});
