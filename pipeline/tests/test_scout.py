import copy
import re
from datetime import date
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest
import torch
from hypothesis import given
from hypothesis import strategies as st
from scipy.stats import binom

import aseri.forecast as forecast_module
from aseri import scout
from aseri.forecast import MODEL_ID
from aseri.scout import (
    CONFIG,
    SERIES,
    acceptance_region,
    buckets,
    cached,
    calendar,
    check,
    failures,
    hold_back,
    judge,
    main,
    model_id,
    origins,
    past_row,
    report,
    run,
)

# Timestral's 21 levels.
LEVELS = (0.01, 0.05, *np.round(np.arange(0.1, 0.91, 0.05), 2).tolist(), 0.95, 0.99)
# Hubverse's model_id: team_abbr-model_abbr, each part at most 16 letters, digits, "_" or "+".
HUBVERSE = re.compile(r"([A-Za-z0-9_+]{1,16})-([A-Za-z0-9_+]{1,16})")
RULE = CONFIG["rule"]
FEWEST = CONFIG["fewest_lag"]


# The keep rule


def test_buckets_are_those_the_series_has():
    assert buckets(SERIES["gpr_daily"]) == {"1-7": range(1, 8), "8-28": range(8, 29)}
    assert buckets(SERIES["hormuz_transits"]) == {
        "1-7": range(1, 8),
        "8-14": range(8, 15),
    }
    assert buckets(SERIES["ua_air_raid_hours"]) == {"1-7": range(1, 8)}


def test_a_bucket_passes_only_when_every_part_of_the_rule_holds():
    # 52 origins: the 8 in 10 range's region at 5% is 36 to 47 hits, 0.69 to 0.90.
    good = {
        "wql": (0.95, 0.92, 0.99),
        "mase": 0.97,
        "coverage": 0.80,
        "origins": 52,
        "region": (36, 47),
    }

    assert failures(**good, rule=RULE) == []
    assert failures(**good | {"wql": (0.981, 0.95, 0.99)}, rule=RULE) == [
        "WQL under 2% better"
    ]
    assert failures(**good | {"wql": (0.95, 0.90, 1.0)}, rule=RULE) == [
        "its 90% interval reaches 0"
    ]
    assert failures(**good | {"mase": 1.001}, rule=RULE) == ["MASE worse"]
    assert failures(**good | {"coverage": 0.65}, rule=RULE) == [
        "8 in 10 coverage outside its region"
    ]
    assert failures(**good | {"coverage": 0.95}, rule=RULE) == [
        "8 in 10 coverage outside its region"
    ]


def test_a_bucket_with_no_number_fails_rather_than_passes():
    # A flat history gives no MASE scale, and an empty bucket no ratio: neither may pass for a gain.
    nan = float("nan")

    assert failures((nan, nan, nan), nan, nan, 52, (36, 47), RULE) == [
        "WQL under 2% better",
        "its 90% interval reaches 0",
        "MASE worse",
        "8 in 10 coverage outside its region",
    ]
    # A bucket no origin scores has nothing to judge: it fails for that alone.
    assert failures((nan, nan, nan), nan, nan, 0, (0, 0), RULE) == [
        "no scored target in this bucket"
    ]


def test_an_empty_bucket_fails_and_reports_without_a_crash():
    # Hormuz's days 8-14 all unscored: nothing to bootstrap, nothing to divide by.
    cells = pd.DataFrame(
        {
            "reference_date": pd.Timestamp("2026-10-04"),
            "horizon": range(1, 8),
            "wis": 2.0,
            "ase_median": 0.5,
            "interval_coverage_80": True,
        }
    )

    judged = judge(cells, cells, SERIES["hormuz_transits"], RULE)

    late = judged[1]
    assert (late["bucket"], late["origins"], late["failures"]) == (
        "8-14",
        0,
        ["no scored target in this bucket"],
    )
    results = {
        "hormuz_transits": {
            "origins": [pd.Timestamp("2026-10-04")],
            "as_of": pd.Timestamp("2026-11-02"),
            "candidates": [
                {"name": "dow", "members": ["dow"], "buckets": judged, "passed": False}
            ],
        }
    }
    runtime = {"made": 2, "cached": 0, "seconds": 1.0}
    text = report(date(2026, 11, 3), results, CONFIG, runtime)
    assert (
        "| dow | dow | 8-14 | 0 | - | - | - | fails: no scored target in this bucket |"
        in text
    )


@given(
    n=st.integers(1, 600),
    p=st.sampled_from([0.5, 0.8, 0.9]),
    alpha=st.sampled_from([0.01, 0.05, 0.1]),
)
def test_the_coverage_region_is_the_binomial_one_for_the_actual_n(n, p, alpha):
    assert acceptance_region(n, p, alpha) == (
        binom.ppf(alpha / 2, n, p),
        binom.ppf(1 - alpha / 2, n, p),
    )


def test_the_coverage_region_widens_as_origins_get_fewer():
    # The spec's fixed 0.70 to 0.90 fits about 52 origins; 26 need a wider band, 104 a narrower one.
    def share(n):
        low, high = acceptance_region(n, 0.8, 0.05)
        return low / n, high / n

    assert share(26) == pytest.approx((0.654, 0.923), abs=1e-3)
    assert share(104) == pytest.approx((0.721, 0.875), abs=1e-3)


# No leakage: a covariate value is used only once the daily run would have it


def test_a_past_covariate_is_held_back_by_its_lag_against_the_targets_freshest():
    # Brent is up to 8 days old at a run, a PortWatch lane as fresh as 3: 5 days are not out yet.
    assert hold_back(SERIES["brent_spot"], SERIES["hormuz_transits"], FEWEST) == 5
    # GPR is up to 8 days old, the views as fresh as 1.
    assert hold_back(SERIES["gpr_daily"], SERIES["wiki_ww3_views"], FEWEST) == 7
    # A fresher covariate than its target is still never read past the target's last day.
    assert hold_back(SERIES["wiki_ww3_views"], SERIES["gpr_daily"], FEWEST) == 0


def test_the_hold_back_follows_the_runs_config():
    # Were Hormuz forecast the day its data ends, Brent's whole 8-day lag would be held back.
    fewest = FEWEST | {"hormuz_transits": 0}
    target = SERIES["hormuz_transits"]
    context = pd.Series(1.0, pd.date_range("2026-01-01", "2026-10-29", freq="D"))
    future = target.target_dates(context.index, target.horizon)

    rows = scout.covariates(
        ["brent_spot"], target, context, future, {"brent_spot": context}, fewest
    )

    assert hold_back(SERIES["brent_spot"], target, fewest) == 8
    assert np.isnan(rows["past_covariates"][0, 0, -8:]).all()
    assert rows["past_covariates"][0, 0, -9] == 1


def test_one_fetch_brings_both_lanes_so_nothing_is_held_back():
    lanes = SERIES["bab_el_mandeb_transits"], SERIES["suez_transits"]
    assert hold_back(*lanes, FEWEST) == 0


def test_a_past_row_blanks_what_is_not_yet_published_and_reads_no_later_value():
    # The covariate is the day of the month, defined from Dec 30 to Jan 8, Jan 3 missing.
    values = pd.Series(
        np.r_[30.0, 31.0, np.arange(1, 9.0)],
        pd.date_range("2019-12-30", periods=10, freq="D"),
    ).drop(pd.Timestamp("2020-01-03"))
    context = pd.date_range("2020-01-01", periods=6, freq="D")

    np.testing.assert_array_equal(
        past_row(values, context, held=2), [1, 2, np.nan, 4, np.nan, np.nan]
    )
    # Lagged by 3: each day reads the value of 3 days before, and still none past Jan 4.
    np.testing.assert_array_equal(
        past_row(values, context, held=2, lag=3),
        [np.nan, 30, 31, 1, 2, np.nan],
    )
    # A context past the covariate's end is blank there, never filled with a later value.
    later = pd.date_range("2020-01-05", periods=6, freq="D")
    assert np.isnan(past_row(values, later, held=0)[-1])


@given(
    end=st.integers(0, 400),
    length=st.integers(1, 60),
    held=st.integers(0, 15),
    lag=st.integers(0, 30),
)
def test_no_past_row_ever_holds_a_value_dated_after_its_cutoff(end, length, held, lag):
    # The leak canary: each value is its own date as a day number, so any value read from a day past
    # the cutoff would show as a number above it.
    days = pd.date_range("2024-01-01", periods=500, freq="D")
    future = pd.Series(np.arange(len(days), dtype=float), days)
    context = days[max(0, end - length + 1) : end + 1]
    cutoff = end - held

    row = past_row(future, context, held, lag)

    assert len(row) == len(context)
    assert not (row[np.isfinite(row)] > cutoff).any()


def test_calendar_rows_are_pure_functions_of_the_date():
    days = pd.date_range("2026-02-14", periods=12, freq="D")

    # Lunar New Year 2026 is Feb 17: its eve to day +6, Feb 16 to 23.
    np.testing.assert_array_equal(
        calendar("lny", days), [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0]
    )
    # 2026-02-14 is a Saturday, Monday 0.
    assert calendar("dow", days)[:3].tolist() == [5, 6, 0]
    assert calendar(
        "gw", pd.DatetimeIndex(["2026-09-30", "2026-10-01", "2026-10-07", "2026-10-08"])
    ).tolist() == [0, 1, 1, 0]
    assert calendar(
        "xmas",
        pd.DatetimeIndex(["2025-12-23", "2025-12-24", "2026-01-01", "2026-01-02"]),
    ).tolist() == [0, 1, 1, 0]
    # Outside the years of the Lunar New Year table the row is unknown, never a wrong 0.
    assert np.isnan(calendar("lny", pd.DatetimeIndex(["2014-02-01"]))).all()


def test_a_candidates_rows_cover_the_context_and_known_ones_the_horizon_too():
    target = SERIES["taiwan_strait_transits"]
    days = pd.date_range("2025-01-01", "2026-02-10", freq="D")
    observed = {
        target.id: pd.Series(100.0, days),
        "suez_transits": pd.Series(np.arange(len(days), dtype=float), days),
    }
    context = observed[target.id]
    future = target.target_dates(context.index, target.horizon)

    rows = scout.covariates(
        ["dow", "lny@7", "suez_transits@2"], target, context, future, observed, FEWEST
    )

    assert rows["past_covariates"].shape == (1, 1, len(context))
    assert rows["known_covariates"].shape == (1, 1, len(context) + 28)
    assert rows["categorical_known_covariates"].shape == (1, 1, len(context) + 28)
    # Lunar New Year 2026 lagged a week: Feb 23 to Mar 2, inside the horizon.
    lny = pd.Series(rows["known_covariates"][0, 0], context.index.append(future))
    assert lny["2026-02-22"] == 0 and lny["2026-02-23"] == 1 and lny["2026-03-02"] == 1
    # The same source, so no hold-back: lagged 2 days, its last value is that of 2 days before the last.
    assert rows["past_covariates"][0, 0, -1] == len(days) - 3


def test_an_origin_waits_until_its_every_target_is_settled():
    # Suez: 28 steps, each scored 14 days after its day. Data to Oct 29, the archive's vintage of Oct 30.
    suez = SERIES["suez_transits"]
    y = pd.Series(1.0, pd.date_range("2026-01-01", "2026-10-29", freq="D"))

    # From Sunday Sep 13 the last target, Oct 11, settles on Oct 25; from Sep 20 not before Nov 1.
    assert origins(suez, y, 2, pd.Timestamp("2026-10-30")) == [
        pd.Timestamp("2026-09-06"),
        pd.Timestamp("2026-09-13"),
    ]
    # A month on, with no newer data, every target is settled: the data's end is the limit.
    assert origins(suez, y, 1, pd.Timestamp("2026-11-30")) == [
        pd.Timestamp("2026-09-27")
    ]


# The config, checked at import


def test_the_config_names_only_known_series_calendars_and_short_tags():
    def broken(change):
        config = copy.deepcopy(CONFIG)
        change(config)
        with pytest.raises(ValueError):
            check(config)

    check(CONFIG)
    broken(lambda c: c["candidates"]["suez_transits"].update(bem=["nowhere"]))
    # A series as its own covariate is the target itself, not a covariate.
    broken(lambda c: c["candidates"]["suez_transits"].update(bem=["suez_transits"]))
    broken(lambda c: c["candidates"]["suez_transits"].update(toolong=["dow"]))
    broken(lambda c: c["candidates"]["suez_transits"].update(bem=["dow@-1"]))
    broken(
        lambda c: c["candidates"]["suez_transits"].update(
            bem=["dow", "lny", "gw", "xmas"]
        )
    )
    broken(lambda c: c["candidates"]["suez_transits"].update(a=["dow"], b=["lny"]))
    broken(lambda c: c["enabled"].update(suez_transits="nosuch"))
    broken(lambda c: c["rule"].update(wql_ratio=1.02))


# The model ID


def test_nothing_is_enabled_so_every_series_keeps_the_model_id():
    # Enabling a covariate needs the daily job to feed it and to archive under scout.model_id, which it
    # does not yet: wire both before you enable one.
    assert CONFIG["enabled"] == {}
    assert {model_id(id) for id in SERIES} == {MODEL_ID}


def test_enabling_a_covariate_gives_the_series_a_model_id_of_its_own():
    enabled = {"taiwan_strait_transits": "lny"}

    assert model_id("taiwan_strait_transits", enabled) == "aseri-ts209m_c1_lny"
    assert model_id("suez_transits", enabled) == MODEL_ID


def test_every_candidates_model_id_fits_hubverse():
    ids = [
        model_id(series, {series: name})
        for series, candidates in CONFIG["candidates"].items()
        for name in candidates
    ]

    assert HUBVERSE.fullmatch(MODEL_ID)
    for id in ids:
        assert HUBVERSE.fullmatch(id), id
    # The longest tag the config allows fills the model part exactly.
    assert len(model_id("gpr_daily", {"gpr_daily": "abcdef"}).split("-")[1]) == 16


# The cache


def test_a_changed_offset_misses_the_cache(tmp_path, monkeypatch):
    model = StubModel()
    suez = SERIES["suez_transits"]
    context = pd.Series(100.0, pd.date_range("2026-01-01", "2026-09-13", freq="D"))

    def made():
        return cached(lambda: model, context, suez, {}, tmp_path)[1] is not None

    assert made()
    assert not made()
    offsets = forecast_module.OFFSETS.copy()
    offsets.loc[offsets["series_id"] == "suez_transits", "offset"] += 0.1
    monkeypatch.setattr(forecast_module, "OFFSETS", offsets)
    assert made()
    assert model.calls == 2


# The command line


@pytest.mark.parametrize(
    "flags",
    [["--series", "nosuch"], ["--candidates", "nosuch"], ["--origins", "0"]],
)
def test_the_command_line_refuses_what_would_test_nothing(flags, tmp_path, capsys):
    with pytest.raises(SystemExit) as stop:
        main([str(tmp_path / "a"), str(tmp_path / "r"), str(tmp_path / "c"), *flags])

    assert stop.value.code == 2
    assert "error:" in capsys.readouterr().err


# The report


def bucket(name, wql, failed=()):
    return {
        "bucket": name,
        "origins": 26,
        "wql": wql,
        "mase": 0.99,
        "coverage": 0.81,
        "region": (17, 24),
        "failures": list(failed),
    }


def test_the_report_gives_every_candidate_its_numbers_and_verdict():
    results = {
        "taiwan_strait_transits": {
            "origins": [pd.Timestamp("2026-04-12"), pd.Timestamp("2026-10-04")],
            "as_of": pd.Timestamp("2026-11-02"),
            "candidates": [
                {
                    "name": "lny",
                    "members": ["lny"],
                    "buckets": [
                        bucket("1-7", (0.97, 0.95, 0.99)),
                        bucket("8-28", (0.96, 0.93, 0.99)),
                    ],
                    "passed": True,
                },
                {
                    "name": "dowlny",
                    "members": ["dow", "lny"],
                    "buckets": [
                        bucket("1-7", (1.004, 0.99, 1.02), ["WQL under 2% better"]),
                        bucket("8-28", (0.96, 0.93, 0.99)),
                    ],
                    "passed": False,
                },
            ],
        }
    }
    runtime = {"made": 30, "cached": 48, "seconds": 61.0}

    text = report(date(2026, 11, 3), results, CONFIG, runtime)

    assert text.startswith("# Covariate scout, 2026-11-03\n")
    assert "**Passed: taiwan_strait_transits `lny`.**" in text
    assert "the archive's newest vintage, of 2026-11-02" in text
    assert "Origins: 2, 2026-04-12 to 2026-10-04, on its vintage of 2026-11-02." in text
    assert (
        "| lny | lny | 1-7 | 26 | -3.0% [-5.0, -1.0] | -1.0% | 0.81 (0.65 to 0.92) | passes |"
        in text
    )
    assert (
        "| dowlny | dow, lny | 1-7 | 26 | +0.4% [-1.0, +2.0] | -1.0% | 0.81 (0.65 to 0.92) | fails: WQL under 2% better |"
        in text
    )
    assert "| dowlny | dow, lny | 8-28 |" in text
    assert "30 forecasts made, 48 from the cache, 61 s of model time" in text
    assert "—" not in text and "–" not in text


def test_a_report_with_no_pass_says_so():
    results = {
        "gpr_daily": {
            "origins": [pd.Timestamp("2026-10-05")],
            "as_of": pd.Timestamp("2026-11-02"),
            "candidates": [
                {
                    "name": "xmas",
                    "members": ["xmas"],
                    "buckets": [bucket("1-7", (1.0, 0.99, 1.01), ["MASE worse"])],
                    "passed": False,
                }
            ],
        }
    }

    text = report(
        date(2026, 11, 3),
        results,
        CONFIG,
        {"made": 2, "cached": 0, "seconds": 4.0},
    )

    assert "**Passed: none.** The daily forecasts stay univariate." in text


# End to end, on a stub model


class StubModel:
    """Stands in for Timestral: a band around 110 without covariates, around the true 100 with any."""

    def __init__(self):
        self.calls = 0

    def forecast(self, context, prediction_length, **covariates):
        self.calls += 1
        z = np.array([-2.33, -1.64, *np.linspace(-1.28, 1.28, 17), 1.64, 2.33])
        centre = 100.0 if covariates else 110.0
        quantiles = np.broadcast_to(centre + 5 * z, (1, 1, prediction_length, 21))
        return SimpleNamespace(
            quantiles=torch.tensor(quantiles.copy()), quantile_levels=LEVELS
        )


def archive_of(tmp_path, values: dict[str, pd.Series]):
    deltas = tmp_path / "archive" / "target-data" / "deltas"
    deltas.mkdir(parents=True)
    pd.concat(
        pd.DataFrame(
            {
                "target": id,
                "target_end_date": s.index.strftime("%Y-%m-%d"),
                "observation": s.to_numpy(),
                "as_of": "2026-10-30",
            }
        )
        for id, s in values.items()
    ).to_csv(deltas / "2026-10-30.csv", index=False)
    return tmp_path / "archive"


def test_a_run_reports_proposes_and_reuses_its_cache(tmp_path):
    days = pd.date_range("2024-01-01", "2026-10-29", freq="D")
    noise = np.random.default_rng(0).normal(0, 5, len(days))
    archive_dir = archive_of(
        tmp_path,
        {
            "bab_el_mandeb_transits": pd.Series(100 + noise, days),
            "suez_transits": pd.Series(100 + noise[::-1], days),
        },
    )
    before = sorted(p.as_posix() for p in archive_dir.rglob("*"))
    config = copy.deepcopy(CONFIG)
    config["run"]["origins"] = 6
    config["candidates"] = {"bab_el_mandeb_transits": {"suez": ["suez_transits"]}}
    model = StubModel()

    passed = run(
        archive_dir,
        tmp_path / "report",
        tmp_path / "cache",
        date(2026, 11, 3),
        config=config,
        load=lambda: model,
    )

    assert passed == ["bab_el_mandeb_transits:suez"]
    # Six origins, each once without and once with the candidate.
    assert model.calls == 12
    text = (tmp_path / "report" / "2026-11-03.md").read_text(encoding="utf-8")
    assert "**Passed: bab_el_mandeb_transits `suez`.**" in text
    assert "12 forecasts made, 0 from the cache" in text
    # Read-only on the daily data.
    assert sorted(p.as_posix() for p in archive_dir.rglob("*")) == before

    # Next month, on the same data, every forecast comes from the cache.
    def refuse():
        raise AssertionError("the model should not load: every forecast is cached")

    assert (
        run(
            archive_dir,
            tmp_path / "report",
            tmp_path / "cache",
            date(2026, 12, 3),
            config=config,
            load=refuse,
        )
        == passed
    )
    assert "0 forecasts made, 12 from the cache" in (
        tmp_path / "report" / "2026-12-03.md"
    ).read_text(encoding="utf-8")
