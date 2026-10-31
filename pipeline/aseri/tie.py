"""The day-to-day tie of a series: how its real days moved together within a forecast, which the page's possible paths follow."""

from statistics import NormalDist

import numpy as np
import pandas as pd

from aseri.archive import REPLAY_DAYS
from aseri.forecast import Forecast

# Fewer pairs give too loose a correlation to draw paths with: the days are then drawn independent.
MIN_PAIRS = 100


def day_to_day_tie(
    forecasts: list[Forecast], resolved: pd.Series, trading: bool = False
) -> dict:
    """`rho`, the lag-1 correlation across consecutive horizons of the same forecast of the normal scores of where the real days fell, and `n`, its number of pairs.

    Over the forecasts of the replay window, against `resolved`: each day's value as first observed.
    `rho` is 0 below MIN_PAIRS pairs.
    """
    newest = max(f.reference_date for f in forecasts)
    pairs = np.concatenate(
        [
            np.column_stack([z[:-1], z[1:]])
            for f in forecasts
            if f.reference_date >= newest - pd.Timedelta(days=REPLAY_DAYS)
            for z in [_scores(f, resolved, trading)]
        ]
    )
    pairs = pairs[~np.isnan(pairs).any(axis=1)]
    rho = np.corrcoef(pairs.T)[0, 1] if len(pairs) >= MIN_PAIRS else 0.0
    # nan_to_num: a constant score has no correlation, and JSON has no NaN.
    return {"rho": round(float(np.nan_to_num(rho)), 2), "n": len(pairs)}


def _scores(forecast: Forecast, resolved: pd.Series, trading: bool) -> np.ndarray:
    """The normal score of each real day's PIT in `forecast`, NaN until the day is resolved.

    The PIT reads the day off the quantiles by straight lines, from below and from above, so a value
    on tied quantiles (a count clipped at 0) takes the middle of their levels. Clipped to
    [0.005, 0.995], a day beyond the outer levels keeps a finite score.
    """
    # Step h is day h, a day the vintages lack unknown; for Brent (`trading`) it is the h-th
    # price after the reference date, as it has none on weekends and holidays.
    steps = len(forecast.quantiles)
    if trading:
        after = resolved[resolved.index > forecast.reference_date].to_numpy()[:steps]
        real = np.pad(after, (0, steps - len(after)), constant_values=np.nan)
    else:
        days = pd.date_range(
            forecast.reference_date + pd.Timedelta(days=1), periods=steps, freq="D"
        )
        real = resolved.reindex(days).to_numpy()
    levels = np.asarray(forecast.levels)
    pit = np.array(
        [
            np.interp(y, q, levels, left=0, right=1) / 2
            + np.interp(-y, -q[::-1], levels[::-1], left=1, right=0) / 2
            for y, q in zip(real, forecast.quantiles)
        ]
    )
    normal = NormalDist()
    return np.array(
        [np.nan if np.isnan(p) else normal.inv_cdf(p) for p in pit.clip(0.005, 0.995)]
    )
