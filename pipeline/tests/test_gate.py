"""The pre-publish gate, on the web fixtures (a real subset of the API) and on hand-built forecasts."""

import itertools
import json
import math
import shutil
from pathlib import Path

import jsonschema
import numpy as np
import pandas as pd
import pytest

from aseri import gate
from aseri.forecast import Forecast
from aseri.publish import CONTRACT
from aseri.series import GPR_DAILY

FIXTURES = Path(__file__).resolve().parents[2] / "web" / "src" / "fixtures"
# The OpenAPI 3.1 schema of 2022-10-07, from https://spec.openapis.org/oas/3.1/schema/2022-10-07.
OAS = Path(__file__).parent / "fixtures" / "oas-3.1-schema-2022-10-07.json"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture
def api(tmp_path):
    """The web fixtures: the files of a real run that the page reads, as the pipeline wrote them."""
    return shutil.copytree(FIXTURES, tmp_path / "api")


def edit(api, path, change):
    document = read(api / path)
    change(document)
    (api / path).write_text(json.dumps(document), encoding="utf-8")


def test_the_contract_is_valid_openapi_and_json_schema():
    openapi = read(CONTRACT / "openapi.json")
    jsonschema.Draft202012Validator(read(OAS)).validate(openapi)
    for schema in (CONTRACT / "schemas").glob("*.schema.json"):
        jsonschema.Draft202012Validator.check_schema(read(schema))
    named = {
        content["schema"]["$ref"]
        for path in openapi["paths"].values()
        for content in path["get"]["responses"]["200"]["content"].values()
        if "schema" in content
    }
    # Every schema is one openapi.json names, or the shared definitions.
    assert {f"schemas/{p.name}" for p in (CONTRACT / "schemas").iterdir()} == named | {
        "schemas/defs.schema.json"
    }


def test_the_web_fixtures_keep_to_the_contract(api):
    """The page's fixtures cannot drift from what the pipeline publishes."""
    assert gate.contract(api, subset=True) == []


def test_a_linked_file_must_be_published_unless_the_api_is_a_subset(api):
    errors = gate.contract(api)

    assert "series/gpr_daily/forecasts.json: missing, linked from series.json" in errors
    assert "series/gpr_daily/scores.json: missing, linked from series.json" in errors
    assert "licenses/CC-BY-NC-4.0.txt: missing, linked from series.json" in errors
    # A file at a fixed path; one at a templated path is needed only where a file links to it.
    assert "openapi.json: no file for /openapi.json" in errors
    assert not [e for e in errors if "no file for /series/{series_id}" in e]


def test_a_subset_without_a_series_daily_values_or_replay_is_checked_without_them(
    api, capsys
):
    (api / "series" / "gpr_daily" / "actuals.json").unlink()
    (api / "series" / "gpr_daily" / "replay.json").unlink()

    assert gate.main(api, subset=True) == 0
    assert capsys.readouterr().out.endswith(": 0 errors\n")


def test_a_file_off_its_schema_fails(api):
    edit(api, "series.json", lambda catalog: catalog.pop("errata"))

    assert gate.contract(api, subset=True) == [
        "series.json: 'errata' is a required property"
    ]


def test_a_key_the_schema_does_not_declare_fails_though_the_published_schema_lets_it_through(
    api,
):
    edit(api, "series.json", lambda catalog: catalog["series"][0].update(colour=1))

    assert gate.contract(api, subset=True) == [
        "series.json: series/0: Additional properties are not allowed ('colour' was unexpected)"
    ]
    # A client validating against the published schema meets fields added within v1 and goes on.
    gate.validator("catalog.schema.json", strict=False).validate(
        read(api / "series.json")
    )


@pytest.mark.parametrize("value", ["2026-02-30", "26-10-30", "20261030"])
def test_a_date_that_is_no_iso_day_fails(api, value):
    edit(
        api,
        "series/gpr_daily/latest.json",
        lambda latest: latest.update(forecast_date=value),
    )

    assert (
        f"series/gpr_daily/latest.json: forecast_date: '{value}' is not a 'date'"
        in gate.contract(api, subset=True)
    )


@pytest.mark.parametrize(
    "value",
    ["2026-10-30T25:55:23Z", "2026-10-30 14:55:23", "2026-10-30T14:55:23+01:00"],
)
def test_a_timestamp_off_utc_to_the_second_fails(api, value):
    edit(api, "series.json", lambda catalog: catalog.update(generated_at=value))

    assert gate.contract(api, subset=True) == [
        f"series.json: generated_at: '{value}' is not a 'date-time'"
    ]


@pytest.mark.parametrize("value", ["portwatch.imf.org", "https://portwatch imf.org/"])
def test_a_link_that_is_no_uri_fails(api, value):
    edit(
        api,
        "series.json",
        lambda catalog: catalog["series"][0]["source"].update(url=value),
    )

    assert gate.contract(api, subset=True) == [
        f"series.json: series/0/source/url: '{value}' is not a 'uri'"
    ]


def test_a_number_json_cannot_hold_fails(api):
    path = api / "series" / "suez_transits" / "actuals.json"
    text = path.read_text(encoding="utf-8")
    path.write_text(text.replace("]", ", NaN]", 1), encoding="utf-8")

    assert gate.contract(api, subset=True) == [
        "series/suez_transits/actuals.json: not JSON with finite numbers: NaN"
    ]


def test_a_file_openapi_does_not_describe_fails(api):
    (api / "series" / "gpr_daily" / "notes.json").write_text("{}")

    assert gate.contract(api, subset=True) == [
        "series/gpr_daily/notes.json: no path of openapi.json describes it"
    ]


@pytest.mark.parametrize(
    ("path", "change", "error"),
    [
        (
            "series/gpr_daily/latest.json",
            lambda latest: latest.update(forecast_date="2026-11-01"),
            "series/gpr_daily/latest.json: forecast_date is 2026-11-01, the catalog's latest_forecast_date 2026-10-31",
        ),
        (
            "series/gpr_daily/actuals.json",
            lambda actuals: actuals.update(
                date=actuals["date"][:-1], observation=actuals["observation"][:-1]
            ),
            "series/gpr_daily/actuals.json: ends on 2026-10-25, the catalog's last_observation_date 2026-10-26",
        ),
        (
            "series/gpr_daily/replay.json",
            lambda replay: replay.update(forecasts=replay["forecasts"][:-1]),
            "series/gpr_daily/replay.json: ends on 2026-10-25, the catalog's latest_reference_date 2026-10-26",
        ),
        (
            "series.json",
            lambda catalog: catalog["series"][0]["links"].update(
                latest="series/suez_transits/latest.json"
            ),
            "series.json: gpr_daily links latest to series/suez_transits/latest.json",
        ),
        (
            "series/hormuz_transits/replay.json",
            lambda replay: replay.update(series_id="suez_transits"),
            "series/hormuz_transits/replay.json: series_id is suez_transits",
        ),
    ],
    ids=["latest", "actuals", "replay", "links", "series-id"],
)
def test_files_that_disagree_fail(api, path, change, error):
    edit(api, path, change)

    assert gate.contract(api, subset=True) == [error]


def test_the_scoreboard_lists_every_series_of_the_catalog_with_scores(api):
    edit(api, "scores.json", lambda scores: scores["series"].pop(0))

    assert gate.contract(api, subset=True) == [
        "scores.json: misses gpr_daily, which the catalog links to its scores"
    ]


def test_a_daily_step_off_its_reference_date_fails_through_the_files(api):
    edit(
        api,
        "series/gpr_daily/latest.json",
        lambda latest: latest["target_end_date"].__setitem__(3, "2026-10-31"),
    )

    assert gate.contract(api, subset=True) == [
        "series/gpr_daily/latest.json: step 4 is dated 2026-10-31, not 2026-10-30"
    ]


@pytest.mark.parametrize(
    ("dates", "errors"),
    [
        (["2026-10-28", "2026-10-29", "2026-10-30", "2026-11-02"], []),
        # Good Friday and Easter Monday, a weekend between.
        (["2027-03-30"], []),
        (["2026-10-31"], ["step 1 is dated 2026-10-31, a weekend day"]),
        (
            ["2026-10-28", "2026-10-28"],
            ["step 2 is dated 2026-10-28, not after the day before"],
        ),
        (["2026-11-02"], ["step 1 is dated 2026-11-02, skipping 3 weekdays"]),
    ],
    ids=["weekdays", "easter", "saturday", "repeated", "three-weekdays"],
)
def test_trading_day_steps_skip_weekends_and_at_most_two_holidays(dates, errors):
    reference_date = "2027-03-25" if dates[0] > "2027" else "2026-10-27"

    assert gate.step_dates(reference_date, dates, "trading_day") == errors


def test_calendar_day_steps_follow_the_reference_date_day_by_day():
    assert gate.step_dates("2026-12-30", ["2026-12-31", "2027-01-01"], "day") == []
    assert gate.step_dates("2026-12-30", ["2026-12-31", "2027-01-02"], "day") == [
        "step 2 is dated 2027-01-02, not 2027-01-01"
    ]


def test_quantiles_that_cross_fail(api):
    def change(latest):
        quantiles = latest["quantiles"]
        quantiles["0.4"][2], quantiles["0.6"][2] = (
            quantiles["0.6"][2],
            quantiles["0.4"][2],
        )

    edit(api, "series/gpr_daily/latest.json", change)

    assert gate.contract(api, subset=True) == [
        "series/gpr_daily/latest.json: step 3 decreases from level 0.4 to 0.45"
    ]


def test_arrays_that_do_not_line_up_fail(api):
    edit(
        api,
        "series/gpr_daily/latest.json",
        lambda latest: latest["quantiles"]["0.5"].pop(),
    )

    assert gate.contract(api, subset=True) == [
        "series/gpr_daily/latest.json: level 0.5 has 27 values for 28 steps"
    ]


# A year of daily values zigzagging between 10 and 20: range 10, and every daily move 1.
YEAR = pd.Series(
    10.0 + np.abs(np.arange(365) % 20 - 10),
    index=pd.date_range(end="2026-10-26", periods=365),
)
# Two steps, the second's median on the year's top: bands 2 and 4 daily moves wide.
INSIDE = {"0.1": [14.0, 18.0], "0.5": [15.0, 20.0], "0.9": [16.0, 22.0]}


def bands(**steps):
    """INSIDE with the levels of a step replaced: step_2=(0.1, 0.5, 0.9)."""
    quantiles = {level: list(values) for level, values in INSIDE.items()}
    for step, values in steps.items():
        for level, value in zip(("0.1", "0.5", "0.9"), values):
            quantiles[level][int(step[-1]) - 1] = value
    return quantiles


@pytest.mark.parametrize(
    ("quantiles", "errors", "warnings"),
    [
        (INSIDE, [], []),
        (
            bands(step_2=(19.0, 21.0, 23.0)),
            [],
            ["the median leaves the range of its 365 days by 0.1 of it, over 0.05"],
        ),
        (
            bands(step_2=(25.0, 26.0, 27.0)),
            ["the median leaves the range of its 365 days by 0.6 of it, over 0.5"],
            [],
        ),
        (
            bands(step_1=(15.0, 15.0, 15.0)),
            [
                "the 8 in 10 band is 0 times the mean daily move of its 365 days, outside 0.06 to 48"
            ],
            [],
        ),
        (
            bands(step_1=(14.95, 15.0, 15.05)),
            [],
            [
                "the 8 in 10 band is 0.1 times the mean daily move of its 365 days, outside 0.12 to 24"
            ],
        ),
        (
            bands(step_2=(0.0, 15.0, 30.0)),
            [],
            [
                "the 8 in 10 band is 30 times the mean daily move of its 365 days, outside 0.12 to 24"
            ],
        ),
        (
            bands(step_2=(-20.0, 15.0, 50.0)),
            [
                "the 8 in 10 band is 70 times the mean daily move of its 365 days, outside 0.06 to 48"
            ],
            [],
        ),
    ],
    ids=[
        "inside",
        "just-outside",
        "far-outside",
        "no-width",
        "narrow",
        "wide",
        "absurd",
    ],
)
def test_a_forecast_far_from_its_history_fails_and_one_near_a_bound_warns(
    quantiles, errors, warnings
):
    assert gate.check_forecast(quantiles, YEAR, "2026-10-26") == (errors, warnings)


def test_a_large_change_from_the_forecast_before_only_warns():
    # Made the day before: its steps 2 and 3 are today's 1 and 2, its bands 4 wide.
    before = {
        "0.1": [0.0, 10.0, 14.0],
        "0.5": [0.0, 12.0, 16.0],
        "0.9": [0.0, 14.0, 18.0],
    }

    # Today's medians, 15 and 20, moved 0.75 and 1 of those widths.
    assert gate.check_forecast(INSIDE, YEAR, "2026-10-26", before, 1) == ([], [])
    moved = bands(step_1=(18.5, 19.5, 20.5))
    assert gate.check_forecast(moved, YEAR, "2026-10-26", before, 1) == (
        [],
        [
            "the median moved by 1.9 band widths of the forecast before on the same day, over 1.5"
        ],
    )


def test_a_day_the_forecast_before_gave_no_band_is_no_scale_for_a_change():
    # Counts held at 0, or a band the replay rounded to nothing: step 2 of the one before has no width.
    before = {
        "0.1": [0.0, 12.0, 14.0],
        "0.5": [0.0, 12.0, 16.0],
        "0.9": [0.0, 12.0, 18.0],
    }

    # Today's step 1 is 3.5 from it, which would read as millions of widths; step 2 moved 1.
    moved = bands(step_1=(14.5, 15.5, 16.5))
    assert gate.check_forecast(moved, YEAR, "2026-10-26", before, 1) == ([], [])


def test_a_band_clipped_at_its_series_floor_may_have_no_width():
    # A count between 0 and 10, every daily move 1; on step 1 the forecast is all 0: none, surely.
    counts = YEAR - 10
    at_zero = {"0.1": [0.0, 1.0], "0.5": [0.0, 2.0], "0.9": [0.0, 3.0]}

    assert gate.check_forecast(at_zero, counts, "2026-10-26", limits=(0, math.inf)) == (
        [],
        [],
    )
    # Unclipped, the same band would be one of no width.
    assert gate.check_forecast(at_zero, counts, "2026-10-26")[0] == [
        "the 8 in 10 band is 0 times the mean daily move of its 365 days, outside 0.06 to 48"
    ]


@pytest.mark.parametrize("days", [0, 1, 27])
def test_a_forecast_with_too_few_days_before_it_is_not_bounded_and_says_so(days):
    short = YEAR.iloc[365 - days :]

    assert gate.check_forecast(
        bands(step_2=(90.0, 95.0, 99.0)), short, "2026-10-26"
    ) == (
        [],
        [
            f"{days} days in the 365 before its reference date, fewer than 28: not bounded"
        ],
    )


def test_a_run_s_new_forecasts_are_each_checked_against_the_one_before_it():
    def forecast(day, median):
        return Forecast(
            reference_date=pd.Timestamp(day),
            levels=(0.1, 0.5, 0.9),
            quantiles=np.array([[median - 1, median, median + 1]] * 2),
        )

    archived = [forecast("2026-10-24", 15.0)]
    # The 25th is in bounds and moved 0.5; the 26th far outside, and 5 widths from the 25th's step 2.
    new = [forecast("2026-10-25", 16.0), forecast("2026-10-26", 26.0)]

    errors, warnings = gate.check_forecasts(GPR_DAILY, new, YEAR, archived)

    assert errors == [
        "2026-10-26: the median leaves the range of its 365 days by 0.6 of it, over 0.5"
    ]
    assert warnings == [
        "2026-10-26: the median moved by 5 band widths of the forecast before on the same day, over 1.5"
    ]


def test_steps_between_two_forecasts_count_days_or_prices():
    prices = pd.Series(
        1.0, index=pd.DatetimeIndex(["2026-10-23", "2026-10-26", "2026-10-27"])
    )

    assert gate.steps_between(prices, "2026-10-23", "2026-10-27", trading=False) == 4
    assert gate.steps_between(prices, "2026-10-23", "2026-10-27", trading=True) == 2


def test_the_bounds_hold_every_forecast_of_the_backfill_without_a_warning():
    """The calibration: no forecast of the 120 days the fixtures replay comes near a bound."""
    for replay in FIXTURES.glob("series/*/replay.json"):
        forecasts = read(replay)["forecasts"]
        actuals = read(replay.parent / "actuals.json")
        observed = pd.Series(
            actuals["observation"], index=pd.DatetimeIndex(actuals["date"])
        )
        trading = replay.parent.name == "brent_spot"
        for before, forecast in itertools.pairwise(forecasts):
            shift = gate.steps_between(
                observed, before["reference_date"], forecast["reference_date"], trading
            )
            assert gate.check_forecast(
                forecast["quantiles"],
                observed,
                forecast["reference_date"],
                before["quantiles"],
                shift,
            ) == ([], []), (replay.parent.name, forecast["reference_date"])
