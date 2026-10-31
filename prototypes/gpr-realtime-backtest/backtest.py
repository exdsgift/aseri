"""Real-time against latest-vintage GPR backtest, from the authors' archived vintages (issue #145). Usage: see README.md.

Each weekly origin is forecast twice by the production Timestral-209M: from the vintage known on its
day, and from the latest vintage. The real-time forecast is scored against each target's value as
known `score_lag` days after it (`record.settled`), the latest one against the latest vintage, on the
same targets. Prints the write-up's tables and writes docs/research/gpr-realtime-backtest.json.
The forecasts are cached in data/forecasts.npz: delete it to forecast again.
"""

import json
import re
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
from aseri import archive, record, scoring
from aseri.forecast import (
    MODEL_ID,
    PACKAGE_COMMIT,
    WEIGHTS_REVISION,
    Forecast,
    forecast,
    load_model,
    make_context,
)
from aseri.series import GPR_DAILY
from aseri.sources import gpr

DATA = Path(__file__).parent / "data"
OUT = ROOT / "docs" / "research" / "gpr-realtime-backtest.json"
NAME = re.compile(r"data_gpr_daily_recent_(\d{8})\.dta")
# The newest vintage used, pinned so that a rerun scores the same data; move it on to extend the backtest.
LATEST = pd.Timestamp("2026-10-26")
H, LAG = GPR_DAILY.horizon, GPR_DAILY.score_lag
# The bootstrap's mean block, in weekly origins: 4 weeks is each bucket's longest horizon or more.
BLOCK = 4
# The authors' fix of missing articles, rewriting every day since 2021 (2024-02-05 and 2024-02-07 files).
REWRITE = pd.Timestamp("2024-02-05")


def load() -> tuple[dict, dict]:
    """The vintages aseri would have archived, keyed by as_of, and the files it would not have, with why.

    A file's as_of is the day after its date, the first 07:00 UTC run to see it. A file the adapter's
    contract rejects, or one that drops archived days (`archive.check_revisions` holds it for a human,
    who would not accept it), leaves the previous vintage in force, as in production.
    """
    vintages, rejected = {}, {}
    for path in sorted(DATA.glob("data_gpr_daily_recent_*.dta")):
        day = pd.Timestamp(NAME.fullmatch(path.name)[1])
        if day > LATEST:
            continue
        try:
            observed = gpr.parse(path.read_bytes())
        except (KeyError, ValueError) as error:
            rejected[f"{day:%Y-%m-%d}"] = f"adapter: {error}"
            continue
        if vintages and len(
            dropped := vintages[max(vintages)].index.difference(observed.index)
        ):
            rejected[f"{day:%Y-%m-%d}"] = (
                f"archive hold: drops {len(dropped)} days from {dropped.min():%Y-%m-%d}"
            )
            continue
        vintages[day + pd.Timedelta(days=1)] = observed
    return vintages, rejected


def deltas(vintages: dict) -> pd.DataFrame:
    """Every value as first seen, shaped like the archive's deltas: a row per vintage and new or changed day."""
    frames, previous = [], pd.Series(dtype=float)
    for as_of, observed in vintages.items():
        new = archive.observation_delta(observed, previous)
        frames.append(
            pd.DataFrame(
                {
                    "target_end_date": new.index,
                    "observation": new.to_numpy(),
                    "as_of": as_of,
                }
            )
        )
        previous = observed
    return pd.concat(frames, ignore_index=True)


def oddities(vintages: dict) -> dict:
    """What the used vintages hold that a reader should know, by file date: their last day, empty updates, and rewrites `archive.check_revisions` would hold for review."""
    notes = {
        k: {} for k in ("last_day_not_file_date", "no_change", "past_revision_window")
    }
    previous = None
    for as_of, new in vintages.items():
        file = f"{as_of - pd.Timedelta(days=1):%Y-%m-%d}"
        if new.index[-1] != as_of - pd.Timedelta(days=1):
            notes["last_day_not_file_date"][file] = f"{new.index[-1]:%Y-%m-%d}"
        if previous is not None:
            changed = archive.observation_delta(new, previous).index
            deep = changed[
                changed < new.index[-1] - pd.Timedelta(days=GPR_DAILY.revision_window)
            ]
            if changed.empty:
                notes["no_change"][file] = f"{new.index[-1]:%Y-%m-%d}"
            if len(deep):
                notes["past_revision_window"][file] = {
                    "days": len(deep),
                    "oldest": f"{deep.min():%Y-%m-%d}",
                    "largest_change": num((new[deep] - previous[deep]).abs().max()),
                }
        previous = new
    return notes


def forecasts(contexts: dict[str, list[pd.Series]], refs) -> tuple[dict, float]:
    """The 21 quantiles of every origin, per version, cached; and the seconds the forecasts took."""
    cache = DATA / "forecasts.npz"
    if cache.exists():
        saved = np.load(cache)
        assert list(saved["refs"]) == [f"{r:%Y-%m-%d}" for r in refs], (
            "origins changed: delete the cache"
        )
        return {name: saved[name] for name in contexts} | {
            "levels": saved["levels"]
        }, float(saved["seconds"])
    model, start, out = load_model(), time.perf_counter(), {}
    for name, series in contexts.items():
        made = [forecast(model, context, H) for context in series]
        out[name] = np.stack([f.quantiles for f in made])
        print(
            f"{name}: {len(made)} forecasts, {time.perf_counter() - start:.0f} s so far",
            flush=True,
        )
    out["levels"] = np.array(made[0].levels)
    seconds = time.perf_counter() - start
    np.savez(cache, refs=[f"{r:%Y-%m-%d}" for r in refs], seconds=seconds, **out)
    return out, seconds


def scored(quantiles, levels, contexts, refs, truth) -> pd.DataFrame:
    """`scoring.score` of every origin against `truth`, one row per (origin, horizon)."""
    frames = []
    for q, context, ref in zip(quantiles, contexts, refs):
        targets = pd.date_range(ref + pd.Timedelta(days=1), periods=H)
        y = np.array([truth[t] for t in targets])
        rows = scoring.score(Forecast(ref, tuple(levels), q), context, y)
        # The side the 80% band misses on, for #146's per-side calibration.
        below, above = (
            y < q[:, np.isclose(levels, 0.1)][:, 0],
            y > q[:, np.isclose(levels, 0.9)][:, 0],
        )
        frames.append(rows.assign(reference_date=ref, below_80=below, above_80=above))
    return pd.concat(frames, ignore_index=True)


def num(value) -> float | None:
    return round(float(value), 4) if np.isfinite(value) else None


def interval(result) -> dict:
    value, low, high = result
    return {"value": num(value), "ci": [num(low), num(high)]}


def bucket(rows: pd.DataFrame) -> dict:
    """The scores of one bucket, as `record._bucket` publishes them, with the weekly origins' block."""
    origins = rows.groupby("reference_date").mean(numeric_only=True)

    def against(model, baseline):
        ratio, low, high = scoring.bootstrap(
            origins[model], origins[baseline], block=BLOCK
        )
        return {
            "ratio": num(ratio),
            "ci": [num(low), num(high)],
            "verdict": scoring.verdict(low, high),
        }

    def coverage(band):
        hits, targets = int(rows[f"interval_coverage_{band}"].sum()), len(rows)
        low, high = scoring.clopper_pearson(hits, targets)
        return {
            "hits": hits,
            "targets": targets,
            "rate": num(hits / targets),
            "ci": [num(low), num(high)],
        }

    return {
        "origins": len(origins),
        "coverage_50": coverage(50),
        "coverage_80": coverage(80),
        "below_80": num(rows["below_80"].mean()),
        "above_80": num(rows["above_80"].mean()),
        "wis": {
            p: num(rows[p].mean())
            for p in ("wis", "dispersion", "overprediction", "underprediction")
        }
        | {"vs_probabilistic_naive": against("wis", "wis_naive")},
        "ae_median": {
            "mean": num(rows["ae_median"].mean()),
            "vs": {
                name: against("ae_median", f"ae_{name}") for name in record.BASELINES
            },
        },
    }


def gap(real_time: pd.DataFrame, latest: pd.DataFrame) -> dict:
    """Real-time minus latest-vintage, paired on the origins, with the same block bootstrap."""
    columns = ["wis", "ae_median", "interval_coverage_50", "interval_coverage_80"]
    a, b = (
        r.groupby("reference_date")[columns].mean().astype(float)
        for r in (real_time, latest)
    )
    return {
        c: interval(scoring.bootstrap(a[c] - b[c], block=BLOCK)) for c in columns
    } | {
        "wis_ratio": interval(scoring.bootstrap(a["wis"], b["wis"], block=BLOCK)),
        "ae_median_ratio": interval(
            scoring.bootstrap(a["ae_median"], b["ae_median"], block=BLOCK)
        ),
    }


def revisions(contexts, latest, settled, refs) -> dict:
    """How far values move, in % of the later value: each real-time context's last 28 days by age at its origin, and each settled target."""

    def stats(new, old):
        pct = 100 * (np.asarray(new) - old) / old
        pct = pct[np.isfinite(pct)]  # a 0 has no %
        return {
            "median_abs": num(np.median(np.abs(pct))),
            "median": num(np.median(pct)),
            "mean": num(pct.mean()),
            "share_over_1pct": num((np.abs(pct) > 1).mean()),
        }

    tails = [context.iloc[-28:] for context in contexts]
    days = np.concatenate([tail.index for tail in tails])
    values = np.concatenate([tail.to_numpy() for tail in tails])
    young = np.concatenate(
        [(ref - tail.index).days < 7 for tail, ref in zip(tails, refs)]
    )
    out = {}
    for name, truth in (("settled", settled), ("latest", latest)):
        final = np.array([truth[t] for t in days])
        for ages, m in (("0-6", young), ("7-27", ~young)):
            out[f"real_time_vs_{name}_age_{ages}"] = stats(values[m], final[m])
    targets = pd.DatetimeIndex(list(settled))
    for period, m in periods(targets).items():
        out[f"settled_vs_latest_{period}"] = stats(
            [settled[t] for t in targets[m]], latest[targets[m]].to_numpy()
        )
    return out


def periods(days: pd.DatetimeIndex) -> dict:
    """Before and from the authors' February 2024 rewrite of everything since 2021, to tell it from routine revisions."""
    before = days < REWRITE
    return {
        "all": np.full(len(days), True),
        "before_2024_02_05": before,
        "from_2024_02_05": ~before,
    }


def main():
    started = time.perf_counter()
    vintages, rejected = load()
    rows = deltas(vintages)
    # The as-of view must give back each vintage exactly, and nothing seen after its day.
    for as_of, observed in vintages.items():
        assert archive.view(rows, as_of).equals(observed), (
            f"the as-of view of {as_of:%Y-%m-%d} differs from its file"
        )
    latest = vintages[LATEST + pd.Timedelta(days=1)]
    today = LATEST + pd.Timedelta(days=1)

    # One origin a week: the week's first vintage, its last day the reference date, every target settled by today.
    by_day = pd.Series(list(vintages), index=[v.index[-1] for v in vintages.values()])
    as_ofs = [
        a
        for a in by_day.groupby(by_day.index.to_period("W")).min()
        if scoring.scoreable_on(vintages[a].index[-1] + pd.Timedelta(days=H), LAG)
        <= today
    ]
    refs = [vintages[a].index[-1] for a in as_ofs]
    real_time_contexts = [
        make_context(GPR_DAILY, archive.view(rows, a), r) for a, r in zip(as_ofs, refs)
    ]
    latest_contexts = [make_context(GPR_DAILY, latest, r) for r in refs]
    for rt, lv in zip(real_time_contexts, latest_contexts):
        assert rt.index.equals(lv.index), (
            "the two contexts of an origin must cover the same days"
        )

    quantiles, seconds = forecasts(
        {"real_time": real_time_contexts, "latest": latest_contexts}, refs
    )
    # Every target, and the 28 context days before the first origin that `revisions` compares.
    targets = pd.date_range(
        refs[0] - pd.Timedelta(days=27), refs[-1] + pd.Timedelta(days=H)
    )
    found = {t: record.settled(rows, t, LAG) for t in targets}
    settled = {t: v[0] for t, v in found.items()}
    assert all(scoring.scoreable_on(t, LAG) >= v[1] for t, v in found.items()), (
        "a value seen after its scoring day"
    )
    levels = quantiles["levels"]
    versions = {
        "real_time": scored(
            quantiles["real_time"], levels, real_time_contexts, refs, settled
        ),
        "latest_vintage": scored(
            quantiles["latest"], levels, latest_contexts, refs, latest
        ),
        # The two halves of the gap: the inputs alone, and the truth alone.
        "real_time_inputs_latest_truth": scored(
            quantiles["real_time"], levels, real_time_contexts, refs, latest
        ),
        "latest_inputs_settled_truth": scored(
            quantiles["latest"], levels, latest_contexts, refs, settled
        ),
    }
    result = {
        "issue": 145,
        "series_id": GPR_DAILY.id,
        "model": {
            "model_id": MODEL_ID,
            "weights_revision": WEIGHTS_REVISION,
            "package_commit": PACKAGE_COMMIT,
        },
        "vintages": {
            "files": len(vintages) + len(rejected),
            "used": len(vintages),
            "first": f"{min(vintages) - pd.Timedelta(days=1):%Y-%m-%d}",
            "latest": f"{LATEST:%Y-%m-%d}",
            "rejected": rejected,
            **oddities(vintages),
        },
        "origins": {
            "n": len(refs),
            "first": f"{refs[0]:%Y-%m-%d}",
            "last": f"{refs[-1]:%Y-%m-%d}",
        },
        "method": {
            "as_of": "a vintage's as_of is the day after its file's date, the first 07:00 UTC run that could see it",
            "origins": "the first vintage of each week (Monday to Sunday), forecast from its last day, horizons 1 to 28; only origins whose every target is settled by the latest vintage",
            "real_time": f"context: the vintage of the origin's day, through archive.view; truth: each target's value as known {LAG} days after it, record.settled",
            "latest_vintage": f"context and truth: the {LATEST:%Y-%m-%d} vintage",
            "baselines": "computed by scoring.score from each version's own context",
            "bootstrap": f"scoring.bootstrap, stationary, mean block {BLOCK} weekly origins, {scoring.REPS} resamples, seed {scoring.SEED}, 95%",
            "coverage_interval": "Clopper-Pearson, exact, 95%, over the scored days, too narrow for overlapping origins",
        },
        "runtime_s": {
            "forecasts": round(seconds),
            "per_forecast": round(seconds / (2 * len(refs)), 2),
        },
        "revisions_pct": revisions(real_time_contexts, latest, settled, refs),
        "scores": {
            name: {b: bucket(r[r["bucket"] == b]) for b in scoring.BUCKETS}
            for name, r in versions.items()
        },
        "gap_real_time_minus_latest": {
            period: {
                b: gap(
                    *(
                        r[
                            (r["bucket"] == b)
                            & periods(pd.DatetimeIndex(r["reference_date"]))[period]
                        ]
                        for r in (versions["real_time"], versions["latest_vintage"])
                    )
                )
                for b in scoring.BUCKETS
            }
            for period in ("all", "before_2024_02_05", "from_2024_02_05")
        },
    }
    OUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    report(result)
    print(
        f"\ntotal {time.perf_counter() - started:.0f} s (forecasts {seconds:.0f} s, cached or not)"
    )


def report(result):
    """The Markdown tables of the write-up."""

    def ci(d, key="ratio"):
        return f"{d[key]:.3f} [{d['ci'][0]:.3f}, {d['ci'][1]:.3f}]"

    def rate(d):
        return f"{d['rate']:.3f} [{d['ci'][0]:.3f}, {d['ci'][1]:.3f}]"

    vintages = dict(result["vintages"])
    deep = pd.Series(vintages.pop("past_revision_window"))
    years = pd.DatetimeIndex(deep.index).year
    big = deep.map(lambda d: d["largest_change"] > 1).to_numpy()
    print(
        json.dumps(
            {"vintages": vintages}
            | {k: result[k] for k in ("origins", "runtime_s", "revisions_pct")},
            indent=1,
        )
    )
    print(
        f"rewrites past the revision window: {len(deep)} vintages, by year {deep.groupby(years).size().to_dict()}; "
        f"by more than 1 point: {int(big.sum())}, by year {deep[big].groupby(years[big]).size().to_dict()}"
    )
    print(
        "\n| Version | Bucket | WIS | dispersion / over / under | cov50 | cov80 | below / above 80 | MAE | WIS / prob. naive | MAE / naive | MAE / snaive7 | MAE / mean28 |"
    )
    print("|---|---|---|---|---|---|---|---|---|---|---|---|")
    for name, buckets in result["scores"].items():
        for b, s in buckets.items():
            w, ae = s["wis"], s["ae_median"]
            print(
                f"| {name} | {b} | {w['wis']:.2f} | {w['dispersion']:.2f} / {w['overprediction']:.2f} / {w['underprediction']:.2f} "
                f"| {rate(s['coverage_50'])} | {rate(s['coverage_80'])} | {s['below_80']:.3f} / {s['above_80']:.3f} "
                f"| {ae['mean']:.2f} | {ci(w['vs_probabilistic_naive'])} | "
                + " | ".join(
                    f"{ci(ae['vs'][n])} {ae['vs'][n]['verdict']}"
                    for n in record.BASELINES
                )
                + " |"
            )
    print("\n| Origins | Bucket | WIS | WIS ratio | MAE | MAE ratio | cov50 | cov80 |")
    print("|---|---|---|---|---|---|---|---|")
    for period, buckets in result["gap_real_time_minus_latest"].items():
        for b, g in buckets.items():
            print(
                f"| {period} | {b} | {ci(g['wis'], 'value')} | {ci(g['wis_ratio'], 'value')} | {ci(g['ae_median'], 'value')} "
                f"| {ci(g['ae_median_ratio'], 'value')} | {ci(g['interval_coverage_50'], 'value')} | {ci(g['interval_coverage_80'], 'value')} |"
            )


if __name__ == "__main__":
    main()
