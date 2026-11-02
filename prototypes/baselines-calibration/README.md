PROTOTYPE, throwaway: picks the primary baselines, the calibration offsets and the model candidates before the live record reaches 30 (issue #146)

Decisions, rules and numbers: `docs/adr/0001-baselines-and-calibration-before-the-live-record.md`; every number in `docs/research/baselines-calibration.json`. Run on 2026-10-31.

## Files

- `pyproject.toml`, `uv.lock`: this prototype's own environment (Chronos-2, TimesFM-2.5, statsmodels), so `pipeline/uv.lock` is untouched. It pins Timestral, torch and pandas as the pipeline does, and imports `aseri` from `pipeline/`.
- `fetch.py`: the four PortWatch lanes from aseri's archive (its 2026-10-31 vintage), the "World War III" views, Brent, the alert hours and the drones through the production adapters, into `data/series/`. GPR comes from `../gpr-realtime-backtest/`.
- `forecasts.py [MODEL ...]`: the origins of every series, and each model's 21 quantiles on them, cached in `data/forecasts/`. GPR reuses the real-time contexts, truths and production forecasts of #145.
- `evaluate.py`: scores everything with `aseri.scoring`, applies the ADR's rules, prints the tables and writes the JSON.
- `data/` (series, forecasts, the weights live in the Hugging Face cache) is git-ignored.

## Rerun (Git Bash on Windows, from this folder)

```bash
uv sync
# GPR's vintages and #145's forecast cache, once (about 8 minutes, then 35 if its cache is missing):
(cd ../../pipeline && uv sync && uv run python -I ../prototypes/gpr-realtime-backtest/fetch.py && uv run python -I -X utf8 ../prototypes/gpr-realtime-backtest/backtest.py > /dev/null)
uv run python -I fetch.py
uv run python -I -X utf8 forecasts.py            # 2.9 h of model time; 78 min wall split in three processes (below)
uv run python -I -X utf8 evaluate.py > data/report_stdout.md   # about 80 s once every forecast is cached
```

`forecasts.py MODEL ...` runs only those models, so the work splits across processes. The run of 2026-10-31 used three: `timestral timestral_ctx512 timestral_ctx1024 timestral_ctx2048 timestral_log1p`, then `timestral_smooth chronos2 timesfm25`, then `ets` (with `OMP_NUM_THREADS=2`). The context variants read the `timestral` cache, making it if missing, and reuse its forecast wherever the history is no longer than the context. The weights download once, at the revisions pinned in `forecasts.py`, with aseri's User-Agent appended to the Hugging Face client's. A cached forecast is checked against its origins; delete it after changing them.
