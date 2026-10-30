from statistics import NormalDist

import numpy as np
import pandas as pd
import pytest

from aseri.forecast import Forecast
from aseri.tie import day_to_day_tie

LEVELS = (
    0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5,
    0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99,
)  # fmt: skip
STANDARD = np.array([NormalDist().inv_cdf(level) for level in LEVELS])
START = pd.Timestamp("2026-06-28")


def ar1(rho, forecasts=121, horizon=28, seed=0):
    """One Gaussian AR(1) path of normal scores per forecast, independent of the others."""
    rng = np.random.default_rng(seed)
    z = rng.standard_normal((forecasts, horizon))
    for h in range(1, horizon):
        z[:, h] = rho * z[:, h - 1] + np.sqrt(1 - rho**2) * z[:, h]
    return z


def falling_at(scores, start=START):
    """Daily forecasts from `start` in which a real value of 0 falls at the normal score scores[r, h].

    Each forecast is a standard normal shifted day by day, so every forecast sees its own path
    even though they share the real days.
    """
    return [
        Forecast(
            reference_date=start + pd.Timedelta(days=r),
            levels=LEVELS,
            quantiles=STANDARD[None, :] - z[:, None],
        )
        for r, z in enumerate(scores)
    ]


def zeros(days=400):
    return pd.Series(0.0, index=pd.date_range(START, periods=days, freq="D"))


@pytest.mark.parametrize("rho", [0.5, -0.3])
def test_recovers_the_tie_of_an_ar1(rho):
    tie = day_to_day_tie(falling_at(ar1(rho)), zeros())

    assert tie["n"] == 121 * 27
    assert tie["rho"] == pytest.approx(rho, abs=0.05)


def test_independent_days_have_no_tie():
    tie = day_to_day_tie(falling_at(ar1(0.0)), zeros())

    assert tie["rho"] == pytest.approx(0, abs=0.05)


def test_pairs_only_the_days_already_observed():
    # The real values stop 9 days after the newest forecast was made: its first 8 pairs,
    # and every older forecast's pairs up to that day.
    tie = day_to_day_tie(falling_at(ar1(0.5)), zeros(121 + 9))

    assert tie["n"] == sum(min(27, 128 - r) for r in range(121))


def test_reads_only_the_forecasts_of_the_120_days_to_the_newest():
    # 200 daily forecasts: the 79 oldest fall outside the replay window.
    assert day_to_day_tie(falling_at(ar1(0.5, forecasts=200)), zeros())["n"] == (
        121 * 27
    )


def test_is_zero_below_100_pairs():
    # 3 forecasts give 81 pairs, too few to trust.
    tie = day_to_day_tie(falling_at(ar1(0.9, forecasts=3)), zeros())

    assert tie == {"rho": 0.0, "n": 81}


def test_a_trading_day_series_pairs_each_step_with_the_next_print():
    # Brent prints on weekdays only, and its steps are trading days: by date, every pair
    # that touched a weekend would be lost; by position, none is.
    prints = pd.bdate_range(START, periods=300)
    forecasts = [
        Forecast(
            reference_date=prints[r],
            levels=LEVELS,
            quantiles=STANDARD[None, :] - z[:, None],
        )
        for r, z in enumerate(ar1(0.5, forecasts=85, horizon=14))
    ]

    tie = day_to_day_tie(forecasts, pd.Series(0.0, index=prints))

    assert tie["n"] == 85 * 13
    assert tie["rho"] == pytest.approx(0.5, abs=0.1)
