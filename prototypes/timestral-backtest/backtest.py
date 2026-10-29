"""Rolling-origin backtest of one Timestral model on the 4 series. Usage: backtest.py Timestral-209M

Writes data/fc_<model>.npz (forecasts, actuals, baselines, timings) for report.py.
"""

import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import psutil
import torch
from timestral import TimestralForecaster

MODEL = sys.argv[1]
REVISION = {
    "Timestral-28M": "49b26409ac87b5935539a5d8ffe7f397b720db47",
    "Timestral-209M": "9874d252ab0aae16f7f7c999f98f98d6ad7d8365",
}[MODEL]
THREADS = 4  # same vCPU count as a public-repo ubuntu-latest runner
H, N_ORIGINS, STEP, LIVE_H = 90, 52, 7, 30
DATA = Path(__file__).parent / "data"
PORTS = ["Suez Canal", "Taiwan Strait", "Strait of Hormuz"]

torch.set_num_threads(THREADS)
proc = psutil.Process()


def load_series():
    g = pd.read_stata(DATA / "gpr_daily_recent.dta")
    out = {"GPR daily (GPRD)": g.set_index("date")["GPRD"].astype(float).asfreq("D")}
    for port in PORTS:
        d = pd.DataFrame(
            json.loads((DATA / f"portwatch_{port.replace(' ', '_')}.json").read_text())
        )
        d.index = pd.to_datetime(d["date"], unit="ms")
        out[port] = d["n_total"].astype(float).asfreq("D")
    for name, s in out.items():
        assert s.notna().all(), f"{name} has gaps, baselines would need filling"
    return out


series = load_series()
rss_before_model = proc.memory_info().rss
t0 = time.perf_counter()
fc = TimestralForecaster.from_pretrained(
    f"mistralai/{MODEL}",
    revision=REVISION,
    cache_dir=DATA / "hf",
    local_files_only=True,
)
load_s = time.perf_counter() - t0

res = {
    "names": list(series),
    "load_s": load_s,
    "rss_before_model": rss_before_model,
    "levels": np.array(fc.quantile_levels),
}
for i, (name, s) in enumerate(series.items()):
    y, n = s.to_numpy(), len(s)
    # origin o: context y[:o], targets y[o:o+H]; last origin leaves 7 days of actuals
    origins = [n - STEP * k for k in range(N_ORIGINS, 0, -1)]
    q = np.full((N_ORIGINS, H, len(fc.quantile_levels)), np.nan, np.float32)
    act, naive, snaive = (np.full((N_ORIGINS, H), np.nan) for _ in range(3))
    scale, secs = np.zeros(N_ORIGINS), []
    for j, o in enumerate(origins):
        ctx = y[:o]
        t = time.perf_counter()
        q[j] = fc.forecast(ctx, prediction_length=H).quantiles[0, 0].numpy()
        secs.append(time.perf_counter() - t)
        avail = min(H, n - o)
        act[j, :avail] = y[o : o + avail]
        naive[j] = ctx[-1]
        snaive[j] = ctx[-7:][np.arange(H) % 7]
        scale[j] = np.mean(np.abs(ctx[7:] - ctx[:-7]))
    t = time.perf_counter()
    live = fc.forecast(y, prediction_length=LIVE_H).quantiles[0, 0].numpy()
    live_s = time.perf_counter() - t
    res |= {
        f"{i}_q": q,
        f"{i}_act": act,
        f"{i}_naive": naive,
        f"{i}_snaive": snaive,
        f"{i}_scale": scale,
        f"{i}_secs": np.array(secs),
        f"{i}_live": live,
        f"{i}_live_s": live_s,
        f"{i}_origin_dates": s.index[origins].strftime("%Y-%m-%d").to_numpy(),
        f"{i}_hist_dates": s.index.strftime("%Y-%m-%d").to_numpy(),
        f"{i}_hist": y,
        f"{i}_ctx_len": len(y),
    }
    print(
        f"{name}: n={n}, per-forecast median {np.median(secs):.3f}s (first {secs[0]:.3f}s), "
        f"live {live_s:.3f}s"
    )

res["peak_wset"] = (
    proc.memory_info().peak_wset
)  # Windows peak working set of this process
res["total_s"] = time.perf_counter() - t0
np.savez(DATA / f"fc_{MODEL}.npz", **res)
print(
    f"load {load_s:.1f}s, peak RAM {res['peak_wset'] / 2**30:.2f} GiB, "
    f"RSS before model {rss_before_model / 2**30:.2f} GiB, total {res['total_s']:.0f}s"
)
