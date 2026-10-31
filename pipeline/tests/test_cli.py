"""The daily run end to end: fetch, forecast, archive and publish, with a recorded GPR file, a stand-in PortWatch layer and a stub model."""

import hashlib
import io
import json
import re
from dataclasses import replace
from datetime import UTC, date, datetime
from pathlib import Path
from types import SimpleNamespace
from urllib.error import URLError
from urllib.parse import parse_qs, urlsplit

import numpy as np
import pandas as pd
import pytest
import torch

import aseri.__main__ as cli
import aseri.forecast as forecast_module
from aseri import archive, record
from aseri.publish import shown
from aseri.series import GPR_DAILY, TAIWAN_STRAIT_TRANSITS
from aseri.sources import fred, gpr, losses, portwatch

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
    monkeypatch.setattr(portwatch, "datetime", clock)
    monkeypatch.setattr(gpr, "download", lambda url: (gpr_file, HEADERS))
    cli.main(api_dir, archive_dir)


def unreachable(request, timeout):
    raise URLError("PortWatch is not reachable from the tests")


@pytest.fixture(autouse=True)
def portwatch_down(monkeypatch):
    # Every test runs every series; the GPR tests see PortWatch down, so its four series publish nothing.
    # The other sources share urlopen and time.sleep, so Brent, Wikipedia, the alerts and the drones fail too.
    monkeypatch.setattr(portwatch.urllib.request, "urlopen", unreachable)
    monkeypatch.setattr(portwatch.time, "sleep", lambda seconds: None)


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
        [
            archive.SeriesRun(
                GPR_DAILY,
                [cli.forecast(StubModel(), observed, GPR_DAILY.horizon)],
                observed,
                date(2026, 10, 30),
                {},
            )
        ],
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
        level: [shown(v) for v in latest["quantiles"][level]]
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


def test_a_reviewed_rewrite_goes_through_once_it_is_accepted(
    tmp_path, monkeypatch, stub_model
):
    archive_dir = tmp_path / "archive"
    days = pd.date_range("2023-01-01", "2026-10-26", freq="D")
    history = pd.DataFrame({"date": days, "GPRD": 100.0 + np.arange(len(days)) % 50})
    archive.write(
        archive_dir,
        [
            archive.SeriesRun(
                GPR_DAILY, [], history.set_index("date")["GPRD"], date(2026, 10, 27), {}
            )
        ],
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
    # Actions sets both for the test step too, and the runs under test must not write to its summary or outputs.
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    monkeypatch.delenv("GITHUB_OUTPUT", raising=False)


@pytest.fixture
def summary(tmp_path, monkeypatch):
    """The Actions run summary, as daily.yml's run step gives it."""
    path = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(path))
    return lambda: path.read_text(encoding="utf-8")


# The recorded file ends on 2026-10-26, and GPR's expected lag is 8 days: late from 10 days old, Nov 5.
@pytest.mark.parametrize(
    ("run_day", "status", "stale_since"),
    [(4, "ok", None), (5, "late", "2026-11-05"), (9, "late", "2026-11-05")],
    ids=["9 days old", "10 days old: 2 past the lag", "14 days old"],
)
def test_data_past_its_expected_lag_warns_in_the_run_summary_and_on_the_page_and_still_publishes(
    tmp_path, monkeypatch, stub_model, summary, run_day, status, stale_since
):
    outputs = tmp_path / "outputs"
    monkeypatch.setenv("GITHUB_OUTPUT", str(outputs))
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
    # The same day every run: the page and the alert agree with the summary, with no state kept.
    assert entry["stale_since"] == stale_since
    assert (
        outputs.read_text(encoding="utf-8")
        == ("stale=gpr_daily\n" if stale_since else "stale=\n")
        + "revision_hold=\ncalibration_red=\n"
    )


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
    # As of the vintage it holds, not the day it was republished.
    assert read(day2 / "actuals.json")["as_of"] == "2026-10-27"
    entry = read(tmp_path / "day2" / "series.json")["series"][0]
    # The first day the data was 2 days past GPR's 8-day lag.
    assert entry["stale_since"] == "2026-11-05"
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
    # Its data, to Oct 19, is not late yet: the page is as current as on any day, and only the summary says it failed.
    assert entry["stale_since"] is None


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


# The four sea lanes, with GPR: every source of the daily run.

PORTS = {
    "suez_transits": "Suez Canal",
    "hormuz_transits": "Strait of Hormuz",
    "bab_el_mandeb_transits": "Bab el-Mandeb Strait",
    "taiwan_strait_transits": "Taiwan Strait",
}
# The layer's edit stamps: 2026-10-28T07:51:08Z, as recorded, and the next weekly batch's.
EDITED, NEXT_EDIT = 1793173868799, 1793778668799


def chokepoint_days(level, last_day="2026-10-25"):
    """Whole ships around `level`, with a weekly cycle, from a fixed first day: 400 days to 2026-10-25."""
    days = pd.date_range("2025-09-21", last_day, freq="D")
    return pd.Series(level + days.day_of_week % 3, index=days)


def sea_lanes(last_day="2026-10-25"):
    return {
        "Suez Canal": chokepoint_days(41, last_day),
        "Strait of Hormuz": chokepoint_days(3, last_day),
        "Bab el-Mandeb Strait": chokepoint_days(33, last_day),
        "Taiwan Strait": chokepoint_days(231, last_day),
    }


class Response:
    """What urlopen returns, as far as the adapter reads it."""

    def __init__(self, body):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return self.body


class PortWatch:
    """Stands in for the PortWatch layer: `lanes` by portname, paged as ArcGIS pages them; the `down` ones answer error bodies."""

    def __init__(self, lanes, edited=EDITED, down=()):
        self.lanes, self.edited, self.down = lanes, edited, down

    def __call__(self, request, timeout):
        query = parse_qs(urlsplit(request.full_url).query)
        if "where" not in query:
            body = {"editingInfo": {"dataLastEditDate": self.edited}}
        elif (
            port := re.fullmatch("portname='(.+)'", query["where"][0])[1]
        ) in self.down:
            body = {"error": {"code": 400, "message": "Invalid query parameters."}}
        elif "returnCountOnly" in query:
            body = {"count": len(self.lanes[port])}
        else:
            offset, size = (
                int(query["resultOffset"][0]),
                int(query["resultRecordCount"][0]),
            )
            page = self.lanes[port].iloc[offset : offset + size]
            body = {
                "features": [
                    {"attributes": {"date": f"{day:%Y-%m-%d}", "n_total": int(n)}}
                    for day, n in page.items()
                ],
                "exceededTransferLimit": offset + size < len(self.lanes[port]),
            }
        return Response(json.dumps(body).encode())


def serve(monkeypatch, lanes, **kwargs):
    monkeypatch.setattr(portwatch.urllib.request, "urlopen", PortWatch(lanes, **kwargs))


@pytest.fixture
def short_backfill(monkeypatch):
    # The tests of several runs need no 121-day backfill of five series; the first sea-lane test runs it whole.
    monkeypatch.setattr(archive, "REPLAY_DAYS", 14)


def test_one_run_forecasts_every_series_into_one_manifest_one_round_and_one_catalog(
    tmp_path, monkeypatch, stub_model
):
    serve(monkeypatch, sea_lanes())
    archive_dir = tmp_path / "archive"

    run_on(
        monkeypatch,
        datetime(2026, 10, 30, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "api",
        archive_dir,
    )

    assert sorted(
        p.relative_to(archive_dir).as_posix() for p in files(archive_dir)
    ) == [
        "model-output/aseri-timestral209m/2026-10-30-aseri-timestral209m.csv",
        "runs/2026-10-30.json",
        "target-data/deltas/2026-10-30.csv",
    ]
    manifest = read(archive_dir / "runs" / "2026-10-30.json")
    issued = pd.DataFrame(manifest["forecasts"])
    # GPR's 60 recorded days; each sea lane, a first run, backfills the 120 days before its newest.
    assert issued.groupby("target", sort=False).size().to_dict() == {
        "gpr_daily": 60,
        **dict.fromkeys(PORTS, 121),
    }
    assert issued[issued["forecast_mode"] == "live"][
        ["target", "reference_date"]
    ].values.tolist() == [["gpr_daily", "2026-10-26"]] + [
        [series_id, "2026-10-25"] for series_id in PORTS
    ]
    assert list(manifest["upstream"]) == ["gpr_daily", *PORTS]
    assert manifest["upstream"]["taiwan_strait_transits"] == {
        "source_url": TAIWAN_STRAIT_TRANSITS.source["data_url"],
        "sha256": manifest["upstream"]["taiwan_strait_transits"]["sha256"],
        "data_last_edit_date": "2026-10-28T07:51:08Z",
    }
    rounds = pd.read_csv(
        archive_dir
        / "model-output"
        / "aseri-timestral209m"
        / "2026-10-30-aseri-timestral209m.csv"
    )
    assert list(rounds["target"].unique()) == ["gpr_daily", *PORTS]
    deltas = pd.read_csv(archive_dir / "target-data" / "deltas" / "2026-10-30.csv")
    assert deltas.groupby("target", sort=False).size().to_dict() == {
        "gpr_daily": 60,
        **dict.fromkeys(PORTS, 400),
    }

    api = tmp_path / "api"
    catalog = read(api / "series.json")
    assert [s["series_id"] for s in catalog["series"]] == ["gpr_daily", *PORTS]
    for entry in catalog["series"][1:]:
        assert entry["last_observation_date"] == "2026-10-25"
        assert entry["latest_reference_date"] == "2026-10-25"
        assert entry["stale_since"] is None
        assert entry["baseline_label"] == "its 365-day mean"
    entries = {s["series_id"]: s for s in catalog["series"]}
    # The newest 365 days of 41, 42 and 43 by weekday.
    assert entries["suez_transits"]["baseline"] == pytest.approx(
        chokepoint_days(41).iloc[-365:].mean(), abs=1e-4
    )
    assert entries["suez_transits"]["note"] is None
    assert entries["taiwan_strait_transits"]["note"] == TAIWAN_STRAIT_TRANSITS.note
    # Each series' files keep GPR's shape, under its own id.
    gpr_latest = read(api / "series" / "gpr_daily" / "latest.json")
    for series_id, port in PORTS.items():
        series = api / "series" / series_id
        latest = read(series / "latest.json")
        assert latest.keys() == gpr_latest.keys()
        assert latest["series_id"] == series_id
        assert len(read(series / "forecasts.json")["forecasts"]) == 121
        assert (
            read(series / "replay.json").keys()
            == read(api / "series" / "gpr_daily" / "replay.json").keys()
        )
        actuals = read(series / "actuals.json")
        assert (
            actuals["observation"]
            == sea_lanes()[port].iloc[-400:].astype(float).tolist()
        )
        # Counts: a band that would reach below 0 stops at 0.
        assert min(min(q) for q in latest["quantiles"].values()) >= 0
    hormuz = read(api / "series" / "hormuz_transits" / "latest.json")
    assert hormuz["quantiles"]["0.01"][-1] == 0


def test_a_series_whose_source_fails_keeps_its_last_good_files_while_the_others_publish(
    tmp_path, monkeypatch, stub_model, summary, short_backfill
):
    archive_dir = tmp_path / "archive"
    serve(monkeypatch, sea_lanes())
    run_on(
        monkeypatch,
        datetime(2026, 10, 30, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "day1",
        archive_dir,
    )

    # The next weekly batch, with the Taiwan Strait query failing on every attempt.
    serve(
        monkeypatch,
        sea_lanes("2026-11-01"),
        edited=NEXT_EDIT,
        down=("Taiwan Strait",),
    )
    run_on(
        monkeypatch,
        datetime(2026, 11, 5, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "day2",
        archive_dir,
    )

    manifest = read(archive_dir / "runs" / "2026-11-05.json")
    assert "taiwan_strait_transits" not in manifest["upstream"]
    assert {f["target"] for f in manifest["forecasts"]} == {
        "suez_transits",
        "hormuz_transits",
        "bab_el_mandeb_transits",
    }
    row = [line for line in summary().splitlines() if "taiwan_strait" in line][-1]
    assert row.startswith("| taiwan_strait_transits | failed | 2026-10-25 |")
    assert "Invalid query parameters" in row
    entries = {
        s["series_id"]: s for s in read(tmp_path / "day2" / "series.json")["series"]
    }
    assert entries["suez_transits"]["latest_reference_date"] == "2026-11-01"
    assert entries["taiwan_strait_transits"]["latest_reference_date"] == "2026-10-25"
    day1 = tmp_path / "day1" / "series" / "taiwan_strait_transits"
    day2 = tmp_path / "day2" / "series" / "taiwan_strait_transits"
    assert read(day2 / "latest.json") == read(day1 / "latest.json")
    assert (
        read(day2 / "actuals.json")["observation"]
        == read(day1 / "actuals.json")["observation"]
    )


def test_a_rewrite_older_than_the_revision_window_holds_only_its_own_series_and_names_it_for_the_alert(
    tmp_path, monkeypatch, stub_model, summary, short_backfill
):
    archive_dir = tmp_path / "archive"
    serve(monkeypatch, sea_lanes())
    run_on(
        monkeypatch,
        datetime(2026, 10, 30, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "day1",
        archive_dir,
    )
    output = tmp_path / "output"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))

    # The next weekly batch, with Suez rewritten four months back, far past its 30-day revision window.
    lanes = sea_lanes("2026-11-01")
    lanes["Suez Canal"].loc["2026-07-01"] = 50
    serve(monkeypatch, lanes, edited=NEXT_EDIT)
    run_on(
        monkeypatch,
        datetime(2026, 11, 5, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "day2",
        archive_dir,
    )

    # Nothing of the rewritten file is archived, while the other lanes go on.
    manifest = read(archive_dir / "runs" / "2026-11-05.json")
    assert "suez_transits" not in manifest["upstream"]
    assert {f["target"] for f in manifest["forecasts"]} == {
        "hormuz_transits",
        "bab_el_mandeb_transits",
        "taiwan_strait_transits",
    }
    deltas = pd.read_csv(archive_dir / "target-data" / "deltas" / "2026-11-05.csv")
    assert "suez_transits" not in set(deltas["target"])
    row = [line for line in summary().splitlines() if "suez" in line][-1]
    assert row.startswith("| suez_transits | held | 2026-10-25 |")
    assert "2026-07-01" in row
    day1 = tmp_path / "day1" / "series" / "suez_transits"
    day2 = tmp_path / "day2" / "series" / "suez_transits"
    assert read(day2 / "latest.json") == read(day1 / "latest.json")
    assert "revision_hold=suez_transits\n" in output.read_text(encoding="utf-8")


class SuezBreaksTheModel(StubModel):
    """The stub, except on Suez's contexts (only 41, 42 and 43 ships), where it returns NaN as a broken model might."""

    def forecast(self, context, prediction_length):
        result = super().forecast(context, prediction_length)
        if set(np.unique(context[~np.isnan(context)])) <= {41, 42, 43}:
            result.quantiles[:] = float("nan")
        return result


def test_a_model_error_in_one_series_fails_only_that_series_and_still_archives_its_data(
    tmp_path, monkeypatch, summary, short_backfill
):
    monkeypatch.setattr(cli, "load_model", SuezBreaksTheModel)
    archive_dir = tmp_path / "archive"
    serve(monkeypatch, sea_lanes())

    run_on(
        monkeypatch,
        datetime(2026, 10, 30, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "api",
        archive_dir,
    )

    row = [line for line in summary().splitlines() if "suez" in line][-1]
    assert row.startswith("| suez_transits | failed | - |")
    assert "non-finite" in row
    manifest = read(archive_dir / "runs" / "2026-10-30.json")
    assert "suez_transits" not in {f["target"] for f in manifest["forecasts"]}
    # Its vintage is kept all the same: PortWatch keeps none, and the next run forecasts the days missed.
    assert (
        len(archive.as_of_view(archive_dir, "suez_transits", date(2026, 10, 30))) == 400
    )
    catalog = read(tmp_path / "api" / "series.json")
    assert [s["series_id"] for s in catalog["series"]] == [
        "gpr_daily",
        "hormuz_transits",
        "bab_el_mandeb_transits",
        "taiwan_strait_transits",
    ]

    # The next day the model is whole again: Suez forecasts every day of its window, the newest live.
    monkeypatch.setattr(cli, "load_model", StubModel)
    run_on(
        monkeypatch,
        datetime(2026, 10, 31, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "next",
        archive_dir,
    )

    index = read(tmp_path / "next" / "series" / "suez_transits" / "forecasts.json")[
        "forecasts"
    ]
    # The newest day and the 14 before it, in this test's short backfill.
    assert len(index) == 15
    assert [f["reference_date"] for f in index if f["forecast_mode"] == "live"] == [
        "2026-10-25"
    ]


def with_day(lanes, port, day, ships):
    lanes[port][pd.Timestamp(day)] = ships
    return lanes


def test_the_record_scores_each_series_from_the_archive_and_names_a_red_band_for_the_alert(
    tmp_path, monkeypatch, stub_model, short_backfill
):
    archive_dir = tmp_path / "archive"
    serve(monkeypatch, sea_lanes())
    run_on(
        monkeypatch,
        datetime(2026, 10, 30, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "day1",
        archive_dir,
    )
    output = tmp_path / "output"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    # From one weekly forecast, for this test: in a real record one miss alone is no alarm.
    monkeypatch.setattr(record, "MIN_N", 1)

    # Three weeks on, with Taiwan's Nov 1, 7 days after the live forecast of Oct 25, a tracking dropout.
    serve(
        monkeypatch,
        with_day(sea_lanes("2026-11-15"), "Taiwan Strait", "2026-11-01", 24),
        edited=NEXT_EDIT,
    )
    run_on(
        monkeypatch,
        datetime(2026, 11, 16, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "day2",
        archive_dir,
    )

    api = tmp_path / "day2"
    taiwan = read(api / "series" / "taiwan_strait_transits" / "scores.json")
    suez = read(api / "series" / "suez_transits" / "scores.json")
    # Due by Nov 16 with a 14-day wait: the days to Nov 2, so the first 7 of Oct 25's live forecast.
    assert taiwan["n"] == 1
    assert taiwan["live"]["weekly"] == [
        {"reference_date": "2026-10-25", "inside_80": False}
    ]
    assert suez["live"]["weekly"] == [
        {"reference_date": "2026-10-25", "inside_80": True}
    ]
    # Apart: the 14 backfilled before it, and Oct 26, forecast on Nov 16 from the data of that day.
    assert taiwan["retrospective"]["n"] == 15
    page = read(api / "scores.json")
    assert [s["series_id"] for s in page["series"]] == ["gpr_daily", *PORTS]
    assert read(api / "series.json")["series"][4]["links"]["scores"] == (
        "series/taiwan_strait_transits/scores.json"
    )
    assert "calibration_red=taiwan_strait_transits\n" in output.read_text(
        encoding="utf-8"
    )


def test_a_scoring_error_in_one_series_costs_only_its_scores(
    tmp_path, monkeypatch, stub_model, summary, short_backfill
):
    scored = record.scored

    def suez_breaks(series, *args, **kwargs):
        if series.id == "suez_transits":
            raise ValueError("a broken vintage")
        return scored(series, *args, **kwargs)

    monkeypatch.setattr(record, "scored", suez_breaks)
    output = tmp_path / "output"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    serve(monkeypatch, sea_lanes())

    run_on(
        monkeypatch,
        datetime(2026, 10, 30, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "api",
        tmp_path / "archive",
    )

    api = tmp_path / "api"
    entries = {s["series_id"]: s for s in read(api / "series.json")["series"]}
    # Suez publishes its forecast, with no link to scores it does not have.
    assert entries.keys() == {"gpr_daily", *PORTS}
    assert "scores" not in entries["suez_transits"]["links"]
    assert not (api / "series" / "suez_transits" / "scores.json").exists()
    assert [s["series_id"] for s in read(api / "scores.json")["series"]] == [
        "gpr_daily",
        "hormuz_transits",
        "bab_el_mandeb_transits",
        "taiwan_strait_transits",
    ]
    assert (api / "series" / "taiwan_strait_transits" / "scores.json").exists()
    row = [line for line in summary().splitlines() if "suez" in line][-1]
    assert row.startswith("| suez_transits | ok | 2026-10-25 |")
    assert "scores failed: ValueError: a broken vintage" in row
    assert output.read_text(encoding="utf-8").endswith("calibration_red=\n")


def test_a_suspect_newest_value_moves_the_origin_back_a_day_and_the_note_says_so_only_while_it_does(
    tmp_path, monkeypatch, stub_model, short_backfill
):
    archive_dir = tmp_path / "archive"
    serve(monkeypatch, sea_lanes())
    run_on(
        monkeypatch,
        datetime(2026, 10, 30, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "day1",
        archive_dir,
    )

    # Upstream revises the archived newest day to a dropout: its forecast exists, so nothing starts a day early.
    serve(monkeypatch, with_day(sea_lanes(), "Taiwan Strait", "2026-10-25", 24))
    run_on(
        monkeypatch,
        datetime(2026, 10, 31, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "day2",
        archive_dir,
    )

    entry = {
        s["series_id"]: s for s in read(tmp_path / "day2" / "series.json")["series"]
    }["taiwan_strait_transits"]
    assert entry["latest_reference_date"] == "2026-10-25"
    assert entry["note"] == TAIWAN_STRAIT_TRANSITS.note

    # The next batch ends on a dropout: the latest forecast starts from the day before, and the note says why.
    serve(
        monkeypatch,
        with_day(sea_lanes("2026-11-01"), "Taiwan Strait", "2026-11-01", 24),
        edited=NEXT_EDIT,
    )
    run_on(
        monkeypatch,
        datetime(2026, 11, 5, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "day3",
        archive_dir,
    )

    entry = {
        s["series_id"]: s for s in read(tmp_path / "day3" / "series.json")["series"]
    }["taiwan_strait_transits"]
    assert (entry["last_observation_date"], entry["latest_reference_date"]) == (
        "2026-11-01",
        "2026-10-31",
    )
    assert entry["note"].startswith("The value of 2026-11-01 is under review")
    assert entry["note"].endswith(TAIWAN_STRAIT_TRANSITS.note)
    # The other lanes are not held: their latest forecast starts from their newest day.
    suez = {
        s["series_id"]: s for s in read(tmp_path / "day3" / "series.json")["series"]
    }["suez_transits"]
    assert (suez["latest_reference_date"], suez["note"]) == ("2026-11-01", None)


def test_an_archive_of_single_series_manifests_reads_and_stays_byte_identical_under_a_run_of_every_series(
    tmp_path, monkeypatch, stub_model, short_backfill
):
    archive_dir = tmp_path / "archive"
    # As the archive branch began: one GPR run, written before the upstream stamps, one series in its manifest.
    observed = gpr.parse(RECORDED_GPR.read_bytes())
    archive.write(
        archive_dir,
        [
            archive.SeriesRun(
                GPR_DAILY,
                [cli.forecast(StubModel(), observed, GPR_DAILY.horizon)],
                observed,
                date(2026, 10, 30),
                {},
            )
        ],
        code_commit="0" * 40,
        run_url=None,
        generated_at=datetime(2026, 10, 30, 0, 49, 14, tzinfo=UTC),
    )
    manifest_path = archive_dir / "runs" / "2026-10-30.json"
    old = read(manifest_path)
    del old["upstream"]
    manifest_path.write_text(json.dumps(old, indent=2), encoding="utf-8", newline="\n")
    archive_before = files(archive_dir)
    serve(monkeypatch, sea_lanes())

    run_on(
        monkeypatch,
        datetime(2026, 10, 31, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "api",
        archive_dir,
    )

    after = files(archive_dir)
    assert {p: after[p] for p in archive_before} == archive_before
    assert sorted(
        p.relative_to(archive_dir).as_posix() for p in set(after) - set(archive_before)
    ) == [
        "model-output/aseri-timestral209m/2026-10-31-aseri-timestral209m.csv",
        "runs/2026-10-31.json",
        "target-data/deltas/2026-10-31.csv",
    ]
    index = read(tmp_path / "api" / "series" / "gpr_daily" / "forecasts.json")[
        "forecasts"
    ]
    assert [
        (f["reference_date"], f["forecast_date"], f["forecast_mode"]) for f in index
    ][-1] == (
        "2026-10-26",
        "2026-10-30",
        "live",
    )
    # The archived live forecast, and the 14 days before it backfilled.
    assert len(index) == 15
    catalog = read(tmp_path / "api" / "series.json")
    assert [s["series_id"] for s in catalog["series"]] == ["gpr_daily", *PORTS]


# Brent and the drones through a whole run, with hand-made files and PortWatch down.


def test_brent_and_the_drones_run_end_to_end_on_trading_days_and_with_a_fall_flagged(
    tmp_path, monkeypatch, stub_model, short_backfill
):
    prints = pd.bdate_range("2025-09-01", "2026-10-27")
    brent = "observation_date,DCOILBRENTEU\n" + "".join(
        f"{d:%Y-%m-%d},{100 + i % 5:.2f}\n" for i, d in enumerate(prints)
    )
    # 1500 drones a day to 2026-10-30, but the total falls by 50 on the 29th: a correction.
    days = pd.date_range("2025-09-01", "2026-10-30")
    totals = [1500 * i for i in range(len(days))]
    totals[-2] = totals[-3] - 50
    totals[-1] = totals[-2] + 1500
    reports = [
        {"date": f"{d:%Y-%m-%d}", "day": i + 2, "drone": t}
        for i, (d, t) in enumerate(zip(days, totals))
    ]
    clock = SimpleNamespace(now=lambda tz: datetime(2026, 10, 30, 7, 2, tzinfo=UTC))
    monkeypatch.setattr(fred, "datetime", clock)
    monkeypatch.setattr(losses, "datetime", clock)
    monkeypatch.setattr(fred, "download", lambda url: (brent.encode(), {}))
    monkeypatch.setattr(
        losses, "download", lambda url: (json.dumps(reports).encode(), {})
    )
    archive_dir = tmp_path / "archive"

    run_on(
        monkeypatch,
        datetime(2026, 10, 30, 7, 2, tzinfo=UTC),
        RECORDED_GPR.read_bytes(),
        tmp_path / "api",
        archive_dir,
    )

    rounds = pd.read_csv(
        archive_dir
        / "model-output"
        / "aseri-timestral209m"
        / "2026-10-30-aseri-timestral209m.csv"
    )
    brent_dates = pd.DatetimeIndex(
        rounds.loc[rounds["target"] == "brent_spot", "target_end_date"]
    )
    assert not (brent_dates.day_of_week >= 5).any()
    api = tmp_path / "api"
    latest = read(api / "series" / "brent_spot" / "latest.json")
    assert latest["reference_date"] == "2026-10-27"
    assert latest["horizon_unit"] == "trading_day"
    assert latest["target_end_date"][:4] == [
        "2026-10-28",
        "2026-10-29",
        "2026-10-30",
        "2026-11-02",
    ]
    manifest = read(archive_dir / "runs" / "2026-10-30.json")
    assert manifest["upstream"]["ua_drones_downed_claimed"]["revisions"] == [
        "2026-10-29"
    ]
    actuals = read(api / "series" / "ua_drones_downed_claimed" / "actuals.json")
    assert actuals["observation"][-2:] == [-50.0, 1500.0]
    entries = {s["series_id"]: s for s in read(api / "series.json")["series"]}
    assert list(entries) == ["gpr_daily", "brent_spot", "ua_drones_downed_claimed"]
    assert entries["ua_drones_downed_claimed"]["unit"].endswith(
        "claimed by Ukraine's General Staff, one side's figures"
    )


def test_a_day_without_a_drone_report_is_never_archived_forecast_from_or_published_as_a_value(
    tmp_path, monkeypatch, short_backfill
):
    model = StubModel()
    monkeypatch.setattr(cli, "load_model", lambda: model)
    # 1500 drones a day to 2026-10-30, but no report on Oct 20: the 20th and the 21st, whose
    # difference holds two days, are missing.
    days = pd.date_range("2025-09-01", "2026-10-30")
    reports = [
        {"date": f"{d:%Y-%m-%d}", "day": i + 2, "drone": 1500 * i}
        for i, d in enumerate(days)
        if d != pd.Timestamp("2026-10-20")
    ]
    monkeypatch.setattr(
        losses, "download", lambda url: (json.dumps(reports).encode(), {})
    )
    gap = ["2026-10-20", "2026-10-21"]

    for day in (30, 31):
        clock = SimpleNamespace(
            now=lambda tz, day=day: datetime(2026, 10, day, 7, 2, tzinfo=UTC)
        )
        monkeypatch.setattr(losses, "datetime", clock)
        run_on(
            monkeypatch,
            datetime(2026, 10, day, 7, 2, tzinfo=UTC),
            RECORDED_GPR.read_bytes(),
            tmp_path / "api",
            tmp_path / "archive",
        )

    deltas = pd.concat(
        pd.read_csv(path)
        for path in (tmp_path / "archive" / "target-data" / "deltas").glob("*.csv")
    )
    drones = deltas[deltas["target"] == "ua_drones_downed_claimed"]
    # Every value once, on the first run: the missing days never, and nothing new the day after.
    assert set(drones["as_of"]) == {"2026-10-30"}
    assert not set(gap) & set(drones["target_end_date"])
    issued = {
        f["reference_date"]
        for f in read(tmp_path / "archive" / "runs" / "2026-10-30.json")["forecasts"]
        if f["target"] == "ua_drones_downed_claimed"
    }
    assert not set(gap) & issued
    assert "2026-10-19" in issued and "2026-10-22" in issued
    # The model read the two days as unknown.
    assert any(np.isnan(context).sum() == 2 for context in model.contexts)
    actuals = (
        tmp_path / "api" / "series" / "ua_drones_downed_claimed" / "actuals.json"
    ).read_text(encoding="utf-8")
    assert "NaN" not in actuals
    assert not set(gap) & set(json.loads(actuals)["date"])
