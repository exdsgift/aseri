import hashlib
import json
from datetime import UTC, date, datetime
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest
import torch

from aseri import archive
from aseri.forecast import Forecast, forecast, make_context
from aseri.series import GPR_DAILY


def days_to(last_day, values):
    dates = pd.date_range(end=last_day, periods=len(values), freq="D")
    return pd.Series(values, index=dates, dtype=float)


def two_step_forecast(reference_date, shift=0.0):
    return Forecast(
        reference_date=pd.Timestamp(reference_date),
        levels=(0.1, 0.5, 0.9),
        quantiles=np.array(
            [[90.1, 100.2, 110.3], [85.4, 101.5, 120.6]], dtype=np.float32
        )
        + shift,
    )


UPSTREAM = {
    "source_url": "https://www.matteoiacoviello.com/gpr_files/data_gpr_daily_recent.dta",
    "sha256": "cd" * 32,
    "last_modified": "Mon, 26 Oct 2026 17:55:26 GMT",
    "etag": '"6adf940e-185ee0"',
}


def archive_run(archive_dir, forecasts, observed, run_day):
    archive.write(
        archive_dir,
        GPR_DAILY,
        forecasts,
        observed=observed,
        as_of=run_day,
        upstream=UPSTREAM,
        code_commit="0123abc",
        run_url="https://github.com/exdsgift/aseri/actions/runs/1",
        generated_at=datetime(
            run_day.year, run_day.month, run_day.day, 7, 3, 12, tzinfo=UTC
        ),
    )


def test_a_round_holds_every_level_of_every_forecast_in_the_long_hubverse_shape(
    tmp_path,
):
    observed = days_to("2026-10-26", [120.5, 98.23, 101.3])

    archive_run(
        tmp_path,
        [two_step_forecast("2026-10-25"), two_step_forecast("2026-10-26", shift=1)],
        observed,
        date(2026, 10, 29),
    )

    round_file = (
        tmp_path
        / "model-output"
        / "aseri-timestral209m"
        / "2026-10-29-aseri-timestral209m.csv"
    )
    assert round_file.read_text(encoding="utf-8").splitlines() == [
        "forecast_date,target,reference_date,horizon,target_end_date,output_type,output_type_id,value",
        "2026-10-29,gpr_daily,2026-10-25,1,2026-10-26,quantile,0.1,90.1",
        "2026-10-29,gpr_daily,2026-10-25,1,2026-10-26,quantile,0.5,100.2",
        "2026-10-29,gpr_daily,2026-10-25,1,2026-10-26,quantile,0.9,110.3",
        "2026-10-29,gpr_daily,2026-10-25,2,2026-10-27,quantile,0.1,85.4",
        "2026-10-29,gpr_daily,2026-10-25,2,2026-10-27,quantile,0.5,101.5",
        "2026-10-29,gpr_daily,2026-10-25,2,2026-10-27,quantile,0.9,120.6",
        "2026-10-29,gpr_daily,2026-10-26,1,2026-10-27,quantile,0.1,91.1",
        "2026-10-29,gpr_daily,2026-10-26,1,2026-10-27,quantile,0.5,101.2",
        "2026-10-29,gpr_daily,2026-10-26,1,2026-10-27,quantile,0.9,111.3",
        "2026-10-29,gpr_daily,2026-10-26,2,2026-10-28,quantile,0.1,86.4",
        "2026-10-29,gpr_daily,2026-10-26,2,2026-10-28,quantile,0.5,102.5",
        "2026-10-29,gpr_daily,2026-10-26,2,2026-10-28,quantile,0.9,121.6",
    ]


def test_an_empty_archive_backfills_the_newest_date_and_the_120_days_before_it():
    observed = days_to("2026-10-26", range(200))

    dates = archive.new_reference_dates(observed, [])

    assert dates == pd.date_range("2026-06-28", "2026-10-26").tolist()
    assert len(dates) == 121


def test_an_archive_with_only_a_later_forecast_backfills_the_days_before_it():
    observed = days_to("2026-10-26", range(200))

    dates = archive.new_reference_dates(observed, [pd.Timestamp("2026-10-26")])

    assert dates == pd.date_range("2026-06-28", "2026-10-25").tolist()


def test_a_jump_of_several_days_forecasts_from_every_new_date_in_order():
    observed = days_to("2026-10-26", range(200))
    archived = observed.index[observed.index <= "2026-10-23"].tolist()

    assert archive.new_reference_dates(observed, archived) == [
        pd.Timestamp("2026-10-24"),
        pd.Timestamp("2026-10-25"),
        pd.Timestamp("2026-10-26"),
    ]


def test_a_jump_past_the_window_still_forecasts_every_day_after_the_archive():
    observed = days_to("2026-10-26", range(200))

    dates = archive.new_reference_dates(observed, [pd.Timestamp("2026-05-01")])

    assert dates == pd.date_range("2026-05-02", "2026-10-26").tolist()


def test_data_that_has_not_moved_forecasts_nothing():
    observed = days_to("2026-10-26", range(200))

    assert archive.new_reference_dates(observed, observed.index.tolist()) == []


def test_the_first_delta_holds_the_whole_series():
    observed = days_to("2026-10-26", [120.5, 98.23, 101.3])

    delta = archive.observation_delta(observed, pd.Series(dtype=float))

    assert delta.equals(observed)


def test_a_delta_holds_only_the_days_that_are_new_or_revised():
    vintage = days_to("2026-10-25", [120.5, 98.23, 101.3])
    observed = days_to("2026-10-27", [120.5, 98.23, 99.8, 140.0, 0.0])

    delta = archive.observation_delta(observed, vintage)

    assert delta.to_dict() == {
        pd.Timestamp("2026-10-25"): 99.8,
        pd.Timestamp("2026-10-26"): 140.0,
        pd.Timestamp("2026-10-27"): 0.0,
    }


def test_the_first_run_records_every_observation_and_later_runs_only_the_new_or_revised(
    tmp_path,
):
    archive_run(
        tmp_path,
        [two_step_forecast("2026-10-26")],
        days_to("2026-10-26", [120.5, 98.23, 101.3]),
        date(2026, 10, 29),
    )
    archive_run(
        tmp_path,
        [two_step_forecast("2026-11-01")],
        days_to(
            "2026-11-01", [120.5, 98.23, 99.8, 140.0, 0.0, 87.5, 90.25, 110.0, 110.0]
        ),
        date(2026, 11, 2),
    )

    deltas = tmp_path / "target-data" / "deltas"
    assert (deltas / "2026-10-29.csv").read_text(encoding="utf-8").splitlines() == [
        "target,target_end_date,observation,as_of",
        "gpr_daily,2026-10-24,120.5,2026-10-29",
        "gpr_daily,2026-10-25,98.23,2026-10-29",
        "gpr_daily,2026-10-26,101.3,2026-10-29",
    ]
    assert (deltas / "2026-11-02.csv").read_text(encoding="utf-8").splitlines() == [
        "target,target_end_date,observation,as_of",
        "gpr_daily,2026-10-26,99.8,2026-11-02",
        "gpr_daily,2026-10-27,140.0,2026-11-02",
        "gpr_daily,2026-10-28,0.0,2026-11-02",
        "gpr_daily,2026-10-29,87.5,2026-11-02",
        "gpr_daily,2026-10-30,90.25,2026-11-02",
        "gpr_daily,2026-10-31,110.0,2026-11-02",
        "gpr_daily,2026-11-01,110.0,2026-11-02",
    ]


def test_the_as_of_view_holds_each_value_as_it_was_known_on_that_day(tmp_path):
    archive_run(
        tmp_path, [], days_to("2026-10-26", [120.5, 98.23, 101.3]), date(2026, 10, 29)
    )
    # A second vintage revises 2026-10-26 and adds a day.
    archive_run(
        tmp_path,
        [],
        days_to("2026-10-27", [120.5, 98.23, 99.8, 140.0]),
        date(2026, 11, 2),
    )

    def view(t):
        return archive.as_of_view(tmp_path, "gpr_daily", t).to_dict()

    assert view(date(2026, 10, 28)) == {}
    assert (
        view(date(2026, 11, 1))
        == days_to("2026-10-26", [120.5, 98.23, 101.3]).to_dict()
    )
    assert (
        view(date(2026, 11, 2))
        == days_to("2026-10-27", [120.5, 98.23, 99.8, 140.0]).to_dict()
    )


def test_the_as_of_view_never_returns_a_day_after_its_date(tmp_path):
    # An upstream file dated ahead of its download, which the view must not pass on.
    archive_run(
        tmp_path, [], days_to("2026-10-31", [120.5, 98.23, 101.3]), date(2026, 10, 30)
    )

    assert archive.as_of_view(tmp_path, "gpr_daily", date(2026, 10, 30)).to_dict() == {
        pd.Timestamp("2026-10-29"): 120.5,
        pd.Timestamp("2026-10-30"): 98.23,
    }


def since_2023(last_day="2026-10-26"):
    days = pd.date_range("2023-01-01", last_day, freq="D")
    return pd.Series(100.0 + np.arange(len(days)) % 50, index=days)


def test_a_rewrite_older_than_the_revision_window_holds_the_run(tmp_path):
    archive_run(tmp_path, [], since_2023(), date(2026, 10, 27))
    revised = since_2023()
    revised["2023-05-01"] = 250.0

    with pytest.raises(archive.RevisionHold, match="90-day.*2023-05-01"):
        archive.check_revisions(tmp_path, GPR_DAILY, revised, date(2026, 10, 28))


def test_revisions_within_the_window_and_new_days_pass(tmp_path):
    archive_run(tmp_path, [], since_2023(), date(2026, 10, 27))
    # GPR's weekly update: a new week, and every day back to 90 before its newest revised.
    revised = since_2023("2026-11-02")
    revised["2026-08-04":] += 1.5

    archive.check_revisions(tmp_path, GPR_DAILY, revised, date(2026, 11, 3))


@pytest.mark.parametrize(
    "truncated",
    [since_2023()[:"2026-06-01"], since_2023()["2023-03-01":]],
    ids=["its newest months", "its first months"],
)
def test_a_file_that_drops_archived_days_holds_the_run(tmp_path, truncated):
    # A broken download: still continuous, every value it keeps unchanged, but shorter.
    archive_run(tmp_path, [], since_2023(), date(2026, 10, 27))

    with pytest.raises(archive.RevisionHold, match="dropped"):
        archive.check_revisions(tmp_path, GPR_DAILY, truncated, date(2026, 10, 28))


class RecordingStub:
    """Stands in for Timestral and keeps every context it reads; its band scales with the whole context, so any leak moves it."""

    def __init__(self):
        self.contexts = []

    def forecast(self, context, prediction_length):
        self.contexts.append(context)
        levels = (0.1, 0.5, 0.9)
        steps = np.arange(1, prediction_length + 1)[:, None]
        band = context.mean() + steps * context.std() * (np.array(levels) - 0.5)
        return SimpleNamespace(
            quantiles=torch.tensor(band)[None, None], quantile_levels=levels
        )


def test_a_forecast_from_the_archive_is_blind_to_every_value_and_vintage_after_its_origin(
    tmp_path,
):
    origin = date(2026, 10, 27)
    first = days_to("2026-10-19", [120.5, 98.23, 101.3, 99.8, 140.0])
    # Revises 2026-10-18 and adds the days to the origin.
    second = days_to(
        "2026-10-27",
        [120.5, 98.23, 101.3, 87.5, 140.0, 90.25, 110.0, 105.5, 0.0, 99.0, 101.0, 130.4, 77.7],
    )  # fmt: skip
    clean, poisoned = tmp_path / "clean", tmp_path / "poisoned"
    archive_run(clean, [], first, date(2026, 10, 20))
    archive_run(clean, [], second, origin)
    archive_run(poisoned, [], first, date(2026, 10, 20))
    # Days after the origin in a vintage of the origin, then a later vintage that rewrites everything.
    archive_run(
        poisoned, [], pd.concat([second, days_to("2026-10-30", [1e9] * 3)]), origin
    )
    archive_run(poisoned, [], days_to("2026-11-01", [1e9] * 18), date(2026, 11, 2))

    def forecast_from(archive_dir):
        model = RecordingStub()
        context = make_context(
            GPR_DAILY,
            archive.as_of_view(archive_dir, "gpr_daily", origin),
            pd.Timestamp(origin),
        )
        return forecast(model, context, horizon=3), model.contexts

    clean_forecast, clean_contexts = forecast_from(clean)
    poisoned_forecast, poisoned_contexts = forecast_from(poisoned)

    assert archive.as_of_view(poisoned, "gpr_daily", date(2026, 11, 2)).max() == 1e9
    assert clean_contexts[0].tolist() == second.tolist()
    assert poisoned_contexts[0].tobytes() == clean_contexts[0].tobytes()
    assert poisoned_forecast.quantiles.tobytes() == clean_forecast.quantiles.tobytes()
    assert poisoned_forecast.reference_date == pd.Timestamp(origin)


def test_a_second_run_on_the_same_day_never_rewrites_the_archive(tmp_path):
    observed = days_to("2026-10-26", [120.5, 98.23, 101.3])
    archive_run(
        tmp_path, [two_step_forecast("2026-10-26")], observed, date(2026, 10, 29)
    )
    before = {p: p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}

    with pytest.raises(FileExistsError):
        archive_run(
            tmp_path,
            [two_step_forecast("2026-10-26", shift=1)],
            observed,
            date(2026, 10, 29),
        )

    assert {p: p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()} == before


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def test_a_run_manifest_records_the_modes_provenance_inputs_upstream_file_and_checksums(
    tmp_path,
):
    observed = days_to("2026-10-26", [120.5, 98.23, 101.3])

    archive_run(
        tmp_path,
        [two_step_forecast("2026-10-25"), two_step_forecast("2026-10-26")],
        observed,
        date(2026, 10, 29),
    )

    manifest = json.loads(
        (tmp_path / "runs" / "2026-10-29.json").read_text(encoding="utf-8")
    )
    data = {
        "source_url": "https://www.matteoiacoviello.com/gpr_files/data_gpr_daily_recent.dta",
        "as_of": "2026-10-29",
    }
    round_file = "model-output/aseri-timestral209m/2026-10-29-aseri-timestral209m.csv"
    delta_file = "target-data/deltas/2026-10-29.csv"
    assert manifest == {
        "forecast_date": "2026-10-29",
        "model_id": "aseri-timestral209m",
        "forecasts": [
            {
                "target": "gpr_daily",
                "reference_date": "2026-10-25",
                "forecast_mode": "retrospective",
                "data": data
                | {"input_sha256": sha256(b"2026-10-24,120.5\n2026-10-25,98.23\n")},
            },
            {
                "target": "gpr_daily",
                "reference_date": "2026-10-26",
                "forecast_mode": "live",
                "data": data
                | {
                    "input_sha256": sha256(
                        b"2026-10-24,120.5\n2026-10-25,98.23\n2026-10-26,101.3\n"
                    )
                },
            },
        ],
        "upstream": {"gpr_daily": UPSTREAM},
        "provenance": {
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
            "generated_at": "2026-10-29T07:03:12Z",
            "leakage_note": "Timestral's training-data cutoff is not published; backtests may be optimistic.",
        },
        "files": {
            round_file: sha256((tmp_path / round_file).read_bytes()),
            delta_file: sha256((tmp_path / delta_file).read_bytes()),
        },
    }


def test_a_forecast_from_the_newest_day_is_retrospective_when_the_archive_holds_a_newer_one(
    tmp_path,
):
    archive_run(
        tmp_path,
        [two_step_forecast("2026-10-26")],
        days_to("2026-10-26", [120.5, 98.23, 101.3]),
        date(2026, 10, 29),
    )

    # Upstream has dropped its newest day, and the backfill fills the days before the archived forecast.
    archive_run(
        tmp_path,
        [two_step_forecast("2026-10-24"), two_step_forecast("2026-10-25")],
        days_to("2026-10-25", [120.5, 98.23]),
        date(2026, 10, 30),
    )

    manifest = json.loads(
        (tmp_path / "runs" / "2026-10-30.json").read_text(encoding="utf-8")
    )
    assert [
        (f["reference_date"], f["forecast_mode"]) for f in manifest["forecasts"]
    ] == [("2026-10-24", "retrospective"), ("2026-10-25", "retrospective")]


def test_archived_forecasts_read_back_oldest_first_with_the_run_that_issued_them(
    tmp_path,
):
    archive_run(
        tmp_path,
        [two_step_forecast("2026-10-25"), two_step_forecast("2026-10-26")],
        days_to("2026-10-26", [120.5, 98.23, 101.3]),
        date(2026, 10, 29),
    )
    archive_run(
        tmp_path,
        [two_step_forecast("2026-10-27", shift=1)],
        days_to("2026-10-27", [120.5, 98.23, 101.3, 99.0]),
        date(2026, 10, 30),
    )

    archived = archive.read(tmp_path, "gpr_daily")

    assert [
        (a.forecast.reference_date, a.forecast_date, a.provenance["forecast_mode"])
        for a in archived
    ] == [
        (pd.Timestamp("2026-10-25"), "2026-10-29", "retrospective"),
        (pd.Timestamp("2026-10-26"), "2026-10-29", "live"),
        (pd.Timestamp("2026-10-27"), "2026-10-30", "live"),
    ]
    newest = archived[-1]
    assert newest.forecast.levels == (0.1, 0.5, 0.9)
    assert newest.forecast.quantiles.tolist() == [
        [91.1, 101.2, 111.3],
        [86.4, 102.5, 121.6],
    ]
    assert newest.provenance["generated_at"] == "2026-10-30T07:03:12Z"
    assert newest.provenance["data"]["as_of"] == "2026-10-30"


def test_an_empty_archive_has_no_forecasts(tmp_path):
    assert archive.read(tmp_path, "gpr_daily") == []


def test_archived_forecasts_keep_the_model_that_made_them_after_a_model_change(
    tmp_path, monkeypatch
):
    archive_run(
        tmp_path,
        [two_step_forecast("2026-10-26")],
        days_to("2026-10-26", [120.5, 98.23, 101.3]),
        date(2026, 10, 29),
    )
    monkeypatch.setattr(archive, "MODEL_ID", "aseri-timestral209m-v2")

    (archived,) = archive.read(tmp_path, "gpr_daily")

    assert archived.model_id == "aseri-timestral209m"
    assert archived.forecast.quantiles.shape == (2, 3)
