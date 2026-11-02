PROTOTYPE, throwaway: measures how much the latest-vintage GPR backtest flatters Timestral (issue #145)

Results and verdicts: `docs/research/gpr-realtime-backtest.md`, numbers in `docs/research/gpr-realtime-backtest.json`. Spike run on 2026-10-31.

## Files

- `fetch.py`: lists the authors' archived daily vintages (`data_gpr_daily_recent_YYYYMMDD.dta`) through the GitHub contents API and downloads the missing ones into `data/`, one a second, with aseri's User-Agent and the GPR adapter's retry.
- `backtest.py`: builds the as-of view of GPR from the vintages, forecasts each weekly origin twice with the production Timestral-209M (`aseri.forecast`), from the vintage of its day and from the latest vintage, scores both with `aseri.scoring`, prints the Markdown tables and writes `docs/research/gpr-realtime-backtest.json`. It asserts that the as-of view gives back every vintage exactly and that no scoring value was seen after its scoring day.
- `revisions.py`: calibrates GPR's deep-revision rule (#149). It replays every update between accepted vintages 1 to 4 apart (the archive's view after missed weeks) through the production `archive.check_revisions`, counts the moved and scaled old days through `archive.deep_revision`, prints the calibration tables, asserts that only the February 2024 fix holds, and writes the replay fixture `pipeline/tests/fixtures/gpr_revision_pairs.csv`.
- `data/` (vintages, about 440 MB, the forecast cache `forecasts.npz` and `report_stdout.md`) is git-ignored.

## Rerun (Git Bash on Windows, from `pipeline/`, which provides the pinned model and the `aseri` package)

```bash
cd pipeline
uv sync
uv run python -I ../prototypes/gpr-realtime-backtest/fetch.py      # about 8 min, once
uv run python -I -X utf8 ../prototypes/gpr-realtime-backtest/backtest.py > ../prototypes/gpr-realtime-backtest/data/report_stdout.md
# about 35 min on a laptop CPU (464 forecasts at 4.4 s); about 35 s once data/forecasts.npz exists
uv run python -I -X utf8 ../prototypes/gpr-realtime-backtest/revisions.py      # about 70 s, no model
```

The scripts put `pipeline/` on their own path, so `-I` is safe. The Timestral weights come from the Hugging Face cache at the revision pinned in `aseri/forecast.py`. `LATEST` in `backtest.py` pins the newest vintage used (2026-10-26), so a rerun scores the same data; delete `data/forecasts.npz` after changing it.
