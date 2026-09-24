# Otto's Quiz Show

Hungarian party trivia game: the TV runs `/tv`, phones join at `/ABCD`. pnpm monorepo: `packages/shared` (protocol, rules, all UI text), `apps/server` (Fastify + Socket.IO, in-memory game engine, Postgres via Drizzle), `apps/web` (React + Vite). Design and roadmap are in `PLAN.md`; setup and deploy steps are in `README.md`.

## Commands

- `pnpm dev` runs the server on :3000 and Vite on :5173 (TV at http://localhost:5173/tv).
- `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm e2e`
- `pnpm questions:check` validates the question file.
- `pnpm audio:prepare` (needs ffmpeg) turns sounds in `audio-src/` into `apps/web/public/audio/`; `pnpm voice:generate` records Otto's lines (needs `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` in the owner's shell; never ask for the key). Both READMEs are in those folders.
- The TV has three effects modes, forced with `/tv?fx=full|lite|flat`. E2E defaults to `lite` because headless Chromium has no GPU.
- Otto's lines (`packages/shared/src/strings.ts`) must stay free of names and numbers, because they are pre-recorded; after editing them, the voice needs regenerating.
- Schema change: edit `apps/server/src/db/schema.ts`, run `pnpm db:generate`, and commit the new migration. Railway applies it on deploy.

## Production

- Live at https://triviaserver-production-d945.up.railway.app (TV: `/tv`, health: `/healthz`).
- Railway project `efficient-perception`: one app service `@trivia/server` plus `Postgres`, region US East. Details are in `README.md` under "Deploying to Railway".
- **Railway deploys the `main` branch.** Every push to `main` redeploys and ends any game in progress; pushing to other branches deploys nothing. To ship work from a branch, merge it into `main`.
- There is no Railway config file in the repo (Railway stopped letting new services use config-as-code). Build, pre-deploy, and health check settings live only in the Railway dashboard.
- A cloud session can't reach Railway. Deploy settings, logs, and variables need the owner's Railway dashboard or the `railway` CLI on their machine.

## Adding questions

Questions live in `apps/server/seed/questions.json`. Every deploy loads any new ones into the database and skips ones already there, so adding questions means editing this file, checking it, committing, and pushing. **Do not use `pnpm gen`** (it spends Anthropic API credits); write the questions yourself in the session.

### Format

Append objects to the array:

```json
{
  "category": "zene",
  "difficulty": 2,
  "prompt": "Melyik országból származik az ABBA?",
  "answer": "Svédország",
  "wrong": ["Norvégia", "Dánia", "Finnország"],
  "explanation": "A négy tag Stockholmban alakította meg az együttest 1972-ben."
}
```

- `category` is one of the slugs in `apps/server/seed/categories.json`: `tortenelem`, `foldrajz`, `tudomany`, `film`, `zene`, `sport`, `gasztro`, `magyarorszag`.
- `difficulty`: 1 = most adults know it; 2 = an informed, curious adult knows it; 3 = only people interested in the topic know it.
- `answer` is the correct answer. `wrong` has exactly 3 wrong answers. The game shuffles the order.
- `explanation` is optional: one short sentence shown on the TV at the reveal.

### Content rules

- Natural Hungarian that doesn't read like a translation, with correct spelling (ő, ű).
- Exactly one correct answer, which must be an undisputed, easily checkable fact.
- No facts that change over time: records, current office holders, populations, "the latest" anything. If unavoidable, pin a date ("2024 végéig").
- No estimates, opinions, or "melyik NEM…" questions.
- Wrong answers are plausible, the same kind of thing as the answer, similar in length, and none of them is partly right.
- The question is at most 200 characters and each answer at most 60. The answer never appears in the question.
- Mix Hungarian and international topics, and eras and question styles. Family-friendly.
- Don't repeat a fact already in the file (search it first).

### Workflow

1. Write the new questions and append them to `apps/server/seed/questions.json`.
2. Run `pnpm questions:check` and fix every error and warning.
3. **Blind check:** start a sub-agent (Agent tool) that sees only the prompts and the four choices in shuffled order, labelled A–D, never the answer key. Ask it to answer each one, with a confidence from 0 to 1 and a note on anything ambiguous, outdated, or misspelled. Remove or fix every question where its choice differs from the key, its confidence is below 0.85, or it raised a concern. Report what was dropped and why.
4. Run `pnpm test` (the seed file has its own test), then commit the questions on their own with a message like `Add 40 questions (zene, sport)` and push.

The game prefers questions a TV (household) hasn't seen, so a steady supply of new questions per category keeps repeat games fresh. Players can flag bad questions; `pnpm flagged` (needs `DATABASE_URL`) lists them, and `pnpm flagged --retire <id>` removes one. Fix or delete a flagged question in the JSON as well, or it will stay retired in the database but come back on a fresh database.
