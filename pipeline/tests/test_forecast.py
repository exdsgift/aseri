import math
from dataclasses import replace
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest
import torch
from hypothesis import example, given
from hypothesis import strategies as st
from hypothesis.extra.numpy import arrays

from aseri.forecast import forecast, under_review
from aseri.series import GPR_DAILY


class StubModel:
    """Stands in for Timestral: every quantile it forecasts is the length of the context it was given."""

    def forecast(self, context, prediction_length):
        levels = (0.1, 0.5, 0.9)
        shape = (1, 1, prediction_length, len(levels))
        return SimpleNamespace(
            quantiles=torch.full(shape, float(len(context))), quantile_levels=levels
        )


def observed(last_day, days):
    dates = pd.date_range(end=last_day, periods=days, freq="D")
    return pd.Series(range(days), index=dates, dtype=float)


def test_forecasts_from_the_last_observed_date():
    result = forecast(StubModel(), observed("2026-10-26", days=10), horizon=3)

    assert result.reference_date == pd.Timestamp("2026-10-26")


def test_forecasts_every_step_at_every_level_of_the_model():
    result = forecast(StubModel(), observed("2026-10-26", days=10), horizon=3)

    assert result.levels == (0.1, 0.5, 0.9)
    assert result.quantiles.shape == (3, 3)


def test_reads_the_whole_history():
    result = forecast(StubModel(), observed("2026-10-26", days=400), horizon=3)

    assert (result.quantiles == 400).all()


class CrossingModel:
    """Returns a band whose 0.5 quantile sits above its 0.9 quantile."""

    def forecast(self, context, prediction_length):
        crossed = torch.tensor([[[[1.0, 5.0, 3.0]] * prediction_length]])
        return SimpleNamespace(quantiles=crossed, quantile_levels=(0.1, 0.5, 0.9))


def test_quantiles_never_decrease_across_levels():
    result = forecast(CrossingModel(), observed("2026-10-26", days=10), horizon=2)

    assert result.quantiles.tolist() == [[1.0, 3.0, 5.0], [1.0, 3.0, 5.0]]


class RawModel:
    """Returns whatever band it is given, as a model that breaks every promise might."""

    def __init__(self, band):
        self.band = band

    def forecast(self, context, prediction_length):
        levels = tuple(np.linspace(0.1, 0.9, self.band.shape[1]))
        return SimpleNamespace(
            quantiles=torch.tensor(self.band)[None, None], quantile_levels=levels
        )


# Each kind with the range its quantiles must keep: alert hours stop at 25 regions times 24 h.
KINDS = [
    ("index", -math.inf, math.inf),
    ("count", 0, math.inf),
    ("alert_hours", 0, 600),
]


@given(
    band=arrays(
        np.float32,
        st.tuples(st.integers(1, 4), st.integers(1, 5)),
        elements=st.floats(width=32),
    ),
    kind=st.sampled_from(KINDS),
)
@example(band=np.array([[1.0, np.nan, 3.0]], dtype=np.float32), kind=KINDS[1])
def test_published_quantiles_are_finite_ordered_and_inside_the_range_of_their_kind(
    band, kind
):
    name, low, high = kind
    model = RawModel(band)
    if not np.isfinite(band).all():
        with pytest.raises(ValueError, match="non-finite"):
            forecast(model, observed("2026-10-26", days=10), len(band), name)
        return

    quantiles = forecast(
        model, observed("2026-10-26", days=10), len(band), name
    ).quantiles

    assert np.isfinite(quantiles).all()
    assert (np.diff(quantiles, axis=1) >= 0).all()
    assert (quantiles >= low).all() and (quantiles <= high).all()


def ending(last_day, values):
    dates = pd.date_range(end=last_day, periods=len(values), freq="D")
    return pd.Series(values, index=dates, dtype=float)


# 28 days of 280 to 340: quartiles 295 and 325, so 3 IQRs reach from 205 to 415.
MONTH = [280.0, 300.0, 320.0, 340.0] * 7
WITH_EDGE_CHECK = replace(GPR_DAILY, edge_iqr=3.0)


@pytest.mark.parametrize(
    ("last", "held"),
    [(25.0, True), (1000.0, True), (210.0, False), (410.0, False)],
    ids=["a dropout", "a spike", "low but inside", "high but inside"],
)
def test_a_newest_value_more_than_k_iqrs_outside_its_28_days_before_is_under_review(
    last, held
):
    assert under_review(WITH_EDGE_CHECK, ending("2026-10-26", MONTH + [last])) == held


def test_a_flat_month_gives_no_scale_and_holds_nothing():
    assert not under_review(WITH_EDGE_CHECK, ending("2026-10-26", [5.0] * 28 + [9.0]))


def test_the_edge_check_is_off_for_gpr_whose_spikes_are_the_news():
    # The day after 9/11, 725.5, after a month with quartiles of 49 and 64.5, near the real ones.
    month = [40.0, 52.0, 62.0, 72.0] * 7
    assert not under_review(GPR_DAILY, ending("2001-09-12", month + [725.5]))
    assert under_review(
        replace(GPR_DAILY, edge_iqr=3.0), ending("2001-09-12", month + [725.5])
    )
