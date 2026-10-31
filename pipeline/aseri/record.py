"""The track record: every archived forecast scored against the observation it is due, live and retrospective apart, and the live calibration monitor."""

from datetime import date

import numpy as np
import pandas as pd

from aseri import archive
from aseri.archive import Archived
from aseri.forecast import make_context, measurement_errors
from aseri.scoring import (
    BUCKETS,
    REPS,
    SEED,
    TAIL,
    TRADING_YEAR,
    WINDOW,
    bootstrap,
    clopper_pearson,
    known_on,
    score,
    scoreable_on,
    traffic_light,
    verdict,
)
from aseri.series import Series

# A series shows its live scores from 30 resolved live forecasts (spec 6.4).
MIN_N = 30
# The record's squares: the last 8 weekly forecasts, 7 days ahead.
SQUARES, SQUARE_HORIZON = 8, 7
# The baselines of the median's error, as `scoring.score` names its columns.
BASELINES = ("naive", "snaive7", "mean28")
# How every published score is computed, stated in the score files.
METHOD = {
    "wis": "Bracher et al. (2021), as scoringutils computes it: on the 21 levels, (2/21) times the sum of their pinball losses, which is twice the plain pinball loss of scoringrules and utilsforecast. Components: dispersion, overprediction (observations below the band), underprediction.",
    "observation": "Each target is scored once its series' score_lag_days have passed after its date, against its value as known that day, or as first seen after it when the source had not published it yet. The archive keeps every vintage, so a score never changes.",
    "origins": "A bucket counts a forecast once every day of the bucket it forecasts is scored.",
    "coverage_interval": "Clopper-Pearson, exact, 95%, over the scored days. It assumes independent days, which neighbouring forecasts are not: it is too narrow.",
    "bootstrap": {
        "method": "stationary block bootstrap of the ratio of mean scores, over the forecasts in date order, one mean per forecast and bucket",
        "block_length": {bucket: horizons[-1] for bucket, horizons in BUCKETS.items()},
        "resamples": REPS,
        "seed": SEED,
        "interval": 1 - 2 * TAIL,
    },
    "verdict": "beats when the whole interval of the ratio is below 1, loses when it is above 1, ties otherwise; null, like the ratio, when a baseline has no error",
    "mase_scale": "the mean absolute 7-day change over the last 365 days of each forecast's own context",
    "baselines": {
        "naive": "the last value",
        "snaive7": "the value of the same weekday a week back",
        "mean28": "the mean of the last 28 days",
        "probabilistic_naive": "the last value plus the quantiles of past h-day changes, in both signs, over the last 365 days: the baseline of WIS",
    },
    "weekly": f"The forecasts from each series' record_weekday, the day its live forecasts start from; the squares are the last {SQUARES}, {SQUARE_HORIZON} days ahead.",
    "calibration_monitor": f"Basel's binomial traffic light, in both directions, on the weekly live forecasts, one day per forecast and bucket, the longest, from {MIN_N} forecasts.",
    "trading_days": "A series whose horizon_unit is trading_day (Brent) counts its steps in prices: step h is scored against the h-th price after the reference date, and a week is 5 prices, so its seasonal naive is the price 5 trading days back, its 28-day mean the last 20 prices and its MASE scale the 5-price change; its year, the reach of the MASE scale and the probabilistic naive, is 252 prices.",
}


def scored(
    series: Series,
    archived: list[Archived],
    vintages: pd.DataFrame,
    today: date,
    *,
    latest: bool = False,
) -> pd.DataFrame:
    """Every target of `archived` due by `today`, one row each: its forecast's reference date and mode, the observation and its `as_of`, and the scores.

    A target is due from its scoring day, `scoring.scoreable_on`, and scored against the value known
    that day. The archive is append-only, so that value, and the score, are the same on every later
    run. `latest` scores the same targets against today's vintage instead: the sensitivity check of a
    series that revises. `vintages` are the archive's, as `archive.vintages` reads them.
    shortcut: every archived forecast is scored as one model's; split by `model_id` when MODEL_ID changes.
    shortcut: every run rescores the whole archive, about 45 s for the launch backfill and growing with it;
    keep the scores of past runs outside the archive if a run ever spends minutes here.
    """
    today = pd.Timestamp(today)
    vintages = vintages[vintages["as_of"] <= today]
    # A registered measurement error is blank in the model's input, and no observation to score against.
    errors = set(measurement_errors(series))
    observations, contexts, frames = {}, {}, []
    trading = series.horizon_unit == "trading_day"
    # Brent's days with a price, which its steps are counted in.
    prints = pd.DatetimeIndex(vintages["target_end_date"].unique()).sort_values()
    for issued in archived:
        forecast = issued.forecast
        steps = len(forecast.quantiles)
        # Step h is the h-th price after the reference date, as public-api.md 4.3 scores it: a holiday
        # the calendar did not foresee moves no step onto a day without a price.
        targets = (
            prints[prints > forecast.reference_date][:steps]
            if trading
            else pd.date_range(
                forecast.reference_date + pd.Timedelta(days=1), periods=steps
            )
        )
        for target in targets.difference(list(observations)):
            if scoreable_on(target, series.score_lag) > today or target in errors:
                observations[target] = None
            elif latest:
                observations[target] = known_on(vintages, target, today)
            else:
                observations[target] = settled(vintages, target, series.score_lag)
        # The steps no price has reached yet are not due.
        seen = [observations[target] for target in targets] + [None] * (
            steps - len(targets)
        )
        # Nothing due yet: skipped, which saves most of the work, but for one empty table that keeps the columns.
        if not any(seen) and (frames or issued is not archived[-1]):
            continue
        # The vintage the forecast was made from, never today's: its baselines saw what it saw.
        as_of = issued.provenance["data"]["as_of"]
        if as_of not in contexts:
            contexts[as_of] = archive.view(vintages, as_of)
        rows = score(
            forecast,
            make_context(series, contexts[as_of], forecast.reference_date),
            [np.nan if found is None else found[0] for found in seen],
            kind=series.kind,
            week=5 if trading else 7,
            year=TRADING_YEAR if trading else WINDOW,
        )
        rows.insert(0, "reference_date", forecast.reference_date)
        rows.insert(1, "forecast_mode", issued.provenance["forecast_mode"])
        rows.insert(
            rows.columns.get_loc("observation") + 1,
            "observation_as_of",
            pd.DatetimeIndex([found[1] for found in seen if found is not None]),
        )
        frames.append(rows)
    return pd.concat(frames, ignore_index=True)


def settled(
    vintages: pd.DataFrame, target: pd.Timestamp, lag_days: int
) -> tuple[float, pd.Timestamp] | None:
    """The value `target` is scored against, and its `as_of`: as known on its scoring day, or, if its source had not published it by then, as first seen after.

    The launch backfill's targets were all due before the archive began, so they take its first vintage.
    shortcut: `known_on` scans every vintage row for each target, GPR's 15,000 included; group the rows
    by target date once if runs get slow.
    """
    found = known_on(vintages, target, scoreable_on(target, lag_days))
    if found is None:
        first = vintages.loc[vintages["target_end_date"] == target, "as_of"].min()
        found = None if pd.isna(first) else known_on(vintages, target, first)
    return found


def summary(series: Series, rows: pd.DataFrame, latest: pd.DataFrame) -> dict:
    """The record of `series` for its score file: the live and the retrospective forecasts, never combined, then the same against the latest vintage.

    `rows` and `latest` are what `scored` returns for the same day, without and with `latest`.
    """
    live = _mode(series, rows, "live")
    return {
        "series_id": series.id,
        # The live forecasts resolved 7 days ahead: the page shows the live scores from MIN_N.
        "n": live["n"],
        "min_n_to_display": MIN_N,
        "primary_baseline": series.primary_baseline,
        "score_lag_days": series.score_lag,
        "live": live,
        "retrospective": _mode(series, rows, "retrospective"),
        "latest_vintage": {
            mode: _mode(series, latest, mode) for mode in ("live", "retrospective")
        },
    }


def calibration(series: Series, rows: pd.DataFrame) -> dict[tuple[str, float], str]:
    """The traffic-light zone of the live 5 in 10 and 8 in 10 ranges, per bucket, on the weekly forecasts.

    One day per forecast and bucket, its longest, so that neighbouring hits share as little of their
    future as possible: `traffic_light` counts them as independent. A band is checked from MIN_N
    forecasts on: before, a single miss reads red.
    """
    weekly = rows[
        (rows["forecast_mode"] == "live")
        & (rows["reference_date"].dt.day_of_week == series.record_weekday)
    ]
    zones = {}
    for bucket, horizons in BUCKETS.items():
        hits = weekly[weekly["horizon"] == min(horizons[-1], series.horizon)]
        if horizons[0] > series.horizon or len(hits) < MIN_N:
            continue
        for band in (0.5, 0.8):
            zones[bucket, band] = traffic_light(
                int(hits[f"interval_coverage_{band * 100:.0f}"].sum()), len(hits), band
            )
    return zones


def _mode(series: Series, rows: pd.DataFrame, mode: str) -> dict:
    rows = rows[rows["forecast_mode"] == mode]
    buckets = {
        bucket: _bucket(rows, bucket, min(horizons[-1], series.horizon))
        for bucket, horizons in BUCKETS.items()
        if horizons[0] <= series.horizon
    }
    weekly = rows[
        (rows["horizon"] == SQUARE_HORIZON)
        & (rows["reference_date"].dt.day_of_week == series.record_weekday)
    ].tail(SQUARES)
    return {
        "n": buckets["1-7"]["n"],
        "since": _day(rows["reference_date"].min()),
        # The vintages its targets were scored against, the oldest and the newest.
        "observation_as_of": None
        if rows.empty
        else [
            _day(rows["observation_as_of"].min()),
            _day(rows["observation_as_of"].max()),
        ],
        "buckets": buckets,
        "weekly": [
            {"reference_date": _day(day), "inside_80": bool(inside)}
            for day, inside in zip(
                weekly["reference_date"], weekly["interval_coverage_80"]
            )
        ],
    }


def _bucket(rows: pd.DataFrame, bucket: str, last: int) -> dict:
    """The scores of `bucket`, whose last day for this series is `last`."""
    rows = rows[rows["bucket"] == bucket]
    # Only forecasts with that last day scored, so with every day of the bucket but a registered
    # measurement error: each weighs the same.
    rows = rows[rows.groupby("reference_date")["horizon"].transform("max") == last]
    if rows.empty:
        return {"n": 0}
    # One mean per forecast, in date order, for the bootstrap.
    forecasts = rows.groupby("reference_date").mean(numeric_only=True)

    def against(model: str, baseline: str) -> dict:
        ratio, low, high = bootstrap(
            forecasts[model], forecasts[baseline], block=BUCKETS[bucket][-1]
        )
        return {
            "ratio": _number(ratio),
            "ci": [_number(low), _number(high)],
            "verdict": verdict(low, high),
        }

    def coverage(band: int) -> dict:
        hits, targets = int(rows[f"interval_coverage_{band}"].sum()), len(rows)
        return {
            "hits": hits,
            "targets": targets,
            "rate": _number(hits / targets),
            "ci": [_number(end) for end in clopper_pearson(hits, targets)],
        }

    return {
        "n": len(forecasts),
        "coverage_50": coverage(50),
        "coverage_80": coverage(80),
        "wis": {
            part: _number(rows[part].mean())
            for part in ("wis", "dispersion", "overprediction", "underprediction")
        }
        | {"vs_probabilistic_naive": against("wis", "wis_naive")},
        "ae_median": {
            "mean": _number(rows["ae_median"].mean()),
            "vs": {name: against("ae_median", f"ae_{name}") for name in BASELINES},
        },
        "mase": _number(rows["ase_median"].mean()),
    }


def _number(value) -> float | None:
    """Four decimals, or null where there is no number (JSON has no NaN)."""
    return round(float(value), 4) if np.isfinite(value) else None


def _day(day) -> str | None:
    return None if pd.isna(day) else f"{day:%Y-%m-%d}"
