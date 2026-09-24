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

## Studio, sound and voice

The TV is a 2.5D TV studio: a CSS 3D set (`apps/web/src/stage/`) with a GSAP camera that cuts between shots per phase (`director.ts`), a PixiJS canvas for spotlights and particles (`fx.ts`), contestant desks and Otto as a posed cutout rig. Phones stay simple and silent (they vibrate instead).

- **Effects modes:** `full` (everything), `lite` (the studio and camera, no particle canvas or ambient animation) and `flat` (the plain screens, no motion). The TV measures its frame rate for 3 seconds and steps down (full → lite → flat) if it drops under 40 fps; the result is remembered. Force a mode with `/tv?fx=full|lite|flat` (also remembered); the old `?lowfx=1` means flat. The OS "reduce motion" setting also starts flat.
- **Mute:** press **M** on the TV, or click the speaker button in the top-right corner. The choice is remembered.
- **Sounds:** the studio sound set is rendered offline by `pnpm audio:render` and converted by `pnpm audio:prepare` (needs ffmpeg) into `apps/web/public/audio/`. Real recordings replace rendered sounds name by name; the shopping list and naming rules are in `apps/web/public/audio/README.md`. Any cue without a file falls back to live synthesis. Levels and ducking are in the `LEVELS` table in `apps/web/src/audio/engine.ts`.
- **Otto's voice:** recorded once by `pnpm voice:generate` into `apps/web/public/voice/` with ElevenLabs (recommended) or Azure text-to-speech; steps, credits and retakes (`--redo`) are in the README there. The TV credits the voice when the service asks for it. Without the files Otto is text-only. Voiced lines contain no names or numbers; the TV shows whom a line is about with name chips and a spotlight. Each line carries a bracketed performance cue for ElevenLabs v3, which screens hide. Otto also reads each question aloud from `apps/web/public/voice/q/` (`pnpm voice:generate --questions`).
- **Variety:** Otto has 3–9 versions of each line and says every version before repeating one. He reacts to each category, marks the first round and halfway, and the last round scores **double points**.
- **Hearing the sounds without a game:** `pnpm build && pnpm e2e` includes `e2e/sound.spec.ts`, which renders every synthesized sound offline through `/tv?audiotest` and checks it is audible and doesn't clip.

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
