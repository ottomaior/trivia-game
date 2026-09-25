# Otto's Quiz Show

Hungarian party trivia game: the TV runs `/tv`, phones join at `/ABCD`. pnpm monorepo: `packages/shared` (protocol, rules, all UI text), `apps/server` (Fastify + Socket.IO, in-memory game engine, Postgres via Drizzle), `apps/web` (React + Vite). Design and roadmap are in `PLAN.md`; setup and deploy steps are in `README.md`.

## Commands

- `pnpm dev` runs the server on :3000 and Vite on :5173 (TV at http://localhost:5173/tv).
- `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm e2e`
- `pnpm questions:check` validates the question file.
- `pnpm audio:render` renders the studio sound set into `audio-src/`, and `pnpm audio:prepare` (needs ffmpeg) turns `audio-src/` into `apps/web/public/audio/`; `pnpm voice:generate` records Otto's lines with ElevenLabs (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`) or Azure (`--provider azure`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`), keys set in the owner's shell; never ask for a key. `--dry-run` shows the credit cost, `--redo <ids>` retakes lines. Both READMEs are in those folders.
- `apps/motion` holds the paper-studio art: the generators in `apps/motion/art` (plain Node, the single source of every drawing) and the Remotion clips in `apps/motion/src`. The web app's `dev` and `build` run the generator into `apps/web/public/art/` (gitignored), and the game shows the drawings as `<img src="/art/….svg">`. Players pick one of twelve characters (`CHARACTERS` in `rules.ts`), drawn by `ui/Character.tsx` with an optional expression; `stage/expressions.ts` decides which face the game state earns (correct, wrong, fooled, sneaky, out, frozen, slimed). Ottó is `ui/PaperOtto.tsx`: one image per rig piece (`art/stage.mjs`), posed and lip-synced with CSS, so no SVG filter is redrawn while the game runs; keep it that way on weak TVs. Panels that stretch to fit text (tiles, cards, desks) are in `STRETCH` in `art/build.mjs`. `pnpm motion:art` builds the contact sheet, `pnpm motion:studio` previews the clips, `pnpm motion:render` renders the show open; see its README. The TV plays the show open through the intro (`TIMINGS.intro` = `SHOW_OPEN_MS`, falling back to the title card in flat mode or if the clip can't play); its web copy is committed at `apps/web/public/clips/show-open.mp4`, rendered with `pnpm --filter @trivia/motion render:web` (needs Remotion's browser, or `--browser-executable` for Edge). The clip has Ottó's `welcome-1` line baked in: re-render it after re-recording that line. The Dockerfile installs with `--filter '!@trivia/motion'`, so Remotion never reaches the server image.
- The TV has three effects modes, forced with `/tv?fx=full|lite|flat`. E2E defaults to `lite` because headless Chromium has no GPU.
- Otto's lines (`packages/shared/src/strings.ts`) must stay free of names and numbers, because they are pre-recorded; after editing them, the voice needs regenerating. Each line starts with a bracketed performance cue (`[excited]`, `[sighs]`, `[short pause]`…) that ElevenLabs v3 acts out and screens strip (`ottoText`); keep one on every line. The TV never repeats a variant until all were said (`LinePicker`), so frequent situations need many variants.
- Otto is a host, not a commentator: each round he reads the question and says at most one more thing, only when something happened (rules in `apps/server/src/game/otto.ts`; small moments only after a quiet round). Keep lines short: `ottoMaxChars` sets a budget per line (about 13 characters a second), and a test enforces it; prefer cues that don't add pauses. The server waits for Otto to finish before moving on, using each clip's `durationMs` from the voice manifests, so a long line slows the game rather than getting cut off.
- Otto reads every question aloud: `pnpm voice:generate --questions` records each prompt in the seed files (`questions.json`, `bluff.json`, `timeline.json`, `numbers.json`) into `apps/web/public/voice/q/`, named by a hash of the prompt (`questionVoiceId`), so a reworded question is recorded again. Otto's voice is ElevenLabs voice `M336tBVZHWWiWb4R54ui` on `eleven_v3` (Starter plan; the key is only on the owner's PC).
- Schema change: edit `apps/server/src/db/schema.ts`, run `pnpm db:generate`, and commit the new migration. Railway applies it on deploy.

## Production

- Live at https://triviaserver-production-d945.up.railway.app (TV: `/tv`, health: `/healthz`).
- Railway project `efficient-perception`: one app service `@trivia/server` plus `Postgres`, region US East. Details are in `README.md` under "Deploying to Railway".
- **Railway deploys the `main` branch.** Every push to `main` redeploys and ends any game in progress; pushing to other branches deploys nothing. To ship work from a branch, merge it into `main`.
- There is no Railway config file in the repo (Railway stopped letting new services use config-as-code). Build, pre-deploy, and health check settings live only in the Railway dashboard.
- A cloud session can't reach Railway. Deploy settings, logs, and variables need the owner's Railway dashboard or the `railway` CLI on their machine.

## Adding questions

Multiple-choice questions live in `apps/server/seed/questions.json`; the party modes have their own files (see "Party modes" below). Every deploy loads any new ones into the database and skips ones already there, so adding questions means editing the file, checking it, committing, and pushing. **Do not use `pnpm gen`** (it spends Anthropic API credits); write the questions yourself in the session.

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

- `category` is one of the slugs in `apps/server/seed/categories.json`. Aim for 15 questions per difficulty in each category.
- `difficulty`: 1 = most adults know it; 2 = an informed, curious adult knows it; 3 = only people interested in the topic know it.
- `answer` is the correct answer. `wrong` has exactly 3 wrong answers. The game shuffles the order.
- `explanation` is optional: one short sentence shown on the TV at the reveal.

### Packs

In the lobby the VIP first picks a game mode (Kvíz, Milliomos-létra, Blöffölő, Időrend, Tippelj!; names and taglines in `t.modeNames`/`t.modeTaglines`); in Kvíz the players then vote for a question pack, while a mode with a single pack locks it at once. The VIP can switch some of the pack's categories off, and each round's category vote then offers only that pack's categories. Packs are defined in `apps/server/seed/packs.json` as lists of category slugs (`"*"` means all), and a category can be in several packs. A pack is offered only once its categories hold at least `PACK_MIN_QUESTIONS` (60) questions, so a new pack or category can be added before its questions are written. `pnpm questions:check` prints the counts per category and per pack, and flags packs that are still hidden. A pack with `"mode": "ladder"` plays Milliomos-létra (15 rungs, `apps/server/src/rooms/Ladder.ts`) instead of the ten-round game; its rungs draw easy, medium and hard questions in turn, so every category needs all three difficulties. Packs with `"mode": "bluff"`, `"timeline"` or `"guess"` play the party modes below, and are sized only by questions of their own kind.

### Party modes

Three modes play eight rounds of the classic loop (category vote, Otto reads the prompt, reveal, scoreboard; no power plays) with their own kind of question, each in its own seed file. Their rules are in `apps/server/src/rooms/Bluff.ts`, `Timeline.ts` and `Guess.ts`, their scoring in `packages/shared/src/rules.ts`. The general content rules above apply to all of them; `pnpm questions:check` validates and counts every file.

- **Blöffölő** (`seed/bluff.json`): everyone writes a believable lie, then picks the truth from the lies. Entries are `{category, difficulty, prompt, answer, alternates?, decoys, explanation?}`. The prompt has exactly one `____` blank (read aloud as a pause) or is a short question. `answer` is short (at most 40 characters) and surprising; `alternates` are other spellings of the truth, which players can't submit as lies; `decoys` are the house's two believable lies, used when too few players write one. Pick facts where no other filler of the blank is also true: players' lies are scored as lies, so a blank with several correct answers ("more X live in Australia than people") is unfair.
- **Időrend** (`seed/timeline.json`): order five items chronologically. Entries are `{category, difficulty, prompt, items: [{text, year}] ×5, explanation?}`, listed earliest first with different years. Avoid items whose year depends on the definition (festival vs cinema release, single vs album, construction start vs opening) when it could change the order, and pin ambiguous items in the text ("Dűne, első rész").
- **Tippelj!** (`seed/numbers.json`): guess a number, then bet chips on the closest guesses. Entries are `{category, difficulty, prompt, answer, unit?, explanation?}`. The answer is one exact, undisputed number; skip facts that sources give differently (heights, areas, runtimes) or pin them ("2024 végén"). Decimals and negatives work (players may type a decimal comma), but avoid answers like 9¾ that are awkward to type.

The blind check (below) works the same way per file: for Blöffölő the checker sees the prompt with the truth and the two decoys shuffled and also flags blanks with other true fillers; for Tippelj! it gives the exact number; for Időrend it orders the five items shown in shuffled order.

### Content rules

- The players are a Hungarian friend group aged 18–35: pick themes and a light, witty style they enjoy (the 2000s–2020s pop culture they grew up with, series, games, internet, sport), within the rules below.
- Natural Hungarian that doesn't read like a translation, with correct spelling (ő, ű). Use the Hungarian release titles of films, series and books.
- Exactly one correct answer, which must be an undisputed, easily checkable fact.
- No facts that change over time: records, current office holders, populations, "the latest" anything. If unavoidable, pin a date ("2024 végéig").
- No estimates, opinions, or "melyik NEM…" questions.
- Wrong answers are plausible, the same kind of thing as the answer, similar in length, and none of them is partly right.
- The question is at most 200 characters and each answer at most 60. The answer never appears in the question.
- Mix Hungarian and international topics, and eras and question styles. Family-friendly.
- Don't repeat a fact already in the file (search it first).
- Write every question yourself. Other quiz sites and question banks (Honfoglaló, Milliomos question files) are copyrighted: never copy them. Open Trivia DB may give ideas, but take only the fact and write fresh wording and wrong answers.

### Workflow

1. Write the new questions and append them to `apps/server/seed/questions.json` (or the party mode's file).
2. Run `pnpm questions:check` and fix every error and warning.
3. **Blind check:** start a sub-agent (Agent tool) that sees only the prompts and the four choices in shuffled order, labelled A–D, never the answer key. Ask it to answer each one, with a confidence from 0 to 1 and a note on anything ambiguous, outdated, or misspelled. Remove or fix every question where its choice differs from the key, its confidence is below 0.85, or it raised a concern. Report what was dropped and why.
4. Run `pnpm test` (the seed file has its own test), then commit the questions on their own with a message like `Add 40 questions (zene, sport)` and push.
5. Record the read-alouds for the new questions: `pnpm voice:generate --questions` (only new or reworded prompts are recorded), then commit `apps/web/public/voice/q/` and push. This needs the ElevenLabs key, which only the owner's PC has; from a cloud session, tell the owner to run it. Questions without a recording still play, just silently.

The game prefers questions a TV (household) hasn't seen, so a steady supply of new questions per category keeps repeat games fresh. Players can flag bad questions; `pnpm flagged` (needs `DATABASE_URL`) lists them, and `pnpm flagged --retire <id>` removes one. Fix or delete a flagged question in the JSON as well, or it will stay retired in the database but come back on a fresh database.
