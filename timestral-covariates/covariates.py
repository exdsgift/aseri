"""Targets, covariate series, covariate sets and the leak-free alignment used by backtest.py.

Run directly (`python -I covariates.py`) for the self-check on hand-made cases.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).parent
DATA, BASE = HERE / "data", HERE.parent / "timestral-backtest" / "data"

# Worst-case publication lag in days on the day the job runs (as of 2026-10-29): PortWatch ~4 days;
# GPR updates on Mondays (up to 7 days stale); FRED Brent arrives in weekly batches (up to 8 days);
# Wikipedia and the alerts file are complete up to yesterday; the losses file carries today's report.
PUB_LAG = {"portwatch": 4, "gpr": 7, "brent": 8, "wiki": 1, "alerts": 1, "drones": 0}
# Freshest the target can be on a job day. A covariate is masked for max(0, its lag - this) days at the
# end of each context, so the backtest never sees a covariate value the live job would not have yet.
TARGET_MIN_LAG = {"portwatch": 4, "gpr": 0, "alerts": 1}

# Lunar New Year day; the indicator covers the eve plus 7 days (the 8-day statutory holiday). Not tuned.
LNY = ["2019-02-05", "2020-01-25", "2021-02-12", "2022-02-01", "2023-01-22", "2024-02-10", "2025-01-29",
       "2026-02-17", "2027-02-06"]  # fmt: skip


def portwatch(path):
    d = pd.DataFrame(json.loads(Path(path).read_text()))
    return pd.Series(
        d["n_total"].astype(float).to_numpy(), pd.to_datetime(d["date"], unit="ms")
    ).asfreq("D")


def alert_hours(starts, ends):
    """Alert-hours per UTC day, summed over regions, each event split at UTC midnight.

    Integrates the count of active alerts between sorted breakpoints (starts, ends, midnights), so
    every segment lies within one day.
    """
    s, e = (pd.DatetimeIndex(pd.to_datetime(x, utc=True)).tz_convert(None) for x in (starts, ends))  # naive UTC
    days = pd.date_range(s.min().floor("D"), e.max().ceil("D"), freq="D")
    t = (
        np.concatenate([s.to_numpy(), e.to_numpy(), days.to_numpy()])
        .astype("datetime64[s]")
        .astype(np.int64)
    )
    d = np.concatenate([np.ones(len(s)), -np.ones(len(e)), np.zeros(len(days))])
    o = np.argsort(t, kind="stable")
    t, active = t[o], np.cumsum(d[o])
    seg_h = np.diff(t) / 3600 * active[:-1]
    day = pd.to_datetime(t[:-1], unit="s").floor("D")
    return pd.Series(seg_h).groupby(day).sum().asfreq("D", fill_value=0.0)


def load():
    """Returns (targets, covs): dicts of daily pd.Series. Targets have no gaps; covs may have NaN."""
    g = pd.read_stata(BASE / "gpr_daily_recent.dta").set_index("date").asfreq("D")
    pw = {p: portwatch(BASE / f"portwatch_{p.replace(' ', '_')}.json") for p in
          ["Suez Canal", "Taiwan Strait", "Strait of Hormuz"]}  # fmt: skip
    pw["Bab el-Mandeb Strait"] = portwatch(DATA / "portwatch_Bab_el-Mandeb_Strait.json")
    a = pd.read_csv(DATA / "alerts.csv")
    alerts = alert_hours(a["started_at"], a["finished_at"])
    alerts = alerts[
        : pd.Timestamp("2026-10-28")
    ]  # 2026-10-29 is a partial day in this file
    los = pd.DataFrame(json.loads((DATA / "losses.json").read_text()))
    drones = (
        los.set_index(pd.to_datetime(los["date"]))["drone"]
        .astype(float)
        .asfreq("D")
        .diff()
        .clip(lower=0)
    )
    wiki = json.loads((DATA / "wiki_World_War_III.json").read_text())["items"]
    ww3 = pd.Series(
        [float(r["views"]) for r in wiki],
        pd.to_datetime([r["timestamp"][:8] for r in wiki]),
    ).asfreq("D")
    b = pd.read_csv(DATA / "brent.csv", na_values=".")
    brent = (
        b.set_index(pd.to_datetime(b["observation_date"]))["DCOILBRENTEU"]
        .astype(float)
        .asfreq("D")
    )

    targets = {
        "GPR daily (GPRD)": g["GPRD"].astype(float),
        **pw,
        "Ukraine air-raid alert-hours": alerts,
    }
    for name, s in targets.items():
        assert s.notna().all(), f"{name} has gaps"
    covs = {"GPRD_THREAT": g["GPRD_THREAT"].astype(float), "GPRD_ACT": g["GPRD_ACT"].astype(float),
            "Brent": brent, "WW3 views": ww3, "Drones downed": drones, **pw}  # fmt: skip
    return targets, covs


SOURCE = {"GPR daily (GPRD)": "gpr", "GPRD_THREAT": "gpr", "GPRD_ACT": "gpr", "Brent": "brent", "WW3 views": "wiki",
          "Drones downed": "drones", "Ukraine air-raid alert-hours": "alerts", "Suez Canal": "portwatch",
          "Taiwan Strait": "portwatch", "Strait of Hormuz": "portwatch", "Bab el-Mandeb Strait": "portwatch"}  # fmt: skip

# Per target: set name -> (past covariates, known calendar covariates). "dow" is a categorical
# day-of-week code (target-encoded by timestral), "lny" a 0/1 Lunar New Year holiday indicator.
SETS = {
    "GPR daily (GPRD)": {"none": ([], []), "dow": ([], ["dow"]), "ww3": (["WW3 views"], [])},
    "Suez Canal": {"none": ([], []), "dow": ([], ["dow"]), "bem": (["Bab el-Mandeb Strait"], []),
                   "bem+threat": (["Bab el-Mandeb Strait", "GPRD_THREAT"], [])},
    "Taiwan Strait": {"none": ([], []), "dow": ([], ["dow"]), "dow+lny": ([], ["dow", "lny"])},
    "Strait of Hormuz": {"none": ([], []), "dow": ([], ["dow"]), "brent": (["Brent"], []),
                         "gpr-sub": (["GPRD_THREAT", "GPRD_ACT"], []),
                         "brent+threat+bem": (["Brent", "GPRD_THREAT", "Bab el-Mandeb Strait"], [])},
    "Bab el-Mandeb Strait": {"none": ([], []), "dow": ([], ["dow"]), "suez": (["Suez Canal"], []),
                             "suez+brent+threat": (["Suez Canal", "Brent", "GPRD_THREAT"], [])},
    "Ukraine air-raid alert-hours": {"none": ([], []), "dow": ([], ["dow"]), "drones": (["Drones downed"], [])},
}  # fmt: skip


def mask_days(cov, target):
    return max(0, PUB_LAG[SOURCE[cov]] - TARGET_MIN_LAG[SOURCE[target]])


def past_row(cov, dates, o, mask):
    """Covariate values on dates[:o] (the context), the last `mask` of them blanked (not yet published)."""
    v = cov.reindex(dates[:o]).to_numpy(dtype=float, copy=True)
    if mask:
        v[-mask:] = np.nan
    return v


def known_rows(names, dates, o, h):
    """Calendar rows over the context dates[:o] plus the h days after it (known in advance)."""
    d = pd.date_range(dates[0], periods=o + h, freq="D")
    lny = np.zeros(len(d))
    for day in pd.to_datetime(LNY):
        lny[(d >= day - pd.Timedelta(days=1)) & (d <= day + pd.Timedelta(days=6))] = 1.0
    rows = {"dow": d.day_of_week.to_numpy(float), "lny": lny}
    num = [rows[n] for n in names if n != "dow"]
    cat = [rows["dow"]] if "dow" in names else []
    return (np.stack(num) if num else None), (np.stack(cat) if cat else None)


def _self_check():
    # alert-hours: 23:00 -> 01:30 next day, plus 10:00 -> 11:00 the same first day, in another region
    ah = alert_hours(["2024-01-01 23:00+00:00", "2024-01-01 10:00+00:00"],
                     ["2024-01-02 01:30+00:00", "2024-01-01 11:00+00:00"])  # fmt: skip
    assert np.allclose(ah.loc["2024-01-01":"2024-01-02"].to_numpy(), [2.0, 1.5]), ah
    # overlapping alerts in two regions count twice (summed over regions)
    assert np.isclose(
        alert_hours(["2024-01-01 10:00Z"] * 2, ["2024-01-01 12:00Z"] * 2).sum(), 4.0
    )
    # past row: target dates Jan 1..10; covariate = day of month, defined Dec 30..Jan 8 with Jan 3 missing
    dates = pd.date_range("2020-01-01", periods=10, freq="D")
    cov = pd.Series(
        np.r_[30.0, 31.0, np.arange(1, 9.0)],
        pd.date_range("2019-12-30", periods=10, freq="D"),
    )
    cov = cov.drop(pd.Timestamp("2020-01-03"))
    r = past_row(cov, dates, 6, 2)  # context Jan 1..6; Jan 5-6 not yet published
    assert np.array_equal(r, [1, 2, np.nan, 4, np.nan, np.nan], equal_nan=True), r
    assert len(past_row(cov, dates, 6, 0)) == 6 and past_row(cov, dates, 6, 0)[-1] == 6
    assert np.isnan(
        past_row(cov, dates, 10, 0)[-1]
    )  # Jan 10 is past the covariate's end: NaN, never a later value
    # known rows: 2020-01-01 is a Wednesday (dayofweek 2); LNY 2020-01-25 -> indicator Jan 24..31
    num, cat = known_rows(["dow", "lny"], dates, 6, 30)
    assert (
        cat.shape == (1, 36) and cat[0, 0] == 2 and cat[0, 5] == 0 and cat[0, 35] == 2
    )
    assert (
        num.shape == (1, 36)
        and num[0].sum() == 8
        and num[0, 23] == 1
        and num[0, 22] == 0
        and num[0, 31] == 0
    )
    assert known_rows([], dates, 6, 30) == (None, None)
    assert (
        mask_days("Brent", "Strait of Hormuz") == 4
        and mask_days("Bab el-Mandeb Strait", "Suez Canal") == 0
    )
    assert (
        mask_days("Drones downed", "Ukraine air-raid alert-hours") == 0
        and mask_days("WW3 views", "GPR daily (GPRD)") == 1
    )
    print("covariates self-check ok")


if __name__ == "__main__":
    _self_check()
    targets, covs = load()
    for name, s in {**targets, **covs}.items():
        print(f"{name}: {s.index[0].date()} to {s.index[-1].date()}, n={len(s)}, NaN={int(s.isna().sum())}, "
              f"mean={s.mean():.1f}")  # fmt: skip
