import numpy as np
import pandas as pd
import pytest
from hypothesis import given
from hypothesis import strategies as st
from hypothesis.extra.numpy import arrays

from aseri.forecast import Forecast
from aseri.scoring import (
    BUCKETS,
    LAG_DAYS,
    bootstrap,
    clopper_pearson,
    inside,
    known_on,
    probabilistic_naive,
    score,
    scoreable_on,
    traffic_light,
    verdict,
    wis,
)

# Timestral's 21 levels.
LEVELS = (0.01, 0.05, *np.round(np.arange(0.1, 0.91, 0.05), 2).tolist(), 0.95, 0.99)


def test_wis_matches_the_scoringutils_documented_example():
    # The example of scoringutils' wis(), version 2.3.0:
    # https://epiforecasts.io/scoringutils/reference/wis.html
    observed = np.array([1.0, -15.0, 22.0])
    predicted = np.array([[-1, 0, 1, 2, 3], [-2, 1, 2, 2, 4], [-2, 0, 3, 3, 4]])

    scores = wis(predicted, observed, (0.1, 0.25, 0.5, 0.75, 0.9))

    np.testing.assert_allclose(scores["wis"], [0.36, 15.34, 19.14])


def test_wis_components_of_the_scoringutils_example_by_hand():
    # Each sums the intervals' terms, then divides by K + 1/2 = 2.5. The second observation lies 13 below
    # the 80% band, 16 below the 50% band and 17 below the median: the forecast was too high.
    observed = np.array([1.0, -15.0, 22.0])
    predicted = np.array([[-1, 0, 1, 2, 3], [-2, 1, 2, 2, 4], [-2, 0, 3, 3, 4]])

    scores = wis(predicted, observed, (0.1, 0.25, 0.5, 0.75, 0.9))

    np.testing.assert_allclose(
        scores["dispersion"], [(0.1 * 4 + 0.25 * 2) / 2.5, 0.85 / 2.5, 1.35 / 2.5]
    )
    np.testing.assert_allclose(
        scores["overprediction"], [0, (13 + 16 + 0.5 * 17) / 2.5, 0]
    )
    np.testing.assert_allclose(
        scores["underprediction"], [0, 0, (18 + 19 + 0.5 * 19) / 2.5]
    )


@given(
    quantiles=arrays(np.float64, (4, 21), elements=st.floats(-1e6, 1e6)),
    observed=arrays(np.float64, 4, elements=st.floats(-1e6, 1e6)),
)
def test_wis_in_interval_form_is_twice_the_mean_pinball_loss(quantiles, observed):
    y = observed[:, None]
    pinball = ((y < quantiles) - np.array(LEVELS)) * (quantiles - y)

    np.testing.assert_allclose(
        wis(quantiles, observed, LEVELS)["wis"],
        2 * pinball.mean(axis=1),
        rtol=1e-9,
        atol=1e-6,
    )


def test_a_point_forecast_scores_its_absolute_error():
    quantiles = np.full((2, 21), 10.0)

    scores = wis(quantiles, np.array([13.5, 8.0]), LEVELS)

    np.testing.assert_allclose(scores["wis"], [3.5, 2.0])


def test_wis_refuses_levels_without_a_median_in_the_middle():
    with pytest.raises(ValueError, match="symmetric"):
        wis(np.zeros((1, 3)), np.zeros(1), (0.1, 0.6, 0.9))


def test_an_observation_on_the_bound_of_a_band_counts_as_inside():
    quantiles = np.array(
        [np.arange(21.0)] * 3
    )  # the 0.1 level is 2, the 0.9 level is 18
    observed = np.array([2.0, 18.0, 18.5])

    assert inside(quantiles, observed, LEVELS, 0.8).tolist() == [True, True, False]
    assert inside(quantiles, observed, LEVELS, 0.5).tolist() == [False, False, False]


def test_the_exact_interval_of_no_hits_and_of_all_hits_has_a_closed_form():
    assert clopper_pearson(0, 10) == pytest.approx((0, 1 - 0.025 ** (1 / 10)))
    assert clopper_pearson(10, 10) == pytest.approx((0.025 ** (1 / 10), 1))


def test_eighty_percent_of_thirty_cannot_be_told_from_sixty_or_ninety():
    # The research's own table: 0.61 to 0.92.
    low, high = clopper_pearson(24, 30)

    assert (round(low, 2), round(high, 2)) == (0.61, 0.92)


def test_scores_a_forecast_at_every_observed_horizon_against_its_baselines():
    history = np.arange(1.0, 36.0)  # 1 to 35, up one a day
    observed = np.r_[
        36.0:44.0, np.nan
    ]  # the trend goes on; the ninth day is not observed yet
    # A point forecast that is always one short.
    stub = Forecast(
        reference_date=pd.Timestamp("2026-10-26"),
        levels=LEVELS,
        quantiles=np.repeat(observed[:, None] - 1, 21, axis=1),
    )

    rows = score(stub, history, observed)

    assert rows["horizon"].tolist() == [1, 2, 3, 4, 5, 6, 7, 8]
    assert rows["bucket"].tolist() == ["1-7"] * 7 + ["8-28"]
    assert rows["ae_median"].tolist() == [1.0] * 8
    assert rows["wis"].tolist() == [1.0] * 8
    assert rows["ae_naive"].tolist() == [1, 2, 3, 4, 5, 6, 7, 8]
    # The same weekday a week back: 7 short on this trend, 14 at day 8.
    assert rows["ae_snaive7"].tolist() == [7.0] * 7 + [14.0]
    # The mean of 8 to 35 is 21.5.
    assert rows["ae_mean28"].tolist() == [13.5 + h for h in range(1, 9)]
    # Every day is 7 above the same weekday before it, so the MASE scale is 7.
    assert rows["ase_median"].tolist() == [1 / 7] * 8
    assert rows["interval_coverage_80"].tolist() == [False] * 8


def test_the_probabilistic_naive_spreads_the_past_changes_both_ways_around_the_last_value():
    # Every h-day change of a steady climb is h, so the spread is h either side.
    quantiles = probabilistic_naive(np.arange(1.0, 36.0), LEVELS, horizon=3)

    for h, row in enumerate(quantiles, start=1):
        assert row.tolist() == [35.0 - h] * 10 + [35.0] + [35.0 + h] * 10


def test_the_probabilistic_naive_of_a_count_stays_at_zero_or_above():
    quantiles = probabilistic_naive([2.0, 0.0] * 20, LEVELS, horizon=1, kind="count")

    assert quantiles[0].tolist() == [0.0] * 11 + [2.0] * 10


def test_a_stub_that_forecasts_the_naive_baseline_scores_exactly_1_against_it():
    walk = 100 + np.random.default_rng(0).normal(size=500).cumsum()
    per_origin = []
    for origin in range(400, 460):
        history, observed = walk[: origin + 1], walk[origin + 1 : origin + 8]
        stub = Forecast(
            reference_date=pd.Timestamp("2026-01-01") + pd.Timedelta(days=origin),
            levels=LEVELS,
            quantiles=probabilistic_naive(history, LEVELS, horizon=7),
        )
        per_origin.append(score(stub, history, observed).mean(numeric_only=True))
    means = pd.DataFrame(per_origin)

    block = BUCKETS["1-7"][-1]
    assert bootstrap(means["wis"], means["wis_naive"], block=block) == (1, 1, 1)
    assert bootstrap(means["ae_median"], means["ae_naive"], block=block) == (1, 1, 1)


def test_a_model_with_half_the_baselines_every_score_beats_it():
    baseline = np.random.default_rng(1).gamma(2, size=60)

    estimate, low, high = bootstrap(0.5 * baseline, baseline, block=7)

    assert (estimate, low, high) == (0.5, 0.5, 0.5)
    assert verdict(low, high) == "beats"


def test_the_bootstrap_is_seeded_so_a_rerun_publishes_the_same_interval():
    scores = np.random.default_rng(2).gamma(2, size=60)

    assert bootstrap(scores, block=7) == bootstrap(scores, block=7)


def test_with_blocks_longer_than_the_record_each_resample_is_the_record_shifted():
    assert bootstrap(np.arange(10.0), block=10**9) == (4.5, 4.5, 4.5)


def test_a_longer_block_widens_the_interval_on_overlapping_origins():
    # Neighbouring origins share most of their future, so their scores move together.
    noise = np.random.default_rng(3).normal(size=200)
    scores = np.empty(200)
    scores[0] = noise[0]
    for t in range(1, 200):
        scores[t] = 0.9 * scores[t - 1] + noise[t]
    scores += 10

    _, low_1, high_1 = bootstrap(scores, block=1)
    _, low_28, high_28 = bootstrap(scores, block=28)

    assert high_28 - low_28 > 1.5 * (high_1 - low_1)


@pytest.mark.parametrize(
    ("low", "high", "said"),
    [
        (0.7, 0.95, "beats"),
        (0.8, 1.1, "ties"),
        (0.9, 1.0, "ties"),
        (1.0, 1.2, "ties"),
        (1.02, 1.3, "loses"),
    ],
)
def test_the_page_says_beats_or_loses_only_when_the_whole_interval_does(
    low, high, said
):
    assert verdict(low, high) == said


@pytest.mark.parametrize(
    ("series_id", "scored"),
    [
        ("gpr_daily", "2026-11-23"),
        ("suez_transits", "2026-11-02"),
        ("taiwan_strait_transits", "2026-11-02"),
        ("brent_spot", "2026-10-26"),
        ("ua_air_raid_hours", "2026-10-26"),
    ],
)
def test_a_target_is_scored_its_series_lag_after_its_date(series_id, scored):
    assert scoreable_on("2026-10-19", LAG_DAYS[series_id]) == pd.Timestamp(scored)


# GPR's 2026-10-19 as three runs saw it: first released, revised a week later (the research's real
# example), and revised again long after the score was frozen.
VINTAGES = pd.DataFrame(
    {
        "target_end_date": pd.to_datetime(["2026-10-19", "2026-10-19", "2026-10-19"]),
        "observation": [248.7, 220.8, 231.0],
        "as_of": pd.to_datetime(["2026-10-20", "2026-10-27", "2027-01-11"]),
    }
)


def test_a_target_is_scored_against_the_vintage_known_on_its_scoring_day():
    day = scoreable_on("2026-10-19", LAG_DAYS["gpr_daily"])

    assert known_on(VINTAGES, "2026-10-19", day) == (
        220.8,
        pd.Timestamp("2026-10-27"),
    )


def test_a_frozen_score_ignores_every_vintage_after_its_scoring_day():
    day = scoreable_on("2026-10-19", LAG_DAYS["gpr_daily"])

    assert known_on(VINTAGES.iloc[:2], "2026-10-19", day) == known_on(
        VINTAGES, "2026-10-19", day
    )


def test_a_target_nobody_had_observed_yet_has_no_observation():
    assert known_on(VINTAGES, "2026-10-19", pd.Timestamp("2026-10-19")) is None
    assert known_on(VINTAGES, "2026-10-20", pd.Timestamp("2026-12-31")) is None


@pytest.mark.parametrize("misses", range(13))
def test_reproduces_the_basel_cutoffs_on_250_days_of_a_99_percent_band(misses):
    # https://www.mathworks.com/help/risk/overview-of-var-backtesting.html: green 0 to 4, yellow 5 to 9, red 10 up.
    hits = np.arange(250) >= misses  # synthetic: the first `misses` days fall outside
    zone = "green" if misses <= 4 else "yellow" if misses <= 9 else "red"

    assert traffic_light(int(hits.sum()), len(hits), 0.99) == zone


@pytest.mark.parametrize(
    ("hits", "n", "zone"),
    [
        (200, 250, "green"),
        (160, 250, "red"),  # far too narrow
        (250, 250, "red"),  # far too wide
        (10, 10, "green"),  # likely: 0.8 to the 10th is 0.11
        (30, 30, "yellow"),  # 0.8 to the 30th is 0.001
    ],
)
def test_the_80_percent_band_is_checked_in_both_directions(hits, n, zone):
    assert traffic_light(hits, n, 0.8) == zone
