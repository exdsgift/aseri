"""Metrics tables (stdout, Markdown), example charts and out/snapshot.json from data/fc_*.npz."""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

HERE = Path(__file__).parent
DATA, OUT = HERE / "data", HERE / "out"
CHARTS = HERE.parents[1] / "docs" / "research" / "assets" / "spike"
MODELS = ["Timestral-28M", "Timestral-209M"]
REVISION = {
    "Timestral-28M": "49b26409ac87b5935539a5d8ffe7f397b720db47",
    "Timestral-209M": "9874d252ab0aae16f7f7c999f98f98d6ad7d8365",
}
CHECK_H = [1, 7, 14, 30, 60, 90]
BUCKETS = [(1, 7), (8, 30), (31, 90)]
RECENT = "2026-09-01"  # origins whose context ends on/after this date get their own table (leakage check)


# ---- metrics: y (O, h), point f (O, h), quantiles qf (O, h, L) at `lv` levels; NaN y = no actual ----
def mase(f, y, scale):
    return np.nanmean(np.abs(y - f) / scale[:, None])


def wql(qf, y, lv):
    m = ~np.isnan(y)
    d = y[m][:, None] - qf[m]
    pin = np.maximum(lv * d, (lv - 1) * d)
    return np.mean(2 * pin.sum(0) / np.abs(y[m]).sum())


def cover(lo, hi, y):
    m = ~np.isnan(y)
    return np.mean((y[m] >= lo[m]) & (y[m] <= hi[m]))


# hand-computed check: errors 2 and 6 over scale 5 -> MASE (0.4 + 1.2) / 2 = 0.8
_y, _f, _s = np.array([[10.0, 20.0]]), np.array([[12.0, 14.0]]), np.array([5.0])
assert np.isclose(mase(_f, _y, _s), 0.8)
# pinball sums per level: q.1 0.2+0.5=0.7, q.5 1+1=2, q.9 0.5+0.5=1 -> mean(2*[.7,2,1]/30) = 7.4/90
_lv, _qf = (
    np.array([0.1, 0.5, 0.9]),
    np.array([[[8.0, 12.0, 15.0], [15.0, 18.0, 25.0]]]),
)
assert np.isclose(wql(_qf, _y, _lv), 7.4 / 90)
# a point forecast scored by WQL over symmetric levels equals WAPE: (2 + 6) / 30
assert np.isclose(wql(np.repeat(_f[..., None], 3, -1), _y, _lv), 8 / 30)
assert (
    cover(_qf[..., 0], _qf[..., 2], _y) == 1.0
    and cover(_qf[..., 0], _qf[..., 1], _y) == 0.5
)
assert np.isclose(
    mase(np.array([[12.0, np.nan]]), np.array([[10.0, np.nan]]), _s), 0.4
)  # NaN skipped

R = {m: np.load(DATA / f"fc_{m}.npz", allow_pickle=True) for m in MODELS}
r0 = R[MODELS[1]]
levels = r0["levels"]
idx = {q: int(np.argmin(np.abs(levels - q))) for q in (0.1, 0.25, 0.5, 0.75, 0.9)}
wql_idx = [int(np.argmin(np.abs(levels - q))) for q in np.arange(1, 10) / 10]
lv9 = levels[wql_idx]
rng = np.random.default_rng(0)


def scores(i, rows, hs, model=None, point=None):
    """Metrics over origins `rows` and horizon indices `hs` (0-based) for a model or a baseline."""
    y, sc = r0[f"{i}_act"][rows][:, hs], r0[f"{i}_scale"][rows]
    if model is None:
        f = point[rows][:, hs]
        return {
            "mase": mase(f, y, sc),
            "wql": wql(np.repeat(f[..., None], 9, -1), y, lv9),
        }
    q = R[model][f"{i}_q"][rows][:, hs]
    return {
        "mase": mase(q[..., idx[0.5]], y, sc),
        "wql": wql(q[..., wql_idx], y, lv9),
        "c80": cover(q[..., idx[0.1]], q[..., idx[0.9]], y),
        "c50": cover(q[..., idx[0.25]], q[..., idx[0.75]], y),
    }


def boot_ratio(i, rows, hs, model):
    """Bootstrap over origins of MASE(model) / MASE(snaive): 5th and 95th percentiles."""
    y, sc = r0[f"{i}_act"][rows][:, hs], r0[f"{i}_scale"][rows][:, None]
    em = np.nanmean(np.abs(y - R[model][f"{i}_q"][rows][:, hs, idx[0.5]]) / sc, 1)
    es = np.nanmean(np.abs(y - r0[f"{i}_snaive"][rows][:, hs]) / sc, 1)
    b = rng.integers(0, len(em), (2000, len(em)))
    return np.percentile(em[b].mean(1) / es[b].mean(1), [5, 95])


def table(i, origin_mask, label, horizons):
    act = r0[f"{i}_act"]
    print(f"\n**{label}**\n")
    print(
        "| h | N | MASE naive | MASE snaive | MASE mean28 | MASE 28M | MASE 209M | 209M/snaive [90% CI] | WQL snaive | WQL 28M "
        "| WQL 209M | cov80 28M | cov80 209M | cov50 28M | cov50 209M |"
    )
    print("|" + "---|" * 15)
    verdict = {m: [] for m in MODELS}
    for h in horizons:
        a, b = (h, h) if isinstance(h, int) else h
        hs = list(range(a - 1, b))
        rows = np.where(origin_mask & ~np.isnan(act[:, b - 1]))[
            0
        ]  # origins with actuals for the whole span
        if len(rows) < 2:
            continue
        nv = scores(i, rows, hs, point=r0[f"{i}_naive"])
        sn = scores(i, rows, hs, point=r0[f"{i}_snaive"])
        mn = scores(i, rows, hs, point=MEAN28[i])
        s = {m: scores(i, rows, hs, model=m) for m in MODELS}
        lo, hi = boot_ratio(i, rows, hs, "Timestral-209M")
        for m in MODELS:
            verdict[m].append(
                (h, s[m]["mase"] < sn["mase"] and 0.7 <= s[m]["c80"] <= 0.9)
            )
        print(
            f"| {h if isinstance(h, int) else f'{a}-{b}'} | {len(rows)} | {nv['mase']:.2f} | {sn['mase']:.2f} | {mn['mase']:.2f} "
            f"| {s['Timestral-28M']['mase']:.2f} | {s['Timestral-209M']['mase']:.2f} "
            f"| {s['Timestral-209M']['mase'] / sn['mase']:.2f} [{lo:.2f}, {hi:.2f}] "
            f"| {sn['wql']:.3f} | {s['Timestral-28M']['wql']:.3f} | {s['Timestral-209M']['wql']:.3f} "
            f"| {s['Timestral-28M']['c80']:.2f} | {s['Timestral-209M']['c80']:.2f} "
            f"| {s['Timestral-28M']['c50']:.2f} | {s['Timestral-209M']['c50']:.2f} |"
        )
    for m in MODELS:
        print(
            f"\n{m} passes (beats snaive on MASE and cov80 in 0.7-0.9): "
            + ", ".join(
                f"{h if isinstance(h, int) else f'{h[0]}-{h[1]}'}={'Y' if ok else 'n'}"
                for h, ok in verdict[m]
            )
        )


names = list(r0["names"])
# reference only, not in the verdict rule: mean of the last 28 context days, held flat
MEAN28 = {}
for i in range(len(names)):
    o = np.searchsorted(r0[f"{i}_hist_dates"], r0[f"{i}_origin_dates"])
    MEAN28[i] = np.repeat([[r0[f"{i}_hist"][k - 28:k].mean()] for k in o], 90, 1)
for i, name in enumerate(names):
    ctx_end = pd.to_datetime(r0[f"{i}_origin_dates"]) - pd.Timedelta(days=1)
    every = np.ones(len(ctx_end), bool)
    print(
        f"\n### {name}\n\nOrigins: context ends {ctx_end[0].date()} to {ctx_end[-1].date()}, "
        f"history {r0[f'{i}_ctx_len']} days, scale (mean |y_t - y_t-7|) at the last origin "
        f"{r0[f'{i}_scale'][-1]:.2f}"
    )
    table(i, every, "All 52 origins (last 12 months)", CHECK_H + BUCKETS)
    table(
        i,
        ctx_end >= pd.Timestamp(RECENT),
        f"Origins with context ending on or after {RECENT}",
        [1, 7, 14, 30, (1, 7), (8, 30)],
    )
    # per-h MASE ratio 209M/snaive and 28M/snaive, every 5 days, for the write-up
    act = r0[f"{i}_act"]
    line = []
    for h in range(1, 91, 4):
        rows = np.where(~np.isnan(act[:, h - 1]))[0]
        sn = scores(i, rows, [h - 1], point=r0[f"{i}_snaive"])["mase"]
        line.append(
            f"h{h}:"
            + "/".join(
                f"{scores(i, rows, [h - 1], model=m)['mase'] / sn:.2f}" for m in MODELS
            )
        )
    print("\nper-h MASE ratio vs snaive (28M/209M): " + " ".join(line))

print("\n### Runtime (4 torch threads)\n")
print(
    "| model | load s | peak RAM GiB | "
    + " | ".join(f"{n} s/forecast" for n in names)
    + " | backtest total s |"
)
print("|" + "---|" * (4 + len(names)))
for m in MODELS:
    r = R[m]
    print(
        f"| {m} | {float(r['load_s']):.1f} | {float(r['peak_wset']) / 2**30:.2f} | "
        + " | ".join(f"{np.median(r[f'{i}_secs']):.2f}" for i in range(len(names)))
        + f" | {float(r['total_s']):.0f} |"
    )

# ---- charts: 209M forecast at the latest origin that has 90 days of actuals ----
CHARTS.mkdir(parents=True, exist_ok=True)
plt.rcParams.update(
    {"font.size": 9, "axes.spines.top": False, "axes.spines.right": False}
)
for i, name in enumerate(names):
    act = r0[f"{i}_act"]
    j = np.where(~np.isnan(act[:, -1]))[0][-1]
    od = pd.to_datetime(r0[f"{i}_origin_dates"][j])
    hd, hist = pd.to_datetime(r0[f"{i}_hist_dates"]), r0[f"{i}_hist"]
    o = int(np.searchsorted(hd, od))
    fd = hd[o : o + 90]
    q = r0[f"{i}_q"][j]
    fig, ax = plt.subplots(figsize=(7, 3.3), dpi=100, facecolor="#fcfcfb")
    ax.set_facecolor("#fcfcfb")
    ax.plot(
        hd[o - 120 : o], hist[o - 120 : o], color="#52514e", lw=1.2, label="history"
    )
    ax.plot(fd, act[j], color="#0b0b0b", lw=1.2, label="actual")
    ax.fill_between(
        fd,
        q[:, idx[0.1]],
        q[:, idx[0.9]],
        color="#2a78d6",
        alpha=0.18,
        lw=0,
        label="80% interval",
    )
    ax.fill_between(
        fd,
        q[:, idx[0.25]],
        q[:, idx[0.75]],
        color="#2a78d6",
        alpha=0.32,
        lw=0,
        label="50% interval",
    )
    ax.plot(fd, q[:, idx[0.5]], color="#2a78d6", lw=2, label="Timestral-209M median")
    ax.plot(
        fd, r0[f"{i}_snaive"][j], color="#52514e", lw=1, ls=":", label="seasonal naive"
    )
    ax.axvline(od, color="#52514e", lw=0.6)
    ax.set_title(
        f"{name}: 90-day forecast from {(od - pd.Timedelta(days=1)).date()}", loc="left"
    )
    ax.grid(axis="y", color="#e5e4e0", lw=0.6)
    ax.legend(fontsize=7, frameon=False, ncol=6, loc="upper center", bbox_to_anchor=(0.5, -0.1))
    fig.tight_layout()
    fname = name.split(" (")[0].lower().replace(" ", "-")
    fig.savefig(CHARTS / f"{fname}.png", facecolor=fig.get_facecolor())
    plt.close(fig)

# ---- snapshot for the UI prototype: last 180 days + latest 30-day 209M forecast ----
SRC = {
    "GPR daily (GPRD)": (
        "Caldara-Iacoviello Geopolitical Risk index, daily (GPRD)",
        'CC BY. Caldara, Dario and Matteo Iacoviello (2022), "Measuring Geopolitical Risk", '
        "American Economic Review 112(4). Data: matteoiacoviello.com/gpr.htm",
    ),
}
PW = (
    "IMF PortWatch daily chokepoint transits, n_total",
    "Sources: UN Global Platform; IMF PortWatch (portwatch.imf.org). IMF terms: attribution required, "
    "commercial reuse needs IMF permission.",
)
snap = {
    "generated": "2026-10-29",
    "model": "mistralai/Timestral-209M",
    "model_revision": REVISION["Timestral-209M"],
    "forecast_attribution": "Forecast by Timestral-209M (Mistral AI), weights under the Modified MIT License",
    "series": [],
}
for i, name in enumerate(names):
    hd, hist, live = r0[f"{i}_hist_dates"], r0[f"{i}_hist"], r0[f"{i}_live"]
    start = pd.Timestamp(hd[-1]) + pd.Timedelta(days=1)
    nd = 2 if name.startswith("GPR") else 1
    src, lic = SRC.get(name, PW)
    snap["series"].append(
        {
            "id": name.split(" (")[0].lower().replace(" ", "-"),
            "name": name,
            "source": src,
            "licence": lic,
            "last_updated": str(hd[-1]),
            "history": [
                [str(d), round(float(v), nd)] for d, v in zip(hd[-180:], hist[-180:])
            ],
            "forecast": [
                {
                    "date": str((start + pd.Timedelta(days=k)).date()),
                    **{f"q{q:g}": round(float(live[k, idx[q]]), nd) for q in idx},
                }
                for k in range(len(live))
            ],
        }
    )
OUT.mkdir(exist_ok=True)
(OUT / "snapshot.json").write_text(json.dumps(snap, separators=(",", ":")))
print(
    f"\nsnapshot {(OUT / 'snapshot.json').stat().st_size} bytes; charts: "
    + ", ".join(
        f"{p.name} {p.stat().st_size // 1024} KB" for p in sorted(CHARTS.glob("*.png"))
    )
)
