"""The bulk downloads: every forecast, observation and score in Hubverse tables, Parquet and CSV, with a Frictionless data package."""

import json
from datetime import datetime
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from aseri.archive import DELTAS, timestamp
from aseri.publish import FORECAST_LICENSE
from aseri.record import SCORED

# The Arrow type of each Table Schema type the files use.
ARROW = {
    "string": pa.string(),
    "date": pa.date32(),
    "integer": pa.int64(),
    "number": pa.float64(),
    "boolean": pa.bool_(),
}
# Each table's columns in order, with their Table Schema types. The forecasts are collect_hub's shape:
# the model, then the round's own columns.
FORECASTS = {
    "model_id": "string",
    "forecast_date": "date",
    "target": "string",
    "reference_date": "date",
    "horizon": "integer",
    "target_end_date": "date",
    "output_type": "string",
    "output_type_id": "number",
    "value": "number",
}
TIME_SERIES = {
    "target": "string",
    "target_end_date": "date",
    "observation": "number",
    "as_of": "date",
}
ORACLE = {
    "target": "string",
    "target_end_date": "date",
    "oracle_value": "number",
    "as_of": "date",
}
# The record's columns as record.scored types them, after the model and the series.
SCORES = {"model_id": "string", "target": "string"} | {
    column: {
        "datetime64[us]": "date",
        "str": "string",
        "int64": "integer",
        "float64": "number",
        "bool": "boolean",
    }[dtype]
    for column, dtype in SCORED.items()
}


def write(
    bulk_dir: Path,
    archive_dir: Path,
    sources,
    scores: list[pd.DataFrame],
    generated_at: datetime,
) -> None:
    """Write the archive's bulk files under `bulk_dir`, and `datapackage.json`, which lists each with its columns, licences and sources.

    `sources` pairs each series with the module that fetches it, as `__main__.SOURCES` does: one
    source's values are under one licence, so they get one CSV. `scores` are what `record.scored`
    returns, every model's, each with its `model_id` and `target`.
    """
    bulk_dir.mkdir(parents=True, exist_ok=True)
    every = [series for series, _ in sources]
    resources = []
    # A year's rounds never change once it is out, so neither do its files, rebuilt byte for byte each run as
    # the dated forecast files are. Strings throughout, so the CSV keeps the archive's text exactly.
    # shortcut: every year is rebuilt from the archive each run, and a pyarrow or zlib upgrade can change a closed
    # year's bytes, never its rows; carry closed years over from the last deploy if runs get slow or bytes must hold.
    rounds = sorted((archive_dir / "model-output").glob("*/*.csv"))
    for year in sorted({path.name[:4] for path in rounds}):
        forecasts = pd.concat(
            pd.read_csv(path, dtype=str).assign(model_id=path.parent.name)
            for path in rounds
            if path.name.startswith(year)
        )
        for name in (f"forecasts-{year}.parquet", f"forecasts-{year}.csv.gz"):
            resources.append(
                _table(
                    bulk_dir / name,
                    forecasts,
                    FORECASTS,
                    [
                        "model_id",
                        "target",
                        "reference_date",
                        "horizon",
                        "output_type_id",
                    ],
                    f"Every forecast of the runs of {year}, one row per model, series, reference date, step and quantile level. A closed year never changes.",
                    [_licence(FORECAST_LICENSE)],
                    _sources(every),
                )
            )
    observations = pd.concat(
        pd.read_csv(path, dtype=str)
        for path in sorted((archive_dir / DELTAS).glob("*.csv"))
    )
    key = ["target", "target_end_date", "as_of"]
    resources.append(
        _table(
            bulk_dir / "time-series.parquet",
            observations,
            TIME_SERIES,
            key,
            "Every value of every series as first seen, a change-log: a day's value as known on a date is its row with the latest as_of up to it. Each series is under its source's terms.",
            _licences(every),
            _sources(every),
        )
    )
    by_source = {}
    for series, module in sources:
        by_source.setdefault(module.__name__.rsplit(".", 1)[1], []).append(series)
    for name, group in by_source.items():
        ids = [series.id for series in group]
        resources.append(
            _table(
                bulk_dir / f"time-series-{name}.csv",
                observations[observations["target"].isin(ids)],
                TIME_SERIES,
                key,
                f"The time series of {', '.join(ids)}, under its source's terms alone.",
                _licences(group),
                _sources(group),
            )
        )
    scored = (
        pd.concat(scores, ignore_index=True)
        if scores
        else pd.DataFrame(columns=list(SCORES))
    )
    resources.append(
        _table(
            bulk_dir / "oracle-output.csv",
            # A target's value is its series' alone, so every model's scores of it agree.
            scored.drop_duplicates(["target", "target_end_date"])
            .rename(
                columns={"observation": "oracle_value", "observation_as_of": "as_of"}
            )
            .sort_values(["target", "target_end_date"], kind="stable"),
            ORACLE,
            ["target", "target_end_date"],
            "The value each scored target was scored against, as known its series' score lag after its day, with the as_of of that vintage.",
            _licences(every),
            _sources(every),
        )
    )
    resources.append(
        _table(
            bulk_dir / "scores.parquet",
            scored,
            SCORES,
            ["model_id", "target", "reference_date", "horizon"],
            "Every scored target of every model, one row per model, series, reference date and step. The record in scores.json counts the model in use alone.",
            [_licence(FORECAST_LICENSE)],
            _sources(every),
        )
    )
    package = {
        "$schema": "https://datapackage.org/profiles/2.0/datapackage.json",
        "name": "aseri",
        "title": "aseri: daily probabilistic forecasts of nine public risk signals",
        "description": "Every forecast, observation and score of aseri, in Hubverse tables. Each file carries its own licences and sources.",
        "homepage": "https://exdsgift.github.io/aseri/api/",
        "created": timestamp(generated_at),
        "resources": resources,
    }
    (bulk_dir / "datapackage.json").write_text(json.dumps(package), encoding="utf-8")


def _table(path, frame, fields, key, description, licenses, sources) -> dict:
    """Write `frame`'s `fields` to `path`, Parquet or CSV by its name, and return its resource."""
    frame = frame[list(fields)]
    if path.suffix == ".parquet":
        schema = pa.schema((name, ARROW[kind]) for name, kind in fields.items())
        # The cast also drops pandas' metadata, which names its version, so a pandas upgrade keeps the bytes.
        table = pa.Table.from_pandas(frame, preserve_index=False).cast(schema)
        # Level 9 is 26% smaller than the default on the real rounds, for a tenth of a second.
        pq.write_table(table, path, compression="zstd", compression_level=9)
    else:
        frame.to_csv(
            path,
            index=False,
            lineterminator="\n",
            date_format="%Y-%m-%d",
            # No write time in the header, so a closed year's file keeps its bytes.
            compression={"method": "gzip", "mtime": 0}
            if path.suffix == ".gz"
            else None,
        )
    csv = path.suffix != ".parquet"
    return {
        "name": path.name.replace(".", "-"),
        "path": path.name,
        "type": "table",
        "description": description,
        "format": "csv" if csv else "parquet",
        "mediatype": "text/csv" if csv else "application/vnd.apache.parquet",
        **({"encoding": "utf-8"} if csv else {}),
        **({"compression": "gz"} if path.suffix == ".gz" else {}),
        "schema": {
            "fields": [{"name": name, "type": kind} for name, kind in fields.items()],
            "primaryKey": key,
        },
        "licenses": licenses,
        "sources": sources,
    }


def _licence(license: dict) -> dict:
    return {
        "title": license["name"],
        "path": license["url"],
        "attribution": license["attribution"],
    }


def _licences(series) -> list[dict]:
    return _once([_licence(s.license) for s in series])


def _sources(series) -> list[dict]:
    return _once(
        [{"title": s.source["title"], "path": s.source["url"]} for s in series]
    )


def _once(items: list) -> list:
    """`items` without repeats, in order: PortWatch's four sea lanes share one licence and one source."""
    return [item for i, item in enumerate(items) if item not in items[:i]]
