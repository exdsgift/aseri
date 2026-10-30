"""The archive branch: every forecast aseri issues, the observations it saw and the run that made it, append-only."""

import hashlib
import json
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import NamedTuple

import pandas as pd

from aseri.forecast import (
    MODEL_ID,
    PACKAGE_COMMIT,
    WEIGHTS,
    WEIGHTS_REVISION,
    Forecast,
    make_context,
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
        issued_here = [f for f in run["forecasts"] if f["target"] == series_id]
        if not issued_here:
            continue  # a run that only recorded revised observations, or other series
        # The manifest's own path, so a later model change cannot lose the older rounds.
        round_file = next(p for p in run["files"] if p.startswith("model-output/"))
        rows = pd.read_csv(archive_dir / round_file)
        # Split once: filtering the whole round for each forecast is quadratic in a backfill of every series.
        tables = dict(list(rows[rows["target"] == series_id].groupby("reference_date")))
        for issued in issued_here:
            table = tables[issued["reference_date"]].pivot(
                index="horizon", columns="output_type_id", values="value"
            )
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
    archive_dir: Path, series_id: str, observed: pd.Series, as_of: date
) -> bool:
    return not observation_delta(
        observed, as_of_view(archive_dir, series_id, as_of)
    ).empty


class RevisionHold(Exception):
    """Upstream changed values older than the series' revision window: a method change or a broken file, for a human to review."""


def check_revisions(
    archive_dir: Path, series: Series, observed: pd.Series, as_of: date
) -> None:
    """Raise RevisionHold if `observed` changes an archived value older than `series.revision_window` days before its newest."""
    known = as_of_view(archive_dir, series.id, as_of)
    # A broken file can be continuous and unchanged where it has data, yet shorter.
    dropped = known.index.difference(observed.index)
    if len(dropped):
        raise RevisionHold(
            f"{series.id}: upstream dropped {len(dropped)} archived days, from "
            f"{dropped.min():%Y-%m-%d} to {dropped.max():%Y-%m-%d}. "
            "Nothing is archived or published until someone has reviewed the file."
        )
    revised = observation_delta(observed, known).index.intersection(known.index)
    oldest_allowed = observed.index[-1] - pd.Timedelta(days=series.revision_window)
    deep = revised[revised < oldest_allowed]
    if len(deep):
        raise RevisionHold(
            f"{series.id}: upstream changed {len(deep)} archived values older than its "
            f"{series.revision_window}-day revision window, the oldest on {deep.min():%Y-%m-%d}. "
            "Nothing is archived or published until someone has reviewed the rewrite."
        )


def timestamp(moment: datetime) -> str:
    return f"{moment:%Y-%m-%dT%H:%M:%SZ}"


def observation_delta(observed: pd.Series, vintage: pd.Series) -> pd.Series:
    """The observed (date, value) pairs that `vintage` lacks or holds with another value."""
    return observed[vintage.reindex(observed.index) != observed]


class SeriesRun(NamedTuple):
    """One series' part of a run: the vintage it fetched, that download's upstream stamps, and the forecasts made from it."""

    series: Series
    forecasts: list[Forecast]
    observed: pd.Series
    as_of: date
    upstream: dict


def write(
    archive_dir: Path,
    runs: list[SeriesRun],
    *,
    code_commit: str,
    run_url: str | None,
    generated_at: datetime,
) -> None:
    """Archive one run of every series in `runs`: their forecasts as one Hubverse round, the observations new since the last run as one delta, and one manifest.

    A forecast is live only from the newest day the run forecasts for its series, and after every
    archived one; the others, backfill included, were issued after the fact, so they are retrospective.
    That day is the newest observed one, or the day before while the newest is under review.
    A run with no forecasts records only the revised observations.
    """
    forecast_date = generated_at.date().isoformat()
    round_file = ROUNDS / f"{forecast_date}-{MODEL_ID}.csv"
    delta_file = DELTAS / f"{forecast_date}.csv"
    rounds, deltas, issued = [], [], []
    for series, forecasts, observed, as_of, _ in runs:
        newest_archived = max(
            (a.forecast.reference_date for a in read(archive_dir, series.id)),
            default=pd.Timestamp.min,
        )
        newest = max((f.reference_date for f in forecasts), default=None)
        delta = observation_delta(observed, as_of_view(archive_dir, series.id, as_of))
        rounds += [
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
        deltas.append(
            pd.DataFrame(
                {
                    "target": series.id,
                    "target_end_date": delta.index.strftime("%Y-%m-%d"),
                    "observation": delta.to_numpy(),
                    "as_of": as_of.isoformat(),
                }
            )
        )
        issued += [
            {
                "target": series.id,
                "reference_date": f"{forecast.reference_date:%Y-%m-%d}",
                "forecast_mode": "live"
                if forecast.reference_date == newest
                and forecast.reference_date > newest_archived
                else "retrospective",
                "data": {
                    "source_url": series.source["data_url"],
                    "as_of": as_of.isoformat(),
                    # With the anomaly register of the run's code commit, as make_context applies it.
                    "input_sha256": input_sha256(
                        make_context(series, observed, forecast.reference_date)
                    ),
                },
            }
            for forecast in forecasts
        ]
    written = [delta_file]
    if rounds:
        _write_csv(archive_dir / round_file, pd.DataFrame(rounds))
        written.insert(0, round_file)
    _write_csv(archive_dir / delta_file, pd.concat(deltas, ignore_index=True))
    manifest = {
        "forecast_date": forecast_date,
        "model_id": MODEL_ID,
        "forecasts": issued,
        # The raw files this run read, so a later audit can tell a revision from a broken download.
        "upstream": {run.series.id: run.upstream for run in runs},
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
        "x", encoding="utf-8", newline="\n"
    ) as file:
        json.dump(manifest, file, indent=2)


def newest_as_of(archive_dir: Path, series_id: str) -> date:
    """The day of the newest vintage the archive holds of `series_id`."""
    rows = pd.concat(
        pd.read_csv(path, usecols=["target", "as_of"])
        for path in (archive_dir / DELTAS).glob("*.csv")
    )
    return date.fromisoformat(rows.loc[rows["target"] == series_id, "as_of"].max())


def as_of_view(archive_dir: Path, series_id: str, t: date) -> pd.Series:
    """`series_id` as the archive knew it on day `t`: every date up to `t`, each with its latest value seen by `t`."""
    rows = _seen(archive_dir, series_id)
    t = pd.Timestamp(t)
    rows = rows[(rows["as_of"] <= t) & (rows["target_end_date"] <= t)]
    return _by_date(rows.drop_duplicates("target_end_date", keep="last"))


def first_seen(archive_dir: Path, series_id: str) -> pd.Series:
    """Every date of `series_id` with its value in the first vintage that held it: the one that resolved its forecasts."""
    rows = _seen(archive_dir, series_id)
    # As in as_of_view: a vintage dated before a day is no vintage of it.
    rows = rows[rows["target_end_date"] <= rows["as_of"]]
    return _by_date(rows.drop_duplicates("target_end_date", keep="first"))


def _seen(archive_dir: Path, series_id: str) -> pd.DataFrame:
    """Every value the deltas hold of `series_id`, oldest vintage first."""
    deltas = sorted((archive_dir / DELTAS).glob("*.csv"))
    if not deltas:
        empty = pd.DatetimeIndex([])
        return pd.DataFrame(
            {"target_end_date": empty, "observation": [], "as_of": empty}
        )
    rows = pd.concat(
        pd.read_csv(path, parse_dates=["target_end_date", "as_of"]) for path in deltas
    )
    return rows[rows["target"] == series_id].sort_values("as_of", kind="stable")


def _by_date(rows: pd.DataFrame) -> pd.Series:
    rows = rows.sort_values("target_end_date")
    return pd.Series(
        rows["observation"].to_numpy(),
        index=pd.DatetimeIndex(rows["target_end_date"]),
        dtype=float,
    )


def input_sha256(context: pd.Series) -> str:
    """The hash of a model context as `date,value` lines: rebuilt from the deltas, it must hash the same."""
    return _sha256(context.to_csv(header=False, lineterminator="\n").encode())


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _write_csv(path: Path, frame: pd.DataFrame) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # "x" refuses to overwrite: an archived file is never rewritten.
    frame.to_csv(path, index=False, mode="x", lineterminator="\n")
