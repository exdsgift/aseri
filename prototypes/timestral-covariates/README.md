PROTOTYPE, throwaway: tests whether covariates improve Timestral on our series

Results and verdicts: `docs/research/spike-covariates.md`. Baseline it extends: `docs/research/spike-timestral-backtest.md` and `prototypes/timestral-backtest/`. Spike run on 2026-10-29.

## Files

- `fetch.py`: downloads into `data/` the files the baseline spike did not have: IMF PortWatch Bab el-Mandeb Strait, Wikipedia "World_War_III" daily views, FRED Brent, the Ukraine air-raid alerts CSV and the General Staff losses JSON. Files already in `data/` are kept. GPR and the Suez, Taiwan Strait and Hormuz files are read from `../timestral-backtest/data/`, so the targets are the baseline's exact data vintage.
- `covariates.py`: builds the 6 targets and the covariate series, defines the covariate sets per target, and aligns covariates without leakage (publication-lag mask for past covariates, calendar rows for known-future ones). `python covariates.py` runs its self-check on hand-made cases.
- `backtest.py MODEL [TARGET ...]`: 52 weekly origins, horizon 90, one run per covariate set (the no-covariate run included), writes `data/fc_<MODEL>_<target>.npz`.
- `control.py MODEL`: positive control on synthetic series where the covariate carries the signal, to show the model does use covariate rows.
- `report.py`: self-checks the metric and paired-bootstrap code, prints the Markdown ablation tables and verdicts, writes `docs/research/assets/covariates/delta-wql.png`.
- `data/` is git-ignored.

## Rerun (Git Bash on Windows; reuses the baseline spike's venv and weights cache)

```bash
cd prototypes/timestral-covariates
PY=../timestral-backtest/.venv/Scripts/python.exe   # build it first: see ../timestral-backtest/README.md
$PY -I fetch.py
$PY covariates.py                                    # self-check + series summary
$PY -W ignore backtest.py Timestral-209M             # about 1.5 h on a laptop CPU (GPR alone about 40 min)
$PY -W ignore backtest.py Timestral-28M              # about 15 min
$PY -W ignore control.py Timestral-209M
$PY -X utf8 -W ignore report.py > data/report_stdout.md
```

The scripts import `covariates.py` from their own folder, so run them without `-I` (they never run from inside `data/`). `-X utf8` is needed on Windows because the tables contain non-ASCII characters.
