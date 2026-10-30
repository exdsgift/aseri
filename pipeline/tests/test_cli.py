"""The daily run end to end: fetch, forecast, archive and publish, with a recorded GPR file and a stub model."""

import io
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest
import torch

import aseri.__main__ as cli
from aseri.sources import gpr

# The last 60 days of the upstream file as downloaded on 2026-10-29.
RECORDED_GPR = Path(__file__).parent / "fixtures" / "gpr_daily_recent.dta"
LEVELS = (
    0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5,
    0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99,
)  # fmt: skip


class StubModel:
    """Stands in for Timestral: the last value, in a band that widens with each step."""

    def forecast(self, context, prediction_length):
        steps = np.arange(1, prediction_length + 1)[:, None]
        band = context[-1] + steps * (np.array(LEVELS) - 0.5)
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
    monkeypatch.setattr(gpr, "download", lambda url: gpr_file)
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
    monkeypatch.setattr(gpr, "download", lambda url: RECORDED_GPR.read_bytes())

    before = datetime.now(UTC).date().isoformat()
    cli.main(tmp_path / "api", tmp_path / "archive")
    run_days = {before, datetime.now(UTC).date().isoformat()}

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
    monkeypatch.setattr(gpr, "download", lambda url: RECORDED_GPR.read_bytes())
    monkeypatch.setenv("GITHUB_SHA", "f" * 40)
    monkeypatch.setenv("GITHUB_SERVER_URL", "https://github.com")
    monkeypatch.setenv("GITHUB_REPOSITORY", "exdsgift/aseri")
    monkeypatch.setenv("GITHUB_RUN_ID", "42")

    cli.main(tmp_path / "api", tmp_path / "archive")

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

    # Day 1, on an empty archive: one live forecast from the newest day.
    run_on(
        monkeypatch,
        datetime(2026, 10, 20, 7, 2, tzinfo=UTC),
        recorded_gpr_until("2026-10-19"),
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
    assert len(pd.read_csv(rounds / "2026-10-20-aseri-timestral209m.csv")) == 28 * 21
    assert len(pd.read_csv(deltas / "2026-10-20.csv")) == 53
    day1 = read(tmp_path / "day1" / "series" / "gpr_daily" / "forecasts.json")
    assert [(f["reference_date"], f["forecast_mode"]) for f in day1["forecasts"]] == [
        ("2026-10-19", "live")
    ]

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
    assert [
        (f["reference_date"], f["forecast_date"], f["forecast_mode"])
        for f in index["forecasts"]
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
    index = read(tmp_path / "day2" / "series" / "gpr_daily" / "forecasts.json")
    assert [f["reference_date"] for f in index["forecasts"]] == ["2026-10-26"]
