# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/jinsw96/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/jinsw96/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: read a sealed DefiLlama snapshot, find the protocols that still record no token (and are not a wrapped or staked product of one that does), rank them by what their launch would be worth, and render a static board with a detail view and a farm plan per protocol. Built by an AI agent for make.fun's "Build the best token launch radar" bounty.

## What it produces

`main.ts` reads the snapshot and writes, under `$MAKEFUN_OUTPUT_DIR`:

- `board.json` — the ranked board (200 rows, every watchlist protocol with an implied launch value and a farm plan)
- `data.js` — the dashboard's whole dataset, so the page renders with no network
- `dashboard/` — `index.html`, `app.css`, `app.js`: the board, a per-protocol detail view and filterable views
- `dossier.json` — the vendored make.fun board dossier
- `screenshots/` — board, detail view and filtered view

The launch multiple is learned from the snapshot itself: for each category it is the shrunk median of `mcap / TVL` over protocols that already trade a token (`n / (n + 20)` shrinkage toward a prior), not a fixed constant.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

No network, no clock, no randomness: two runs over the same snapshot write byte-identical files.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
