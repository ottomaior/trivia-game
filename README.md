# Otto's Quiz Show

A Hungarian couch party trivia game in the style of a retro TV quiz show. The TV runs a browser tab, and 2–6 players join on their phones with a QR code or a 4-letter room code. [PLAN.md](PLAN.md) has the full design and roadmap.

**Status:** Phase 1, the playable game, is built and tested locally. It has a lobby with a VIP, a category vote, timed questions with speed scoring, a reveal, a scoreboard, and final results. Reconnecting works for both phones and the TV, and players can flag questions. Next step: deploy to Railway.

## Layout

| Path | What |
|---|---|
| `packages/shared` | The contract between all parts: Socket.IO event types, view types, zod schemas, rules and timings, all Hungarian text |
| `apps/server` | Fastify + Socket.IO. Holds all live game state in memory, serves the built web app, and holds the Drizzle schema, migrations, the starter questions (`seed/`), and the content scripts |
| `apps/web` | React + Vite. `/tv` is the host screen; `/` and `/ABCD` are the phone controller |
| `e2e` | Playwright tests that drive one TV and several phones through a whole game |

## Local development

Requirements: Node 22+, pnpm 10, and optionally Postgres 16.

```sh
pnpm install
pnpm dev                      # server on :3000, Vite on :5173
```

- Open `http://localhost:5173/tv` and click **Kezdés**.
- Phones on the same Wi-Fi open `http://<your-computer-ip>:5173/` and type the code. The QR code points at whatever address the TV page was opened with, so open the TV page by its LAN IP too if you want to scan it.
- Without `DATABASE_URL` the server plays the 120 bundled starter questions from memory. To use Postgres: `export DATABASE_URL=postgres://…`, then `pnpm db:seed` (migrates and loads the starter questions), then `pnpm dev`.
- The phone's screen wake lock only works over HTTPS or on localhost, so over plain-HTTP LAN it silently does nothing. It works on Railway.

## Checks

```sh
pnpm typecheck
pnpm test                                   # unit + socket integration tests
TEST_DATABASE_URL=postgres://… pnpm test    # also runs the Postgres store tests (the DB must be migrated)
pnpm build && pnpm e2e                      # Playwright; CHROMIUM_PATH=/path/to/chrome to use a local Chromium
```

After changing `apps/server/src/db/schema.ts`, run `pnpm db:generate` and commit the new file in `apps/server/drizzle/`. Railway applies it on the next deploy.

## Questions

- **Starter set:** `apps/server/seed/questions.json` has 120 hand-written questions. Every deploy loads any new ones and skips ones already in the database.
- **Generate more with Claude (Haiku):** each question is generated, then answered *blind* by a second call. Only questions where the blind answer matches with high confidence are kept, and near-duplicates are skipped.
  ```sh
  export ANTHROPIC_API_KEY=…
  export DATABASE_URL=…   # for Railway, the Postgres service's DATABASE_PUBLIC_URL
  pnpm gen --category all --difficulty all --count 8 --dry-run   # look first; nothing is saved
  pnpm gen --category all --difficulty all --count 8             # 8 categories × 3 levels × up to 8
  ```
  Categories: `tortenelem, foldrajz, tudomany, film, zene, sport, gasztro, magyarorszag`. Add `--verify-model <id>` to use a stronger model for the check.
- **Flags from players:** a question flagged in 2 different games is retired automatically. `pnpm flagged` lists flagged questions, `pnpm flagged --retired` lists retired ones, and `pnpm flagged --retire <id>` or `--restore <id>` changes one by hand.

## Deploying to Railway

1. Create a Railway project and add a **PostgreSQL** database.
2. Add a service from this GitHub repo and pick the branch to deploy. It builds from the `Dockerfile` using `railway.json`.
3. In the service's **Variables**, add `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (a reference variable).
4. Under **Settings → Networking**, click **Generate Domain**. Railway sets `PORT` itself.
5. Deploy. The pre-deploy step (`node apps/server/dist/release.js`) applies migrations and loads the starter questions. The deploy log should show `Migrations applied` and `Seed: 8 categories, 120 new questions`.
6. Check `https://<domain>/healthz`: it should return `{"ok":true,…,"db":true}`. Then open `https://<domain>/tv` on the TV and scan the QR code.

Keep the service at **one replica**, because live games live in server memory. A redeploy ends any game in progress, so don't deploy during game night.
