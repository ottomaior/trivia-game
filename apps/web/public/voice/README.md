# Otto's voice

Otto's lines are recorded once with a text-to-speech voice and shipped as
MP3s in this folder. Without them Otto is text-only. The lines live in
`packages/shared/src/strings.ts`. They contain no player names or numbers, so
one recording fits every game; the TV shows whom a line is about.

`pnpm voice:generate` records only new or changed lines, deletes clips of
lines that were removed, and writes `manifest.json` (and `credit.json` when
the service asks to be credited on screen). Keys go in your own shell: never
commit them or paste them anywhere.

## ElevenLabs (recommended)

The most expressive host voice. Otto's 51 lines are about 1,700 characters:
about 1,700 credits on Multilingual v2, so the free plan (10,000 credits a
month) covers a full recording several times over, retakes included. The free
plan is for non-commercial use and asks for attribution; the TV shows
"Otto hangja: ElevenLabs" on the start screen and in the lobby automatically.

1. On elevenlabs.io, open **Developers → API keys** and create a key with the
   **Text to Speech** permission.
2. Pick Otto's voice: a warm, lively male voice from the **Voice Library**
   (add it to My Voices), or make one with **Voice Design** (e.g. "cheerful
   middle-aged Hungarian game-show host, warm, theatrical, 1970s TV"). Copy
   its **Voice ID**.
3. Set both in your terminal:
   - PowerShell: `$env:ELEVENLABS_API_KEY="…"` and `$env:ELEVENLABS_VOICE_ID="…"`
   - bash/zsh: `export ELEVENLABS_API_KEY=…` and `export ELEVENLABS_VOICE_ID=…`
4. `pnpm voice:generate --dry-run` lists what would be recorded and the
   estimated credits. Then `pnpm voice:generate` records it.
5. `pnpm dev`, open http://localhost:5173/tv and play a round to listen.
   Re-record lines you don't like: `pnpm voice:generate --redo welcome-0,winner-1`
   (ids are in the dry run). Each retake costs only that line's credits.
6. Commit `apps/web/public/voice/` and push to `main`.

Options: `ELEVENLABS_MODEL` (default `eleven_multilingual_v2`; `eleven_v3`
is more expressive, `eleven_flash_v2_5` costs half but sounds flatter).
Delivery (stability, style) is `ELEVEN_SETTINGS` in
`apps/server/src/tools/generateVoice.ts`. Changing the voice, model or
settings records everything again on the next run.

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
