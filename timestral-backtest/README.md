PROTOTYPE, throwaway: answers which forecast horizon Timestral supports on our series

Results and verdicts: `docs/research/spike-timestral-backtest.md`. Spike run on 2026-10-29.

## Files

- `fetch.py`: downloads the GPR daily `.dta` and IMF PortWatch daily transits (Suez Canal, Taiwan Strait, Strait of Hormuz) into `data/`, with retry and backoff.
- `backtest.py MODEL`: rolling-origin backtest (52 weekly origins, horizon 90) for one model, writes `data/fc_<MODEL>.npz`.
- `report.py`: self-checks the metric code on a hand-computed case, prints the Markdown metric and runtime tables, writes the 4 charts to `docs/research/assets/spike/` and `out/snapshot.json`.
- `out/snapshot.json`: last 180 days of each series plus the latest 30-day Timestral-209M forecast (q0.1, q0.25, q0.5, q0.75, q0.9), for the UI prototype.
- `.venv/` and `data/` (raw downloads, HF weights cache, intermediate `.npz`) are git-ignored.

## Rerun (Git Bash on Windows; on Linux use `.venv/bin/python`)

```bash
cd prototypes/timestral-backtest
uv venv --python 3.12 .venv
uv pip install --python .venv/Scripts/python.exe torch --index-url https://download.pytorch.org/whl/cpu
uv pip install --python .venv/Scripts/python.exe "timestral @ git+https://github.com/mistralai/timestral.git@a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff" pandas matplotlib psutil
.venv/Scripts/python.exe -I fetch.py
# download the weights once (backtest.py loads them with local_files_only=True so load time excludes the download)
.venv/Scripts/python.exe -I -c "from timestral import TimestralForecaster as T; T.from_pretrained('mistralai/Timestral-28M', revision='49b26409ac87b5935539a5d8ffe7f397b720db47', cache_dir='data/hf'); T.from_pretrained('mistralai/Timestral-209M', revision='9874d252ab0aae16f7f7c999f98f98d6ad7d8365', cache_dir='data/hf')"
.venv/Scripts/python.exe -I -W ignore backtest.py Timestral-28M    # about 1 min on a laptop CPU
.venv/Scripts/python.exe -I -W ignore backtest.py Timestral-209M   # about 5 min
.venv/Scripts/python.exe -I -W ignore report.py > data/report_stdout.md
```

Optional, vendor-comparable timing (2,016-step random walk, 96 steps ahead, with and without the mirrored pass):

```bash
.venv/Scripts/python.exe -I -W ignore -c "
import time, numpy as np, torch
from timestral import TimestralForecaster
x = np.random.default_rng(0).standard_normal(2016).cumsum()
for m in ['Timestral-28M', 'Timestral-209M']:
    f = TimestralForecaster.from_pretrained('mistralai/' + m, cache_dir='data/hf', local_files_only=True)
    for th in (4, 8):
        torch.set_num_threads(th)
        for sym in (True, False):
            f.forecast(x, prediction_length=96, symmetric_averaging=sym)
            t = time.perf_counter(); [f.forecast(x, prediction_length=96, symmetric_averaging=sym) for _ in range(5)]
            print(m, th, sym, round((time.perf_counter() - t) / 5 * 1000), 'ms')
"
```

Versions used: Python 3.12.13, torch 2.15.0+cpu, timestral 1.0.0 (git a534bdb), numpy 2.5.4, pandas 3.1.0, huggingface-hub 2.4.0. Data as fetched on 2026-10-29: GPR to 2026-10-26, PortWatch to 2026-10-25. A rerun on a later day uses newer data, so the numbers will move.
