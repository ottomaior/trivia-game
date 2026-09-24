# Otto's Quiz Show

A couch party trivia game in the style of a retro TV quiz show. The TV runs a browser tab, and 2–6 players join on their phones with a QR code or a 4-letter room code. See [PLAN.md](PLAN.md) for the full design and roadmap.

**Status:** Phase 0 is done. It includes the lobby (the TV creates a room, phones join, refresh or rejoin works), the database schema, and the deploy setup.

## Layout

| Path | What |
|---|---|
| `packages/shared` | The contract between all parts: Socket.IO event types, view types, zod schemas, game rules, and UI strings (HU/EN) |
| `apps/server` | Fastify + Socket.IO. It owns all live room state in memory, serves the built web app, and holds the Drizzle schema and migrations. |
| `apps/web` | React + Vite. `/tv` is the host screen; `/` and `/ABCD` are the phone controller. |
| `e2e` | Playwright tests that drive one TV and several phones |

## Local development

Requirements: Node 22+, pnpm 10, and optionally Postgres 16.

```sh
pnpm install
cp .env.example .env          # optional; without DATABASE_URL nothing is persisted
pnpm db:migrate               # if you set DATABASE_URL
pnpm dev                      # server on :3000, Vite on :5173
```

- Open `http://localhost:5173/tv` on the "TV" and click a language.
- Phones on the same Wi-Fi open `http://<your-computer-ip>:5173/` and type the code. The QR code on the TV points at whatever host the TV page was opened with, so open the TV page by its LAN IP too if you want to scan it.
- The server loads `.env` only through your shell, e.g. `export $(cat .env | xargs)` before `pnpm dev`, or set `DATABASE_URL` directly.

## Checks

```sh
pnpm typecheck
pnpm test                     # unit + socket integration tests
TEST_DATABASE_URL=postgres://… pnpm test   # also runs the Postgres store tests
pnpm build && pnpm e2e        # Playwright; CHROMIUM_PATH=/path/to/chrome to use a local Chromium
```

After changing `apps/server/src/db/schema.ts`, run `pnpm db:generate` and commit the new file in `apps/server/drizzle/`.

## Deploying to Railway

1. Create a Railway project and add a **Postgres** database.
2. Add a service from this GitHub repo. It builds from the `Dockerfile` using `railway.json`.
3. In the service's variables, add `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (a reference variable).
4. Under the service's Networking settings, generate a public domain. Railway sets `PORT` itself.
5. Deploy. The pre-deploy step runs the migrations, and the health check hits `/healthz`, which also reports whether the database is reachable.

Keep the service at **one replica**, because live games live in server memory. A redeploy ends any game in progress, so don't deploy during game night.
