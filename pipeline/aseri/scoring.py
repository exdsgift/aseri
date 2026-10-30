"""How past forecasts did: scores, their intervals and the observation each target is scored against. Pure, no I/O."""

import numpy as np
import pandas as pd

from aseri.forecast import BOUNDS, Forecast

# The record's horizon buckets; a bucket's longest horizon is also its bootstrap block.
BUCKETS = {"1-7": range(1, 8), "8-28": range(8, 29)}
# How long a target waits for its observation to settle is each series' `score_lag`, in the registry.
# The window, in days of each origin's own context, of the MASE scale and the probabilistic naive's changes.
WINDOW = 365
# Every interval is 95%.
TAIL = 0.025
REPS = 2000
SEED = 0


def wis(quantiles: np.ndarray, observed: np.ndarray, levels) -> pd.DataFrame:
    """The weighted interval score and its components, one row per forecast (Bracher et al. 2021).

    WIS = (|y - m| / 2 + sum_k alpha_k / 2 * IS_k) / (K + 1/2), scoringutils' default. It equals the
    mean, over the 2K+1 levels, of TWICE the pinball loss: on 21 levels, (2/21) times their sum.
    The quantile losses of scoringrules and utilsforecast are the plain pinball loss, so their mean is
    half of this. Overprediction is the penalty for observations below the band, as in scoringutils.
    """
    levels = np.asarray(levels, dtype=float)
    k = len(levels) // 2
    if not (np.allclose(levels + levels[::-1], 1) and np.isclose(levels[k], 0.5)):
        raise ValueError("WIS needs levels symmetric around a median")
    q = np.asarray(quantiles, dtype=float)
    y = np.asarray(observed, dtype=float)
    lower, upper, median = q[:, :k], q[:, : -k - 1 : -1], q[:, k]
    dispersion = (levels[:k] * (upper - lower)).sum(axis=1)
    over = np.maximum(lower - y[:, None], 0).sum(axis=1) + np.maximum(median - y, 0) / 2
    under = (
        np.maximum(y[:, None] - upper, 0).sum(axis=1) + np.maximum(y - median, 0) / 2
    )
    parts = pd.DataFrame(
        {"dispersion": dispersion, "overprediction": over, "underprediction": under}
    ) / (k + 0.5)
    return parts.assign(wis=parts.sum(axis=1))[
        ["wis", "dispersion", "overprediction", "underprediction"]
    ]


def inside(
    quantiles: np.ndarray, observed: np.ndarray, levels, band: float
) -> np.ndarray:
    """Whether each observation lies in the central `band` of its forecast, its bounds included, as scoringutils counts."""
    levels = np.asarray(levels, dtype=float)
    lower = quantiles[:, np.isclose(levels, (1 - band) / 2)][:, 0]
    upper = quantiles[:, np.isclose(levels, (1 + band) / 2)][:, 0]
    return (lower <= observed) & (observed <= upper)


def clopper_pearson(hits: int, n: int) -> tuple[float, float]:
    """The exact 95% interval of a hit rate. It assumes independent hits: on overlapping origins it is too narrow."""
    low = 0.0 if hits == 0 else _root(lambda p: 1 - _binom_cdf(hits - 1, n, p) - TAIL)
    high = 1.0 if hits == n else _root(lambda p: TAIL - _binom_cdf(hits, n, p))
    return low, high


def probabilistic_naive(
    history, levels, horizon: int, kind: str = "index"
) -> np.ndarray:
    """The hubs' baseline (Cramer et al. 2022): the last value plus the quantiles of past h-day changes, one row per h.

    The changes come in both signs, as the COVID-19 Forecast Hub's baseline took them, so its median is
    the naive forecast itself. Its spread stops a model scoring well merely for having one.
    """
    x = pd.Series(history, dtype=float).ffill().to_numpy()[-WINDOW:]
    rows = []
    for h in range(1, horizon + 1):
        changes = x[h:] - x[:-h]
        changes = changes[~np.isnan(changes)]
        # A history too short for any h-day change gives no spread: the naive forecast alone.
        spread = np.r_[changes, -changes] if changes.size else np.zeros(1)
        rows.append(x[-1] + np.quantile(spread, levels))
    return np.clip(np.array(rows), *BOUNDS[kind])


def score(forecast: Forecast, history, observed, kind: str = "index") -> pd.DataFrame:
    """One row per observed horizon of `forecast`: its scores, and the absolute errors and WIS of the baselines.

    `history` is what the forecast was made from, ending at its reference date, and gives the
    baselines; `observed` holds one value per horizon, NaN where a target is not scored. A gap in the
    history is carried forward, as Timestral does with a masked day.
    """
    observed = np.asarray(observed, dtype=float)
    scored = np.isfinite(observed)
    y = observed[scored]
    horizon = np.arange(1, len(observed) + 1)[scored]
    quantiles = np.asarray(forecast.quantiles, dtype=float)[scored]
    x = pd.Series(history, dtype=float).ffill().to_numpy()
    error = np.abs(y - quantiles[:, np.isclose(forecast.levels, 0.5)][:, 0])
    recent = x[-WINDOW:]
    # Hyndman and Koehler's scale, on a fixed window: the in-sample error of the seasonal naive.
    scale = np.nanmean(np.abs(recent[7:] - recent[:-7]))
    spread = probabilistic_naive(history, forecast.levels, len(observed), kind)[scored]
    return pd.DataFrame(
        {
            "horizon": horizon,
            "bucket": [
                next(b for b, hs in BUCKETS.items() if h in hs) for h in horizon
            ],
            "observation": y,
        }
    ).assign(
        **wis(quantiles, y, forecast.levels),
        interval_coverage_50=inside(quantiles, y, forecast.levels, 0.5),
        interval_coverage_80=inside(quantiles, y, forecast.levels, 0.8),
        ae_median=error,
        # A history flat week on week has no scale: no MASE rather than an infinite one.
        ase_median=error / scale if scale > 0 else np.nan,
        ae_naive=np.abs(y - x[-1]),
        # A history under a week has no value a week back for its first days.
        ae_snaive7=np.abs(y - np.r_[np.full(7, np.nan), x][-7:][(horizon - 1) % 7]),
        ae_mean28=np.abs(y - np.nanmean(x[-28:])),
        wis_naive=wis(spread, y, forecast.levels)["wis"],
    )


def bootstrap(model, baseline=None, *, block: int) -> tuple[float, float, float]:
    """mean(model) / mean(baseline), or mean(model) alone, with its 95% stationary block bootstrap interval.

    One value per origin, in date order: the origin's mean over its scored horizons in a bucket.
    Neighbouring origins share most of their future, so their scores move together; blocks of mean
    length `block` (Politis and Romano 1994), at least the bucket's longest horizon, keep that in each
    resample. Seeded, so a rerun publishes the same interval.
    """
    model = np.asarray(model, dtype=float)
    baseline = (
        np.ones_like(model) if baseline is None else np.asarray(baseline, dtype=float)
    )
    rng = np.random.default_rng(SEED)
    n = len(model)
    starts = rng.integers(0, n, size=(REPS, n))
    new_block = rng.random((REPS, n)) < 1 / block
    new_block[:, 0] = True
    step = np.arange(n)
    first = np.maximum.accumulate(np.where(new_block, step, 0), axis=1)
    index = (np.take_along_axis(starts, first, axis=1) + step - first) % n
    ratios = model[index].mean(axis=1) / baseline[index].mean(axis=1)
    low, high = np.quantile(ratios, [TAIL, 1 - TAIL])
    return float(model.mean() / baseline.mean()), float(low), float(high)


def verdict(low: float, high: float) -> str | None:
    """What the page says of a model-to-baseline ratio: it beats or loses only when its whole interval does.

    None when a bound is not finite: a baseline with no error leaves the ratio infinite or undefined.
    """
    if not (np.isfinite(low) and np.isfinite(high)):
        return None
    return "beats" if high < 1 else "loses" if low > 1 else "ties"


def scoreable_on(target_end_date, lag_days: int) -> pd.Timestamp:
    """The day a target is scored, once and for good, against the observation known that day."""
    return pd.Timestamp(target_end_date) + pd.Timedelta(days=lag_days)


def known_on(
    vintages: pd.DataFrame, target_end_date, day
) -> tuple[float, pd.Timestamp] | None:
    """The observation of `target_end_date` as known on `day`, and the `as_of` of the vintage it comes from.

    `vintages` has a row per value seen, with `target_end_date`, `observation` and `as_of` as
    timestamps, like the archive's deltas. The `as_of` returned can be older than `day`: it is when
    that value was first seen. None while nobody had observed the target by `day`.
    """
    seen = vintages[
        (vintages["target_end_date"] == pd.Timestamp(target_end_date))
        & (vintages["as_of"] <= pd.Timestamp(day))
    ]
    if seen.empty:
        return None
    newest = seen.sort_values("as_of", kind="stable").iloc[-1]
    return float(newest["observation"]), newest["as_of"]


def traffic_light(hits: int, n: int, band: float) -> str:
    """The calibration zone of a band that held `hits` of `n` targets, in both directions.

    Basel's zones rest on F, the binomial probability of at most this many misses: green below 0.95,
    yellow below 0.9999, red from there. Too few misses, a band too wide, is miscalibration too, so the
    cutoffs mirror on the same F: yellow below 0.05, red below 0.0001. Mirrored on F rather than on
    the hits, the fewest misses possible stays green while it is likely (0 of 250 at 99% is 0.08).
    """
    f = _binom_cdf(n - hits, n, 1 - band)
    if f < 0.0001 or f >= 0.9999:
        return "red"
    if f < 0.05 or f >= 0.95:
        return "yellow"
    return "green"


def _binom_cdf(k: int, n: int, p: float) -> float:
    """P(X <= k) for X ~ Binomial(n, p), summed in logs so that a long record cannot overflow."""
    i = np.arange(k + 1)
    log_choose = np.r_[0, np.cumsum(np.log((n - i[1:] + 1) / i[1:]))]
    return float(np.exp(log_choose + i * np.log(p) + (n - i) * np.log1p(-p)).sum())


def _root(increasing) -> float:
    """Where an increasing function of p in (0, 1) crosses zero, by bisection to machine precision."""
    low, high = 0.0, 1.0
    for _ in range(60):
        middle = (low + high) / 2
        low, high = (middle, high) if increasing(middle) < 0 else (low, middle)
    return (low + high) / 2
