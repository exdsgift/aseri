"""The daily run end to end: fetch, forecast, archive and publish, with a recorded GPR file and a stub model."""

import hashlib
import io
import json
import re
import runpy
import sys
from dataclasses import replace
from datetime import UTC, date, datetime
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest
import torch

import aseri.__main__ as cli
import aseri.forecast as forecast_module
from aseri import archive
from aseri.series import GPR_DAILY
from aseri.sources import gpr

# The last 60 days of the upstream file as downloaded on 2026-10-29.
RECORDED_GPR = Path(__file__).parent / "fixtures" / "gpr_daily_recent.dta"
# The upstream server's stamps on that day's file.
HEADERS = {
    "Last-Modified": "Mon, 26 Oct 2026 17:55:26 GMT",
    "ETag": '"6adf940e-185ee0"',
}
LEVELS = (
    0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5,
    0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99,
)  # fmt: skip


class StubModel:
    """Stands in for Timestral: the last known value, in a band that widens with each step. It keeps every context it reads."""

    def __init__(self):
        self.contexts = []

    def forecast(self, context, prediction_length):
        self.contexts.append(context)
        steps = np.arange(1, prediction_length + 1)[:, None]
        # Like Timestral, it reads a blank as unknown, never as a value.
        band = context[~np.isnan(context)][-1] + steps * (np.array(LEVELS) - 0.5)
        return SimpleNamespace(
            quantiles=torch.tensor(band)[None, None], quantile_levels=LEVELS
        )


def no_model():
    raise AssertionError("the data has not moved, so no model should load")


def recorded_gpr_until(last_day):
    """The recorded upstream file as it stood when `last_day` was its newest day."""
    frame = pd.read_stata(RECORDED_GPR)
    raw = io.BytesIO()
    frame[frame["date"] <= last_day].to_stata(
        raw, write_index=False, convert_dates={"date": "td"}
    )
    return raw.getvalue()


def run_on(monkeypatch, moment, gpr_file, api_dir, archive_dir):
    clock = SimpleNamespace(now=lambda tz: moment)
    monkeypatch.setattr(cli, "datetime", clock)
    monkeypatch.setattr(gpr, "datetime", clock)
    monkeypatch.setattr(gpr, "download", lambda url: (gpr_file, HEADERS))
    cli.main(api_dir, archive_dir)


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def files(directory):
    return {p: p.read_bytes() for p in directory.rglob("*") if p.is_file()}


@pytest.fixture
def stub_model(monkeypatch):
    monkeypatch.setattr(cli, "load_model", StubModel)


def test_a_daily_run_publishes_the_catalog_the_latest_gpr_forecast_and_its_actuals(
    tmp_path, monkeypatch, stub_model
):
    run_on(
        monkeypatch,
        datetime(2026, 10, 29, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "api",
        tmp_path / "archive",
    )
    run_days = {"2026-10-29"}

    api = tmp_path / "api"
    catalog = read(api / "series.json")
    latest = read(api / "series" / "gpr_daily" / "latest.json")
    actuals = read(api / "series" / "gpr_daily" / "actuals.json")
    assert catalog["series"][0]["links"]["actuals"] == "series/gpr_daily/actuals.json"
    assert len(actuals["date"]) == len(actuals["observation"]) == 60
    assert actuals["date"][-1] == latest["reference_date"]
    assert actuals["observation"][-3:] == [164.2596, 81.5903, 165.2528]
    assert actuals["as_of"] in run_days
    assert catalog["series"][0]["latest_reference_date"] == "2026-10-26"
    assert len(catalog["quantile_levels"]) == 21
    assert latest["reference_date"] == "2026-10-26"
    assert latest["horizon"] == list(range(1, 29))
    assert latest["target_end_date"][0] == "2026-10-27"
    assert latest["target_end_date"][-1] == "2026-11-23"
    assert len(latest["quantiles"]) == 21
    by_step = np.array(list(latest["quantiles"].values())).T
    assert by_step.shape == (28, 21)
    assert (np.diff(by_step, axis=1) >= 0).all()
    provenance = latest["provenance"]
    assert re.fullmatch(r"[0-9a-f]{40}", provenance["code"]["commit"])
    assert provenance["data"]["as_of"] in run_days
    assert re.fullmatch(r"[0-9a-f]{64}", provenance["data"]["input_sha256"])
    assert provenance["inference"]["package_commit"]
    assert provenance["model"]["revision"]
    assert provenance["generated_at"].startswith(latest["forecast_date"])


def test_a_run_in_github_actions_records_its_commit_and_run(
    tmp_path, monkeypatch, stub_model
):
    monkeypatch.setenv("GITHUB_SHA", "f" * 40)
    monkeypatch.setenv("GITHUB_SERVER_URL", "https://github.com")
    monkeypatch.setenv("GITHUB_REPOSITORY", "exdsgift/aseri")
    monkeypatch.setenv("GITHUB_RUN_ID", "42")

    run_on(
        monkeypatch,
        datetime(2026, 10, 29, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "api",
        tmp_path / "archive",
    )

    latest = read(tmp_path / "api" / "series" / "gpr_daily" / "latest.json")
    assert latest["provenance"]["code"] == {
        "commit": "f" * 40,
        "run": "https://github.com/exdsgift/aseri/actions/runs/42",
    }


def test_a_week_of_new_data_is_forecast_from_every_new_day_and_a_rerun_changes_nothing(
    tmp_path, monkeypatch, stub_model
):
    archive_dir = tmp_path / "archive"
    rounds = archive_dir / "model-output" / "aseri-timestral209m"
    deltas = archive_dir / "target-data" / "deltas"

    # Day 1, on an empty archive: the launch backfill, every recorded day, only the newest live.
    day1_file = recorded_gpr_until("2026-10-19")
    run_on(
        monkeypatch,
        datetime(2026, 10, 20, 7, 2, tzinfo=UTC),
        day1_file,
        tmp_path / "day1",
        archive_dir,
    )

    assert sorted(
        p.relative_to(archive_dir).as_posix() for p in files(archive_dir)
    ) == [
        "model-output/aseri-timestral209m/2026-10-20-aseri-timestral209m.csv",
        "runs/2026-10-20.json",
        "target-data/deltas/2026-10-20.csv",
    ]
    assert len(pd.read_csv(rounds / "2026-10-20-aseri-timestral209m.csv")) == (
        53 * 28 * 21
    )
    assert len(pd.read_csv(deltas / "2026-10-20.csv")) == 53
    assert read(archive_dir / "runs" / "2026-10-20.json")["upstream"] == {
        "gpr_daily": {
            "source_url": GPR_DAILY.source["data_url"],
            "sha256": hashlib.sha256(day1_file).hexdigest(),
            "last_modified": "Mon, 26 Oct 2026 17:55:26 GMT",
            "etag": '"6adf940e-185ee0"',
        }
    }
    day1 = read(tmp_path / "day1" / "series" / "gpr_daily" / "forecasts.json")
    assert len(day1["forecasts"]) == 53
    assert day1["forecasts"][0]["reference_date"] == "2026-08-28"
    assert [
        f["reference_date"] for f in day1["forecasts"] if f["forecast_mode"] == "live"
    ] == ["2026-10-19"]

    # Day 2, after GPR's weekly update: one forecast per new day, only the newest live.
    run_on(
        monkeypatch,
        datetime(2026, 10, 27, 7, 4, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "day2",
        archive_dir,
    )

    series = tmp_path / "day2" / "series" / "gpr_daily"
    index = read(series / "forecasts.json")
    assert len(index["forecasts"]) == 60
    assert [
        (f["reference_date"], f["forecast_date"], f["forecast_mode"])
        for f in index["forecasts"][-8:]
    ] == [
        ("2026-10-19", "2026-10-20", "live"),
        ("2026-10-20", "2026-10-27", "retrospective"),
        ("2026-10-21", "2026-10-27", "retrospective"),
        ("2026-10-22", "2026-10-27", "retrospective"),
        ("2026-10-23", "2026-10-27", "retrospective"),
        ("2026-10-24", "2026-10-27", "retrospective"),
        ("2026-10-25", "2026-10-27", "retrospective"),
        ("2026-10-26", "2026-10-27", "live"),
    ]
    assert pd.read_csv(deltas / "2026-10-27.csv")["target_end_date"].tolist() == [
        "2026-10-20",
        "2026-10-21",
        "2026-10-22",
        "2026-10-23",
        "2026-10-24",
        "2026-10-25",
        "2026-10-26",
    ]
    # Each forecast saw only the data up to its own date: the stub centres on that day's value.
    actuals = read(series / "actuals.json")
    for forecast in index["forecasts"]:
        dated = read(series / forecast["url"])
        day = actuals["date"].index(dated["reference_date"])
        assert dated["quantiles"]["0.5"][0] == actuals["observation"][day]
    # The published forecasts are the archived ones.
    archived = pd.read_csv(rounds / "2026-10-27-aseri-timestral209m.csv")
    for reference_date, rows in archived.groupby("reference_date"):
        dated = read(series / "forecasts" / f"{reference_date}.json")
        assert dated["quantiles"] == {
            str(level): by_level.sort_values("horizon")["value"].tolist()
            for level, by_level in rows.groupby("output_type_id")
        }
    latest = read(series / "latest.json")
    assert latest["links"]["canonical"] == "forecasts/2026-10-26.json"
    assert (
        latest["quantiles"]
        == read(series / "forecasts" / "2026-10-26.json")["quantiles"]
    )

    # A rerun the same day: no new data, so no model, no new archive file, the same forecasts.
    archive_before = files(archive_dir)
    monkeypatch.setattr(cli, "load_model", no_model)
    run_on(
        monkeypatch,
        datetime(2026, 10, 27, 9, 30, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "rerun",
        archive_dir,
    )

    assert files(archive_dir) == archive_before
    rerun = tmp_path / "rerun" / "series" / "gpr_daily"
    assert read(rerun / "forecasts.json")["forecasts"] == index["forecasts"]
    for forecast in index["forecasts"]:
        assert (rerun / forecast["url"]).read_bytes() == (
            series / forecast["url"]
        ).read_bytes()


def test_every_forecast_of_the_backfill_reads_the_data_up_to_its_own_date_and_no_further(
    tmp_path, monkeypatch
):
    model = StubModel()
    monkeypatch.setattr(cli, "load_model", lambda: model)

    run_on(
        monkeypatch,
        datetime(2026, 10, 27, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "api",
        tmp_path / "archive",
    )

    observed = gpr.parse(RECORDED_GPR.read_bytes())
    index = read(tmp_path / "api" / "series" / "gpr_daily" / "forecasts.json")
    assert len(model.contexts) == len(index["forecasts"]) == 60
    for context, issued in zip(model.contexts, index["forecasts"]):
        assert context.tolist() == observed.loc[: issued["reference_date"]].tolist()


def test_a_registered_measurement_error_is_blanked_in_every_context_and_kept_in_the_actuals(
    tmp_path, monkeypatch
):
    model = StubModel()
    monkeypatch.setattr(cli, "load_model", lambda: model)
    monkeypatch.setattr(
        forecast_module,
        "ANOMALIES",
        pd.DataFrame(
            {
                "series_id": ["gpr_daily", "another_series"],
                "date": pd.to_datetime(["2026-10-22", "2026-10-23"]),
                "evidence": ["a test entry", "a test entry"],
            }
        ),
    )

    run_on(
        monkeypatch,
        datetime(2026, 10, 27, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "api",
        tmp_path / "archive",
    )

    observed = gpr.parse(RECORDED_GPR.read_bytes())
    # The context side: the model sees the day blank, in every context that reaches it, and only that day.
    for context in model.contexts:
        seen = pd.Series(context, index=observed.index[: len(context)])
        assert seen.isna().tolist() == (seen.index == "2026-10-22").tolist()
        assert seen.dropna().tolist() == observed[seen.dropna().index].tolist()
    # The actuals side: what the archive records and the API publishes keeps the value.
    actuals = read(tmp_path / "api" / "series" / "gpr_daily" / "actuals.json")
    day = actuals["date"].index("2026-10-22")
    assert actuals["observation"][day] == observed["2026-10-22"]
    assert (
        archive.as_of_view(tmp_path / "archive", "gpr_daily", date(2026, 10, 27))[
            "2026-10-22"
        ]
        == observed["2026-10-22"]
    )


def test_a_suspicious_newest_value_moves_the_origin_back_a_day_with_a_note_and_stays_in_the_actuals(
    tmp_path, monkeypatch, stub_model
):
    # GPR keeps its edge check off; the hook, as a series with it on would run it.
    monkeypatch.setattr(cli, "SOURCES", ((replace(GPR_DAILY, edge_iqr=3.0), gpr),))
    spiked = pd.read_stata(RECORDED_GPR)
    spiked.loc[spiked["date"] == "2026-10-26", "GPRD"] = 4000.0
    raw = io.BytesIO()
    spiked.to_stata(raw, write_index=False, convert_dates={"date": "td"})
    archive_dir = tmp_path / "archive"

    run_on(
        monkeypatch,
        datetime(2026, 10, 27, 7, 2, tzinfo=UTC),
        raw.getvalue(),
        tmp_path / "day1",
        archive_dir,
    )

    series = tmp_path / "day1" / "series" / "gpr_daily"
    latest = read(series / "latest.json")
    assert (latest["reference_date"], latest["forecast_mode"]) == ("2026-10-25", "live")
    entry = read(tmp_path / "day1" / "series.json")["series"][0]
    assert entry["last_observation_date"] == "2026-10-26"
    assert "2026-10-26" in entry["note"] and "under review" in entry["note"]
    assert read(series / "actuals.json")["observation"][-1] == 4000.0
    assert archive.as_of_view(archive_dir, "gpr_daily", date(2026, 10, 27))[
        "2026-10-26"
    ] == (4000.0)

    # The next day, the same file: the value is still under review and nothing is forecast twice.
    archive_before = files(archive_dir)
    monkeypatch.setattr(cli, "load_model", no_model)
    run_on(
        monkeypatch,
        datetime(2026, 10, 28, 7, 2, tzinfo=UTC),
        raw.getvalue(),
        tmp_path / "day2",
        archive_dir,
    )

    assert files(archive_dir) == archive_before
    assert read(tmp_path / "day2" / "series.json")["series"][0]["note"] == entry["note"]


def test_a_later_run_backfills_the_days_before_an_archived_forecast_and_latest_stays_the_newest(
    tmp_path, monkeypatch, stub_model
):
    archive_dir = tmp_path / "archive"
    # The archive as it stood before the backfill existed: one live forecast, from the newest day.
    observed = gpr.parse(RECORDED_GPR.read_bytes())
    archive.write(
        archive_dir,
        GPR_DAILY,
        [cli.forecast(StubModel(), observed, GPR_DAILY.horizon)],
        observed=observed,
        as_of=date(2026, 10, 30),
        upstream={},
        code_commit="0" * 40,
        run_url=None,
        generated_at=datetime(2026, 10, 30, 7, 2, tzinfo=UTC),
    )

    run_on(
        monkeypatch,
        datetime(2026, 10, 31, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "api",
        archive_dir,
    )

    series = tmp_path / "api" / "series" / "gpr_daily"
    index = read(series / "forecasts.json")["forecasts"]
    assert [f["reference_date"] for f in index] == pd.date_range(
        "2026-08-28", "2026-10-26"
    ).strftime("%Y-%m-%d").tolist()
    assert [
        (f["reference_date"], f["forecast_date"])
        for f in index
        if f["forecast_mode"] == "live"
    ] == [("2026-10-26", "2026-10-30")]
    assert {f["forecast_date"] for f in index[:-1]} == {"2026-10-31"}
    latest = read(series / "latest.json")
    assert latest["reference_date"] == "2026-10-26"
    assert latest["forecast_date"] == "2026-10-30"
    assert latest["forecast_mode"] == "live"
    assert read(tmp_path / "api" / "series.json")["series"][0][
        "latest_reference_date"
    ] == ("2026-10-26")
    # The replay ends on the latest forecast, at the page's levels and to one decimal.
    replay = read(series / "replay.json")
    assert [f["reference_date"] for f in replay["forecasts"]] == [
        f["reference_date"] for f in index
    ]
    assert replay["forecasts"][-1]["forecast_mode"] == "live"
    assert replay["forecasts"][-1]["quantiles"] == {
        level: [round(v, 1) for v in latest["quantiles"][level]]
        for level in replay["quantile_levels"]
    }
    assert replay["forecasts"][-1]["quantiles"] != {
        level: latest["quantiles"][level] for level in replay["quantile_levels"]
    }
    # Written once: the backfill never forecasts the archived day again.
    backfill = pd.read_csv(
        archive_dir
        / "model-output"
        / "aseri-timestral209m"
        / "2026-10-31-aseri-timestral209m.csv"
    )
    assert backfill["reference_date"].max() == "2026-10-25"


def test_a_second_run_the_same_day_with_new_data_waits_for_tomorrow(
    tmp_path, monkeypatch, stub_model
):
    archive_dir = tmp_path / "archive"
    run_on(
        monkeypatch,
        datetime(2026, 10, 27, 7, 2, tzinfo=UTC),
        recorded_gpr_until("2026-10-25"),
        tmp_path / "morning",
        archive_dir,
    )
    archive_before = files(archive_dir)
    monkeypatch.setattr(cli, "load_model", no_model)

    # Upstream adds 2026-10-26 in the afternoon: today's run is archived, so it publishes what it has.
    run_on(
        monkeypatch,
        datetime(2026, 10, 27, 15, 0, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "afternoon",
        archive_dir,
    )

    assert files(archive_dir) == archive_before
    latest = read(tmp_path / "afternoon" / "series" / "gpr_daily" / "latest.json")
    assert latest["reference_date"] == "2026-10-25"


def test_a_revision_without_a_new_day_is_archived_as_it_is_seen(
    tmp_path, monkeypatch, stub_model
):
    archive_dir = tmp_path / "archive"
    run_on(
        monkeypatch,
        datetime(2026, 10, 27, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "day1",
        archive_dir,
    )
    revised = pd.read_stata(RECORDED_GPR)
    revised.loc[revised["date"] == "2026-10-22", "GPRD"] = 250.0
    raw = io.BytesIO()
    revised.to_stata(raw, write_index=False, convert_dates={"date": "td"})
    monkeypatch.setattr(cli, "load_model", no_model)

    run_on(
        monkeypatch,
        datetime(2026, 10, 28, 7, 2, tzinfo=UTC),
        raw.getvalue(),
        tmp_path / "day2",
        archive_dir,
    )

    delta = pd.read_csv(archive_dir / "target-data" / "deltas" / "2026-10-28.csv")
    assert delta[["target_end_date", "observation", "as_of"]].values.tolist() == [
        ["2026-10-22", 250.0, "2026-10-28"]
    ]
    assert read(archive_dir / "runs" / "2026-10-28.json")["forecasts"] == []
    day1 = read(tmp_path / "day1" / "series" / "gpr_daily" / "forecasts.json")
    day2 = read(tmp_path / "day2" / "series" / "gpr_daily" / "forecasts.json")
    assert day2["forecasts"] == day1["forecasts"]


def test_a_rewrite_older_than_the_revision_window_stops_the_run_before_it_archives_or_publishes(
    tmp_path, monkeypatch, capsys
):
    archive_dir = tmp_path / "archive"
    days = pd.date_range("2023-01-01", "2026-10-26", freq="D")
    history = pd.DataFrame({"date": days, "GPRD": 100.0 + np.arange(len(days)) % 50})
    archive.write(
        archive_dir,
        GPR_DAILY,
        [],
        observed=history.set_index("date")["GPRD"],
        as_of=date(2026, 10, 27),
        upstream={},
        code_commit="0" * 40,
        run_url=None,
        generated_at=datetime(2026, 10, 27, 7, 2, tzinfo=UTC),
    )
    archive_before = files(archive_dir)
    history.loc[history["date"] == "2023-05-01", "GPRD"] = 250.0
    rewritten = io.BytesIO()
    history.to_stata(rewritten, write_index=False, convert_dates={"date": "td"})
    monkeypatch.setattr(gpr, "download", lambda url: (rewritten.getvalue(), HEADERS))
    # runpy runs __main__ afresh, so the guard goes where it imports load_model from.
    monkeypatch.setattr("aseri.forecast.load_model", no_model)
    monkeypatch.delitem(sys.modules, "aseri.__main__")
    monkeypatch.setattr(sys, "argv", ["aseri", str(tmp_path / "api"), str(archive_dir)])

    # As daily.yml runs it: exit 3 is how the workflow tells a hold from a crash.
    with pytest.raises(SystemExit) as stopped:
        runpy.run_module("aseri", run_name="__main__")

    assert stopped.value.code == 3
    assert "2023-05-01" in capsys.readouterr().err
    assert files(archive_dir) == archive_before
    assert not (tmp_path / "api").exists()


def test_a_reviewed_rewrite_goes_through_once_it_is_accepted(
    tmp_path, monkeypatch, stub_model
):
    archive_dir = tmp_path / "archive"
    days = pd.date_range("2023-01-01", "2026-10-26", freq="D")
    history = pd.DataFrame({"date": days, "GPRD": 100.0 + np.arange(len(days)) % 50})
    archive.write(
        archive_dir,
        GPR_DAILY,
        [],
        observed=history.set_index("date")["GPRD"],
        as_of=date(2026, 10, 27),
        upstream={},
        code_commit="0" * 40,
        run_url=None,
        generated_at=datetime(2026, 10, 27, 7, 2, tzinfo=UTC),
    )
    history.loc[history["date"] == "2023-05-01", "GPRD"] = 250.0
    rewritten = io.BytesIO()
    history.to_stata(rewritten, write_index=False, convert_dates={"date": "td"})
    # As a manual run of daily.yml with accept_revisions ticked sets it.
    monkeypatch.setenv("ASERI_ACCEPT_REVISIONS", "true")

    run_on(
        monkeypatch,
        datetime(2026, 10, 28, 7, 2, tzinfo=UTC),
        rewritten.getvalue(),
        tmp_path / "api",
        archive_dir,
    )

    assert (
        archive.as_of_view(archive_dir, "gpr_daily", date(2026, 10, 28))["2023-05-01"]
        == 250.0
    )
    assert (tmp_path / "api" / "series" / "gpr_daily" / "latest.json").exists()


@pytest.fixture(autouse=True)
def no_step_summary(monkeypatch):
    # Actions sets it for the test step too, and the runs under test must not write to its summary.
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)


@pytest.fixture
def summary(tmp_path, monkeypatch):
    """The Actions run summary, as daily.yml's run step gives it."""
    path = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(path))
    return lambda: path.read_text(encoding="utf-8")


# The recorded file ends on 2026-10-26, and GPR's expected lag is 8 days.
@pytest.mark.parametrize(
    ("run_day", "status"),
    [(4, "ok"), (5, "late"), (9, "late")],
    ids=["9 days old", "10 days old: 2 past the lag", "14 days old"],
)
def test_data_past_its_expected_lag_warns_in_the_run_summary_and_still_publishes(
    tmp_path, monkeypatch, stub_model, summary, run_day, status
):
    run_on(
        monkeypatch,
        datetime(2026, 11, run_day, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "api",
        tmp_path / "archive",
    )

    assert f"| gpr_daily | {status} | 2026-10-26 |" in summary()
    entry = read(tmp_path / "api" / "series.json")["series"][0]
    assert entry["latest_reference_date"] == "2026-10-26"
    assert entry["stale_since"] is None


def test_data_7_days_past_its_expected_lag_is_skipped_and_keeps_its_last_forecast_labelled_stale(
    tmp_path, monkeypatch, stub_model, summary
):
    archive_dir = tmp_path / "archive"
    run_on(
        monkeypatch,
        datetime(2026, 10, 27, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "day1",
        archive_dir,
    )
    archive_before = files(archive_dir)
    monkeypatch.setattr(cli, "load_model", no_model)

    # 15 days after its last day: nothing new is forecast or archived, the last good files stay up.
    run_on(
        monkeypatch,
        datetime(2026, 11, 10, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "day2",
        archive_dir,
    )

    assert files(archive_dir) == archive_before
    assert "| gpr_daily | stale | 2026-10-26 |" in summary()
    day1 = tmp_path / "day1" / "series" / "gpr_daily"
    day2 = tmp_path / "day2" / "series" / "gpr_daily"
    assert read(day2 / "latest.json") == read(day1 / "latest.json")
    assert (
        read(day2 / "actuals.json")["observation"]
        == read(day1 / "actuals.json")["observation"]
    )
    entry = read(tmp_path / "day2" / "series.json")["series"][0]
    # The first day the data was older than GPR's 8-day lag allows.
    assert entry["stale_since"] == "2026-11-04"
    assert entry["last_observation_date"] == "2026-10-26"


@pytest.mark.parametrize(
    ("gpr_file", "problem"),
    [
        # Run on 2026-10-25, the recorded file holds 2026-10-26: no day may come after the fetch day.
        (RECORDED_GPR.read_bytes(), "after the fetch day"),
        (b"<html>Service unavailable</html>", "ValueError"),
    ],
    ids=["a day after the fetch day", "a broken file"],
)
def test_a_source_that_fails_its_contract_is_skipped_and_keeps_its_last_forecast_labelled_stale(
    tmp_path, monkeypatch, stub_model, summary, gpr_file, problem
):
    archive_dir = tmp_path / "archive"
    run_on(
        monkeypatch,
        datetime(2026, 10, 20, 7, 2, tzinfo=UTC),
        recorded_gpr_until("2026-10-19"),
        tmp_path / "day1",
        archive_dir,
    )
    archive_before = files(archive_dir)
    monkeypatch.setattr(cli, "load_model", no_model)

    run_on(
        monkeypatch,
        datetime(2026, 10, 25, 7, 2, tzinfo=UTC),
        gpr_file,
        tmp_path / "day2",
        archive_dir,
    )

    assert files(archive_dir) == archive_before
    # The summary holds both runs' tables: the second is this one.
    row = [line for line in summary().splitlines() if "gpr_daily" in line][-1]
    assert row.startswith("| gpr_daily | failed | 2026-10-19 |")
    assert problem in row
    latest = read(tmp_path / "day2" / "series" / "gpr_daily" / "latest.json")
    assert (latest["reference_date"], latest["forecast_mode"]) == ("2026-10-19", "live")
    entry = read(tmp_path / "day2" / "series.json")["series"][0]
    # Its data was not overdue yet, and the run keeps no state: the failure is dated today.
    assert entry["stale_since"] == "2026-10-25"


def test_a_run_with_nothing_to_publish_fails_and_says_why(
    tmp_path, monkeypatch, stub_model, summary
):
    with pytest.raises(SystemExit, match="Nothing to publish"):
        run_on(
            monkeypatch,
            datetime(2026, 10, 27, 7, 2, tzinfo=UTC),
            b"<html>Service unavailable</html>",
            tmp_path / "api",
            tmp_path / "archive",
        )

    assert "| gpr_daily | failed | - |" in summary()
    assert not (tmp_path / "api").exists()
