# Otto's voice

Otto's lines are recorded once with Azure's Hungarian neural voice
(`hu-HU-TamasNeural`) and shipped as MP3s. Without these files Otto is
text-only, as before. The lines themselves live in
`packages/shared/src/strings.ts`; they contain no player names or numbers, so
one recording fits every game (the TV shows who a line is about).

## Generating the recordings

1. In the Azure portal, create a **Speech** resource (the free **F0** tier
   covers all of Otto's lines many times over each month).
2. From its "Keys and Endpoint" page, set these in your own shell (never
   commit them or paste them anywhere):
   - `AZURE_SPEECH_KEY`
   - `AZURE_SPEECH_REGION`, e.g. `westeurope`
3. `pnpm voice:generate --dry-run` lists the lines; `pnpm voice:generate`
   records them. Only new or changed lines are recorded; lines that were
   removed have their files deleted.
4. Try it with `pnpm dev`, then commit `apps/web/public/voice/` and push.

To try another voice, set `AZURE_VOICE` (for example `hu-HU-NoemiNeural`) and
delete the MP3s so everything is recorded again. Rate and pitch are tuned in
`apps/server/src/tools/generateVoice.ts` (`PROSODY`).

After editing Otto's lines, run `pnpm voice:generate` again.
