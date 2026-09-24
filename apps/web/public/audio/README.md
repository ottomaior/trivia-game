# Sound overrides

The game synthesizes all of its sounds. To replace one with a recording, put
the file in this folder and name it in `manifest.json`, for example:

```json
{ "winner": "winner.mp3", "lobby": "lobby-loop.mp3" }
```

Effects: `join`, `start`, `vote`, `question`, `lockIn`, `tick`, `timeUp`,
`reveal`, `wrong`, `scoreboard`, `leadChange`, `winner`.
Music (loops): `lobby`, `thinking`.
