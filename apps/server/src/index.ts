import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { seedData } from './content/seed.ts';
import { MemoryStore, PgStore, type Store } from './db/store.ts';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
// Only for automated tests: e.g. 0.1 makes every phase 10x shorter.
const timingScale = Number(process.env.TIMING_SCALE ?? 1);

let store: Store;
if (process.env.DATABASE_URL) {
  store = new PgStore(process.env.DATABASE_URL);
} else {
  console.warn('DATABASE_URL not set: using the bundled seed questions in memory (nothing is saved)');
  store = new MemoryStore(seedData());
}

// Resolves to apps/web/dist from both src/ (tsx) and dist/ (bundled).
const webDistDir = fileURLToPath(new URL('../../web/dist', import.meta.url));

const { app } = await createApp({ store, webDistDir, timingScale });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.close().finally(() => process.exit(0));
  });
}

await app.listen({ port, host });
