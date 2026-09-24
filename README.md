# Otto's Quiz Show

A Hungarian couch party trivia game in the style of a retro TV quiz show. The TV runs a browser tab, and 1–6 players join on their phones with a QR code or a 4-letter room code. Playing alone works too, which is handy for testing. [PLAN.md](PLAN.md) has the full design and roadmap.

**Status:** Phase 1, the playable game, is built and tested locally. It has a lobby with a VIP, a category vote, timed questions with speed scoring, a reveal, a scoreboard, and final results. Reconnecting works for both phones and the TV, and players can flag questions. It is deployed on Railway at https://triviaserver-production-d945.up.railway.app/tv (see [Deploying to Railway](#deploying-to-railway)). Next step: a real game night.

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

## Sound and motion

The TV plays music and sound effects; phones stay silent (they vibrate instead). Everything is synthesized in the browser with the Web Audio API, in `apps/web/src/audio/`, so there are no audio files to manage.

- **Mute:** press **M** on the TV, or click the speaker button in the top-right corner. The choice is remembered.
- **Levels:** music, effects and ducking levels are in the `LEVELS` table in `apps/web/src/audio/engine.ts`.
- **Replacing a sound with a recording:** put the file in `apps/web/public/audio/` and list it in `manifest.json` there (see the README in that folder). Missing entries keep the synthesized sound.
- **Low-motion mode** for slow smart-TV browsers: open `/tv?lowfx=1` once (remembered; `?lowfx=0` turns it off). It stops all animation and confetti; the OS "reduce motion" setting does the same.
- **Hearing the sounds without a game:** `pnpm build && pnpm e2e` includes `e2e/sound.spec.ts`, which renders every sound offline through `/tv?audiotest` and checks it is audible and doesn't clip.

## Questions

- **Starter set:** `apps/server/seed/questions.json` has 120 hand-written questions. Every deploy loads any new ones and skips ones already in the database.
- **Adding more:** open Claude Code in the repo and ask for them (for example "generate 40 new questions for zene and sport"). `CLAUDE.md` tells it the rules, the format, how to run `pnpm questions:check`, and how to do a blind check with a sub-agent before you commit and push. This runs on your Claude subscription, not API credits.
- `pnpm gen` (optional, uses Anthropic **API credits**): automated bulk generation with Claude Haiku plus blind verification, writing straight to the database. Needs `ANTHROPIC_API_KEY` and `DATABASE_URL`.
- **Flags from players:** a question flagged in 2 different games is retired automatically. `pnpm flagged` lists flagged questions, `pnpm flagged --retired` lists retired ones, and `pnpm flagged --retire <id>` or `--restore <id>` changes one by hand.

## Deploying to Railway

### Current deployment

Deployed on 2026-09-24 and live at **https://triviaserver-production-d945.up.railway.app** (TV at `/tv`, phones at the root URL or by scanning the QR code).

| What | Value |
|---|---|
| Railway project | `efficient-perception` (ID `0bf55b2d-571f-4572-b0a4-0cd0302ffd4e`), environment `production` |
| App service | `@trivia/server` (ID `a3f8ebee-7df7-4c9f-900f-72bfce8e6550`), one replica, region US East |
| Database | `Postgres` service with a volume, same project |
| Source | GitHub `ottomaior/trivia-game`, branch **`main`**, auto-deploys on every push |
| Builder | Dockerfile (`/Dockerfile`) |
| Pre-deploy command | `node apps/server/dist/release.js` (migrations + seed) |
| Health check | `/healthz` |
| Variables | `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`; Railway sets `PORT` (the server listens on 8080) |
| Domain | `triviaserver-production-d945.up.railway.app` (Railway-generated) |

The first deploy logged `Migrations applied` and `Seed: 8 categories, 120 new questions`, and `/healthz` returned `{"ok":true,"rooms":0,"db":true}`.

**Settings live only in the Railway dashboard.** Railway deprecated config-as-code (`railway.json`), and services created after 2026-08-28 can't opt into it, so the repo has no Railway config file; the settings in the table were entered in the service's dashboard. (Railway's replacement is Infrastructure as Code in `.railway/railway.ts`; migrating to it is optional.)

**Things to know:**
- Railway's GitHub import detects the pnpm workspace and offers one service per package (`@trivia/web`, `@trivia/server`) with `pnpm … dev` start commands. That's wrong for this app: it runs as one service built from the root Dockerfile. The `@trivia/web` service was discarded, and the build/start/watch overrides on `@trivia/server` were removed.
- The owner's machine has the `railway` CLI logged in. From the repo folder, `railway link --project 0bf55b2d-571f-4572-b0a4-0cd0302ffd4e` then `railway logs --service a3f8ebee-7df7-4c9f-900f-72bfce8e6550` shows logs, and `railway deployment list --service …` shows deploy status.
- Possible follow-ups: move both services to EU West for lower latency from Hungary (US East adds about 100 ms per round trip, which latency compensation absorbs), rename the project/service, add a short custom domain for the QR code.

### Setting it up from scratch

1. Create a Railway project and add a **PostgreSQL** database.
2. Add a service from this GitHub repo. If Railway offers one service per workspace package, keep only one and remove its build command, start command, and watch path overrides.
3. In the service's **Settings**: branch `main`, builder **Dockerfile**, pre-deploy command `node apps/server/dist/release.js`, health check path `/healthz`.
4. In the service's **Variables**, add `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (a reference variable).
5. Under **Settings → Networking**, click **Generate Domain**. Railway sets `PORT` itself.
6. Deploy. The pre-deploy step applies migrations and loads the starter questions. The deploy log should show `Migrations applied` and `Seed: 8 categories, N new questions`.
7. Check `https://<domain>/healthz`: it should return `{"ok":true,…,"db":true}`. Then open `https://<domain>/tv` on the TV and scan the QR code.

Keep the service at **one replica**, because live games live in server memory. A redeploy ends any game in progress, so don't push to `main` during game night.
