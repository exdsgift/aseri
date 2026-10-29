"""Covariate ablation: same 52 weekly origins and horizon 90 as the baseline spike, one run per covariate set.

Usage: backtest.py MODEL [TARGET ...]   (MODEL = Timestral-209M or Timestral-28M; default: every target)
Writes data/fc_<MODEL>_<target>.npz for report.py.
"""

import sys
import time
from pathlib import Path

import numpy as np
import torch
from covariates import SETS, known_rows, load, mask_days, past_row
from timestral import TimestralForecaster

MODEL, ONLY = sys.argv[1], sys.argv[2:]
REVISION = {
    "Timestral-28M": "49b26409ac87b5935539a5d8ffe7f397b720db47",
    "Timestral-209M": "9874d252ab0aae16f7f7c999f98f98d6ad7d8365",
}[MODEL]
H, N_ORIGINS, STEP = 90, 52, 7
HERE = Path(__file__).parent
torch.set_num_threads(4)  # same vCPU count as a public-repo ubuntu-latest runner

fc = TimestralForecaster.from_pretrained(
    f"mistralai/{MODEL}",
    revision=REVISION,
    cache_dir=HERE.parent / "timestral-backtest" / "data" / "hf",
    local_files_only=True,
)
assert fc.supports_covariates and fc.supports_known_covariates
targets, covs = load()

for name in ONLY or SETS:
    s = targets[name]
    y, dates, n = s.to_numpy(), s.index, len(s)
    origins = [
        n - STEP * k for k in range(N_ORIGINS, 0, -1)
    ]  # context y[:o], targets y[o:o+H]
    act = np.full((N_ORIGINS, H), np.nan)
    for j, o in enumerate(origins):
        act[j, : min(H, n - o)] = y[o : o + H]
    res = {
        "act": act,
        "scale": np.array([np.mean(np.abs(y[7:o] - y[: o - 7])) for o in origins]),
        "origin_dates": dates[origins].strftime("%Y-%m-%d").to_numpy(),
        "sets": list(SETS[name]),
        "levels": np.array(fc.quantile_levels),
    }
    for set_name, (past, known) in SETS[name].items():
        q = np.full((N_ORIGINS, H, len(fc.quantile_levels)), np.nan, np.float32)
        secs = []
        for j, o in enumerate(origins):
            kw = {}
            if past:
                rows = [past_row(covs[c], dates, o, mask_days(c, name)) for c in past]
                kw["past_covariates"] = np.stack(rows)[None]
            num, cat = known_rows(known, dates, o, H)
            if num is not None:
                kw["known_covariates"] = num[None]
            if cat is not None:
                kw["categorical_known_covariates"] = cat[None]
            t = time.perf_counter()
            q[j] = fc.forecast(y[:o], prediction_length=H, **kw).quantiles[0, 0].numpy()
            secs.append(time.perf_counter() - t)
        res[f"q_{set_name}"], res[f"secs_{set_name}"] = q, np.array(secs)
        print(
            f"{MODEL} {name} [{set_name}]: {np.median(secs):.2f} s/forecast, total {sum(secs):.0f} s",
            flush=True,
        )
    slug = name.split(" (")[0].replace(" ", "_")
    np.savez(HERE / "data" / f"fc_{MODEL}_{slug}.npz", **res)
