"""The track record wired to the archive: which targets are scored, against which observation, and what the score files and the monitor say."""

from dataclasses import replace
from datetime import UTC, date, datetime

import numpy as np
import pandas as pd
import pytest

import aseri.forecast as forecast_module
from aseri import archive, record
from aseri.__main__ import SOURCES
from aseri.forecast import Forecast
from aseri.series import BRENT_SPOT, SUEZ_TRANSITS

LEVELS = (
    0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5,
    0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99,
)  # fmt: skip
# Suez: 28 days ahead, and a target waits 14 days for its observation to settle.
SUEZ = SUEZ_TRANSITS


def ships(last_day, days=400):
    """40 to 43 ships, in a 4-day cycle fixed by the date, to `last_day`: any 28 days average 41.5."""
    dates = pd.date_range(end=last_day, periods=days, freq="D")
    return pd.Series(40.0 + (dates - pd.Timestamp("2026-01-01")).days % 4, index=dates)


def around(reference_date, centre):
    """A forecast of `centre` (one value per day ahead) give or take 5 ships, from `reference_date`."""
    centre = np.broadcast_to(np.asarray(centre, dtype=float), SUEZ.horizon)
    return Forecast(
        reference_date=pd.Timestamp(reference_date),
        levels=LEVELS,
        quantiles=centre[:, None] + np.linspace(-5, 5, 21),
    )


def run(archive_dir, forecasts, observed, run_day):
    archive.write(
        archive_dir,
        [archive.SeriesRun(SUEZ, forecasts, observed, run_day, {})],
        code_commit="0" * 40,
        run_url=None,
        generated_at=datetime(run_day.year, run_day.month, run_day.day, 7, tzinfo=UTC),
    )


def scored(archive_dir, today, series=SUEZ, **kwargs):
    return record.scored(
        series,
        archive.read(archive_dir, series.id),
        archive.vintages(archive_dir, series.id),
        pd.Timestamp(today),
        **kwargs,
    )


@pytest.fixture
def first_run(tmp_path):
    """The launch on Oct 26: data to Oct 25, a backfilled forecast from Oct 1 and the live one from Oct 25."""
    run(
        tmp_path,
        [around("2026-10-01", 42.0), around("2026-10-25", 42.0)],
        ships("2026-10-25"),
        date(2026, 10, 26),
    )
    return tmp_path


def test_a_target_is_scored_from_its_score_lag_after_its_date_and_not_before(
    first_run,
):
    on_launch = scored(first_run, "2026-10-26")
    two_weeks_on = scored(first_run, "2026-11-08")

    # Oct 12 plus 14 days is the launch day: Oct 2 to 12 are due, Oct 13 on are not.
    assert on_launch["reference_date"].unique().tolist() == [pd.Timestamp("2026-10-01")]
    assert on_launch["horizon"].tolist() == list(range(1, 12))
    assert (on_launch["forecast_mode"] == "retrospective").all()
    # Two weeks on, every day observed is due: Oct 25 is the last, 24 days ahead. The live
    # forecast's days are not observed yet.
    assert two_weeks_on["horizon"].tolist() == list(range(1, 25))
    # The archive began on Oct 26, after most of these were due: they wait for the first value seen.
    assert (two_weeks_on["observation_as_of"] == pd.Timestamp("2026-10-26")).all()
    assert (
        two_weeks_on["observation"].tolist()
        == ships("2026-10-25")["2026-10-02":].tolist()
    )


def test_a_record_with_nothing_due_yet_summarises_as_empty(tmp_path):
    run(tmp_path, [around("2026-10-25", 42.0)], ships("2026-10-25"), date(2026, 10, 26))
    rows = scored(tmp_path, "2026-10-26")

    summary = record.summary(SUEZ, rows, scored(tmp_path, "2026-10-26", latest=True))

    assert rows.empty
    assert summary["live"] == {
        "n": 0,
        "since": None,
        "observation_as_of": None,
        "buckets": {"1-7": {"n": 0}, "8-28": {"n": 0}},
        "weekly": [],
    }
    assert record.calibration(SUEZ, rows) == {}


def test_a_rerun_on_a_later_day_scores_every_target_it_had_scored_byte_for_byte(
    first_run,
):
    before = scored(first_run, "2026-10-26")

    # A week later upstream revises Oct 5, scored already, Oct 20, not due until Nov 3, and Sep 30, in the
    # history the Oct 1 forecast was made from; and adds the week to Nov 1.
    revised = ships("2026-11-01")
    revised[["2026-09-30", "2026-10-05", "2026-10-20"]] = [7.0, 70.0, 90.0]
    run(first_run, [], revised, date(2026, 11, 3))
    after = scored(first_run, "2026-11-03")
    latest = scored(first_run, "2026-11-03", latest=True)

    keys = ["reference_date", "horizon"]
    again = after.merge(before[keys], on=keys)[before.columns]
    assert again.to_csv(index=False) == before.to_csv(index=False)
    # Oct 20 was due on Nov 3, so the revision seen that day is the value it is scored against.
    oct_20 = after[after["horizon"] == 19].iloc[0]
    assert (oct_20["observation"], oct_20["observation_as_of"]) == (
        90.0,
        pd.Timestamp("2026-11-03"),
    )
    # The latest vintage, the sensitivity check, does see Oct 5's late revision.
    assert latest.loc[latest["horizon"] == 4, "observation"].tolist() == [70.0]
    assert after.loc[after["horizon"] == 4, "observation"].tolist() == [
        ships("2026-10-25")["2026-10-05"]
    ]


def test_live_and_retrospective_forecasts_are_summarised_apart(tmp_path):
    observed = ships("2026-11-01")
    # From Sep 20 to Oct 3, backfilled forecasts 30 ships too high, then a live one that knew the future.
    backfill = [around(day, 72.0) for day in pd.date_range("2026-09-20", "2026-10-03")]
    live = around("2026-10-04", observed["2026-10-05":"2026-11-01"].to_numpy())
    run(tmp_path, [*backfill, live], observed[:"2026-10-04"], date(2026, 10, 5))
    run(tmp_path, [], observed, date(2026, 11, 3))
    rows = scored(tmp_path, "2026-11-03")

    summary = record.summary(SUEZ, rows, scored(tmp_path, "2026-11-03", latest=True))

    live, backtest = summary["live"], summary["retrospective"]
    # Due by Nov 3: the days to Oct 20. The live forecast has its first 16, so the 1-7 bucket only.
    assert summary["n"] == live["n"] == live["buckets"]["1-7"]["n"] == 1
    assert live["buckets"]["8-28"] == {"n": 0}
    assert live["buckets"]["1-7"]["coverage_80"] == {
        "hits": 7,
        "targets": 7,
        "rate": 1.0,
        "ci": [round(0.025 ** (1 / 7), 4), 1.0],
    }
    assert live["buckets"]["1-7"]["wis"]["overprediction"] == 0
    # The 14 backfilled origins all have their first 7 days due; only Sep 20 to 22 their 28th.
    assert backtest["n"] == 14
    assert backtest["buckets"]["8-28"]["n"] == 3
    assert backtest["buckets"]["1-7"]["coverage_80"]["hits"] == 0
    assert backtest["buckets"]["1-7"]["wis"]["underprediction"] == 0
    assert summary["min_n_to_display"] == 30
    assert summary["latest_vintage"]["retrospective"]["n"] == 14


def test_each_series_is_compared_with_its_primary_baseline_chosen_on_the_backtest():
    # Pre-registered for #146: the baseline with the lowest backtest error of each series.
    assert {series.id: series.primary_baseline for series, _ in SOURCES} == {
        "gpr_daily": "mean28",
        "suez_transits": "mean28",
        "hormuz_transits": "naive",
        "bab_el_mandeb_transits": "mean28",
        "taiwan_strait_transits": "mean28",
        "wiki_ww3_views": "naive",
        "brent_spot": "naive",
        "ua_air_raid_hours": "mean28",
        "ua_drones_downed_claimed": "mean28",
    }


def test_a_median_on_the_primary_baseline_ties_it_exactly(tmp_path):
    observed = ships("2026-11-01")
    # The 28-day mean of each origin, as its most likely value for every day ahead.
    forecasts = [
        around(day, observed[:day].iloc[-28:].mean())
        for day in pd.date_range("2026-09-01", "2026-09-30")
    ]
    run(tmp_path, forecasts, observed[:"2026-09-30"], date(2026, 10, 1))
    run(tmp_path, [], observed, date(2026, 11, 3))

    summary = record.summary(
        SUEZ,
        scored(tmp_path, "2026-11-03"),
        scored(tmp_path, "2026-11-03", latest=True),
    )

    assert summary["primary_baseline"] == "mean28"
    against = summary["retrospective"]["buckets"]["1-7"]["ae_median"]["vs"]
    assert against["mean28"] == {"ratio": 1.0, "ci": [1.0, 1.0], "verdict": "ties"}
    assert set(against) == {"naive", "snaive7", "mean28"}


def test_a_ratio_to_a_baseline_with_no_error_has_no_number_and_no_verdict(tmp_path):
    # 40 ships every day: each baseline is exact, and the model one ship high.
    flat = pd.Series(40.0, index=pd.date_range(end="2026-11-01", periods=400))
    forecasts = [around(day, 41.0) for day in pd.date_range("2026-09-01", "2026-09-30")]
    run(tmp_path, forecasts, flat[:"2026-09-30"], date(2026, 10, 1))
    run(tmp_path, [], flat, date(2026, 11, 3))

    bucket = record.summary(
        SUEZ,
        scored(tmp_path, "2026-11-03"),
        scored(tmp_path, "2026-11-03", latest=True),
    )["retrospective"]["buckets"]["1-7"]

    nothing = {"ratio": None, "ci": [None, None], "verdict": None}
    assert bucket["ae_median"]["vs"] == dict.fromkeys(
        ("naive", "snaive7", "mean28"), nothing
    )
    assert bucket["wis"]["vs_probabilistic_naive"] == nothing
    assert bucket["mase"] is None


def test_a_registered_measurement_error_is_never_scored(first_run, monkeypatch):
    monkeypatch.setattr(
        forecast_module,
        "ANOMALIES",
        pd.DataFrame(
            {
                "series_id": ["suez_transits", "another_series"],
                "date": pd.to_datetime(["2026-10-05", "2026-10-06"]),
                "evidence": ["a test entry", "a test entry"],
            }
        ),
    )

    rows = scored(first_run, "2026-11-08")

    # Oct 5, 4 days ahead of Oct 1, is left out; Oct 6 is another series' error.
    assert rows["horizon"].tolist() == [1, 2, 3, *range(5, 25)]


def test_the_record_squares_are_the_last_8_weekly_forecasts_at_7_days_ahead(tmp_path):
    observed = ships("2026-11-15")
    # Every day from Aug 1, each 30 ships too high but on the Sundays of September, Suez's record weekday.
    days = pd.date_range("2026-08-01", "2026-10-31")
    forecasts = [
        around(day, 42.0 if day.month == 9 and day.day_of_week == 6 else 72.0)
        for day in days
    ]
    run(tmp_path, forecasts, observed[:"2026-10-31"], date(2026, 11, 1))
    run(tmp_path, [], observed, date(2026, 11, 16))

    squares = record.summary(
        SUEZ,
        scored(tmp_path, "2026-11-16"),
        scored(tmp_path, "2026-11-16", latest=True),
    )["retrospective"]["weekly"]

    # Due by Nov 16: 7 days ahead of Oct 25 at the latest, the last Sunday.
    assert [s["reference_date"] for s in squares] == [
        "2026-09-06",
        "2026-09-13",
        "2026-09-20",
        "2026-09-27",
        "2026-10-04",
        "2026-10-11",
        "2026-10-18",
        "2026-10-25",
    ]
    assert [s["inside_80"] for s in squares] == [True] * 4 + [False] * 4


def weekly_live(hits_80, hits_50, *, weekday=6, n=30):
    """Rows of `n` weekly live forecasts at 7 and 28 days ahead: the first `hits_80` land in the 8 in 10 range, the first `hits_50` in the 5 in 10."""
    days = pd.date_range("2026-01-04", periods=n, freq="7D") + pd.Timedelta(
        days=(weekday - 6) % 7
    )
    return pd.DataFrame(
        {
            "reference_date": np.repeat(days, 2),
            "forecast_mode": "live",
            "horizon": [7, 28] * n,
            "interval_coverage_80": np.repeat(np.arange(n) < hits_80, 2),
            "interval_coverage_50": np.repeat(np.arange(n) < hits_50, 2),
        }
    )


def test_the_monitor_checks_each_bucket_and_band_of_the_weekly_live_forecasts():
    # 24 and 15 of 30 are what a calibrated forecast gives. Daily origins on other weekdays, and the
    # backtest, miss every time and count for nothing.
    others = weekly_live(0, 0, weekday=2)
    backtest = weekly_live(0, 0).assign(forecast_mode="retrospective")

    zones = record.calibration(SUEZ, pd.concat([weekly_live(24, 15), others, backtest]))

    assert zones == {
        ("1-7", 0.5): "green",
        ("1-7", 0.8): "green",
        ("8-28", 0.5): "green",
        ("8-28", 0.8): "green",
    }


def test_brent_s_steps_are_scored_against_the_prints_after_its_day_in_order(tmp_path):
    # Weekday prints to 2026-10-30 but none on Monday Oct 12, a holiday: the forecast from Friday
    # Oct 9 has its step 1 scored against Tuesday's print, and no step on a weekend.
    prints = pd.bdate_range(end="2026-10-30", periods=80).drop(
        pd.Timestamp("2026-10-12")
    )
    observed = pd.Series(np.arange(len(prints), dtype=float), index=prints)
    from_friday = Forecast(
        reference_date=pd.Timestamp("2026-10-09"),
        levels=LEVELS,
        quantiles=np.zeros((14, 1)) + np.linspace(-5, 5, 21),
    )
    archive.write(
        tmp_path,
        [
            archive.SeriesRun(
                BRENT_SPOT, [from_friday], observed, date(2026, 10, 31), {}
            )
        ],
        code_commit="0" * 40,
        run_url=None,
        generated_at=datetime(2026, 10, 31, 7, tzinfo=UTC),
    )

    rows = scored(tmp_path, "2026-12-01", series=BRENT_SPOT)

    assert rows["horizon"].tolist() == list(range(1, 15))
    assert (
        rows["observation"].tolist()
        == observed[observed.index > "2026-10-09"].iloc[:14].tolist()
    )


def test_the_monitor_turns_red_on_a_band_far_too_narrow_or_far_too_wide():
    assert record.calibration(SUEZ, weekly_live(15, 15))[("1-7", 0.8)] == "red"
    assert record.calibration(SUEZ, weekly_live(30, 30))[("1-7", 0.5)] == "red"


def test_the_monitor_waits_for_30_weekly_forecasts_since_one_miss_alone_reads_red():
    assert record.calibration(SUEZ, weekly_live(0, 0, n=29)) == {}


def test_the_monitor_of_a_14_day_series_checks_its_8_to_14_day_bucket_on_the_14th_day():
    hormuz = replace(SUEZ, horizon=14)
    rows = weekly_live(24, 15).replace({"horizon": {28: 14}})

    assert set(record.calibration(hormuz, rows)) == {
        ("1-7", 0.5),
        ("1-7", 0.8),
        ("8-28", 0.5),
        ("8-28", 0.8),
    }
