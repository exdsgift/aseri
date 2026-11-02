import json
import math
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest
import torch
from hypothesis import example, given
from hypothesis import strategies as st
from hypothesis.extra.numpy import arrays

import aseri.forecast as forecast_module
from aseri.__main__ import SOURCES
from aseri.forecast import forecast, under_review
from aseri.series import GPR_DAILY

# ADR 0001's backtest: every number of its tables.
BACKTEST = (
    Path(__file__).parents[2] / "docs" / "research" / "baselines-calibration.json"
)


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


# The calibration layer of ADR 0001.


def test_the_offsets_are_the_sides_adr_0001_keeps_refitted_on_all_origins():
    results = json.loads(BACKTEST.read_text(encoding="utf-8"))["series"]
    kept = [
        (series_id, bucket, side, sides[side]["offset_all"])
        for series_id, result in results.items()
        for bucket, sides in result["calibration"].items()
        if bucket != "kept_together"
        for side in ("below", "above")
        if sides[side]["keep"]
    ]

    assert list(forecast_module.OFFSETS.itertuples(index=False, name=None)) == kept
    # The owner's decision: Brent's lower side ships, as rule 2 keeps it, and Bab el-Mandeb has none.
    assert ("brent_spot", "1-7", "below", -0.0798) in kept
    assert ("brent_spot", "8-14", "below", -0.0545) in kept
    assert not [row for row in kept if row[0] == "bab_el_mandeb_transits"]


class BandModel:
    """Returns `band`, one row of quantiles at `levels`, on every step."""

    def __init__(self, band, levels=(0.1, 0.5, 0.9)):
        self.band, self.levels = np.asarray(band, dtype=np.float32), levels

    def forecast(self, context, prediction_length):
        steps = np.broadcast_to(self.band, (prediction_length, len(self.band)))
        return SimpleNamespace(
            quantiles=torch.tensor(steps.copy())[None, None],
            quantile_levels=self.levels,
        )


def offsets(rows):
    return pd.DataFrame(rows, columns=["series_id", "bucket", "side", "offset"])


def test_an_offset_of_0_is_the_identity(monkeypatch):
    model = BandModel([90.1, 98.7, 100.2, 104.9, 131.3], (0.1, 0.25, 0.5, 0.75, 0.9))
    raw = forecast(model, observed("2026-10-26", days=10), 14)
    monkeypatch.setattr(
        forecast_module,
        "OFFSETS",
        offsets(
            [
                ("gpr_daily", bucket, side, 0.0)
                for bucket in ("1-7", "8-14")
                for side in ("below", "above")
            ]
        ),
    )

    calibrated = forecast(
        model, observed("2026-10-26", days=10), 14, series_id="gpr_daily"
    )

    assert calibrated.quantiles.tobytes() == raw.quantiles.tobytes()


@given(
    band=arrays(
        np.float32,
        st.integers(3, 7).map(lambda n: 2 * n + 1),
        elements=st.floats(-1e6, 1e6, width=32),
    ),
    below=st.floats(-0.99, 3.0),
    above=st.floats(-0.99, 3.0),
    kind=st.sampled_from(["index", "count", "alert_hours"]),
)
def test_the_median_never_moves_and_the_quantiles_stay_ordered_and_in_range(
    band, below, above, kind
):
    # An ordered band, as the model gives, its median in the middle.
    levels = tuple(np.linspace(0.1, 0.9, len(band)).round(6))
    model = BandModel(np.sort(band), levels)
    table = offsets(
        [
            ("gpr_daily", "1-7", "below", below),
            ("gpr_daily", "8-28", "above", above),
        ]
    )
    raw = forecast(model, observed("2026-10-26", days=10), 28, kind)

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(forecast_module, "OFFSETS", table)
        quantiles = forecast(
            model, observed("2026-10-26", days=10), 28, kind, "gpr_daily"
        ).quantiles

    middle = len(levels) // 2
    assert levels[middle] == 0.5
    assert (quantiles[:, middle] == raw.quantiles[:, middle]).all()
    assert (np.diff(quantiles, axis=1) >= 0).all()
    low, high = forecast_module.BOUNDS[kind]
    assert (quantiles >= low).all() and (quantiles <= high).all()


# A band of 90, 100 and 110 on every step, calibrated: per series, its low and high ends at 1 to 7
# steps, then from step 8. A side's offset d moves its end from the median by 1 + d times as far.
GOLDEN = {
    "gpr_daily": ((90, 110.229), (90, 110.444)),
    "suez_transits": ((90, 110), (90.6, 109.808)),
    "hormuz_transits": ((87.974, 110), (87.658, 109.807)),
    "bab_el_mandeb_transits": ((90, 110), (90, 110)),
    "taiwan_strait_transits": ((89.433, 110), (90.333, 109.479)),
    "wiki_ww3_views": ((89.009, 109.515), (88.03, 113.711)),
    "brent_spot": ((90.798, 110), (90.545, 110)),
    "ua_air_raid_hours": ((91.372, 110), None),
    "ua_drones_downed_claimed": ((89.559, 111.427), None),
}


@pytest.mark.parametrize(
    "series", [series for series, _ in SOURCES], ids=lambda series: series.id
)
def test_each_series_is_calibrated_by_its_own_offsets(series):
    week, later = GOLDEN[series.id]

    result = forecast(
        BandModel([90.0, 100.0, 110.0]),
        observed("2026-10-26", days=10),
        series.horizon,
        series.kind,
        series.id,
    )

    expected = [
        (low, 100, high)
        for step in range(1, series.horizon + 1)
        for low, high in [week if step <= 7 else later]
    ]
    np.testing.assert_allclose(result.quantiles, expected, rtol=0, atol=1e-9)
