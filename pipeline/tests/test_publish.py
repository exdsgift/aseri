import json
from datetime import UTC, date, datetime

import numpy as np
import pandas as pd
import pytest

from aseri.archive import Archived
from aseri.forecast import Forecast
from aseri.publish import publish, publish_catalog, shown
from aseri.series import BRENT_SPOT, GPR_DAILY, TAIWAN_STRAIT_TRANSITS

PROVENANCE = {
    "model": {
        "id": "mistralai/Timestral-209M",
        "revision": "9874d252ab0aae16f7f7c999f98f98d6ad7d8365",
        "url": "https://huggingface.co/mistralai/Timestral-209M",
    },
    "inference": {
        "package": "timestral",
        "package_commit": "a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff",
    },
    "code": {
        "commit": "0123abc",
        "run": "https://github.com/exdsgift/aseri/actions/runs/1",
    },
    "data": {
        "source_url": "https://www.matteoiacoviello.com/gpr_files/data_gpr_daily_recent.dta",
        "as_of": "2026-10-29",
        "input_sha256": "ab" * 32,
    },
    "generated_at": "2026-10-29T07:03:12Z",
    "leakage_note": "Timestral's training-data cutoff is not published; backtests may be optimistic.",
}

# What every retrospective forecast says of itself, and a live one never does.
PSEUDO_REAL_TIME = {
    "testdata_leakage": "unknown",
    "pseudo_real_time_note": "Made after the fact, from the data as published on its forecast_date, which may differ from what was known on its reference_date.",
}

# The page's levels: its two ranges and most likely value, and the tails a possible path reaches.
LEVELS = (0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99)
QUANTILES = {
    "0.01": [80.4, 70.2],
    "0.05": [85.6, 78.9],
    "0.1": [90.1, 85.4],
    "0.25": [95.2, 93.5],
    "0.5": [100.2, 101.5],
    "0.75": [105.3, 110.6],
    "0.9": [110.3, 120.6],
    "0.95": [115.7, 128.3],
    "0.99": [121.9, 140.8],
}
ATTRIBUTION = (
    'Caldara, D. and M. Iacoviello (2022), "Measuring Geopolitical Risk", '
    "American Economic Review 112(4), 1194-1225. "
    "Data: https://www.matteoiacoviello.com/gpr.htm "
    "Forecasts: aseri (model aseri-timestral209m, Timestral-209M by Mistral AI)."
)
FORECAST_LICENSE = {
    "name": "CC BY-NC 4.0",
    "url": "https://creativecommons.org/licenses/by-nc/4.0/",
    "attribution": "Forecasts: aseri (model aseri-timestral209m, Timestral-209M by Mistral AI).",
    "note": "Upstream terms still apply to the underlying data: see each series' license.",
}


def archived(reference_date, forecast_mode, forecast_date="2026-10-29"):
    return Archived(
        forecast=Forecast(
            reference_date=pd.Timestamp(reference_date),
            levels=LEVELS,
            # As the archive reads them back: already rounded, in float64.
            quantiles=np.array([QUANTILES[str(level)] for level in LEVELS]).T,
        ),
        model_id="aseri-timestral209m",
        forecast_date=forecast_date,
        provenance=PROVENANCE | {"forecast_mode": forecast_mode},
    )


GENERATED_AT = datetime(2026, 10, 30, 7, 1, 5, tzinfo=UTC)


def publish_gpr(api_dir, observed, forecasts):
    entry = publish(
        api_dir,
        GPR_DAILY,
        forecasts,
        observed=observed,
        first_seen=observed,
        as_of=date(2026, 10, 30),
        generated_at=GENERATED_AT,
    )
    publish_catalog(api_dir, [entry], forecasts[-1].forecast.levels, GENERATED_AT)


def days_to(last_day, values, dtype=float):
    dates = pd.date_range(end=last_day, periods=len(values), freq="D")
    return pd.Series(values, index=dates, dtype=dtype).astype(float)


@pytest.fixture
def api_dir(tmp_path):
    publish_gpr(
        tmp_path,
        days_to("2026-10-27", [120.5, 98.23, 101.3, 99.0]),
        [archived("2026-10-25", "retrospective"), archived("2026-10-26", "live")],
    )
    return tmp_path


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def dated(api_dir, reference_date):
    return read(
        api_dir / "series" / "gpr_daily" / "forecasts" / f"{reference_date}.json"
    )


def test_every_archived_forecast_has_its_own_file_by_reference_date(api_dir):
    retrospective = dated(api_dir, "2026-10-25")
    live = dated(api_dir, "2026-10-26")

    assert retrospective["reference_date"] == "2026-10-25"
    assert retrospective["forecast_mode"] == "retrospective"
    assert live["reference_date"] == "2026-10-26"
    assert live["forecast_mode"] == "live"


def test_a_forecast_counts_its_horizon_from_the_reference_date(api_dir):
    forecast = dated(api_dir, "2026-10-26")

    assert forecast["series_id"] == "gpr_daily"
    assert forecast["forecast_date"] == "2026-10-29"
    assert forecast["horizon"] == [1, 2]
    assert forecast["target_end_date"] == ["2026-10-27", "2026-10-28"]


def test_a_forecast_keys_each_quantile_level_without_float_noise(api_dir):
    forecast = dated(api_dir, "2026-10-26")

    assert forecast["output_type"] == "quantile"
    assert forecast["quantiles"] == QUANTILES


def test_a_forecast_carries_the_provenance_of_the_run_that_issued_it(api_dir):
    forecast = dated(api_dir, "2026-10-26")

    assert forecast["model_id"] == "aseri-timestral209m"
    assert forecast["provenance"] == PROVENANCE | {"forecast_mode": "live"}
    # Issued once, so republishing it never changes it.
    assert forecast["generated_at"] == "2026-10-29T07:03:12Z"


def test_a_retrospective_forecast_is_labelled_pseudo_real_time(api_dir):
    forecast = dated(api_dir, "2026-10-25")

    assert (
        forecast["provenance"]
        == PROVENANCE | {"forecast_mode": "retrospective"} | PSEUDO_REAL_TIME
    )


def test_a_forecast_credits_the_source_and_the_model(api_dir):
    forecast = dated(api_dir, "2026-10-26")

    assert forecast["attribution"] == ATTRIBUTION


def test_a_forecast_is_self_describing(api_dir):
    forecast = dated(api_dir, "2026-10-26")

    assert forecast["schema_version"] == "1.0.0"
    assert forecast["unit"] == "index (1985-2019 average = 100)"
    assert forecast["horizon_unit"] == "day"
    assert forecast["links"] == {"catalog": "../../../series.json"}


def test_latest_is_the_newest_forecast_linking_to_its_dated_file(api_dir):
    latest = read(api_dir / "series" / "gpr_daily" / "latest.json")
    newest = dated(api_dir, "2026-10-26")

    assert latest["links"] == {
        "catalog": "../../series.json",
        "canonical": "forecasts/2026-10-26.json",
        "replay": "replay.json",
    }
    assert latest | {"links": None} == newest | {"links": None}


def test_replay_holds_the_forecasts_of_the_120_days_to_the_newest_at_the_page_levels(
    tmp_path,
):
    publish_gpr(
        tmp_path,
        days_to("2026-10-27", range(200)),
        [
            archived("2026-06-27", "retrospective", forecast_date="2026-10-30"),
            archived("2026-06-28", "retrospective", forecast_date="2026-10-30"),
            archived("2026-10-26", "live"),
        ],
    )

    replay = read(tmp_path / "series" / "gpr_daily" / "replay.json")
    # The page's levels and the 5% and 95% a path reaches before the chart's frame, as the page writes them.
    shown = {
        level: [round(value) for value in QUANTILES[level]]
        for level in ("0.05", "0.1", "0.25", "0.5", "0.75", "0.9", "0.95")
    }

    assert replay == {
        "series_id": "gpr_daily",
        "model_id": "aseri-timestral209m",
        "horizon": [1, 2],
        "quantile_levels": list(shown),
        "forecasts": [
            {
                "reference_date": "2026-06-28",
                "forecast_mode": "retrospective",
                "quantiles": shown,
            }
            | PSEUDO_REAL_TIME,
            {
                "reference_date": "2026-10-26",
                "forecast_mode": "live",
                "quantiles": shown,
            },
        ],
        "license": FORECAST_LICENSE,
        "attribution": ATTRIBUTION,
    }


@pytest.mark.parametrize(
    ("value", "expected"),
    [(251.4, 251), (-12.6, -13), (10.0, 10), (9.96, 10.0), (2.74, 2.7), (0.0, 0.0)],
)
def test_the_replay_rounds_as_the_page_writes_values_whole_from_10_and_to_one_decimal_below(
    value, expected
):
    assert shown(value) == expected


def test_the_index_lists_every_forecast_oldest_first(api_dir):
    index = read(api_dir / "series" / "gpr_daily" / "forecasts.json")

    assert index == {
        "schema_version": "1.0.0",
        "series_id": "gpr_daily",
        "forecasts": [
            {
                "reference_date": "2026-10-25",
                "forecast_date": "2026-10-29",
                "forecast_mode": "retrospective",
                "url": "forecasts/2026-10-25.json",
            },
            {
                "reference_date": "2026-10-26",
                "forecast_date": "2026-10-29",
                "forecast_mode": "live",
                "url": "forecasts/2026-10-26.json",
            },
        ],
        "generated_at": "2026-10-30T07:01:05Z",
    }


def test_actuals_list_the_observed_values_by_date_without_float_noise(tmp_path):
    publish_gpr(
        tmp_path,
        days_to("2026-10-26", [120.5, 98.23, 101.3], "float32"),
        [archived("2026-10-26", "live")],
    )

    actuals = read(tmp_path / "series" / "gpr_daily" / "actuals.json")

    assert actuals == {
        "schema_version": "1.0.0",
        "series_id": "gpr_daily",
        "unit": "index (1985-2019 average = 100)",
        "as_of": "2026-10-30",
        "date": ["2026-10-24", "2026-10-25", "2026-10-26"],
        "observation": [120.5, 98.23, 101.3],
        "attribution": GPR_DAILY.license["attribution"],
        "generated_at": "2026-10-30T07:01:05Z",
    }


def test_actuals_keep_the_last_400_days(tmp_path):
    publish_gpr(
        tmp_path, days_to("2026-10-26", range(500)), [archived("2026-10-26", "live")]
    )

    actuals = read(tmp_path / "series" / "gpr_daily" / "actuals.json")

    assert len(actuals["date"]) == len(actuals["observation"]) == 400
    assert actuals["date"][0] == "2025-09-22"
    assert actuals["observation"][0] == 100


def test_catalog_lists_the_series_with_its_latest_forecast(api_dir):
    catalog = read(api_dir / "series.json")

    assert catalog["schema_version"] == "1.0.0"
    assert catalog["generated_at"] == "2026-10-30T07:01:05Z"
    assert catalog["model"] == {
        "model_id": "aseri-timestral209m",
        "hf_id": "mistralai/Timestral-209M",
        "revision": "9874d252ab0aae16f7f7c999f98f98d6ad7d8365",
    }
    assert catalog["quantile_levels"] == list(LEVELS)
    assert catalog["series"] == [
        {
            "series_id": "gpr_daily",
            "title": "Geopolitical risk",
            "unit": "index (1985-2019 average = 100)",
            "baseline": 100,
            "baseline_label": "its 1985-2019 average",
            "horizon_unit": "day",
            "horizon_max": 28,
            "interval_steps": [7, 14, 28],
            "last_observation_date": "2026-10-27",
            "latest_reference_date": "2026-10-26",
            "latest_forecast_date": "2026-10-29",
            "stale_since": None,
            "note": None,
            "weekly": True,
            # One pair so far, the two days of 2026-10-25's forecast: far too few for a tie.
            "day_to_day_tie": {"rho": 0.0, "n": 1},
            "source": GPR_DAILY.source,
            "license": GPR_DAILY.license,
            "links": {
                "latest": "series/gpr_daily/latest.json",
                "forecasts": "series/gpr_daily/forecasts.json",
                "replay": "series/gpr_daily/replay.json",
                "actuals": "series/gpr_daily/actuals.json",
            },
        }
    ]


def test_catalog_states_the_forecast_licence(api_dir):
    catalog = read(api_dir / "series.json")

    assert catalog["license"] == FORECAST_LICENSE


# 400 days: the 35 oldest at 1000, then 364 at 250 and the newest at 615, so the 365 newest average 251.
TAIWAN_DAYS = days_to("2026-10-25", [1000.0] * 35 + [250.0] * 364 + [615.0])
REVIEW_NOTE = "The value of 2026-10-25 is under review."


@pytest.mark.parametrize(
    ("note", "published"),
    [
        (None, TAIWAN_STRAIT_TRANSITS.note),
        (REVIEW_NOTE, f"{REVIEW_NOTE} {TAIWAN_STRAIT_TRANSITS.note}"),
    ],
    ids=["nothing under review", "its newest value under review"],
)
def test_catalog_lists_every_series_with_its_365_day_mean_where_it_has_no_fixed_baseline(
    tmp_path, note, published
):
    gpr = publish(
        tmp_path,
        GPR_DAILY,
        [archived("2026-10-26", "live")],
        observed=days_to("2026-10-27", [120.5, 98.23]),
        first_seen=days_to("2026-10-27", [120.5, 98.23]),
        as_of=date(2026, 10, 30),
        generated_at=GENERATED_AT,
    )
    taiwan = publish(
        tmp_path,
        TAIWAN_STRAIT_TRANSITS,
        [archived("2026-10-24", "live")],
        observed=TAIWAN_DAYS,
        first_seen=TAIWAN_DAYS,
        as_of=date(2026, 10, 30),
        generated_at=GENERATED_AT,
        note=note,
    )

    publish_catalog(tmp_path, [gpr, taiwan], (0.1, 0.5, 0.9), GENERATED_AT)

    catalog = read(tmp_path / "series.json")
    assert catalog["quantile_levels"] == [0.1, 0.5, 0.9]
    assert [s["series_id"] for s in catalog["series"]] == [
        "gpr_daily",
        "taiwan_strait_transits",
    ]
    assert catalog["series"][0]["baseline"] == 100
    entry = catalog["series"][1]
    assert (entry["baseline"], entry["baseline_label"]) == (251.0, "its 365-day mean")
    assert entry["unit"] == "ships a day"
    assert entry["note"] == published
    assert entry["links"]["actuals"] == "series/taiwan_strait_transits/actuals.json"
    assert entry["license"]["attribution"] == (
        "Sources: UN Global Platform; IMF PortWatch (portwatch.imf.org)."
    )
    # Each series' files sit under its own id.
    assert read(tmp_path / "series" / "taiwan_strait_transits" / "latest.json")[
        "attribution"
    ].startswith("Sources: UN Global Platform; IMF PortWatch")


def test_brent_counts_trading_days_and_averages_365_days_not_365_prints(tmp_path):
    # Two years of weekday prints to Friday 2026-10-23: 100 until a year ago, then 120.
    prints = pd.bdate_range(end="2026-10-23", periods=522)
    observed = pd.Series(
        np.where(prints > pd.Timestamp("2025-10-23"), 120.0, 100.0), index=prints
    )

    entry = publish(
        tmp_path,
        BRENT_SPOT,
        [archived("2026-10-23", "live")],
        observed=observed,
        first_seen=observed,
        as_of=date(2026, 10, 30),
        generated_at=GENERATED_AT,
    )

    latest = read(tmp_path / "series" / "brent_spot" / "latest.json")
    assert latest["horizon_unit"] == "trading_day"
    # Its 2 steps after a Friday: Monday and Tuesday, never the weekend.
    assert latest["target_end_date"] == ["2026-10-26", "2026-10-27"]
    assert (entry["horizon_unit"], entry["weekly"]) == ("trading_day", False)
    assert entry["baseline"] == 120.0
    assert entry["note"] == BRENT_SPOT.note
