"""Score the published 120-day replay against what happened: band coverage and median error vs naive baselines."""

import json
import sys

import numpy as np
import pandas as pd

fixtures, archive = sys.argv[1], sys.argv[2]
deltas = pd.concat(
    pd.read_csv(f, parse_dates=["target_end_date"])
    for f in __import__("glob").glob(f"{archive}/target-data/deltas/*.csv")
)
for sid in [
    "gpr_daily",
    "suez_transits",
    "taiwan_strait_transits",
    "hormuz_transits",
    "bab_el_mandeb_transits",
]:
    y = (
        deltas[deltas.target == sid]
        .set_index("target_end_date")["observation"]
        .sort_index()
    )
    replay = json.load(open(f"{fixtures}/series/{sid}/replay.json"))
    rows = []
    for f in replay["forecasts"]:
        o = pd.Timestamp(f["reference_date"])
        q = {k: np.array(v) for k, v in f["quantiles"].items()}
        for h in range(1, len(q["0.5"]) + 1):
            t = o + pd.Timedelta(days=h)
            if t not in y.index:
                continue
            obs = y[t]
            snaive = (
                y[o - pd.Timedelta(days=(7 - h % 7) % 7)]
                if h % 7
                else y[o - pd.Timedelta(days=0)]
            )
            # seasonal naive: the same weekday in the last week before the origin
            snaive = y[t - pd.Timedelta(days=7 * int(np.ceil(h / 7)))]
            rows.append(
                dict(
                    h=h,
                    bucket="1-7" if h <= 7 else "8-28",
                    hit50=q["0.25"][h - 1] <= obs <= q["0.75"][h - 1],
                    hit80=q["0.1"][h - 1] <= obs <= q["0.9"][h - 1],
                    ae=abs(q["0.5"][h - 1] - obs),
                    ae_naive=abs(y[o] - obs),
                    ae_snaive=abs(snaive - obs),
                    ae_mean28=abs(y[o - pd.Timedelta(days=27) : o].mean() - obs),
                )
            )
    r = pd.DataFrame(rows)
    g = r.groupby("bucket").agg(
        n=("h", "size"),
        cov50=("hit50", "mean"),
        cov80=("hit80", "mean"),
        mae=("ae", "mean"),
        naive=("ae_naive", "mean"),
        snaive=("ae_snaive", "mean"),
        mean28=("ae_mean28", "mean"),
    )
    for b in ["naive", "snaive", "mean28"]:
        g[f"vs_{b}"] = g["mae"] / g[b]
    print(f"== {sid} ({len(replay['forecasts'])} forecasts)")
    print(g.round(2).to_string())
