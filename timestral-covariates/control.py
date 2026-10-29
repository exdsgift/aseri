"""Positive control: does Timestral use covariates when they carry the signal? Usage: control.py MODEL

Two synthetic cases, 20 origins each, horizon 5, same past_row code as the backtest:
- lead: y_t = x_(t-5) + noise, x an AR(1); the last 5 context values of the past covariate x fix y's next 5.
- known: y_t = 20 + 10 * b_t + noise, b a random 0/1 indicator known in advance (known-future covariate).
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from covariates import past_row
from timestral import TimestralForecaster

MODEL = sys.argv[1]
torch.set_num_threads(4)
fc = TimestralForecaster.from_pretrained(
    f"mistralai/{MODEL}",
    cache_dir=Path(__file__).parent.parent / "timestral-backtest" / "data" / "hf",
    local_files_only=True,
)
rng = np.random.default_rng(1)
N, H = 2000, 5
x = np.zeros(N)
for t in range(1, N):
    x[t] = 0.9 * x[t - 1] + rng.standard_normal()
xs = 50 + 5 * x
y_lead = np.r_[xs[:5], xs[:-5]] + 0.5 * rng.standard_normal(N)  # y_t = xs_(t-5) + noise
assert np.abs(y_lead[5:] - xs[:-5]).max() < 3
xser = pd.Series(xs, pd.date_range("2000-01-01", periods=N, freq="D"))
b = (rng.random(N) < 0.3).astype(float)
y_known = 20 + 10 * b + rng.standard_normal(N)

out = {"lead (past covariate)": [[], []], "known (known-future indicator)": [[], []]}
for o in range(N - 100, N - H + 1, 5):
    for k in range(2):
        kw = (
            {"past_covariates": past_row(xser, xser.index, o, 0)[None, None]}
            if k
            else {}
        )
        q = fc.forecast(y_lead[:o], prediction_length=H, **kw).median[0, 0].numpy()
        out["lead (past covariate)"][k].append(np.abs(q - y_lead[o : o + H]).mean())
        kw = {"known_covariates": b[None, None, : o + H]} if k else {}
        q = fc.forecast(y_known[:o], prediction_length=H, **kw).median[0, 0].numpy()
        out["known (known-future indicator)"][k].append(
            np.abs(q - y_known[o : o + H]).mean()
        )
for case, (a, c) in out.items():
    print(f"{MODEL} {case}: MAE without {np.mean(a):.2f}, with {np.mean(c):.2f} "
          f"(ratio {np.mean(c) / np.mean(a):.2f}, {len(a)} origins)")  # fmt: skip
