# Otto's voice

Otto's lines are recorded once with a text-to-speech voice and shipped as
MP3s in this folder. Without them Otto is text-only. The lines live in
`packages/shared/src/strings.ts`. They contain no player names or numbers, so
one recording fits every game; the TV shows whom a line is about.

`pnpm voice:generate` records only new or changed lines, deletes clips of
lines that were removed, and writes `manifest.json` with each clip's length
(the server waits for Otto to finish a line before moving on), plus
`credit.json` when the service asks to be credited on screen. Keys go in
your own shell: never commit them or paste them anywhere.

## ElevenLabs (recommended)

The most expressive host voice. Otto currently uses the Hungarian Voice
Library voice `M336tBVZHWWiWb4R54ui` on `eleven_v3`, on the Starter plan.

What we learned choosing it:
- **Use a native Hungarian voice.** Voices designed or recorded in English
  read Hungarian with an English accent, whatever the model or settings.
  In the Voice Library, filter by Language: Hungarian.
- **Library voices need a paid plan** through the API (the free plan returns
  "paid_plan_required"). Starter is enough.
- **`eleven_v3` pronounces Hungarian best**, and acts out the bracketed cues
  at the start of each line in `packages/shared/src/strings.ts`
  (`[excited]`, `[sighs]`, `[short pause]`…). It runs on the "Creative"
  setting (`ELEVEN_V3_SETTINGS`); "Natural" sounded robotic.
  Multilingual v2 mispronounced Hungarian with this voice.

Steps:
1. On elevenlabs.io, open **Developers → API keys** and create a key with the
   **Text to Speech** permission (the value starts with `sk_`).
2. Add Otto's voice to My Voices and copy its **Voice ID**.
3. Set both in your terminal:
   - PowerShell: `$env:ELEVENLABS_API_KEY="…"` and `$env:ELEVENLABS_VOICE_ID="…"`
   - bash/zsh: `export ELEVENLABS_API_KEY=…` and `export ELEVENLABS_VOICE_ID=…`
4. `pnpm voice:generate --dry-run` lists what would be recorded and the
   estimated credits. Then `pnpm voice:generate` records Otto's lines and
   `pnpm voice:generate --questions` reads the questions aloud (into `q/`).
5. `pnpm dev`, open http://localhost:5173/tv and play a round to listen.
   Re-record lines you don't like: `pnpm voice:generate --redo welcome-0,winner-1`
   (ids are in the dry run). `--redo` only adds retakes on top of lines that
   are already recorded; on an empty folder it records everything.
6. Commit `apps/web/public/voice/` and push to `main`.

Options: `ELEVENLABS_MODEL` (default `eleven_v3`; `eleven_flash_v2_5`
costs half but sounds flatter; both get `language_code: hu`). Changing the
voice, model or settings records everything again on the next run.

## Azure

Microsoft's Hungarian neural voices (`hu-HU-TamasNeural` by default): clear
but more newsreader than showman. The free F0 tier covers Otto many times over.

1. In the Azure portal, create a **Speech** resource (free F0 tier).
2. From "Keys and Endpoint", set `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`
   (e.g. `westeurope`) in your terminal.
3. `pnpm voice:generate --provider azure` (also `--dry-run`, `--redo`), then
   commit this folder. `AZURE_VOICE=hu-HU-NoemiNeural` picks another voice.

## After editing Otto's lines

Run `pnpm voice:generate` again: only the changed lines are recorded.
