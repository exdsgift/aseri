"""PROTOTYPE, throwaway: runs Timestral-209M on the nine aseri series for every day of the replay window.

Usage (from the repo root, with the spike's venv):
  prototypes/timestral-backtest/.venv/Scripts/python.exe -I -W ignore prototypes/forecast-chart/build/forecasts.py \
      <dir with gpr.dta, brent.csv, alerts.csv, losses.json> prototypes/timestral-backtest/data prototypes/forecast-chart/build/out/forecasts.json

Each replay forecast is a backtest: made today, with only the data up to that day as context.
"""

import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from timestral import TimestralForecaster

raw, spike, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
REVISION = (
    "9874d252ab0aae16f7f7c999f98f98d6ad7d8365"  # same weights as the backtest spike
)
HORIZON = {
    "gpr": 30,
    "ww3": 14,
    "brent": 14,
    "suez": 30,
    "hormuz": 14,
    "bab": 14,
    "taiwan": 30,
    "air": 7,
    "drones": 7,
}
WINDOW, KEEP = 121, 365  # replay origins, days of history shipped to the page
LEVELS = [0.1, 0.25, 0.5, 0.75, 0.9]
UA = {"User-Agent": "aseri-prototype/0.1 (https://github.com/exdsgift/aseri)"}
PW = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query"


def get_json(url):
    for attempt in range(9):
        j = json.load(
            urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60)
        )
        if "error" not in j:  # PortWatch reports errors inside HTTP 200
            return j
        print(f"  retry {attempt + 1}: {j['error'].get('message')}", flush=True)
        time.sleep(min(5 * 2**attempt, 90))
    sys.exit(f"gave up: {url}")


def port_series(rows):
    d = pd.DataFrame(rows)
    idx = (
        pd.to_datetime(d["date"], unit="ms")
        if pd.api.types.is_numeric_dtype(d["date"])
        else pd.to_datetime(d["date"])
    )
    return pd.Series(d["n_total"].astype(float).to_numpy(), index=idx)


def portwatch(name):
    rows, offset = [], 0
    while True:
        q = urllib.parse.urlencode(
            {
                "where": f"portname='{name}'",
                "outFields": "date,portname,n_total",
                "orderByFields": "date",
                "resultOffset": offset,
                "resultRecordCount": 1000,
                "returnGeometry": "false",
                "f": "json",
            }
        )
        page = get_json(f"{PW}?{q}")
        rows += [f["attributes"] for f in page["features"]]
        if not page.get("exceededTransferLimit"):
            return port_series(rows)
        offset += len(page["features"])


def alert_hours(path):
    a = pd.read_csv(path, parse_dates=["started_at", "finished_at"]).dropna(
        subset=["started_at", "finished_at"]
    )
    hours = {}
    for s, e in zip(a.started_at, a.finished_at):
        while s < e:  # split each alert at UTC midnight
            cut = min(e, s.normalize() + pd.Timedelta(days=1))
            hours[s.normalize()] = (
                hours.get(s.normalize(), 0.0) + (cut - s).total_seconds() / 3600
            )
            s = cut
    h = pd.Series(hours)
    h.index = h.index.tz_localize(None)
    return (
        h.sort_index().asfreq("D", fill_value=0.0).iloc[:-1]
    )  # drop today, still partial


def load():
    g = pd.read_stata(spike / "gpr_daily_recent.dta")
    s = {"gpr": g.set_index(pd.to_datetime(g["date"]))["GPRD"].astype(float)}
    for k, f in [
        ("suez", "Suez_Canal"),
        ("hormuz", "Strait_of_Hormuz"),
        ("taiwan", "Taiwan_Strait"),
    ]:
        s[k] = port_series(json.loads((spike / f"portwatch_{f}.json").read_text()))
    s["bab"] = portwatch("Bab el-Mandeb Strait")
    b = pd.read_csv(raw / "brent.csv", na_values=".")
    s["brent"] = (
        b.set_index(pd.to_datetime(b.iloc[:, 0]))
        .iloc[:, 1]
        .dropna()
        .asfreq("D")
        .ffill()
    )  # weekends carry Friday
    s["air"] = alert_hours(raw / "alerts.csv")
    loss = pd.DataFrame(json.loads((raw / "losses.json").read_text()))
    s["drones"] = (
        loss.set_index(pd.to_datetime(loss["date"]))["drone"]
        .astype(float)
        .sort_index()
        .diff()
        .clip(lower=0)
        .dropna()
    )
    end = pd.Timestamp.today().normalize() - pd.Timedelta(days=1)
    items = get_json(
        "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/"
        f"World_War_III/daily/20150701/{end:%Y%m%d}"
    )["items"]
    s["ww3"] = pd.Series(
        {pd.Timestamp(i["timestamp"][:8]): float(i["views"]) for i in items}
    )
    for k in s:
        s[k] = s[k].sort_index().asfreq("D")
        gaps = int(s[k].isna().sum())
        if gaps:
            print(f"  {k}: filling {gaps} missing days forward")
            s[k] = s[k].ffill()
    return s


def sig(v):
    return float(f"{v:.4g}")


torch.set_num_threads(4)
series = load()
model = TimestralForecaster.from_pretrained(
    "mistralai/Timestral-209M",
    revision=REVISION,
    cache_dir=spike / "hf",
    local_files_only=True,
)
levels = np.array(model.quantile_levels, dtype=float)
cols = [int(np.argmin(np.abs(levels - lv))) for lv in LEVELS]
assert np.allclose(levels[cols], LEVELS), levels

result = {
    "model": "Timestral-209M",
    "revision": REVISION,
    "generated": date.today().isoformat(),
    "levels": LEVELS,
    "series": {},
}
for k, s in series.items():
    y, n, h = s.to_numpy(), len(s), HORIZON[k]
    t0, fcs = time.perf_counter(), []
    for org in range(
        n - WINDOW, n
    ):  # forecast made at the end of day `org`, with y[: org + 1] as context
        q = (
            model.forecast(y[: org + 1], prediction_length=h)
            .quantiles[0, 0]
            .numpy()[:, cols]
        )
        fcs.append([[sig(v) for v in row] for row in q])
    keep = s.iloc[-KEEP:]
    result["series"][k] = {
        "start": keep.index[0].strftime("%Y-%m-%d"),
        "values": [sig(v) for v in keep.to_numpy()],
        "originStart": KEEP - WINDOW,  # index in `values` of the first replay origin
        "fc": fcs,
    }
    print(
        f"{k:7} n={n} ctx up to {n} days, h={h}, {WINDOW} forecasts in {time.perf_counter() - t0:.0f}s, last {keep.index[-1]:%Y-%m-%d}",
        flush=True,
    )

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(result, separators=(",", ":")))
print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB)")
