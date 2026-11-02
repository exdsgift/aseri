"""Scores #146's backtest and applies the rules of ADR 0001. Usage: see README.md.

Reads the cached forecasts of forecasts.py (run it first), prints the ADR's tables and writes
docs/research/baselines-calibration.json. Every score is `aseri.scoring`'s; every ratio's interval is
`scoring.bootstrap` over per-origin means, with `scoring.verdict`.
"""

import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))  # forecasts.py, under python -I too
import forecasts as fc

from aseri import scoring, tie
from aseri.forecast import BOUNDS, Forecast

OUT = fc.ROOT / "docs" / "research" / "baselines-calibration.json"
# The bootstrap's mean block in weekly origins, as #145: 4 weeks is at least every bucket's longest step.
BLOCK = 4
LEVELS = np.array(fc.LEVELS)
MEDIAN, LOW80, HIGH80 = (
    int(np.flatnonzero(np.isclose(LEVELS, t))[0]) for t in (0.5, 0.1, 0.9)
)
PATHS = 4000
MEMBERS = ("timestral", "chronos2", "timesfm25", "ets")
BASELINES = ("naive", "snaive7", "mean28", "ets")


def cells(case, quantiles, truth=None) -> pd.DataFrame:
    """One row per scored (origin, step): WIS and its parts, coverage, the side of an 80% miss, the median's error."""
    y = case.truth if truth is None else truth
    n, steps = y.shape
    ok = np.isfinite(y)
    q, y = np.asarray(quantiles, dtype=float)[ok], y[ok]
    horizon = np.tile(np.arange(1, steps + 1), (n, 1))[ok]
    return pd.DataFrame(
        {
            "reference_date": np.repeat(pd.DatetimeIndex(case.refs), steps)
            .to_numpy()
            .reshape(n, steps)[ok],
            "horizon": horizon,
            "bucket": [bucket_of(h) for h in horizon],
        }
    ).assign(
        **scoring.wis(q, y, LEVELS),
        interval_coverage_50=scoring.inside(q, y, LEVELS, 0.5),
        interval_coverage_80=scoring.inside(q, y, LEVELS, 0.8),
        below_80=y < q[:, LOW80],
        above_80=y > q[:, HIGH80],
        ae_median=np.abs(y - q[:, MEDIAN]),
    )


def bucket_of(h: int) -> str:
    return next(b for b, hs in scoring.BUCKETS.items() if h in hs)


def buckets(case) -> list[str]:
    return [b for b, hs in scoring.BUCKETS.items() if hs[0] <= case.series.horizon]


def label(case, bucket: str) -> str:
    """The bucket's steps for this series: 8-28 is 8-14 for a 14-step series."""
    first = scoring.BUCKETS[bucket][0]
    return f"{first}-{min(scoring.BUCKETS[bucket][-1], case.series.horizon)}"


def means(rows: pd.DataFrame, column: str, bucket: str | None = None) -> pd.Series:
    """One mean per origin, in date order, for the bootstrap: over a bucket's steps, or all of them."""
    rows = rows if bucket is None else rows[rows["bucket"] == bucket]
    return rows.groupby("reference_date")[column].mean()


def ratio(model: pd.Series, baseline: pd.Series) -> dict:
    assert model.index.equals(baseline.index), "a ratio compares the same origins"
    value, low, high = scoring.bootstrap(model, baseline, block=BLOCK)
    return {
        "ratio": num(value),
        "ci": [num(low), num(high)],
        "verdict": scoring.verdict(low, high),
    }


def num(value) -> float | None:
    return round(float(value), 4) if np.isfinite(value) else None


# 1. Primary baselines.


def baselines(case, quantiles) -> dict:
    """The registry's candidates and AutoETS, by the mean absolute error over every scored cell (ADR rule 1)."""
    model = cells(case, quantiles["timestral"])
    # The baselines of the record, from each origin's own context, as the record computes them.
    record = pd.concat(
        [
            scoring.score(
                Forecast(ref, tuple(LEVELS), q),
                context,
                y,
                kind=case.series.kind,
                week=case.week,
                year=case.year,
            )
            for ref, q, context, y in zip(
                case.refs, quantiles["timestral"], case.contexts, case.truth
            )
        ],
        ignore_index=True,
    )
    assert np.allclose(record["wis"], model["wis"]), (
        "the fast scorer must match scoring.score"
    )
    ets = cells(case, quantiles["ets"])
    errors = model.assign(
        ae_naive=record["ae_naive"].to_numpy(),
        ae_snaive7=record["ae_snaive7"].to_numpy(),
        ae_mean28=record["ae_mean28"].to_numpy(),
        ae_ets=ets["ae_median"].to_numpy(),
        wis_naive=record["wis_naive"].to_numpy(),
        wis_ets=ets["wis"].to_numpy(),
    )
    mae = {b: float(errors[f"ae_{b}"].mean()) for b in BASELINES}
    pick = min(mae, key=mae.get)
    registry = case.series.primary_baseline
    out = {
        "registry": registry,
        "pick": pick,
        "mae": {b: num(v) for b, v in mae.items()}
        | {"timestral": num(errors["ae_median"].mean())},
        "pick_vs": {
            b: ratio(means(errors, f"ae_{pick}"), means(errors, f"ae_{b}"))
            for b in BASELINES
            if b != pick
        },
        "buckets": {},
    }
    # Not a rule: the best of the registry's three, the pick if AutoETS is not computed in the daily job.
    fallback = min(BASELINES[:3], key=mae.get)
    out["fallback"] = {
        "pick": fallback,
        "vs_registry": ratio(
            means(errors, f"ae_{fallback}"), means(errors, f"ae_{registry}")
        ),
        "vs_ets": ratio(means(errors, f"ae_{fallback}"), means(errors, "ae_ets")),
    }
    for b in buckets(case):
        out["buckets"][label(case, b)] = {
            "mae": {
                name: num(errors.loc[errors["bucket"] == b, f"ae_{name}"].mean())
                for name in BASELINES
            }
            | {"timestral": num(errors.loc[errors["bucket"] == b, "ae_median"].mean())},
            "timestral_vs_pick": ratio(
                means(errors, "ae_median", b), means(errors, f"ae_{pick}", b)
            ),
            "timestral_vs_registry": ratio(
                means(errors, "ae_median", b), means(errors, f"ae_{registry}", b)
            ),
            "wis": {
                "timestral": num(errors.loc[errors["bucket"] == b, "wis"].mean()),
                "probabilistic_naive": num(
                    errors.loc[errors["bucket"] == b, "wis_naive"].mean()
                ),
                "ets": num(errors.loc[errors["bucket"] == b, "wis_ets"].mean()),
            },
            "wis_timestral_vs_probabilistic_naive": ratio(
                means(errors, "wis", b), means(errors, "wis_naive", b)
            ),
            "wis_ets_vs_probabilistic_naive": ratio(
                means(errors, "wis_ets", b), means(errors, "wis_naive", b)
            ),
        }
    return out


def naive_stub_scores_one(case) -> None:
    """Checklist item 11: a forecast that is the naive one scores exactly 1 against the naive."""
    rows = []
    for ref, context, y in zip(case.refs[:20], case.contexts, case.truth):
        last = context.ffill().iloc[-1]
        stub = np.full((case.series.horizon, len(LEVELS)), last)
        rows.append(
            scoring.score(
                Forecast(ref, tuple(LEVELS), stub),
                context,
                y,
                kind=case.series.kind,
                week=case.week,
                year=case.year,
            )
        )
    rows = pd.concat(rows)
    assert (rows["ae_median"] == rows["ae_naive"]).all()
    assert scoring.bootstrap(rows["ae_median"], rows["ae_naive"], block=BLOCK) == (
        1.0,
        1.0,
        1.0,
    )


# 2. Calibration offsets.


def miss(q, y, side) -> np.ndarray:
    """The 80% band's miss on one side, in units of that side's distance from the median to the band."""
    m, low, high = q[..., MEDIAN], q[..., LOW80], q[..., HIGH80]
    if side == "below":
        return (low - y) / np.maximum(m - low, 1e-9)
    return (y - high) / np.maximum(high - m, 1e-9)


def offset(q, y, side) -> float:
    """The conformal quantile of the side's miss over the cells, at level ceil((n + 1) 0.9) / n (ADR rule 2)."""
    scores = miss(q, y, side)[np.isfinite(y)]
    n = len(scores)
    d = float(
        np.quantile(scores, min(1.0, np.ceil((n + 1) * 0.9) / n), method="higher")
    )
    assert d > -1, "an offset this negative would fold the side over the median"
    return d


def widen(q, side, d) -> np.ndarray:
    """Scale every quantile on one side of the median by 1 + d, from the median."""
    q = q.copy()
    m = q[..., MEDIAN : MEDIAN + 1]
    if side == "below":
        q[..., :MEDIAN] = m - (1 + d) * (m - q[..., :MEDIAN])
    else:
        q[..., MEDIAN + 1 :] = m + (1 + d) * (q[..., MEDIAN + 1 :] - m)
    return q


def calibrated(case, q, sides, held_out=True) -> tuple[np.ndarray, dict]:
    """q with the offsets of `sides` ({bucket: [side, ...]}): fitted on the other half of the origins, or on all of them."""
    n = len(case.refs)
    halves = [np.arange(n) < n // 2, np.arange(n) >= n // 2]
    pairs = (
        [(halves[0], halves[1]), (halves[1], halves[0])]
        if held_out
        else [(np.ones(n, bool), np.ones(n, bool))]
    )
    out, fitted = q.copy(), {}
    for b, chosen in sides.items():
        steps = np.array(
            [h - 1 for h in scoring.BUCKETS[b] if h <= case.series.horizon]
        )
        for side in chosen:
            fitted[b, side] = []
            for fit, apply in pairs:
                d = offset(q[np.ix_(fit, steps)], case.truth[np.ix_(fit, steps)], side)
                index = np.ix_(np.flatnonzero(apply), steps)
                out[index] = widen(out[index], side, d)
                fitted[b, side].append(d)
    return np.clip(out, *BOUNDS[case.series.kind]), fitted


def calibration(case, quantiles) -> dict:
    """Each (bucket, side) offset alone, held out, against the keep rule; then the kept ones together."""
    q = quantiles["timestral"]
    raw = cells(case, q)
    out, kept = {}, {}
    for b in buckets(case):
        r = raw[raw["bucket"] == b]
        entry = {"raw": coverage(r)}
        for side in ("below", "above"):
            held, fitted = calibrated(case, q, {b: [side]})
            c = cells(case, held)
            c = c[c["bucket"] == b]
            share, before = c[f"{side}_80"].mean(), r[f"{side}_80"].mean()
            wis = ratio(means(c, "wis"), means(r, "wis"))
            keep = bool(
                abs(share - 0.1) < abs(before - 0.1) and wis["verdict"] != "loses"
            )
            entry[side] = {
                "offset_folds": [num(d) for d in fitted[b, side]],
                "offset_all": num(
                    calibrated(case, q, {b: [side]}, held_out=False)[1][b, side][0]
                ),
                "held_out": coverage(c),
                "wis_ratio": wis,
                "keep": keep,
            }
            if keep:
                kept.setdefault(b, []).append(side)
        out[label(case, b)] = entry
    if kept:
        held, _ = calibrated(case, q, kept)
        c = cells(case, held)
        out["kept_together"] = {
            label(case, b): coverage(c[c["bucket"] == b])
            | {"wis_ratio": ratio(means(c, "wis", b), means(raw, "wis", b))}
            for b in kept
        }
    return out


def coverage(rows) -> dict:
    return {
        "coverage_50": num(rows["interval_coverage_50"].mean()),
        "coverage_80": num(rows["interval_coverage_80"].mean()),
        "below_80": num(rows["below_80"].mean()),
        "above_80": num(rows["above_80"].mean()),
        "wis": num(rows["wis"].mean()),
    }


# 3. Candidates.


def candidates(case, quantiles) -> dict:
    """Every candidate's WIS ratio to the production model per bucket, and the keep rule (ADR rule 3)."""
    q = dict(quantiles)
    q["ensemble"] = fc.post(np.mean([q[m] for m in MEMBERS], axis=0), case.series.kind)
    production = cells(case, q["timestral"])
    out = {}
    for name in [n for n in q if n not in ("timestral", "timestral_smooth")]:
        rows = cells(case, q[name])
        per = {
            label(case, b): ratio(means(rows, "wis", b), means(production, "wis", b))
            | {
                "coverage_80": num(
                    rows.loc[rows["bucket"] == b, "interval_coverage_80"].mean()
                )
            }
            for b in buckets(case)
        }
        verdicts = [p["verdict"] for p in per.values()]
        keep = "beats" in verdicts and "loses" not in verdicts
        if name == "ensemble":
            keep = keep and any(
                p["verdict"] == "beats" and p["ratio"] <= 0.95 for p in per.values()
            )
        out[name] = {
            "buckets": per,
            "wis_all": num(rows["wis"].mean() / production["wis"].mean()),
            "keep": keep if name not in ("chronos2", "timesfm25", "ets") else None,
        }
    passing = [
        f"timestral_ctx{n}" for n in fc.CONTEXTS if out[f"timestral_ctx{n}"]["keep"]
    ]
    out["context_pick"] = (
        min(passing, key=lambda n: out[n]["wis_all"]) if passing else None
    )
    return out


# The 7-day-average target.


def weekly_truth(case) -> np.ndarray:
    """The mean of the `week` scored values ending on each target, NaN if one is missing."""
    w, steps = case.week, case.series.horizon
    resolved = case.resolved.dropna() if case.trading else case.resolved
    out = []
    for ref in case.refs:
        if case.trading:
            seq = np.r_[
                resolved[resolved.index <= ref].to_numpy()[-(w - 1) :],
                resolved[resolved.index > ref].to_numpy()[:steps],
            ]
        else:
            seq = resolved.reindex(
                pd.date_range(ref - pd.Timedelta(days=w - 2), periods=w - 1 + steps)
            ).to_numpy()
        out.append(np.lib.stride_tricks.sliding_window_view(seq, w).mean(axis=1))
    return np.array(out, dtype=float)


def paths_mean(case, q, rho_by_origin) -> np.ndarray:
    """Design B: 4,000 Gaussian AR(1) copula paths per origin over the daily quantiles, each averaged with its window's observed days."""
    w, steps = case.week, case.series.horizon
    out = []
    for i, (context, daily) in enumerate(zip(case.contexts, q)):
        rho = rho_by_origin[i]
        e = np.random.default_rng(i).standard_normal((PATHS, steps))
        z = np.empty_like(e)
        z[:, 0] = e[:, 0]
        for h in range(1, steps):
            z[:, h] = rho * z[:, h - 1] + np.sqrt(max(0.0, 1 - rho * rho)) * e[:, h]
        u = _phi(z)
        # Read off the daily quantiles by straight lines, held beyond the outer levels, as paths.ts does.
        values = np.column_stack(
            [np.interp(u[:, h], LEVELS, daily[h]) for h in range(steps)]
        )
        seen = np.broadcast_to(context.ffill().to_numpy()[-(w - 1) :], (PATHS, w - 1))
        windows = np.lib.stride_tricks.sliding_window_view(
            np.hstack([seen, values]), w, axis=1
        )
        out.append(np.quantile(windows.mean(axis=2), LEVELS, axis=0).T)
    return fc.post(np.array(out), case.series.kind)


def _phi(z):
    from scipy.special import ndtr

    return ndtr(z)


def seven_day(case, quantiles) -> dict:
    """Design B against rho = 1, rho = 0, Timestral on the 7-day mean and its probabilistic naive (ADR rule 3)."""
    q = quantiles["timestral"]
    truth = weekly_truth(case)
    n = len(case.refs)
    halves = [np.arange(n) < n // 2, np.arange(n) >= n // 2]
    # The production tie, from the other half's forecasts: the page's own estimator.
    rhos = []
    for fit in (halves[1], halves[0]):
        made = [
            Forecast(r, tuple(LEVELS), x) for r, x, f in zip(case.refs, q, fit) if f
        ]
        rhos.append(
            tie.day_to_day_tie(
                made,
                case.resolved.dropna() if case.trading else case.resolved,
                case.trading,
            )["rho"]
        )
    rho = np.where(halves[0], rhos[0], rhos[1])
    smoothed = [fc.smooth(c, case.week) for c in case.contexts]
    designs = {
        "paths": paths_mean(case, q, rho),
        "rho_1": paths_mean(case, q, np.ones(n)),
        "rho_0": paths_mean(case, q, np.zeros(n)),
        "direct": quantiles["timestral_smooth"],
        "probabilistic_naive": np.array(
            [
                scoring.probabilistic_naive(
                    s, LEVELS, case.series.horizon, case.series.kind, case.year
                )
                for s in smoothed
            ]
        ),
    }
    # Self-checks: comonotone paths average the daily quantiles; independent ones give a narrower band.
    w = case.week
    seen = np.array([c.ffill().to_numpy()[-(w - 1) :] for c in case.contexts])
    medians = np.lib.stride_tricks.sliding_window_view(
        np.hstack([seen, q[:, :, MEDIAN]]), w, axis=1
    ).mean(axis=2)
    width = designs["rho_1"][..., HIGH80] - designs["rho_1"][..., LOW80]
    assert (
        np.abs(designs["rho_1"][..., MEDIAN] - medians) <= 0.05 * width + 1e-6
    ).all()
    narrow = designs["rho_0"][:, 1:, HIGH80] - designs["rho_0"][:, 1:, LOW80]
    assert narrow.mean() < width[:, 1:].mean()
    rows = {name: cells(case, x, truth) for name, x in designs.items()}
    out = {"rho_folds": rhos}
    for b in buckets(case):
        out[label(case, b)] = {
            name: coverage(r[r["bucket"] == b]) for name, r in rows.items()
        } | {
            f"paths_vs_{name}": ratio(
                means(rows["paths"], "wis", b), means(rows[name], "wis", b)
            )
            for name in designs
            if name != "paths"
        }
    verdicts = [out[label(case, b)] for b in buckets(case)]
    out["keep"] = all(
        v["paths_vs_direct"]["verdict"] != "loses" for v in verdicts
    ) and all(v["paths_vs_probabilistic_naive"]["verdict"] == "beats" for v in verdicts)
    return out


def main():
    started = time.perf_counter()
    result = {"issue": 146, "series": {}, "runtime_s": {}}
    for case in fc.cases():
        sid = case.series.id
        quantiles, seconds = {}, {}
        for name in fc.MODELS:
            if fc.applies(case, name):
                quantiles[name], seconds[name] = fc.cached(case, name)
        result["runtime_s"][sid] = {k: round(v) for k, v in seconds.items()}
        if sid == "gpr_daily":
            naive_stub_scores_one(case)
        smooth = quantiles.pop("timestral_smooth")
        result["series"][sid] = {
            "origins": {
                "n": len(case.refs),
                "first": f"{case.refs[0]:%Y-%m-%d}",
                "last": f"{case.refs[-1]:%Y-%m-%d}",
            },
            "baselines": baselines(case, quantiles),
            "calibration": calibration(case, quantiles),
            "candidates": candidates(case, quantiles),
            "seven_day": seven_day(case, quantiles | {"timestral_smooth": smooth}),
        }
        print(f"{sid}: scored, {time.perf_counter() - started:.0f} s", flush=True)
    result["runtime_s"]["total_model"] = round(
        sum(
            v
            for s in result["runtime_s"].values()
            if isinstance(s, dict)
            for v in s.values()
        )
    )
    result["runtime_s"]["evaluate"] = round(time.perf_counter() - started)
    OUT.write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8")
    report(result)


def report(result):
    """The ADR's tables, in Markdown."""

    def ci(d):
        return f"{d['ratio']:.3f} [{d['ci'][0]:.3f}, {d['ci'][1]:.3f}] {d['verdict']}"

    print("\n## Baselines: MAE over all cells, pick, pick vs the others\n")
    print(
        "| Series | origins | naive | snaive7 | mean28 | AutoETS | Timestral | registry | pick | pick vs the others |"
    )
    print("|---|---|---|---|---|---|---|---|---|---|")
    for sid, s in result["series"].items():
        b = s["baselines"]
        m = b["mae"]
        print(
            f"| {sid} | {s['origins']['n']} | {m['naive']} | {m['snaive7']} | {m['mean28']} | {m['ets']} | {m['timestral']} "
            f"| {b['registry']} | **{b['pick']}** | "
            + "; ".join(f"{k} {ci(v)}" for k, v in b["pick_vs"].items())
            + " |"
        )
    print(
        "\n## Baselines per bucket: Timestral's MAE ratio to the pick; WIS ratios to the probabilistic naive\n"
    )
    print(
        "| Series | Bucket | Timestral / pick (MAE) | Timestral / prob. naive (WIS) | AutoETS / prob. naive (WIS) |"
    )
    print("|---|---|---|---|---|")
    for sid, s in result["series"].items():
        for bl, v in s["baselines"]["buckets"].items():
            print(
                f"| {sid} | {bl} | {ci(v['timestral_vs_pick'])} | {ci(v['wis_timestral_vs_probabilistic_naive'])} | {ci(v['wis_ets_vs_probabilistic_naive'])} |"
            )
    print("\n## Calibration offsets, held out (two-fold by time)\n")
    print(
        "| Series | Bucket | raw cov80 (below / above) | side | offset (folds; all) | held-out side share | held-out cov80 | WIS ratio | keep |"
    )
    print("|---|---|---|---|---|---|---|---|---|")
    for sid, s in result["series"].items():
        for bl, v in s["calibration"].items():
            if bl == "kept_together":
                continue
            r = v["raw"]
            for side in ("below", "above"):
                e = v[side]
                print(
                    f"| {sid} | {bl} | {r['coverage_80']:.3f} ({r['below_80']:.3f} / {r['above_80']:.3f}) | {side} "
                    f"| {e['offset_folds'][0]:+.3f}, {e['offset_folds'][1]:+.3f}; {e['offset_all']:+.3f} | {e['held_out'][f'{side}_80']:.3f} "
                    f"| {e['held_out']['coverage_80']:.3f} | {ci(e['wis_ratio'])} | {'yes' if e['keep'] else 'no'} |"
                )
    print("\n## The kept offsets together, held out\n")
    print(
        "| Series | Bucket | raw cov80 | cov80 | cov50 (raw) | below / above | WIS ratio |"
    )
    print("|---|---|---|---|---|---|---|")
    for sid, s in result["series"].items():
        for bl, v in s["calibration"].get("kept_together", {}).items():
            r = s["calibration"][bl]["raw"]
            print(
                f"| {sid} | {bl} | {r['coverage_80']:.3f} | {v['coverage_80']:.3f} | {v['coverage_50']:.3f} ({r['coverage_50']:.3f}) "
                f"| {v['below_80']:.3f} / {v['above_80']:.3f} | {ci(v['wis_ratio'])} |"
            )
    print("\n## Fallback baseline, the best of the registry's three (not a rule)\n")
    print("| Series | registry | fallback | fallback / registry | fallback / AutoETS |")
    print("|---|---|---|---|---|")
    for sid, s in result["series"].items():
        b = s["baselines"]
        f = b["fallback"]
        print(
            f"| {sid} | {b['registry']} | {f['pick']} | {ci(f['vs_registry'])} | {ci(f['vs_ets'])} |"
        )
    print("\n## Candidates: WIS ratio to production per bucket\n")
    print("| Series | Candidate | buckets | all cells | keep |")
    print("|---|---|---|---|---|")
    for sid, s in result["series"].items():
        c = s["candidates"]
        for name, v in c.items():
            if name == "context_pick":
                continue
            per = "; ".join(
                f"{bl} {ci(p)} cov80 {p['coverage_80']:.3f}"
                for bl, p in v["buckets"].items()
            )
            print(f"| {sid} | {name} | {per} | {v['wis_all']:.3f} | {v['keep']} |")
        print(f"| {sid} | context pick | {c['context_pick']} | | |")
    print(
        "\n## 7-day average: design B against the alternatives (WIS ratio), coverage of the 80% band\n"
    )
    print(
        "| Series | Bucket | rho (folds) | B / rho 1 | B / rho 0 | B / direct | B / prob. naive | cov80 B / rho 1 / direct | keep |"
    )
    print("|---|---|---|---|---|---|---|---|---|")
    for sid, s in result["series"].items():
        d = s["seven_day"]
        for bl, v in d.items():
            if bl in ("rho_folds", "keep"):
                continue
            print(
                f"| {sid} | {bl} | {d['rho_folds']} | {ci(v['paths_vs_rho_1'])} | {ci(v['paths_vs_rho_0'])} | {ci(v['paths_vs_direct'])} "
                f"| {ci(v['paths_vs_probabilistic_naive'])} | {v['paths']['coverage_80']:.3f} / {v['rho_1']['coverage_80']:.3f} / {v['direct']['coverage_80']:.3f} | {d['keep']} |"
            )
    print("\n" + json.dumps(result["runtime_s"], indent=1))


if __name__ == "__main__":
    main()
