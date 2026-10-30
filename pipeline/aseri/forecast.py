"""Timestral-209M forecasts, pinned so that every forecast traces back to the exact model that made it."""

import json
import math
from dataclasses import dataclass
from importlib.metadata import distribution
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from timestral import TimestralForecaster

from aseri.series import Series

# A change to any of these is a different model and needs a new MODEL_ID, so track records never mix.
MODEL_ID = "aseri-timestral209m"
WEIGHTS = "mistralai/Timestral-209M"
WEIGHTS_REVISION = "9874d252ab0aae16f7f7c999f98f98d6ad7d8365"
# The pin lives in pyproject.toml; this reads back the commit actually installed.
_installed = json.loads(distribution("timestral").read_text("direct_url.json") or "{}")
PACKAGE_COMMIT = _installed.get("vcs_info", {}).get("commit_id", "unknown")
# Known measurement errors, by series and day: blank in the model's context, never in the actuals or the scores.
# Version-controlled, so a run's code commit pins the register its contexts were built with.
ANOMALIES = pd.read_csv(Path(__file__).with_name("anomalies.csv"), parse_dates=["date"])
# The range each kind of series keeps its quantiles in; 600 alert hours is 25 regions times 24 h.
BOUNDS = {
    "index": (-math.inf, math.inf),
    "count": (0, math.inf),
    "alert_hours": (0, 600),
}


@dataclass(frozen=True)
class Forecast:
    reference_date: pd.Timestamp
    levels: tuple[float, ...]
    # One row per day after the reference date, one column per level.
    quantiles: np.ndarray


def make_context(
    series: Series, vintage: pd.Series, reference_date: pd.Timestamp
) -> pd.Series:
    """The model's input for a forecast from `reference_date`: the vintage up to that day, its registered measurement errors blank.

    The one context builder of the daily run, the backfill and every backtest. Any threshold,
    scale or detector belongs here, computed on this slice, never on the whole vintage.
    """
    context = vintage.loc[:reference_date]
    errors = ANOMALIES.loc[ANOMALIES["series_id"] == series.id, "date"]
    return context.mask(context.index.isin(errors))


def under_review(series: Series, vintage: pd.Series) -> bool:
    """Whether the newest value lies more than `series.edge_iqr` IQRs outside the quartiles of its 28 days before.

    Tukey's fences, on the newest day's own context. Such a value can only be confirmed by the next
    day, so the run forecasts from the day before. Off when `edge_iqr` is None.
    """
    if series.edge_iqr is None or len(vintage) < 29:
        return False
    context = make_context(series, vintage, vintage.index[-1])
    q1, q3 = context.iloc[-29:-1].quantile([0.25, 0.75])
    reach = series.edge_iqr * (q3 - q1)
    last = context.iloc[-1]
    # A flat month gives no scale, so it holds nothing; a blank newest day is a known error, not a suspect.
    return bool(reach > 0 and (last < q1 - reach or last > q3 + reach))


def forecast(model, observed: pd.Series, horizon: int, kind: str = "index") -> Forecast:
    """Quantile forecast of the `horizon` days after the last observation, from the whole history, inside the range of its `kind`."""
    result = model.forecast(observed.to_numpy(), prediction_length=horizon)
    quantiles = result.quantiles[0, 0].numpy()
    if not np.isfinite(quantiles).all():
        raise ValueError("the model returned non-finite quantiles")
    return Forecast(
        reference_date=observed.index[-1],
        levels=tuple(result.quantile_levels),
        # The API promises non-decreasing quantiles: sorted after any offset, then clipped, which keeps
        # the order. Both are no-ops unless the model ever crosses them or leaves the range.
        quantiles=np.clip(np.sort(quantiles, axis=1), *BOUNDS[kind]),
    )


def load_model() -> TimestralForecaster:
    torch.set_num_threads(4)  # the vCPUs of a public-repo ubuntu-latest runner
    return TimestralForecaster.from_pretrained(WEIGHTS, revision=WEIGHTS_REVISION)
