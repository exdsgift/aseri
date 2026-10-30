"""Timestral-209M forecasts, pinned so that every forecast traces back to the exact model that made it."""

import json
from dataclasses import dataclass
from importlib.metadata import distribution

import numpy as np
import pandas as pd
import torch
from timestral import TimestralForecaster

# A change to any of these is a different model and needs a new MODEL_ID, so track records never mix.
MODEL_ID = "aseri-timestral209m"
WEIGHTS = "mistralai/Timestral-209M"
WEIGHTS_REVISION = "9874d252ab0aae16f7f7c999f98f98d6ad7d8365"
# The pin lives in pyproject.toml; this reads back the commit actually installed.
_installed = json.loads(distribution("timestral").read_text("direct_url.json") or "{}")
PACKAGE_COMMIT = _installed.get("vcs_info", {}).get("commit_id", "unknown")


@dataclass(frozen=True)
class Forecast:
    reference_date: pd.Timestamp
    levels: tuple[float, ...]
    # One row per day after the reference date, one column per level.
    quantiles: np.ndarray


def make_context(vintage: pd.Series, reference_date: pd.Timestamp) -> pd.Series:
    """The model's input for a forecast from `reference_date`: the vintage up to that day.

    The one context builder of the daily run, the backfill and every backtest. Any threshold,
    scale or detector belongs here, computed on this slice, never on the whole vintage.
    """
    return vintage.loc[:reference_date]


def forecast(model, observed: pd.Series, horizon: int) -> Forecast:
    """Quantile forecast of the `horizon` days after the last observation, from the whole history."""
    result = model.forecast(observed.to_numpy(), prediction_length=horizon)
    return Forecast(
        reference_date=observed.index[-1],
        levels=tuple(result.quantile_levels),
        # The API promises non-decreasing quantiles; a no-op unless the model ever crosses them.
        quantiles=np.sort(result.quantiles[0, 0].numpy(), axis=1),
    )


def load_model() -> TimestralForecaster:
    torch.set_num_threads(4)  # the vCPUs of a public-repo ubuntu-latest runner
    return TimestralForecaster.from_pretrained(WEIGHTS, revision=WEIGHTS_REVISION)
