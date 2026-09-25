# @trivia/motion: the paper studio

The art for the redesign and the pre-rendered broadcast clips. The look is an old-school TV quiz show built from cut paper: every piece has paper grain, a slightly torn outline, a cream cut-out border and a soft shadow. The mockups live on the design canvas ("Otto's Quiz Show visual direction", a claude.ai Design artifact).

Nothing here is used by the game yet. The plan is for the web app to use the same drawings (as React components) and for the TV to play the rendered clips on cue.

## Commands

From the repo root:

```bash
pnpm motion:art
pnpm motion:studio
pnpm motion:render
```

- `motion:art` builds every drawing into `public/art/` (open `public/art/index.html` for a sheet of all the faces) and copies the audio the clips use from `apps/web/public` into `public/audio/`.
- `motion:studio` opens Remotion Studio to preview and scrub the clips.
- `motion:render` renders the show open to `out/show-open.mp4` (1080p, H.264 with sound, about a minute).

`public/` and `out/` are generated and not committed.

Remotion needs a Chromium-based browser. On first render it downloads its own headless Chrome; to use Edge instead, add `--browser-executable="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"` to the render command.

Remotion is free for individuals and companies of up to three people.

## What's where

| File | What it draws |
|---|---|
| `art/paperlib.mjs` | The palette and `paper()`, the SVG filter that makes anything look like cut paper |
| `art/otto-real.mjs` | Ottó, drawn after the real Ottó (shaved head, trimmed beard, charcoal three-piece suit, champagne tie) |
| `art/otto-rig.mjs` | Ottó as a jointed puppet for animation: separate arm, forearm, head and mic-arm pieces with pivots, a mouth that opens 0–1, blinking eyelids, and `boil` to redraw the edges |
| `art/build.mjs` | Gombóc and Kocka, the studio background, question card, answer tiles, desks, podium and timer, and runs the rest |
| `art/cast6.mjs` | Bab, Csepp, Csillag, Felhő, Szellem and Bogyó |
| `art/expr.mjs` | Every player's expressions: correct, wrong, fooled, sneaky (Blöffölő), out (Milliomos-létra), frozen and slimed (power plays). Each character is a face-free body with eye and mouth anchors; each expression is one face recipe placed on them. |
| `art/party.mjs` | Party-mode props: the bluffer's mask and truth rosette, clothesline and pegs, measuring tape, pins and chips, the ladder and lifeline badges, phone cards |
| `src/ShowOpen.tsx` | The 10-second show open: the studio lights up, the logo slams in, Ottó hops on and says his welcome line (mouth driven by the clip's loudness), and the cast pops up |

## Before merging into `main`

If Railway's install step installs the whole workspace, this package's Remotion dependencies (including its rendering binaries) will be installed on every deploy even though the server never uses them. The build settings live only in the Railway dashboard, so check the service's install command before merging. If it installs everything, either make it skip this package (for example `pnpm install --frozen-lockfile --filter '!@trivia/motion'`), or keep only the rendered clips in the deployed workspace.
