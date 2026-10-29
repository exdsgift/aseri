"""Ablation tables (stdout, Markdown) and the summary chart from data/fc_<MODEL>_<target>.npz.

Every covariate set is compared with the no-covariate run of the same model on the same origins:
relative change of MASE and WQL (%) and absolute change of cov80 and cov50, each with a 90% CI from
a paired bootstrap over origins (2,000 resamples).
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from covariates import SETS, load

HERE = Path(__file__).parent
DATA = HERE / "data"
CHARTS = HERE.parents[1] / "docs" / "research" / "assets" / "covariates"
MODELS = ["Timestral-209M", "Timestral-28M"]
BUCKETS = [(1, 7), (8, 30), (31, 90)]
NB = 2000


def per_origin(q, y, scale, lv, wi, idx):
    """Per-origin sums over the horizon steps of q (O, h, Q) vs y (O, h); y must have no NaN."""
    d = y[..., None] - q[..., wi]
    return {
        "ae": (np.abs(y - q[..., idx[0.5]]) / scale[:, None]).sum(1),
        "pin": np.maximum(lv * d, (lv - 1) * d).sum(1),  # (O, levels)
        "absy": np.abs(y).sum(1),
        "c80": ((y >= q[..., idx[0.1]]) & (y <= q[..., idx[0.9]])).sum(1),
        "c50": ((y >= q[..., idx[0.25]]) & (y <= q[..., idx[0.75]])).sum(1),
        "n": y.shape[1],
    }


def metrics(p, rows):
    """MASE, WQL, cov80, cov50 over origin index array `rows` (any leading shape: (O,) or (B, O))."""
    n = p["n"] * rows.shape[-1]
    return {
        "mase": p["ae"][rows].sum(-1) / n,
        "wql": (2 * p["pin"][rows].sum(-2) / p["absy"][rows].sum(-1)[..., None]).mean(
            -1
        ),
        "c80": p["c80"][rows].sum(-1) / n,
        "c50": p["c50"][rows].sum(-1) / n,
    }


def paired(pa, pb, rng):
    """Point estimate and 90% bootstrap CI of b vs a: % change of MASE/WQL, point change of coverage."""
    o = len(pa["ae"])
    full, boot = np.arange(o), rng.integers(0, o, (NB, o))
    out = {}
    for k in ("mase", "wql", "c80", "c50"):
        fa, fb, ba, bb = (
            metrics(pa, full)[k],
            metrics(pb, full)[k],
            metrics(pa, boot)[k],
            metrics(pb, boot)[k],
        )
        d, bd = (
            (100 * (fb / fa - 1), 100 * (bb / ba - 1))
            if k in ("mase", "wql")
            else (fb - fa, bb - ba)
        )
        out[k] = (d, *np.percentile(bd, [5, 95]))
    return out


# hand-computed check (quantiles from the baseline spike): median 12, 18 vs 10, 20 -> errors 2, 2 over scale 5 -> MASE 0.4;
# pinball sums per level q.1 0.7, q.5 2, q.9 1 over sum|y| 30 -> WQL 7.4/90; cov80 1.0, "cov50" 0.5
_y, _s = np.array([[10.0, 20.0]]), np.array([5.0])
_q = np.array([[[8.0, 12.0, 15.0], [15.0, 18.0, 25.0]]])
_lv, _idx = np.array([0.1, 0.5, 0.9]), {0.1: 0, 0.25: 0, 0.5: 1, 0.75: 1, 0.9: 2}
_m = metrics(per_origin(_q, _y, _s, _lv, [0, 1, 2], _idx), np.arange(1))
assert np.isclose(_m["mase"], 0.4) and np.isclose(_m["wql"], 7.4 / 90)
assert _m["c80"] == 1.0 and _m["c50"] == 0.5
# paired bootstrap: b's errors are exactly 0.9 x a's at every origin -> -10% with a zero-width CI
_pa = {"ae": np.array([1.0, 2.0, 4.0]), "pin": np.array([[1.0], [3.0], [2.0]]), "absy": np.array([5.0, 6.0, 7.0]),
       "c80": np.array([1, 2, 0]), "c50": np.array([0, 1, 1]), "n": 2}  # fmt: skip
_pb = _pa | {"ae": 0.9 * _pa["ae"], "pin": 0.9 * _pa["pin"], "c80": np.array([2, 2, 0])}
_r = paired(_pa, _pb, np.random.default_rng(0))
assert (
    np.allclose(_r["mase"], -10)
    and np.allclose(_r["wql"], -10)
    and np.allclose(_r["c50"], 0)
)
assert (
    np.isclose(_r["c80"][0], 1 / 6) and _r["c80"][1] >= 0
)  # one more covered step out of 6


def verdict(d):
    """Pre-registered keep rule on {bucket: paired result, plus metrics of the covariate run}."""
    for b in ("1-7", "8-30"):
        wql, mase, c80 = d[b]["wql"], d[b]["mase"], d[b]["m"]["c80"]
        if not (wql[0] <= -2 and wql[2] < 0 and mase[0] <= 0 and 0.7 <= c80 <= 0.9):
            return "drop"
    return "drop" if any(d[b]["wql"][1] > 0 for b in d) else "KEEP"


def fmt(t, pct):
    return (
        f"{t[0]:+.1f}% [{t[1]:+.1f}, {t[2]:+.1f}]"
        if pct
        else f"{t[0]:+.2f} [{t[1]:+.2f}, {t[2]:+.2f}]"
    )


targets, _ = load()
summary = {}  # (model, target, set) -> {bucket: {...}}
for model in MODELS:
    for name in SETS:
        f = DATA / f"fc_{model}_{name.split(' (')[0].replace(' ', '_')}.npz"
        if not f.exists():
            continue
        r = np.load(f, allow_pickle=True)
        act, scale, lv = r["act"], r["scale"], r["levels"]
        idx = {x: int(np.argmin(np.abs(lv - x))) for x in (0.1, 0.25, 0.5, 0.75, 0.9)}
        wi = [int(np.argmin(np.abs(lv - x))) for x in np.arange(1, 10) / 10]
        y_all = targets[name].to_numpy()
        o_idx = np.searchsorted(
            targets[name].index, r["origin_dates"].astype("datetime64[ns]")
        )
        base = {
            "naive": np.repeat(y_all[o_idx - 1][:, None], 90, 1),
            "snaive": np.stack([y_all[o - 7 : o][np.arange(90) % 7] for o in o_idx]),
            "mean28": np.repeat([[y_all[o - 28 : o].mean()] for o in o_idx], 90, 1),
        }
        print(f"\n### {model}: {name}\n")
        print(f"Origins: context ends {np.datetime64(r['origin_dates'][0]) - 1} to "
              f"{np.datetime64(r['origin_dates'][-1]) - 1}. "
              + "Simple baselines, MASE per bucket: "
              + "; ".join(f"{k} " + "/".join(
                  f"{np.mean(np.abs(act[~np.isnan(act[:, b - 1])][:, a - 1:b] - v[~np.isnan(act[:, b - 1])][:, a - 1:b]) / scale[~np.isnan(act[:, b - 1]), None]):.2f}"
                  for a, b in BUCKETS) for k, v in base.items()))  # fmt: skip
        print("\n| set | bucket | N | MASE | ΔMASE [90% CI] | WQL | ΔWQL [90% CI] | cov80 | Δcov80 [90% CI] "
              "| cov50 | Δcov50 [90% CI] | s/forecast |")  # fmt: skip
        print("|" + "---|" * 12)
        rng = np.random.default_rng(0)
        for s in r["sets"]:
            d = {}
            for a, b in BUCKETS:
                rows = np.where(~np.isnan(act[:, b - 1]))[
                    0
                ]  # origins with actuals for the whole bucket
                hs = slice(a - 1, b)
                p = {k: per_origin(r[f"q_{k}"][rows, hs], act[rows, hs], scale[rows], lv[wi], wi, idx)
                     for k in ("none", s)}  # fmt: skip
                m = {
                    k: float(v) for k, v in metrics(p[s], np.arange(len(rows))).items()
                }
                cmp = paired(p["none"], p[s], rng) if s != "none" else None
                d[f"{a}-{b}"] = (cmp or {}) | {"m": m}
                cells = (
                    [
                        fmt(cmp[k], k in ("mase", "wql"))
                        for k in ("mase", "wql", "c80", "c50")
                    ]
                    if cmp
                    else ["ref"] * 4
                )
                print(f"| {s} | {a}-{b} | {len(rows)} | {m['mase']:.3f} | {cells[0]} | {m['wql']:.3f} | {cells[1]} "
                      f"| {m['c80']:.2f} | {cells[2]} | {m['c50']:.2f} | {cells[3]} "
                      f"| {np.median(r[f'secs_{s}']):.2f} |")  # fmt: skip
            if s != "none":
                summary[(model, name, s)] = d
        print()
        for s in r["sets"][1:]:
            d = summary[(model, name, s)]
            print(f"- {s}: **{verdict(d)}** (ΔWQL 1-7 {fmt(d['1-7']['wql'], True)}, 8-30 {fmt(d['8-30']['wql'], True)}, "
                  f"31-90 {fmt(d['31-90']['wql'], True)})")  # fmt: skip

# ---- reproduction: the no-covariate runs must equal the baseline spike's stored forecasts ----
for model in MODELS:
    bf = HERE.parent / "timestral-backtest" / "data" / f"fc_{model}.npz"
    if bf.exists():
        b = np.load(bf, allow_pickle=True)
        for i, name in enumerate(b["names"]):
            f = DATA / f"fc_{model}_{name.split(' (')[0].replace(' ', '_')}.npz"
            if f.exists():
                print(f"repro {model} {name}: max |q_none - baseline q| = "
                      f"{np.nanmax(np.abs(np.load(f)['q_none'] - b[f'{i}_q'])):.2g}")  # fmt: skip

# ---- targeted check: Taiwan forecasts whose target day falls in the 2026 Lunar New Year window ----
for model in MODELS:
    f = DATA / f"fc_{model}_Taiwan_Strait.npz"
    if f.exists():
        r = np.load(f, allow_pickle=True)
        day = r["origin_dates"].astype("datetime64[D]")[:, None] + np.arange(90)
        m = (
            (day >= np.datetime64("2026-02-16"))
            & (day <= np.datetime64("2026-02-23"))
            & ~np.isnan(r["act"])
        )
        mae = {
            s: np.mean(np.abs(r[f"q_{s}"][..., 10][m] - r["act"][m])) for s in r["sets"]
        }
        print(f"\n{model} Taiwan, {m.sum()} (origin, h) points dated 2026-02-16..23 from {m.any(1).sum()} origins, "
              f"actual mean {r['act'][m].mean():.0f}: median MAE " + ", ".join(f"{s} {v:.1f}" for s, v in mae.items()))  # fmt: skip

# ---- chart: ΔWQL % with 90% CI per target and covariate set, 209M, three horizon buckets ----
rows = [(n, s, d) for (m, n, s), d in summary.items() if m == MODELS[0]]
if rows:
    CHARTS.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update(
        {"font.size": 8, "axes.spines.top": False, "axes.spines.right": False}
    )
    fig, ax = plt.subplots(
        figsize=(7, 0.32 * len(rows) + 1.1), dpi=100, facecolor="#fcfcfb"
    )
    ax.set_facecolor("#fcfcfb")
    colors = {
        "1-7": ("#2a78d6", "o"),
        "8-30": ("#eb6834", "s"),
        "31-90": ("#1baf7a", "D"),
    }  # dataviz slots 1-3, validated
    for k, (b, (c, mk)) in enumerate(colors.items()):
        yv = np.arange(len(rows)) + (k - 1) * 0.22
        pt = np.array([d[b]["wql"][0] for _, _, d in rows])
        lo, hi = (np.array([d[b]["wql"][i] for _, _, d in rows]) for i in (1, 2))
        ax.errorbar(
            pt,
            yv,
            xerr=[pt - lo, hi - pt],
            fmt=mk,
            ms=5,
            color=c,
            lw=1,
            capsize=0,
            label=f"h {b}",
        )
    ax.axvline(0, color="#52514e", lw=0.8)
    ax.axvline(-2, color="#7a7975", lw=0.8, ls="--")
    ax.text(-2.05, -0.6, "keep floor -2%", ha="right", va="center", fontsize=7, color="#52514e")
    ax.set_yticks(
        np.arange(len(rows)), [f"{n.split(' (')[0]}: {s}" for n, s, _ in rows]
    )
    ax.invert_yaxis()
    ax.set_xlabel(
        "WQL change vs no covariates, % (90% bootstrap CI over origins; left = better)"
    )
    ax.grid(axis="x", color="#e5e4e0", lw=0.6)
    ax.legend(frameon=False, ncol=3, loc="lower center", bbox_to_anchor=(0.5, 1.0))
    ax.set_title(
        "Timestral-209M: does adding covariates lower the forecast error?",
        loc="left",
        pad=18,
    )
    fig.tight_layout()
    fig.savefig(CHARTS / "delta-wql.png", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"\nchart {(CHARTS / 'delta-wql.png').stat().st_size // 1024} KB")

# ---- chart: Taiwan forecast across the 2026 Lunar New Year week, with and without the indicator ----
f = DATA / f"fc_{MODELS[0]}_Taiwan_Strait.npz"
if f.exists():
    r, s = np.load(f, allow_pickle=True), targets["Taiwan Strait"]
    od = r["origin_dates"].astype("datetime64[D]")
    j = int(np.where(od <= np.datetime64("2026-02-06"))[0][-1])  # LNY window lands at h ~ 10 to 18
    fd = od[j] + np.arange(45)
    hist = s[str(od[j] - 45) : str(od[j] - 1)]
    fig, ax = plt.subplots(figsize=(7, 3.2), dpi=100, facecolor="#fcfcfb")
    ax.set_facecolor("#fcfcfb")
    ax.axvspan(np.datetime64("2026-02-16"), np.datetime64("2026-02-24"), color="#e5e4e0", lw=0, label="Lunar New Year window")
    ax.plot(hist.index, hist.to_numpy(), color="#52514e", lw=1.2, label="history")
    ax.plot(fd, r["act"][j, :45], color="#0b0b0b", lw=1.2, label="actual")
    q = r["q_none"][j, :45]
    ax.fill_between(fd, q[:, 2], q[:, 18], color="#2a78d6", alpha=0.15, lw=0, label="no covariates, 80% band")
    ax.plot(fd, q[:, 10], color="#2a78d6", lw=2, label="no covariates, median")
    ax.plot(fd, r["q_dow+lny"][j, :45, 10], color="#eb6834", lw=2, ls="--", label="day of week + LNY, median")
    ax.set_title(f"Taiwan Strait transits: Timestral-209M from {od[j] - 1}, 45 days ahead", loc="left")
    ax.grid(axis="y", color="#e5e4e0", lw=0.6)
    ax.legend(fontsize=7, frameon=False, ncol=3, loc="upper center", bbox_to_anchor=(0.5, -0.1))
    fig.tight_layout()
    fig.savefig(CHARTS / "taiwan-lny.png", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"chart taiwan-lny {(CHARTS / 'taiwan-lny.png').stat().st_size // 1024} KB")
