"""The bulk downloads: every forecast, observation and score of the archive as Hubverse tables, and their data package."""

import gzip
import json
import shutil
from dataclasses import replace
from datetime import UTC, date, datetime
from pathlib import Path

import jsonschema
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.csv as pacsv
import pyarrow.parquet as pq
import pytest

import aseri.forecast as forecast_module
from aseri import archive, bulk, gate, record
from aseri.__main__ import SOURCES
from aseri.forecast import MODEL_ID, WEIGHTS, Forecast
from aseri.publish import FORECAST_LICENSE, credit
from aseri.series import BRENT_SPOT, GPR_DAILY, SUEZ_TRANSITS

BEFORE = "aseri-timestral209m"
HUBVERSE = [
    "forecast_date",
    "target",
    "reference_date",
    "horizon",
    "target_end_date",
    "output_type",
    "output_type_id",
    "value",
]
# The Data Package v2 profile, from https://datapackage.org/profiles/2.0/datapackage.json.
PROFILE = Path(__file__).parent / "fixtures" / "datapackage-2.0-profile.json"
FIXTURES = Path(__file__).resolve().parents[2] / "web" / "src" / "fixtures"
GENERATED_AT = datetime(2027, 1, 1, 7, 2, tzinfo=UTC)


def two_steps(reference_date, shift=0.0):
    return Forecast(
        reference_date=pd.Timestamp(reference_date),
        # The levels of the page's two ranges, which the record scores.
        levels=(0.1, 0.25, 0.5, 0.75, 0.9),
        quantiles=np.array(
            [[38.5, 40.0, 41.0, 42.5, 44.25], [37.0, 39.5, 41.5, 43.0, 46.0]]
        )
        + shift,
    )


def ships(last_day):
    dates = pd.date_range(end=last_day, periods=60, freq="D")
    return pd.Series(40.0 + dates.day % 4, index=dates)


def gpr(last_day):
    dates = pd.date_range(end=last_day, periods=60, freq="D")
    return pd.Series(100.0 + dates.day / 8, index=dates)


def run(archive_dir, day, forecasts):
    """Archive a run on `day` of Suez, with `forecasts`, and GPR's values, with none."""
    observed = pd.Timestamp(day) - pd.Timedelta(days=1)
    archive.write(
        archive_dir,
        [
            archive.SeriesRun(SUEZ_TRANSITS, forecasts, ships(observed), day, {}),
            archive.SeriesRun(GPR_DAILY, [], gpr(observed), day, {}),
        ],
        code_commit="0" * 40,
        run_url=None,
        generated_at=datetime(day.year, day.month, day.day, 7, tzinfo=UTC),
    )


@pytest.fixture
def hub(tmp_path, monkeypatch):
    """An archive across a new year: the model before on Dec 30, the model in the code on Dec 31 and Jan 1."""
    archive_dir = tmp_path / "archive"
    with monkeypatch.context() as before:
        before.setattr(archive, "MODEL_ID", BEFORE)
        before.setattr(archive, "ROUNDS", Path("model-output", BEFORE))
        run(archive_dir, date(2026, 12, 30), [two_steps("2026-12-29")])
    run(
        archive_dir,
        date(2026, 12, 31),
        [two_steps("2026-12-29", 1), two_steps("2026-12-30", 1)],
    )
    run(archive_dir, date(2027, 1, 1), [two_steps("2026-12-31", 2)])
    return archive_dir


def scores(archive_dir, today):
    """Every model's scores of Suez, as the daily run hands them to the bulk files."""
    archived = archive.read(archive_dir, SUEZ_TRANSITS.id)
    vintages = archive.vintages(archive_dir, SUEZ_TRANSITS.id)
    return [
        record.scored(
            SUEZ_TRANSITS, archived, vintages, pd.Timestamp(today), model_id=model
        ).assign(model_id=model, target=SUEZ_TRANSITS.id)
        for model in (MODEL_ID, BEFORE)
    ]


def write(bulk_dir, archive_dir, today="2027-01-01"):
    """The bulk files of a run on `today` at 07:02."""
    generated_at = datetime.fromisoformat(today).replace(hour=7, minute=2, tzinfo=UTC)
    bulk.write(bulk_dir, archive_dir, SOURCES, scores(archive_dir, today), generated_at)
    return bulk_dir


def resources(bulk_dir):
    package = json.loads((bulk_dir / "datapackage.json").read_text(encoding="utf-8"))
    return {resource["path"]: resource for resource in package["resources"]}


def aseri(model):
    """aseri's licence as the data package gives it, with the credit of `model`."""
    return {
        "title": "CC BY-NC 4.0",
        "path": "https://creativecommons.org/licenses/by-nc/4.0/",
        "attribution": credit(model, WEIGHTS),
    }


def table(path, fields):
    """A CSV read in the types its data package gives."""
    return pacsv.read_csv(
        path,
        convert_options=pacsv.ConvertOptions(
            column_types={name: bulk.ARROW[t] for name, t in fields.items()}
        ),
    )


def test_each_year_s_forecasts_are_one_collected_hub_table_of_every_model(
    hub, tmp_path
):
    files = write(tmp_path / "bulk", hub)

    rounds = sorted(hub.glob("model-output/*/*.csv"))
    for year in ("2026", "2027"):
        csv = pd.read_csv(files / f"forecasts-{year}.csv.gz", dtype=str)
        # collect_hub's shape: the round's rows as archived, after the model that made them.
        assert csv.columns.tolist() == ["model_id", *HUBVERSE]
        archived = pd.concat(
            pd.read_csv(path, dtype=str).assign(model_id=path.parent.name)
            for path in rounds
            if path.name.startswith(year)
        )[["model_id", *HUBVERSE]]
        pd.testing.assert_frame_equal(csv, archived.reset_index(drop=True))
        parquet = pq.read_table(files / f"forecasts-{year}.parquet")
        assert parquet.equals(table(files / f"forecasts-{year}.csv.gz", bulk.FORECASTS))
        assert parquet.schema.types == [
            pa.string(),
            pa.date32(),
            pa.string(),
            pa.date32(),
            pa.int64(),
            pa.date32(),
            pa.string(),
            pa.float64(),
            pa.float64(),
        ]
    # A forecast's year is its run's: the model before and the one in the code, told apart.
    assert pd.read_csv(files / "forecasts-2026.csv.gz").groupby("model_id")[
        "forecast_date"
    ].unique().map(list).to_dict() == {
        BEFORE: ["2026-12-30"],
        MODEL_ID: ["2026-12-31"],
    }
    assert set(pd.read_csv(files / "forecasts-2027.csv.gz")["model_id"]) == {MODEL_ID}


def test_a_closed_year_is_written_byte_for_byte_again_while_the_current_year_grows(
    hub, tmp_path
):
    new_year = write(tmp_path / "jan1", hub)
    run(hub, date(2027, 1, 2), [two_steps("2027-01-01", 3)])
    next_day = write(tmp_path / "jan2", hub, today="2027-01-02")

    for name in ("forecasts-2026.parquet", "forecasts-2026.csv.gz"):
        assert (next_day / name).read_bytes() == (new_year / name).read_bytes()
    # gzip's header holds no write time, which would change the bytes each day.
    assert (new_year / "forecasts-2026.csv.gz").read_bytes()[4:8] == bytes(4)
    assert pq.read_metadata(next_day / "forecasts-2027.parquet").num_rows == 2 * (
        pq.read_metadata(new_year / "forecasts-2027.parquet").num_rows
    )


def test_the_observations_are_a_hubverse_time_series_with_a_csv_per_source(
    hub, tmp_path
):
    files = write(tmp_path / "bulk", hub)

    deltas = pd.concat(
        pd.read_csv(path, dtype=str)
        for path in sorted(hub.glob("target-data/deltas/*.csv"))
    ).reset_index(drop=True)
    assert deltas.columns.tolist() == [
        "target",
        "target_end_date",
        "observation",
        "as_of",
    ]
    assert pq.read_table(files / "time-series.parquet").equals(
        pa.Table.from_pandas(deltas, preserve_index=False).cast(
            pa.schema((name, bulk.ARROW[t]) for name, t in bulk.TIME_SERIES.items())
        )
    )
    # Each source's change-log apart, so that each file has one licence; PortWatch's four sea lanes share one.
    for source, targets in {
        "gpr": ["gpr_daily"],
        "portwatch": ["suez_transits"],
        "wikimedia": [],
    }.items():
        csv = pd.read_csv(files / f"time-series-{source}.csv", dtype=str)
        pd.testing.assert_frame_equal(
            csv,
            deltas[deltas["target"].isin(targets)].reset_index(drop=True),
            check_index_type=False,
        )


def test_the_oracle_output_is_every_due_day_s_value_from_the_vintages_even_with_no_scores(
    hub, tmp_path
):
    run(hub, date(2027, 1, 20), [])
    files = tmp_path / "bulk"
    # A scoring failure costs the scores, never the values known.
    bulk.write(files, hub, SOURCES, [], datetime(2027, 1, 20, 7, tzinfo=UTC))

    oracle = pd.read_csv(files / "oracle-output.csv", dtype=str)
    assert oracle.columns.tolist() == [
        "target",
        "target_end_date",
        "oracle_value",
        "as_of",
    ]
    for series in (SUEZ_TRANSITS, GPR_DAILY):
        vintages = archive.vintages(hub, series.id)
        # Every day seen, once its series' score lag has passed: 14 days for Suez, 35 for GPR.
        due = [
            day
            for day in vintages["target_end_date"].drop_duplicates().sort_values()
            if day + pd.Timedelta(days=series.score_lag) <= pd.Timestamp("2027-01-20")
        ]
        rows = oracle[oracle["target"] == series.id]
        assert rows["target_end_date"].tolist() == [f"{day:%Y-%m-%d}" for day in due]
        for _, row in rows.iterrows():
            value, as_of = record.settled(
                vintages, pd.Timestamp(row["target_end_date"]), series.score_lag
            )
            assert (float(row["oracle_value"]), row["as_of"]) == (
                value,
                f"{as_of:%Y-%m-%d}",
            )


def test_a_registered_measurement_error_has_no_oracle_value(hub, tmp_path, monkeypatch):
    monkeypatch.setattr(
        forecast_module,
        "ANOMALIES",
        pd.DataFrame(
            {
                "series_id": ["suez_transits"],
                "date": pd.to_datetime(["2026-12-20"]),
                "evidence": ["a test entry"],
            }
        ),
    )
    run(hub, date(2027, 1, 20), [])
    files = write(tmp_path / "bulk", hub, today="2027-01-20")

    oracle = pd.read_csv(files / "oracle-output.csv", dtype=str)
    suez = oracle.loc[oracle["target"] == "suez_transits", "target_end_date"]
    assert "2026-12-20" not in suez.tolist()
    assert {"2026-12-19", "2026-12-21"} <= set(suez)


def test_each_score_is_against_its_day_s_oracle_value(hub, tmp_path):
    run(hub, date(2027, 1, 20), [])
    files = write(tmp_path / "bulk", hub, today="2027-01-20")

    oracle = pd.read_csv(files / "oracle-output.csv", parse_dates=["target_end_date"])
    scored = pd.read_parquet(files / "scores.parquet")
    scored["observation_date"] = pd.to_datetime(scored["observation_date"])
    joined = scored.merge(
        oracle,
        left_on=["target", "observation_date"],
        right_on=["target", "target_end_date"],
    )
    assert len(joined) == len(scored) > 0
    assert (joined["observation"] == joined["oracle_value"]).all()


def brent_run(archive_dir, day, forecasts, observed):
    archive.write(
        archive_dir,
        [archive.SeriesRun(BRENT_SPOT, forecasts, observed, day, {})],
        code_commit="0" * 40,
        run_url=None,
        generated_at=datetime(day.year, day.month, day.day, 7, tzinfo=UTC),
    )


def test_brent_s_scores_join_its_forecasts_on_their_dates_after_a_holiday_the_calendar_did_not_foresee(
    tmp_path,
):
    # Weekday prints but none on Monday Oct 12, a holiday four months of history cannot foresee:
    # the forecast from Friday Oct 9 dates its step 1 Oct 12, and the record scores it on Tuesday's print.
    prints = pd.bdate_range(end="2026-11-13", periods=90).drop(
        pd.Timestamp("2026-10-12")
    )
    observed = pd.Series(70.0 + np.arange(len(prints)) / 4, index=prints)
    from_friday = Forecast(
        reference_date=pd.Timestamp("2026-10-09"),
        levels=(0.1, 0.25, 0.5, 0.75, 0.9),
        quantiles=np.full((14, 1), 75.0) + [-4.0, -2.0, 0.0, 2.0, 4.0],
    )
    archive_dir = tmp_path / "archive"
    brent_run(archive_dir, date(2026, 10, 10), [from_friday], observed[:"2026-10-09"])
    brent_run(archive_dir, date(2026, 11, 14), [], observed)
    today = pd.Timestamp("2026-11-30")
    scored = record.scored(
        BRENT_SPOT,
        archive.read(archive_dir, BRENT_SPOT.id),
        archive.vintages(archive_dir, BRENT_SPOT.id),
        today,
    )
    files = tmp_path / "bulk"
    bulk.write(
        files,
        archive_dir,
        SOURCES,
        [scored.assign(model_id=MODEL_ID, target=BRENT_SPOT.id)],
        datetime(2026, 11, 30, 7, tzinfo=UTC),
    )

    forecasts = pd.read_parquet(files / "forecasts-2026.parquet")
    scores = pd.read_parquet(files / "scores.parquet")
    keys = ["model_id", "target", "reference_date", "horizon", "target_end_date"]
    # Every step scored joins its forecast on Hubverse's keys, the round's dates included.
    assert len(scores.merge(forecasts[keys].drop_duplicates(), on=keys)) == 14
    first = scores.iloc[0]
    assert (first["target_end_date"], first["observation_date"]) == (
        date(2026, 10, 12),
        date(2026, 10, 13),
    )
    assert first["observation"] == observed["2026-10-13"]
    # The oracle has a value for each day with a price, none for the holiday.
    oracle = pd.read_csv(files / "oracle-output.csv", dtype=str)
    brent = oracle[oracle["target"] == BRENT_SPOT.id].set_index("target_end_date")
    assert "2026-10-12" not in brent.index
    assert float(brent.loc["2026-10-13", "oracle_value"]) == observed["2026-10-13"]


def test_the_scores_hold_every_scored_target_of_every_model_with_its_vintage(
    hub, tmp_path
):
    run(hub, date(2027, 1, 20), [])
    given = scores(hub, "2027-01-20")
    files = write(tmp_path / "bulk", hub, today="2027-01-20")

    parquet = pq.read_table(files / "scores.parquet")
    assert parquet.column_names == list(bulk.SCORES)
    assert parquet.schema.field("observation_as_of").type == pa.date32()
    frame = parquet.to_pandas()
    assert frame.groupby("model_id")["reference_date"].nunique().to_dict() == {
        BEFORE: 1,
        MODEL_ID: 3,
    }
    assert len(frame) == sum(map(len, given))
    assert frame["wis"].tolist() == pd.concat(given)["wis"].tolist()


def test_a_day_with_nothing_scored_yet_still_writes_a_typed_empty_scores_file(
    hub, tmp_path
):
    files = tmp_path / "bulk"
    bulk.write(files, hub, SOURCES, [], GENERATED_AT)

    empty = pq.read_table(files / "scores.parquet")
    assert empty.num_rows == 0
    assert empty.schema.field("reference_date").type == pa.date32()
    # With no model in its rows, the credit is the model in the code's.
    assert resources(files)["scores.parquet"]["licenses"] == [aseri(MODEL_ID)]


def test_a_closed_year_keeps_its_data_package_entry_through_a_model_change(
    hub, tmp_path, monkeypatch
):
    before = resources(write(tmp_path / "jan1", hub))
    # A later model: a new MODEL_ID, and so a new credit in the code, and its first run.
    later = "aseri-timestral209m_c2"
    monkeypatch.setattr(
        bulk,
        "FORECAST_LICENSE",
        FORECAST_LICENSE | {"attribution": credit(later, WEIGHTS)},
    )
    monkeypatch.setattr(archive, "MODEL_ID", later)
    monkeypatch.setattr(archive, "ROUNDS", Path("model-output", later))
    run(hub, date(2027, 1, 2), [two_steps("2027-01-01", 3)])
    after = resources(write(tmp_path / "jan2", hub, today="2027-01-02"))

    for name in ("forecasts-2026.parquet", "forecasts-2026.csv.gz"):
        assert after[name] == before[name]
        # Each model of its rows is credited, the one before too.
        assert after[name]["licenses"] == [aseri(BEFORE), aseri(MODEL_ID)]
    assert after["forecasts-2027.parquet"]["licenses"] == [
        aseri(MODEL_ID),
        aseri(later),
    ]


def test_the_time_series_holds_only_the_series_of_the_package_as_its_csvs_do(
    hub, tmp_path
):
    # A series no longer in SOURCES left its values in the archive; its licence is no longer known.
    archive.write(
        hub,
        [
            archive.SeriesRun(
                replace(SUEZ_TRANSITS, id="retired_lane"),
                [],
                ships("2027-01-01"),
                date(2027, 1, 2),
                {},
            )
        ],
        code_commit="0" * 40,
        run_url=None,
        generated_at=datetime(2027, 1, 2, 7, tzinfo=UTC),
    )
    files = write(tmp_path / "bulk", hub, today="2027-01-02")

    targets = set(pq.read_table(files / "time-series.parquet")["target"].to_pylist())
    in_csvs = set().union(
        *(set(pd.read_csv(p)["target"]) for p in files.glob("time-series-*.csv"))
    )
    assert targets == in_csvs == {"gpr_daily", "suez_transits"}


def test_the_data_package_is_valid_frictionless_and_gives_each_file_its_columns_licences_and_sources(
    hub, tmp_path
):
    files = write(tmp_path / "bulk", hub)
    package = json.loads((files / "datapackage.json").read_text(encoding="utf-8"))

    jsonschema.Draft7Validator(
        json.loads(PROFILE.read_text(encoding="utf-8"))
    ).validate(package)
    resources = {r["path"]: r for r in package["resources"]}
    assert set(resources) == {p.name for p in files.iterdir()} - {"datapackage.json"}
    assert package["created"] == "2027-01-01T07:02:00Z"
    for path, resource in resources.items():
        names = [field["name"] for field in resource["schema"]["fields"]]
        if path.endswith(".parquet"):
            assert pq.read_schema(files / path).names == names
        else:
            with (
                gzip.open(files / path, "rt", encoding="utf-8")
                if path.endswith(".gz")
                else open(files / path, encoding="utf-8") as file
            ):
                assert file.readline().rstrip("\n").split(",") == names
        assert set(resource["schema"]["primaryKey"]) <= set(names)
    # aseri's forecasts and scores are under its own licence, credited to each model of their rows;
    # each source's values under its own terms alone.
    assert resources["forecasts-2026.parquet"]["licenses"] == [
        aseri(BEFORE),
        aseri(MODEL_ID),
    ]
    assert resources["forecasts-2027.csv.gz"]["licenses"] == [aseri(MODEL_ID)]
    assert resources["scores.parquet"]["licenses"] == [aseri(MODEL_ID)]
    assert resources["time-series-gpr.csv"]["licenses"] == [
        {
            "title": "CC BY 4.0",
            "path": "https://creativecommons.org/licenses/by/4.0/",
            "attribution": GPR_DAILY.license["attribution"],
        }
    ]
    assert resources["time-series-portwatch.csv"]["sources"] == [
        {
            "title": "IMF PortWatch, Daily Chokepoints Data",
            "path": "https://portwatch.imf.org/",
        }
    ]
    # A file of every source carries every source's terms, each once.
    assert len(resources["time-series.parquet"]["licenses"]) == 6
    assert len(resources["oracle-output.csv"]["sources"]) == 6


@pytest.fixture
def api(hub, tmp_path):
    """The web fixtures, a real subset of the API, with the bulk files of the test archive."""
    api_dir = shutil.copytree(FIXTURES, tmp_path / "api")
    write(api_dir / "bulk", hub)
    return api_dir


def test_the_bulk_files_keep_to_the_contract(api):
    assert gate.contract(api, subset=True) == []


def test_a_bulk_file_the_data_package_lists_must_be_published(api):
    (api / "bulk" / "forecasts-2027.csv.gz").unlink()

    assert gate.contract(api, subset=True) == []
    assert (
        "bulk/forecasts-2027.csv.gz: missing, linked from bulk/datapackage.json"
        in gate.contract(api)
    )


def test_a_bulk_file_the_data_package_does_not_list_fails(api):
    shutil.copy(
        api / "bulk" / "time-series-gpr.csv", api / "bulk" / "time-series-extra.csv"
    )

    assert gate.contract(api, subset=True) == [
        "bulk/time-series-extra.csv: not in bulk/datapackage.json"
    ]


def drop_as_of(path):
    pd.read_csv(path).drop(columns="as_of").to_csv(path, index=False)


def horizon_as_double(path):
    scores = pq.read_table(path)
    at = scores.schema.get_field_index("horizon")
    pq.write_table(
        scores.set_column(at, "horizon", scores["horizon"].cast(pa.float64())), path
    )


@pytest.mark.parametrize(
    ("path", "change", "error"),
    [
        (
            "oracle-output.csv",
            drop_as_of,
            "bulk/oracle-output.csv: its columns are target, target_end_date, oracle_value, not target, target_end_date, oracle_value, as_of as bulk/datapackage.json lists them",
        ),
        (
            "scores.parquet",
            horizon_as_double,
            "bulk/scores.parquet: horizon is double, not int64 as bulk/datapackage.json's integer",
        ),
    ],
    ids=["csv-columns", "parquet-type"],
)
def test_a_bulk_file_off_its_data_package_fails(api, path, change, error):
    change(api / "bulk" / path)

    assert gate.contract(api, subset=True) == [error]


def test_the_catalog_links_the_data_package(api):
    catalog = json.loads((api / "series.json").read_text(encoding="utf-8"))
    catalog["links"] = {"bulk": "bulk/data-package.json"}
    (api / "series.json").write_text(json.dumps(catalog), encoding="utf-8")

    assert "bulk/data-package.json: missing, linked from series.json" in gate.contract(
        api
    )
