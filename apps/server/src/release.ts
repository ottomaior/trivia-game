import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { loadSeedFile } from './content/seed.ts';
import { PgStore } from './db/store.ts';

// Railway's pre-deploy step: apply pending migrations, then load any new
// starter questions. Both are idempotent, so running it on every deploy is safe.
// Works from src/ (tsx) and dist/ (bundled): both sit one level below the package root.

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
const client = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder });
  console.log('Migrations applied');
} finally {
  await client.end();
}

if (process.argv.includes('--no-seed')) process.exit(0);

const store = new PgStore(url);
try {
  const result = await store.seed(loadSeedFile());
  console.log(`Seed: ${result.categories} categories, ${result.questions} new questions`);
} finally {
  await store.close();
}
