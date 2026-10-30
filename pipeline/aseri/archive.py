"""The archive branch: every forecast aseri issues, the observations it saw and the run that made it, append-only."""

import hashlib
import json
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

import pandas as pd

from aseri.forecast import (
    MODEL_ID,
    PACKAGE_COMMIT,
    WEIGHTS,
    WEIGHTS_REVISION,
    Forecast,
)
from aseri.series import Series

ROUNDS = Path("model-output", MODEL_ID)
DELTAS = Path("target-data", "deltas")
RUNS = Path("runs")
# The replay slider's reach: the newest date and the 120 days before it, each with its own forecast.
REPLAY_DAYS = 120


@dataclass(frozen=True)
class Archived:
    """A forecast as the archive holds it, with the date and provenance of the run that issued it."""

    forecast: Forecast
    model_id: str
    forecast_date: str
    provenance: dict


def read(archive_dir: Path, series_id: str) -> list[Archived]:
    """Every archived forecast of `series_id`, oldest reference date first."""
    archived = []
    for path in sorted((archive_dir / RUNS).glob("*.json")):
        run = json.loads(path.read_text(encoding="utf-8"))
        if not run["forecasts"]:
            continue  # a run that only recorded revised observations
        # The manifest's own path, so a later model change cannot lose the older rounds.
        round_file = next(p for p in run["files"] if p.startswith("model-output/"))
        rows = pd.read_csv(archive_dir / round_file)
        for issued in run["forecasts"]:
            if issued["target"] != series_id:
                continue
            table = rows[
                (rows["target"] == series_id)
                & (rows["reference_date"] == issued["reference_date"])
            ].pivot(index="horizon", columns="output_type_id", values="value")
            archived.append(
                Archived(
                    forecast=Forecast(
                        reference_date=pd.Timestamp(issued["reference_date"]),
                        levels=tuple(table.columns.tolist()),
                        quantiles=table.to_numpy(),
                    ),
                    model_id=run["model_id"],
                    forecast_date=run["forecast_date"],
                    provenance=run["provenance"]
                    | {
                        "data": issued["data"],
                        "forecast_mode": issued["forecast_mode"],
                    },
                )
            )
    # Run order is not date order: a backfill archives days older than the forecasts before it.
    return sorted(archived, key=lambda a: a.forecast.reference_date)


def new_reference_dates(
    observed: pd.Series, archived: list[pd.Timestamp]
) -> list[pd.Timestamp]:
    """The dates to forecast from: every date of the replay window the archive lacks, and every date after its newest."""
    days = observed.index
    wanted = days >= days[-1] - pd.Timedelta(days=REPLAY_DAYS)
    if archived:
        wanted |= days > max(archived)
    return days[wanted & ~days.isin(archived)].tolist()


def ran_on(archive_dir: Path, day: date) -> bool:
    """Whether a run on `day` is archived already: its files are never rewritten, so anything newer waits."""
    return (archive_dir / RUNS / f"{day.isoformat()}.json").exists()


def has_new_observations(
    archive_dir: Path, series_id: str, observed: pd.Series
) -> bool:
    return not observation_delta(
        observed, _latest_vintage(archive_dir, series_id)
    ).empty


def timestamp(moment: datetime) -> str:
    return f"{moment:%Y-%m-%dT%H:%M:%SZ}"


def observation_delta(observed: pd.Series, vintage: pd.Series) -> pd.Series:
    """The observed (date, value) pairs that `vintage` lacks or holds with another value."""
    return observed[vintage.reindex(observed.index) != observed]


def write(
    archive_dir: Path,
    series: Series,
    forecasts: list[Forecast],
    *,
    observed: pd.Series,
    as_of: date,
    code_commit: str,
    run_url: str | None,
    generated_at: datetime,
) -> None:
    """Archive one run: its forecasts of `series` as a Hubverse round, the observations new since the last run, and a manifest.

    A forecast is live only from the newest observed day and after every archived one;
    the others, backfill included, were issued after the fact, so they are retrospective.
    A run with no forecasts records only the revised observations.
    """
    newest_archived = max(
        (a.forecast.reference_date for a in read(archive_dir, series.id)),
        default=pd.Timestamp.min,
    )
    forecast_date = generated_at.date().isoformat()
    round_file = ROUNDS / f"{forecast_date}-{MODEL_ID}.csv"
    delta_file = DELTAS / f"{forecast_date}.csv"
    delta = observation_delta(observed, _latest_vintage(archive_dir, series.id))
    rounds = [
        {
            "forecast_date": forecast_date,
            "target": series.id,
            "reference_date": f"{forecast.reference_date:%Y-%m-%d}",
            "horizon": step,
            "target_end_date": f"{forecast.reference_date + pd.Timedelta(days=step):%Y-%m-%d}",
            "output_type": "quantile",
            "output_type_id": level,
            # Four decimals, as in the API, drop the float32 noise and keep enough digits for scoring.
            "value": round(float(value), 4),
        }
        for forecast in forecasts
        for step, values in enumerate(forecast.quantiles, start=1)
        for level, value in zip(forecast.levels, values)
    ]
    written = [delta_file]
    if forecasts:
        _write_csv(archive_dir / round_file, pd.DataFrame(rounds))
        written.insert(0, round_file)
    _write_csv(
        archive_dir / delta_file,
        pd.DataFrame(
            {
                "target": series.id,
                "target_end_date": delta.index.strftime("%Y-%m-%d"),
                "observation": delta.to_numpy(),
                "as_of": as_of.isoformat(),
            }
        ),
    )
    manifest = {
        "forecast_date": forecast_date,
        "model_id": MODEL_ID,
        "forecasts": [
            {
                "target": series.id,
                "reference_date": f"{forecast.reference_date:%Y-%m-%d}",
                "forecast_mode": "live"
                if forecast.reference_date == observed.index[-1]
                and forecast.reference_date > newest_archived
                else "retrospective",
                "data": {
                    "source_url": series.source["data_url"],
                    "as_of": as_of.isoformat(),
                    # The exact context, as `date,value` lines: rebuilt from the deltas, it must hash the same.
                    "input_sha256": _sha256(
                        observed.loc[: forecast.reference_date]
                        .to_csv(header=False, lineterminator="\n")
                        .encode()
                    ),
                },
            }
            for forecast in forecasts
        ],
        "provenance": {
            "model": {
                "id": WEIGHTS,
                "revision": WEIGHTS_REVISION,
                "url": f"https://huggingface.co/{WEIGHTS}",
            },
            "inference": {"package": "timestral", "package_commit": PACKAGE_COMMIT},
            "code": {"commit": code_commit, "run": run_url},
            "generated_at": timestamp(generated_at),
            "leakage_note": "Timestral's training-data cutoff is not published; backtests may be optimistic.",
        },
        "files": {
            path.as_posix(): _sha256((archive_dir / path).read_bytes())
            for path in written
        },
    }
    (archive_dir / RUNS).mkdir(exist_ok=True)
    with (archive_dir / RUNS / f"{forecast_date}.json").open(
        "x", encoding="utf-8"
    ) as file:
        json.dump(manifest, file, indent=2)


def _latest_vintage(archive_dir: Path, series_id: str) -> pd.Series:
    """The observations as the archive last saw them: for each date, the value with the latest as_of."""
    deltas = sorted((archive_dir / DELTAS).glob("*.csv"))
    if not deltas:
        return pd.Series(dtype=float)
    rows = pd.concat(pd.read_csv(path) for path in deltas)
    rows = (
        rows[rows["target"] == series_id]
        .sort_values("as_of", kind="stable")
        .drop_duplicates("target_end_date", keep="last")
    )
    return pd.Series(
        rows["observation"].to_numpy(), index=pd.to_datetime(rows["target_end_date"])
    )


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _write_csv(path: Path, frame: pd.DataFrame) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # "x" refuses to overwrite: an archived file is never rewritten.
    frame.to_csv(path, index=False, mode="x", lineterminator="\n")
