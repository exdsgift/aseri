# data

Current state, and nothing else. **This ref is force-pushed to a single commit every
run** — it keeps no history, deliberately, because everything on it is regenerable: lose
it and the next run rebuilds it. It is a cache.

The Pages job overlays this branch's `data/` directory onto the assembled site, so
production is "code from `master` plus data from here". That is what lets `master` stop
receiving automated commits and become a protectable ref (#6, #10).

Two things are **not** here:

- **The accumulated record** is on the `history` branch, append-only, one directory per
  run. It is the only store time cannot rebuild, so it must never live on a ref that
  gets force-pushed.
- **Reference inputs** — the actor alias table, the polity table, the coastline — stay
  on `master`. A human edits them and they get reviewed, which makes them source, not
  output.

Nothing on this branch is reviewed, and no pull request should ever target it.
