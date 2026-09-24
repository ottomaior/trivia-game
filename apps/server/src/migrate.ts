import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

// Applies pending SQL migrations. Railway runs this as the pre-deploy command.
// Works from both src/ (tsx) and dist/ (bundled) because both sit one level
// below the package root.

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
