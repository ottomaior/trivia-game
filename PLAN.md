# PLAN.md — "Otto's Quiz Show" (working title)

## 0. Context

This is a couch party trivia game for 2–6 friends in the same room, inspired by *Knowledge is Power* and Jackbox. One TV runs a browser tab (the **host screen**). Players join from their phone browsers with a QR code or a 4-letter room code. The look is a retro 70s–80s TV quiz show hosted by **Otto**, a mustached host character, with blob avatars for the players. A single player can also start a game (handy for testing and practice).

The game is **Hungarian only**: all UI text, Otto's lines, and questions are in Hungarian.

**Status:** Phase 0 and Phase 1 are built and tested, and the game is deployed on Railway at https://triviaserver-production-d945.up.railway.app (see README, "Deploying to Railway"). What's left for Phase 1 is a real game night.

**Decisions already made in Q&A:**
| Topic | Decision |
|---|---|
| Language | **Hungarian only.** (Originally one language per room, HU or EN; English was dropped.) No language column anywhere, and questions are generated natively in Hungarian. |
| "Group" identity | **TV browser identity.** The host tab stores a random `householdId` in localStorage. "Already seen" questions are tracked per household. |
| Frontend | **React + Vite** |
| Game length | **About 15 minutes, 10 questions** (the finale gets added in a later phase) |
| Question QA | **Automatic verification + player flags.** A second Claude pass verifies each question, and flags retire bad ones. There's no manual approval step. |
| Artwork | **Otto and the blobs are drawn in SVG/CSS in code** |
| TV target | **Chrome over HDMI first**, with smart-TV built-in browsers as a best-effort secondary target |

---

## 1. Tech stack (recommendations)

| Concern | Choice | Why |
|---|---|---|
| Realtime | **Socket.IO v4** | It has built-in auto-reconnect, rooms, ack callbacks (useful for "answer received"), heartbeats, and a **long-polling fallback**, which helps old smart-TV browsers and flaky phone Wi-Fi. With raw `ws` we'd have to rebuild all of that. The overhead is irrelevant for 7 clients. Typed events come from shared TS interfaces. |
| Server | Node 22 + **Fastify** + Socket.IO | Fastify also serves the built web app, `/healthz`, and a small JSON API. |
| DB | **Postgres on Railway** + **Drizzle ORM** (drizzle-kit migrations) | This is better than SQLite on a volume. Railway volumes block zero-downtime deploys and tie the service to one volume, while Postgres gets managed backups, lets the generator scripts run from your laptop over the public URL, and gives us `pg_trgm` for duplicate detection. Drizzle is TS-first and lightweight. |
| Validation | **zod** schemas in `shared` | All client→server payloads get validated at runtime. The same schemas validate AI-generated question JSON. |
| Client | React 19 + Vite, React Router, CSS Modules with CSS variables for tokens | There's no UI kit, which keeps generic app styling out. Animations are plain CSS keyframes (light enough for TV browsers). |
| QR | `qrcode` (renders SVG on the TV) | |
| Tests | **Vitest** (engine unit tests with a fake clock) + **Playwright** (1 TV context plus N phone contexts in one browser) | |
| Package mgmt | **pnpm workspaces** | |
| AI | Anthropic TS SDK, Haiku (`claude-haiku-4-5`) for generation, structured JSON output, and the Message Batches API for bulk runs (50% cheaper) | |

## 2. Project structure — a single monorepo deployed as a single service

```
trivia-game/
├─ package.json / pnpm-workspace.yaml / tsconfig.base.json
├─ packages/
│  └─ shared/            # the contract between all three parts
│     └─ src/
│        protocol.ts     # Socket.IO ClientToServer / ServerToClient event maps
│        views.ts        # HostView, PlayerView (what each screen may know)
│        schemas.ts      # zod: payloads + question kinds
│        rules.ts        # timings, scoring formula, limits (single source of truth)
│        strings.ts      # all Hungarian UI text + Otto's lines
├─ apps/
│  ├─ server/
│  │  └─ src/
│  │     index.ts        # Fastify + Socket.IO + static web build
│  │     rooms/          # RoomManager, room codes, sessions/reconnect
│  │     game/           # engine: phases, timers (injectable clock), scoring, views
│  │     content/        # question selection, household "seen" tracking, flags
│  │     db/             # drizzle schema + migrations
│  │  └─ scripts/        # gen-questions.ts (generate + blind verify), flagged.ts
│  │  seed/              # hand-written starter questions (loaded on every deploy)
│  └─ web/
│     └─ src/
│        main.tsx        # routes: /tv (host), /:code? (phone join), /credits
│        tv/             # host screens (lazy-loaded)
│        phone/          # controller screens (lazy-loaded, kept small)
│        ui/             # tokens.css, Marquee border, AnswerTile, Blob, Otto, Timer
│        net/            # socket client, clock sync, session storage
└─ e2e/                  # Playwright multi-device tests
```

**Why this setup:**
- **The shared protocol types are the main benefit.** Drift between the TV, phone, and server is the most common bug source in games like this, and one `shared` package makes drift a compile error.
- **One Railway service** serves both the static web build and the socket server. That means the same origin, no CORS, one deploy, and one URL for the QR code.
- **TV and phone as two routes of one Vite app** share the design system. Route-level code splitting keeps the phone bundle small.
- **Railway:** one service (Dockerfile, pre-deploy `node apps/server/dist/release.js` for migrations and seed, health check `/healthz`, all set in the Railway dashboard) plus the Postgres plugin (`DATABASE_URL` reference variable). **It must be a single instance**, because live state is in memory.

## 3. Game state machine

Each room is a class on the server that owns one active timer. Every transition goes through `enterPhase(phase)`, which sets `phaseEndsAt` (server time), schedules the next transition, and broadcasts views. Phases end **early** once every connected player has acted.

```
                 VIP taps "Start"
LOBBY ──────────────────────────────▶ INTRO (3s, Otto welcome)
  ▲                                         │
  │ VIP "Play again" (same players)         ▼
  │                              ┌──▶ CATEGORY_VOTE (8s | all voted)
  │                              │          │  (later: power-play pick happens HERE, in parallel)
  │                              │          ▼
  │                              │    QUESTION_READ (2s: question on TV, answers locked)
  │                              │          ▼
  │                              │    QUESTION_OPEN (20s | all answered)
  │                              │          │  (later: Freeze/Slime obstacles resolved on phone)
  │                              │          ▼
  │                              │    REVEAL (7s staged: drumroll → correct → who picked what → points)
  │                              │          ▼
  │                              └── SCOREBOARD (4s)  [round < 10]
  │                                         │ round == 10
  │                                         ▼
  └────────────────────────────────── FINAL_RESULTS (winner, podium; VIP: again / new lobby)

Later phases insert: SPECIAL_ROUND (LINKING | SORTING) at fixed rounds, and FINALE_PYRAMID before FINAL_RESULTS.
Cross-cutting: PAUSED (TV disconnected mid-game → timers frozen, resumes on TV reconnect; room dies after 10 min).
```

**Target time per question:** 8 + 2 + ≤20 + 6 + 4, so ≤40 seconds and usually about 30 because phases end early. With intro and results, 10 questions take roughly 8–10 minutes, which leaves room for special rounds and the finale later. To keep things moving, the category vote and the power-play pick happen **on the same phone screen at the same time**, never as separate phases.

**Category vote:** the server offers 3 categories that still have unseen questions for this household (never the previous round's category, when there's a choice). The most votes wins, and a tie is broken randomly (this is an open decision, see §7). Question difficulty follows a curve: easy for rounds 1–3, medium for 4–7, hard for 8–10.

**Scoring** (constants in `shared/rules.ts`):
`points = correct ? round(500 + 500 × (1 − responseMs / openMs)) : 0`, which gives 500–1000 per correct answer.
- `responseMs = serverReceivedAt − answersOpenedAt − oneWayLatency(player)`. One-way latency is an EWMA of socket ping RTT/2, clamped to 0–150 ms, so a phone on bad Wi-Fi isn't penalized.
- Once a player locks in an answer, they can't change it.

**Answer secrecy:** the server shuffles choices per question. `QUESTION_*` views contain the choices with **no** correct index. The correct index is added only in the `REVEAL` view, and that applies to both the TV and the phones.

## 4. WebSocket protocol (Socket.IO, typed in `shared/protocol.ts`)

**Pattern: state snapshots, not deltas.** On every change the server sends each socket a **role-specific view** that is complete for its phase: `HostView` to the TV and a personalized `PlayerView` to each phone. That makes reconnection trivial (the next snapshot *is* the resync) and keeps clients as pure renderers. A few one-shot events handle animations and sounds.

Every view carries `{ stage, round, totalRounds, phaseEndsAt, serverNow, paused }`. Clients compute their clock offset from `serverNow` plus `time:ping` samples and count down to `phaseEndsAt`.

### Client → Server
| Event | Sender | Payload | Ack |
|---|---|---|---|
| `host:create` | TV | `{ householdId }` | `{ roomCode, hostToken }` |
| `host:resume` | TV | `{ roomCode, hostToken }` | `ok \| NOT_FOUND` |
| `player:join` | phone | `{ roomCode, name }` | `{ playerId, sessionToken, avatar } \| ROOM_FULL \| NAME_TAKEN \| IN_PROGRESS \| NOT_FOUND` |
| `player:resume` | phone | `{ roomCode, playerId, sessionToken }` | `ok \| NOT_FOUND` |
| `player:setAvatar` | phone | `{ color, face }` (lobby only) | |
| `vip:start` | VIP phone | `{}` (needs ≥2 players) | |
| `vip:kick` | VIP phone | `{ playerId }` (lobby only) | |
| `vip:playAgain` / `vip:newLobby` | VIP phone | `{}` | |
| `vote:cast` | phone | `{ categoryId }` | `ok` |
| `answer:submit` | phone | `{ questionId, choice: 0-3 }` | `{ accepted }` (drives the "Locked in!" state) |
| `question:flag` | phone | `{ questionId, reason }` (REVEAL/SCOREBOARD only) | `ok` |
| `time:ping` | any | `{ t }` | `{ t, serverNow }` |
| *later* `power:choose` | phone | `{ power: 'freeze'\|'slime', targetId }` | |
| *later* `power:cleared` | phone | `{ }` (after N taps or swipe coverage — server records it for the TV) | |
| *later* `link:submit`, `sort:submit`, `pyramid:answer` | phone | kind-specific | |

### Server → Client
| Event | To | Payload |
|---|---|---|
| `view:host` | TV | `HostView`: room code, join URL, players (name, avatar, connected, isVIP, score, hasActed), current phase data (vote options + live tally, question + choices, reveal with picks per player + deltas, scoreboard, results) |
| `view:player` | each phone | `PlayerView`: `me` (id, isVIP, score, rank), phase data for the controller (vote options, choices + `myChoice`, reveal: `wasCorrect`, `pointsGained`) |
| `fx` | TV (and phones) | `{ type: 'answerLocked'\|'allAnswered'\|'timeWarning'\|'otto', lineKey? }`: one-shot audio and animation cues |
| `room:closed` | all | `{ reason }` |

**Reconnect and identity:**
- Phone: `{ roomCode, playerId, sessionToken }` goes in localStorage. On load, if it's there, the phone sends `player:resume` and lands back in the same slot and score. A random `sessionToken` means nobody can hijack a slot by guessing IDs.
- TV: `householdId` is kept in localStorage permanently. `{ roomCode, hostToken }` is kept for the current room, so an accidental TV refresh resumes the game.
- A disconnected player keeps their slot. The game **doesn't wait** for them: timers run, their answer counts as none, and they're shown dimmed on the TV. In the lobby, a player disconnected for more than 60s is removed. If the VIP drops, the VIP role passes to the next connected player.
- There's no mid-game joining (rejoin only) in the MVP.

**Room codes:** 4 consonants from `BCDFGHJKLMNPQRSTVWXZ`. Leaving out vowels avoids accidentally spelling real words. The join URL is `https://<domain>/ABCD`, and the QR code encodes it.

## 5. Database schema (Postgres, Drizzle)

```sql
categories            (id serial pk, slug text unique, name text, active bool)

questions             (id uuid pk,
                       category_id int fk,
                       kind text check in ('mc','link','sort')   -- future-proof for special rounds
                       difficulty smallint 1..3,
                       prompt text,
                       payload jsonb,        -- mc: {choices[4], correct}; link: {pairs}; sort: {groups, items}
                       explanation text,     -- one-liner Otto can say at reveal
                       source text check in ('claude','manual'),
                       source_ref text,      -- gen batch id, or 'seed'
                       status text check in ('active','retired'),
                       verifier_score real,
                       flag_count int default 0,
                       times_shown int default 0, times_correct int default 0,  -- difficulty calibration
                       norm_hash text,       -- normalized prompt+answer, unique
                       created_at timestamptz)
  idx (category_id, kind, status, difficulty); unique(norm_hash); gin trgm(prompt)

question_flags        (id serial pk, question_id fk, match_id fk, player_name text,
                       reason text check in ('wrong_answer','ambiguous','typo','offensive','other'),
                       created_at, unique(question_id, match_id, player_name))

households            (id uuid pk, created_at, last_seen_at)
household_seen        (household_id fk, question_id fk, seen_at, pk(household_id, question_id))

matches               (id uuid pk, household_id fk, room_code, settings jsonb,
                       started_at, ended_at)
match_players         (match_id fk, seat smallint, name, avatar jsonb, final_score int, rank smallint,
                       pk(match_id, seat))
match_answers         (match_id fk, round smallint, question_id fk, seat smallint,
                       choice smallint null, correct bool, response_ms int, points int)

generation_batches    (id uuid pk, model, prompt_version, category_id, difficulty,
                       requested int, accepted int, rejected int, input_tokens, output_tokens, created_at)
```

**Selection query:** `status='active' AND category=$1 AND kind='mc'`, ordered unseen-by-this-household first, then closest difficulty, then least recently seen (random among ties), skipping questions already asked this game. **Flags:** a question retires automatically when flags come from **2 different matches** (the threshold is a constant). The `flagged.ts` script lists flagged and retired questions and can retire or restore one by hand.

**Content workflow (chosen):** questions are written in Claude Code sessions on the owner's subscription (not API credits), appended to `apps/server/seed/questions.json`, checked with `pnpm questions:check` plus a blind check by a sub-agent that never sees the answer key, then committed and deployed. `CLAUDE.md` has the rules and steps.

**Optional API pipeline** (`pnpm gen --category tortenelem --difficulty 2 --count 10`, uses API credits):
1. **Generate:** Haiku writes the questions natively in Hungarian, mixing Hungarian and international topics. Output is structured JSON validated by zod, and each call includes existing prompts from that category to steer away from duplicates.
2. **Verify:** a separate call answers each question *blind* (without seeing the answer key) and rates ambiguity and confidence. The question is kept only if the blind answer matches and confidence is at or above a threshold.
3. **Dedupe:** exact `norm_hash` matches, then `pg_trgm` similarity above 0.6 within the same category.
4. **Insert** as `active` and record a `generation_batches` row.

**Starter set:** 120 hand-written questions (8 categories × 3 difficulties × 5) ship in `apps/server/seed/`, so the game is playable before any AI generation. The deploy's pre-deploy step loads new ones idempotently. Growing the bank to about 700 with the generator costs a few dollars of Haiku usage.

## 6. Phases and milestones

### Phase 0 — Skeleton and deploy (goal: the pipeline works end-to-end) — built; deployed to Railway 2026-09-24
- Monorepo scaffold, shared package, Fastify + Socket.IO, Vite app with `/tv` and `/:code` routes.
- Drizzle schema and first migration. Railway service + Postgres, Dockerfile, health check.
- Design tokens (palette, Shrikhand + Archivo **with the `latin-ext` subset** for ő/ű), marquee border component.
- ✅ **Milestone:** open the Railway URL `/tv` on the TV and it shows a room code and QR. Scan with a phone, enter a name, and the name and blob appear on the TV. Works over the real internet.

### Phase 1 — Playable MVP (goal: game night with friends) — built and tested locally
- Room engine: every phase in §3 with an injectable clock and early-ending phases. Scoring and latency compensation.
- Lobby: VIP badge, "Start" on the VIP phone, blob avatars (SVG with color and face variants), kick.
- Category vote → question (read, then open) → reveal (who picked what) → scoreboard → final results with a podium. Play again.
- TV "click to start" overlay, needed for audio unlock and fullscreen (audio itself comes in Phase 2).
- Phone: Screen Wake Lock (re-acquired on `visibilitychange`), large A–D tiles at least 64px tall, haptic `navigator.vibrate` on lock-in where supported.
- Reconnection (phone and TV), VIP handoff, TV-disconnect pause.
- Otto as an SVG (idle blink and mustache wiggle) with **text speech-bubble** lines (for example "Lightning fast!" or "Nobody? Really?").
- Flag button on the phone during reveal. Household "seen" tracking. `matches`, `match_players`, and `match_answers` are written.
- Generator (generate + blind verify + hash and trigram dedupe) and a hand-written Hungarian starter set.
- Tests: engine unit tests (phase transitions, early end, scoring, secrecy: no `correct` field in pre-reveal views, reconnect), plus a Playwright test running 1 TV and 3 phones through a full game.
- ✅ **Milestone:** a full 10-question game on your TV with 3+ phones. Refreshing a phone mid-question restores the same player. Refreshing the TV resumes the game. A second game from the same TV shows no repeated questions.

### Phase 2 — Juice and content quality — sound, animation and Otto's commentary built
- ✅ Sound system: synthesized music (lounge loop, thinking pulse) and 12 effects via Web Audio, derived from view changes on the TV, mute toggle (M key / button), optional MP3 overrides.
- ✅ Otto animation (blink, mustache wiggle, talking mouth, moods), chasing marquee bulbs, staged reveal, FLIP scoreboard with count-up, rising podium and confetti — all in CSS, no Framer Motion. Low-motion mode (`?lowfx=1`).
- ✅ Otto line engine: streaks, everyone wrong twice, lightning answers, comebacks, blowouts, close races, last round, solo wording.
- Content: `pg_trgm` dedupe, Message Batches bulk generation, `flagged.ts` re-verification, difficulty recalibration from `times_correct/times_shown`, and a `flagged.ts` option to re-verify flagged questions with Claude.
- Smart-TV pass: `@vitejs/plugin-legacy` for the `/tv` route, a reduced-motion or low-end mode, and a test on your TV's browser.
- ✅ **Milestone:** a game with full audio and animation, and a question bank of at least 1,500. The flagged-question workflow gets used once for real.

### Phase 2.5 — Studio upgrade (built, in review)
- ✅ 2.5D studio: CSS 3D set, GSAP camera director, PixiJS light and particle layer, FPS guard with `full | lite | flat` modes (`?fx=`).
- ✅ Staging: slot-machine category pick (new 1.6s `vote_result` phase), round title card, word-by-word prompt, split-flap clock, reveal with dropping tiles, sparks, points flying to the desks, desks re-sorting with a crown.
- ✅ Otto as a posed cutout rig with lip sync; name- and number-free lines so they can be voiced (`pnpm voice:generate` with ElevenLabs or Azure; the TV credits the voice service).
- ✅ Audio engine with buses, random variants of recorded sounds, studio audience reactions; `pnpm audio:prepare` and a sound shopping list.
- ✅ Rollout: intro title card with bouncing logo letters, empty desks waiting in the lobby, desks that shrink to fit six players, the final on a rising three-step podium with a drifting camera and the full results on the board.
- ✅ Phones: faint sunburst backdrop, answer buttons that pop in and squash, a confetti pop for right answers and a shake for wrong ones, the player's blob (with a crown when leading) on the standings and final screens.
- Next: record the sounds and Otto's voice (owner), then tune levels and timings after a real game night.

### Phase 3 — Power Plays
- One power play per player, granted every N rounds. The player picks it **during the category vote**, on the same screen, so no extra phase is added.
- **Freeze:** the target's answer screen is covered in ice and needs N taps to break. The server sends the obstacle in the target's `PlayerView`. The timer keeps running, which is the whole penalty.
- **Slime:** the target has to swipe to wipe the canvas until at least 70% is clear. Coverage is computed on the client with a downsampled pixel grid.
- The TV shows who hit whom, with animation and Otto commentary.
- ✅ **Milestone:** each power play works in a 4-player game, and no phase takes longer because of it. Unit tests cover targeting rules (can't target yourself, one per round, what happens if the target disconnects).

### Phase 4 — Special rounds
- **Linking** (match 4 left items to 4 right items) and **Sorting** (drag or tap items into one of 2 bins). These use the `kind`/`payload` columns, and the generator and verifier get prompts for each kind.
- Placed at fixed rounds (for example 4 and 8). Scoring is per correct item, with a speed bonus.
- ✅ **Milestone:** both round types can be played on a phone with one thumb and are readable on the TV, backed by generated content.

### Phase 5 — Finale: pyramid race
- Starting position comes from the final score. Rapid-fire questions go to everyone at once, a correct answer moves you up a step and a wrong one costs time or steps, and the first to reach the top wins.
- ✅ **Milestone:** a close finale that the leader can lose. The final results show the pyramid winner.

### Phase 6 — Voice and presentation
- Otto voice lines in Hungarian (production method still to decide, §7), with subtitles. Intro and outro sequences and an attract loop in the lobby.

## 7. Risks and open decisions

### Risks
| Risk | Mitigation |
|---|---|
| **AI factual errors, especially in Hungarian** (Haiku is weaker there) | Blind verification pass, flags with auto-retire, and an `explanation` field that makes errors easier to spot. Consider a stronger model for the *verify* step only (decision below). Sample 20 generated questions yourself before game night. |
| **A Railway deploy or restart wipes live games** (state is in memory) | Don't deploy during game night. Clients show "Server restarted — new room" cleanly. Snapshotting rooms to Postgres is out of scope unless it becomes a problem. |
| **Smart-TV browsers** (old JS engines, weak GPUs, remote-only input) | Chrome over HDMI is the main target. The TV screen needs no input after "click to start", which works with a remote OK button. Legacy build and a low-motion mode in Phase 2. |
| **Wake Lock needs HTTPS and isn't supported everywhere** | Railway gives us HTTPS. For local LAN testing we use `@vitejs/plugin-basic-ssl`. Fallback: a small muted looping video trick on iOS if needed. Reconnect covers the rest. |
| **iOS Safari drops the socket when the app is backgrounded** | `player:resume` on `visibilitychange`, and the snapshot pattern makes the resync instant. |
| **Latency fairness** | Server-side timing with RTT compensation, clamped so it can't be gamed. |
| **Autoplay audio blocked** | Mandatory "click to start" on the TV unlocks an `AudioContext`. Phones stay silent apart from haptics. |
| **QR readability from the couch** | QR at least 30% of the TV height, a 4-letter code in huge Shrikhand, and a short custom domain. |
| **IP and branding** | Original name, characters, and art. No assets or names from *Knowledge is Power*. |
| **Diacritics** (ő, ű) | Load the Google Fonts `latin-ext` subset and add a visual test string. |

### Decisions still open for you (current defaults in parentheses)
1. **Category choice:** everyone votes (default), or a rotating chooser where the last-place player picks as a catch-up mechanic, closer to KiP.
2. **Timers:** vote 8s, read 2s, answer 20s. Want them tighter or looser?
3. **Double points in the last 2 questions** as a comeback mechanic? (default: no, since the finale covers comebacks)
4. **Flag auto-retire threshold:** (flags from 2 different matches)
5. **Verify model:** Haiku (cheapest) or a stronger model for verification only (better HU accuracy, still cheap per batch).
6. **Categories:** the default 8 are History, Geography, Science, Film & TV, Music, Sport, Food, Hungary / Pop culture. Want to swap any?
7. **Otto's voice (Phase 6):** record a real person (for example you), or use Hungarian TTS.
8. **Domain:** a short custom domain for the join URL, or `*.up.railway.app`.
9. **Content tone:** family-friendly only, or allow edgier categories?
10. **Game name** (Otto's show needs a title for the logo).

## 8. Verification strategy (for every phase)
- `pnpm test`: Vitest engine tests with a fake clock covering transitions, early end, scoring math, view secrecy, reconnect, and VIP handoff.
- `pnpm e2e`: Playwright opens 1 TV context and 3 phone contexts and runs a full game, including a phone reload mid-question.
- `pnpm typecheck && pnpm lint` in CI (GitHub Actions) on every push.
- Manual: LAN dev (`pnpm dev`, phones on the same Wi-Fi over HTTPS), then a real game on Railway before each milestone is called done.
