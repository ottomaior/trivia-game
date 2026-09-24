# Studio sounds

Every sound here is optional. Without a file, the game plays its built-in
synthesized version (or nothing, for the audience reactions). With a file, the
recording wins. A sound can have several variants (`applause.wav`,
`applause-2.wav`, `applause-3.wav`); the game picks one at random each time, so
repeats don't get stale.

## How to add sounds

1. Download a free Sonniss GDC bundle (sonniss.com/gameaudiogdc, royalty-free,
   commercial use, no attribution needed).
2. Pick files from the list below and copy them into `audio-src/` at the repo
   root (it is git-ignored), **renamed to the sound's name**: `applause.wav`,
   `applause-2.wav`, `lobby.wav`, … Any of wav, mp3, ogg, flac, aif, m4a works.
3. Run `pnpm audio:prepare`. It needs ffmpeg (`winget install ffmpeg` on
   Windows, `brew install ffmpeg` on macOS, or set `FFMPEG_PATH`). It trims
   silence, cuts effects to 5 seconds with a fade, evens out loudness
   (−16 LUFS), converts to MP3 here, and rewrites `manifest.json`. Files you
   removed from `audio-src/` are removed here too.
4. Check the total it prints (budget: 6 MB), try it with `pnpm dev`, then
   commit `apps/web/public/audio/` and push.

## Shopping list

Search keywords are for the Sonniss bundle file names. ★ = most noticeable,
get these first.

### Studio audience

| Name | When | What it should sound like | Search for | Variants |
|---|---|---|---|---|
| `applause` ★ | right answer, intro, final | a medium studio crowd clapping, 2–4 s, natural fade | applause, clapping, crowd clap, studio audience | 3 |
| `cheer` ★ | everyone right, lead change, winner | crowd cheering and whooping, short burst | cheer, crowd cheer, whoop, yay | 2 |
| `aww` | nobody got it | sympathetic crowd "awww" going down | aww, crowd disappointed, crowd sigh | 1–2 |
| `ooh` | Otto praises a streak or a lightning answer | impressed crowd "oooh" | ooh, crowd impressed, crowd reaction | 1–2 |
| `laugh` | Otto jokes after nobody got it | a warm crowd laugh, not a sitcom roar | crowd laugh, audience laughter, chuckle | 2 |
| `gasp` | close race | quick crowd gasp | gasp, crowd gasp, surprise | 1 |

### Stingers and effects

| Name | When | What it should sound like | Search for |
|---|---|---|---|
| `reveal` ★ | right answer revealed | a bright "ding"/bell hit or a short correct-answer sting, under 1.5 s. It plays 0.75 s after `drumroll` starts | ding, bell, correct, success sting, chime |
| `drumroll` ★ | right before the reveal | a snare drumroll, about 0.75–1 s, ending on its own or cut (the ding covers the end) | drumroll, snare roll |
| `wrong` ★ | nobody got it | a comic "wah-wah" or a soft buzzer, under 1.5 s | fail, wrong, buzzer, trombone, wah wah |
| `timeUp` | the answer clock hits zero | a game-show buzzer, short | buzzer, time up, game show buzzer |
| `tick` | last 5 seconds of the clock | a single clock tick or wood block, very short | clock tick, tick, wood block |
| `question` | a new question appears | a whoosh or swoosh with a light sting | whoosh, swoosh, transition |
| `start` | the show begins | a short fanfare or TV intro sting, 1–2 s | fanfare, intro sting, tv jingle |
| `winner` ★ | final results | a triumphant fanfare, 2–4 s | fanfare, victory, win, triumph |
| `leadChange` | somebody takes the lead | a short upward sting or brass hit | sting, brass hit, level up |
| `scoreboard` | the standings appear | a soft swoosh or slide | slide, swoosh, ui transition |
| `spinTick` | the category slot machine spins | one short mechanical click (plays many times) | click, ratchet, slot, mechanical click |
| `spinLand` | the slot machine stops | a clunk plus a small bell | slot stop, clunk, ding, lock |
| `join` | a player joins the lobby | a friendly pop or blip | pop, bubble, ui positive |
| `vote` | a player votes | a light click or tap | tap, ui click, button |
| `lockIn` | a player locks in an answer | a satisfying click/lock | lock, click, confirm |

### Music (loops)

| Name | When | What it should sound like | Search for |
|---|---|---|---|
| `lobby` | waiting for players | upbeat, jazzy or funky 70s/80s TV loop, 30–90 s, loops cleanly | retro, funk, lounge, game show music loop |
| `thinking` ★ | while players answer | tense but light "thinking" loop, steady pulse | thinking, suspense loop, quiz, tension light |
| `final` | the final results | celebratory loop, brass or disco | celebration, victory loop, disco |

Music is kept as stereo 128 kbps; long tracks eat the 6 MB budget quickly,
so prefer loops under a minute.
