"""The backtest of #146: its origins, and every model's 21 quantiles on them, cached. Usage: see README.md.

    python forecasts.py [MODEL ...]     # every model by default; a cached model is read, not rerun

Each series has weekly origins on its record weekday: the last 104 whose every target is observed
(two years, which hold the 120-day backfill window). GPR has the 232 real-time origins of #145 instead:
the context is the vintage known on the origin's day and the truth the value known `score_lag` days
after each target, never the latest vintage. Forecasts go to data/forecasts/<series>__<model>.npz.
"""

import os
import sys
import time
import warnings
from dataclasses import dataclass
from pathlib import Path
from statistics import NormalDist

import numpy as np
import pandas as pd

os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
HERE = Path(__file__).parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))
sys.path.insert(0, str(ROOT / "prototypes" / "gpr-realtime-backtest"))
import backtest as realtime  # the #145 harness: GPR's vintages and their as-of view
import torch

from aseri import archive, record, scoring
from aseri.__main__ import SOURCES
from aseri.forecast import (
    BOUNDS,
    forecast,
    load_model,
    make_context,
    measurement_errors,
)
from aseri.series import GPR_DAILY, Series

DATA = HERE / "data"
CACHE = DATA / "forecasts"
WEEKS = 104
LEVELS = (0.01, *np.round(np.arange(0.05, 0.951, 0.05), 2), 0.99)
UA = "aseri (+https://github.com/exdsgift/aseri)"
# The open weights, Apache-2.0 both (model cards checked on 2026-10-31), pinned to the revision downloaded.
CHRONOS = ("amazon/chronos-2", "29ec3766d36d6f73f0696f85560a422f50e8498c")
TIMESFM = (
    "google/timesfm-2.5-200m-pytorch",
    "1d952420fba87f3c6dee4f240de0f1a0fbc790e3",
)
CONTEXTS = (512, 1024, 2048)
# The report's spiky or near-zero series, where a log input could matter (checklist item 21).
LOG1P = (
    "hormuz_transits",
    "wiki_ww3_views",
    "ua_air_raid_hours",
    "ua_drones_downed_claimed",
)
# AutoETS fits the last three years of each context: the full GPR history would take minutes a fit.
ETS_YEARS = 3
# TimesFM-2.5 reads at most this many days: its whole context is padded to it, so its cost does not shrink with the series.
TIMESFM_CONTEXT = 4096
Z = np.array([NormalDist().inv_cdf(t) for t in LEVELS])


@dataclass
class Case:
    """One series' backtest: its origins, the context of each, and the value each target is scored against."""

    series: Series
    refs: list
    contexts: list
    # One row per origin, one column per step: the scored value, NaN where none.
    truth: np.ndarray
    # Every day's scored value, by date: the day-to-day tie and the 7-day truth read it.
    resolved: pd.Series

    @property
    def trading(self) -> bool:
        return self.series.horizon_unit == "trading_day"

    @property
    def week(self) -> int:
        return 5 if self.trading else 7

    @property
    def year(self) -> int:
        return scoring.TRADING_YEAR if self.trading else scoring.WINDOW


def gpr_case() -> Case:
    """GPR in real time, on #145's origins: the first vintage of each week whose every target is settled."""
    vintages, _ = realtime.load()
    rows = realtime.deltas(vintages)
    today = realtime.LATEST + pd.Timedelta(days=1)
    h, lag = GPR_DAILY.horizon, GPR_DAILY.score_lag
    by_day = pd.Series(list(vintages), index=[v.index[-1] for v in vintages.values()])
    as_ofs = [
        a
        for a in by_day.groupby(by_day.index.to_period("W")).min()
        if scoring.scoreable_on(vintages[a].index[-1] + pd.Timedelta(days=h), lag)
        <= today
    ]
    refs = [vintages[a].index[-1] for a in as_ofs]
    contexts = [
        make_context(GPR_DAILY, archive.view(rows, a), r) for a, r in zip(as_ofs, refs)
    ]
    days = pd.date_range(
        refs[0] - pd.Timedelta(days=7), refs[-1] + pd.Timedelta(days=h)
    )
    resolved = pd.Series({t: record.settled(rows, t, lag)[0] for t in days})
    return _case(GPR_DAILY, refs, contexts, resolved)


def upstream_case(series: Series) -> Case:
    """A series with no vintages: its latest download, context and truth alike, as the launch backfill."""
    observed = pd.read_csv(
        DATA / "series" / f"{series.id}.csv", parse_dates=["date"], index_col="date"
    )["value"].astype(float)
    days = observed.dropna().index
    # An origin needs every step observed: H prices after it for Brent, H days for the rest.
    last = (
        days[-series.horizon - 1]
        if series.horizon_unit == "trading_day"
        else observed.index[-1] - pd.Timedelta(days=series.horizon)
    )
    refs = list(
        days[(days <= last) & (days.dayofweek == series.record_weekday)][-WEEKS:]
    )
    contexts = [make_context(series, observed, r) for r in refs]
    # A registered measurement error is never scored.
    resolved = observed.mask(observed.index.isin(measurement_errors(series)))
    return _case(series, refs, contexts, resolved)


def _case(series, refs, contexts, resolved) -> Case:
    if series.horizon_unit == "trading_day":
        prints = resolved.dropna()
        truth = [prints[prints.index > r].to_numpy()[: series.horizon] for r in refs]
    else:
        truth = [
            resolved.reindex(
                pd.date_range(r + pd.Timedelta(days=1), periods=series.horizon)
            ).to_numpy()
            for r in refs
        ]
    return Case(series, refs, contexts, np.array(truth, dtype=float), resolved)


def cases() -> list[Case]:
    return [gpr_case()] + [upstream_case(series) for series, _ in SOURCES[1:]]


def post(quantiles, kind: str) -> np.ndarray:
    """aseri's post-processing of any model's quantiles: sorted, then clipped to the series' range."""
    quantiles = np.asarray(quantiles, dtype=float)
    if not np.isfinite(quantiles).all():
        raise ValueError("non-finite quantiles")
    return np.clip(np.sort(quantiles, axis=-1), *BOUNDS[kind])


# The models. Each takes a case and returns its quantiles, one (steps, levels) block per origin.


def timestral(case, transform=lambda context: context):
    model = _timestral()
    h, kind = case.series.horizon, case.series.kind
    return np.stack(
        [forecast(model, transform(c), h, kind).quantiles for c in case.contexts]
    )


def timestral_full(case):
    # #145 forecast the same GPR origins with the production model: its cache is reused, never recomputed.
    saved = realtime.DATA / "forecasts.npz"
    if case.series is GPR_DAILY and saved.exists():
        saved = np.load(saved)
        assert list(saved["refs"]) == _days(case.refs), "#145's origins differ"
        return saved["real_time"]
    return timestral(case)


def timestral_context(length):
    def run(case):
        # A context no longer than `length` is the full one: its forecast is the production one.
        full = cached(case, "timestral")[0]
        short = [i for i, c in enumerate(case.contexts) if len(c) > length]
        out = full.copy()
        if short:
            model = _timestral()
            for i in short:
                out[i] = forecast(
                    model,
                    case.contexts[i].iloc[-length:],
                    case.series.horizon,
                    case.series.kind,
                ).quantiles
        return out

    return run


def timestral_log1p(case):
    """Timestral on log1p of the context, back through expm1, then the series' range. A negative day is blank."""
    model = _timestral()
    out = []
    for c in case.contexts:
        q = forecast(model, np.log1p(c.where(c >= 0)), case.series.horizon).quantiles
        out.append(post(np.expm1(q), case.series.kind))
    out = np.stack(out)
    assert (np.diff(out, axis=-1) >= 0).all() and (out >= 0).all()
    return out


def timestral_smooth(case):
    """Timestral on the trailing weekly mean: the direct way to a 7-day-average forecast."""
    return timestral(case, lambda c: smooth(c, case.week))


def smooth(context: pd.Series, week: int) -> pd.Series:
    """The trailing mean of the last `week` values, a gap carried forward, from the first whole window."""
    return context.ffill().rolling(week).mean().iloc[week - 1 :]


def chronos2(case):
    from chronos import BaseChronosPipeline

    pipe = BaseChronosPipeline.from_pretrained(_weights(*CHRONOS), device_map="cpu")
    quantiles, _ = pipe.predict_quantiles(
        [c.to_numpy() for c in case.contexts],
        prediction_length=case.series.horizon,
        quantile_levels=list(LEVELS),
        batch_size=32,
    )
    return post(np.stack([q[0].numpy() for q in quantiles]), case.series.kind)


def timesfm25(case):
    import timesfm

    model = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
        _weights(*TIMESFM), torch_compile=False
    )
    model.compile(
        timesfm.ForecastConfig(
            max_context=TIMESFM_CONTEXT,
            max_horizon=128,
            normalize_inputs=True,
            use_continuous_quantile_head=True,
            force_flip_invariance=True,
            infer_is_positive=True,
            fix_quantile_crossing=True,
            per_core_batch_size=16,
        )
    )
    _, quantiles = model.forecast(
        horizon=case.series.horizon, inputs=[c.to_numpy() for c in case.contexts]
    )
    # Column 0 is the mean, 1 to 9 the deciles.
    return post(from_deciles(quantiles[..., 1:10]), case.series.kind)


def from_deciles(deciles: np.ndarray) -> np.ndarray:
    """The 21 levels from 9 deciles: the 5% steps between them by straight lines, the outer four by a normal tail.

    shortcut: TimesFM-2.5 has no level beyond 0.1 and 0.9, so 0.01, 0.05, 0.95 and 0.99 stretch the
    median's distance to the outer decile by the normal ratio; a skewed tail is lost.
    """
    inner = np.empty(deciles.shape[:-1] + (17,))
    inner[..., ::2] = deciles
    inner[..., 1::2] = (deciles[..., :-1] + deciles[..., 1:]) / 2
    median = deciles[..., 4:5]
    low = median + (deciles[..., :1] - median) * Z[:2] / Z[2]
    high = median + (deciles[..., -1:] - median) * Z[-2:] / Z[-3]
    return np.concatenate([low, inner, high], axis=-1)


def ets(case):
    """A lean AutoETS: additive errors, no, additive or damped trend, with or without a weekly season, the lowest AICc."""
    from statsmodels.tsa.exponential_smoothing.ets import ETSModel

    h, window = case.series.horizon, ETS_YEARS * case.year
    out = []
    for context in case.contexts:
        # A plain index: statsmodels 0.15's ETS prediction breaks on a bare array.
        y = context.ffill().dropna().iloc[-window:].reset_index(drop=True)
        fits = []
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            for trend, damped in ((None, False), ("add", False), ("add", True)):
                for seasonal in (None, "add"):
                    fit = ETSModel(
                        y,
                        error="add",
                        trend=trend,
                        damped_trend=damped,
                        seasonal=seasonal,
                        seasonal_periods=case.week if seasonal else None,
                    ).fit(disp=False)
                    if np.isfinite(fit.aicc):
                        fits.append(fit)
            best = min(fits, key=lambda f: f.aicc)
            pred = best.get_prediction(start=len(y), end=len(y) + h - 1)
        mean = np.asarray(pred.predicted_mean)
        sd = np.sqrt(np.asarray(pred.var_pred_mean))
        out.append(mean[:, None] + sd[:, None] * Z[None, :])
    return post(np.stack(out), case.series.kind)


MODELS = {
    "timestral": timestral_full,
    **{f"timestral_ctx{n}": timestral_context(n) for n in CONTEXTS},
    "timestral_log1p": timestral_log1p,
    "timestral_smooth": timestral_smooth,
    "chronos2": chronos2,
    "timesfm25": timesfm25,
    "ets": ets,
}


def applies(case: Case, name: str) -> bool:
    return name != "timestral_log1p" or case.series.id in LOG1P


def cached(case: Case, name: str) -> tuple[np.ndarray, float]:
    """A model's quantiles on a case, and the seconds they took, from data/forecasts/ or made and saved there."""
    path = CACHE / f"{case.series.id}__{name}.npz"
    if path.exists():
        saved = np.load(path)
        assert list(saved["refs"]) == _days(case.refs), (
            f"{path.name}: origins changed, delete it"
        )
        return saved["quantiles"], float(saved["seconds"])
    start = time.perf_counter()
    quantiles = MODELS[name](case)
    seconds = time.perf_counter() - start
    if name == "timestral" and case.series is GPR_DAILY:
        # #145's cache: its own runtime, half of its two versions.
        seconds = float(np.load(realtime.DATA / "forecasts.npz")["seconds"]) / 2
    assert quantiles.shape == (len(case.refs), case.series.horizon, len(LEVELS))
    CACHE.mkdir(parents=True, exist_ok=True)
    np.savez(path, refs=_days(case.refs), quantiles=quantiles, seconds=seconds)
    print(
        f"{case.series.id} {name}: {len(case.refs)} origins, {seconds:.0f} s",
        flush=True,
    )
    return quantiles, seconds


_model = None


def _timestral():
    global _model
    if _model is None:
        _model = load_model()  # the production model, 4 torch threads
    return _model


def _weights(repo: str, revision: str) -> str:
    from huggingface_hub import snapshot_download

    return snapshot_download(repo, revision=revision, user_agent=UA)


def _days(refs) -> list[str]:
    return [f"{r:%Y-%m-%d}" for r in refs]


if __name__ == "__main__":
    torch.set_num_threads(
        4
    )  # as the daily job: a public-repo ubuntu-latest runner's vCPUs
    names = sys.argv[1:] or list(MODELS)
    for case in cases():
        for name in names:
            if applies(case, name):
                cached(case, name)
