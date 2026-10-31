"""The pre-publish gate: every file under api/v1 against the contract in the repo's api/, the files against each other, and each series' newest forecast against its own history.

Usage: python -m aseri.gate API_DIR [--subset]. It exits 1 on an error; a warning never fails it.
--subset checks a part of the API, such as the web fixtures: a file the catalog links to may be missing.
"""

import json
import math
import os
import re
import sys
from datetime import date, datetime, timedelta
from functools import cache
from pathlib import Path

import numpy as np
import pandas as pd
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

from aseri.publish import CONTRACT

# Each pair is (warn, fail). Calibrated on the 120-day backfill of the nine series, 1,054 forecasts each
# against the 365 days up to its reference date: the web fixtures' replays of 2026-10-30 and a local run
# of 2026-10-31, its dated files at four decimals. The median never left the range of its 365 days
# (by 0.00001 of it at most, a rounding): more than 5% of that range outside it warns, half fails.
OUTSIDE = (0.05, 0.5)
# The 8 in 10 band was 0.131 (Wikipedia's views, calm after a spike) to 23.6 (Brent, 14 trading days
# ahead) times the mean daily move of its 365 days: outside 0.12 to 24 warns, outside half the low
# and twice the high fails, a band of no width included.
WIDTH = ((0.12, 24.0), (0.06, 48.0))
# The median moved at most 1.43 band widths of the forecast before it, on the same day (Brent): more
# than 1.5 warns, and never fails, since the news can move it as far.
CHANGE = 1.5

FORMATS = FormatChecker()


@FORMATS.checks("date-time", raises=ValueError)
def _utc_to_the_second(value) -> bool:
    """aseri's timestamps: RFC 3339, always in UTC and to the second."""
    if not isinstance(value, str):
        return True
    return bool(re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", value)) and bool(
        datetime.fromisoformat(value)
    )


@cache
def validator(name: str, strict: bool = True) -> Draft202012Validator:
    """The validator of the schema `name`, with the date formats checked.

    Strict, the gate's: an object may hold no key its schema leaves out, so the schemas document every
    key published. Not strict, the published schemas as they are: a key added within v1 passes.
    """
    schemas = {
        path.name: json.loads(path.read_text(encoding="utf-8"))
        for path in (CONTRACT / "schemas").glob("*.schema.json")
    }
    if strict:
        schemas = {name: _closed(schema) for name, schema in schemas.items()}
    registry = Registry().with_resources(
        (schema["$id"], Resource.from_contents(schema)) for schema in schemas.values()
    )
    return Draft202012Validator(
        schemas[name], registry=registry, format_checker=FORMATS
    )


def _closed(schema):
    """`schema` with every object that lists its properties closed to any other key."""
    if isinstance(schema, list):
        return [_closed(item) for item in schema]
    if not isinstance(schema, dict):
        return schema
    closed = {key: _closed(value) for key, value in schema.items()}
    if (
        schema.get("type") == "object"
        and "properties" in schema
        and "additionalProperties" not in schema
    ):
        closed["additionalProperties"] = False
    return closed


def _routes() -> dict[str, tuple[re.Pattern, str | None]]:
    """Each path of openapi.json: the file paths it serves, and the schema of its JSON, if any."""
    openapi = json.loads((CONTRACT / "openapi.json").read_text(encoding="utf-8"))
    routes = {}
    for path, item in openapi["paths"].items():
        (content,) = item["get"]["responses"]["200"]["content"].values()
        schema = content.get("schema", {}).get("$ref")
        routes[path] = (
            re.compile(re.sub(r"\\\{\w+\\\}", "[^/]+", re.escape(path[1:]))),
            schema and schema.removeprefix("schemas/"),
        )
    return routes


def _finite(text: str) -> float:
    value = float(text)
    if not math.isfinite(value):
        raise ValueError(text)
    return value


def contract(api_dir: Path, *, subset: bool = False) -> list[str]:
    """The errors of the files under `api_dir` against the contract: each file against its schema, then the files against each other."""
    routes = _routes()
    errors, documents, served = [], {}, set()
    for file in sorted(p for p in api_dir.rglob("*") if p.is_file()):
        path = file.relative_to(api_dir).as_posix()
        template = next(
            (t for t, (pattern, _) in routes.items() if pattern.fullmatch(path)), None
        )
        if template is None:
            errors.append(f"{path}: no path of openapi.json describes it")
            continue
        served.add(template)
        schema = routes[template][1]
        if schema is None:
            continue
        try:
            document = json.loads(
                file.read_text(encoding="utf-8"),
                parse_float=_finite,
                parse_constant=_finite,
            )
        except ValueError as error:
            errors.append(f"{path}: not JSON with finite numbers: {error}")
            continue
        for error in validator(schema).iter_errors(document):
            where = "/".join(map(str, error.absolute_path))
            errors.append(f"{path}: {where + ': ' if where else ''}{error.message}")
        documents[path] = document
    # The files' agreement reads them in the shapes their schemas give.
    if errors:
        return errors
    if not subset:
        errors = [f"openapi.json: no file for {t}" for t in routes if t not in served]
    return errors + _agreement(documents, api_dir, subset)


def _agreement(documents: dict, api_dir: Path, subset: bool) -> list[str]:
    errors = []

    def published(path: str, by: str) -> None:
        if not subset and path not in documents and not (api_dir / path).is_file():
            errors.append(f"{path}: missing, linked from {by}")

    catalog = documents.get("series.json")
    if catalog is None:
        return ["series.json: missing"]
    published(catalog["license"]["text"], "series.json")
    ids = [entry["series_id"] for entry in catalog["series"]]
    if len(set(ids)) < len(ids):
        errors.append("series.json: lists a series twice")
    errors += [
        f"series/{id}: not a series of the catalog"
        for id in sorted(
            {p.split("/")[1] for p in documents if p.startswith("series/")} - set(ids)
        )
    ]
    for entry in catalog["series"]:
        errors += _series(entry, documents, published)
    board = documents.get("scores.json")
    if board:
        listed = [record["series_id"] for record in board["series"]]
        scored = [e["series_id"] for e in catalog["series"] if "scores" in e["links"]]
        errors += [
            f"scores.json: misses {id}, which the catalog links to its scores"
            for id in scored
            if id not in listed
        ]
        errors += [
            f"scores.json: lists {id}, which the catalog links to no scores"
            for id in listed
            if id not in scored
        ]
        errors += [
            f"scores.json: links {r['series_id']} to {r['links']['scores']}"
            for r in board["series"]
            if r["links"]["scores"] != f"series/{r['series_id']}/scores.json"
        ]
    return errors


def _series(entry: dict, documents: dict, published) -> list[str]:
    """The disagreements of a series' files with its catalog entry and with each other."""
    id, errors = entry["series_id"], []
    base = f"series/{id}/"
    for name, link in entry["links"].items():
        if link != f"{base}{name}.json":
            errors.append(f"series.json: {id} links {name} to {link}")
        else:
            published(link, "series.json")
    published(entry["license"]["text"], "series.json")
    if entry["latest_reference_date"] > entry["last_observation_date"]:
        errors.append(
            f"series.json: {id}'s latest_reference_date is after its last_observation_date"
        )
    mine = {p: d for p, d in documents.items() if p.startswith(base)}
    errors += [
        f"{path}: series_id is {document['series_id']}"
        for path, document in mine.items()
        if document["series_id"] != id
    ]
    latest = mine.get(f"{base}latest.json")
    if latest:
        errors += [
            f"{base}latest.json: {field} is {latest[field]}, the catalog's {named} {entry[named]}"
            for field, named in (
                ("reference_date", "latest_reference_date"),
                ("forecast_date", "latest_forecast_date"),
                ("unit", "unit"),
                ("horizon_unit", "horizon_unit"),
            )
            if latest[field] != entry[named]
        ]
        if len(latest["horizon"]) != entry["horizon_max"]:
            errors.append(
                f"{base}latest.json: has {len(latest['horizon'])} steps, the catalog's horizon_max {entry['horizon_max']}"
            )
        canonical = f"forecasts/{latest['reference_date']}.json"
        if latest["links"].get("canonical") != canonical:
            errors.append(f"{base}latest.json: its canonical link is not {canonical}")
        newest = mine.get(base + canonical)
        if newest and {**latest, "links": None} != {**newest, "links": None}:
            errors.append(f"{base}latest.json: is not a copy of {canonical}")
    actuals = mine.get(f"{base}actuals.json")
    if actuals:
        if actuals["date"][-1] != entry["last_observation_date"]:
            errors.append(
                f"{base}actuals.json: ends on {actuals['date'][-1]}, the catalog's last_observation_date {entry['last_observation_date']}"
            )
        if len(actuals["date"]) != len(actuals["observation"]):
            errors.append(
                f"{base}actuals.json: has {len(actuals['observation'])} values for {len(actuals['date'])} dates"
            )
        if actuals["date"] != sorted(set(actuals["date"])):
            errors.append(f"{base}actuals.json: its dates are not in order, once each")
    replay = mine.get(f"{base}replay.json")
    if replay:
        if replay["forecasts"][-1]["reference_date"] != entry["latest_reference_date"]:
            errors.append(
                f"{base}replay.json: ends on {replay['forecasts'][-1]['reference_date']}, the catalog's latest_reference_date {entry['latest_reference_date']}"
            )
        for forecast in replay["forecasts"]:
            errors += [
                f"{base}replay.json: {forecast['reference_date']}: {e}"
                for e in _levels(forecast["quantiles"], len(replay["horizon"]))
            ]
    index = mine.get(f"{base}forecasts.json")
    if index:
        listed = {f"{base}{f['url']}": f for f in index["forecasts"]}
        dates = [f["reference_date"] for f in index["forecasts"]]
        if dates != sorted(set(dates)):
            errors.append(
                f"{base}forecasts.json: its forecasts are not in order, once each"
            )
        if dates[-1] != entry["latest_reference_date"]:
            errors.append(
                f"{base}forecasts.json: ends on {dates[-1]}, the catalog's latest_reference_date {entry['latest_reference_date']}"
            )
        for path, f in listed.items():
            if f["url"] != f"forecasts/{f['reference_date']}.json":
                errors.append(f"{base}forecasts.json: lists {f['url']}")
            published(path, f"{base}forecasts.json")
            dated = mine.get(path)
            if dated and any(
                dated[k] != f[k]
                for k in ("reference_date", "forecast_date", "forecast_mode")
            ):
                errors.append(f"{path}: is not as {base}forecasts.json lists it")
    for path, forecast in mine.items():
        if path.startswith(f"{base}forecasts/"):
            if index and path not in listed:
                errors.append(f"{path}: not in {base}forecasts.json")
            if path != f"{base}forecasts/{forecast['reference_date']}.json":
                errors.append(
                    f"{path}: its reference_date is {forecast['reference_date']}"
                )
        if path.startswith(f"{base}forecasts/") or path == f"{base}latest.json":
            errors += [f"{path}: {e}" for e in _forecast(forecast)]
    return errors


def _forecast(forecast: dict) -> list[str]:
    """What a forecast file's arrays and dates get wrong that its schema cannot say."""
    steps, errors = len(forecast["horizon"]), []
    if forecast["horizon"] != list(range(1, steps + 1)):
        errors.append("horizon does not count 1, 2, 3 and on")
    if len(forecast["target_end_date"]) != steps:
        errors.append(
            f"target_end_date has {len(forecast['target_end_date'])} dates for {steps} steps"
        )
    if forecast["reference_date"] > forecast["forecast_date"]:
        errors.append("reference_date is after forecast_date")
    return (
        errors
        + _levels(forecast["quantiles"], steps)
        + step_dates(
            forecast["reference_date"],
            forecast["target_end_date"],
            forecast["horizon_unit"],
        )
    )


def _levels(quantiles: dict, steps: int) -> list[str]:
    """Each level has a value per step, and the values never decrease from level to level."""
    levels = sorted(quantiles, key=float)
    errors = [
        f"level {level} has {len(quantiles[level])} values for {steps} steps"
        for level in levels
        if len(quantiles[level]) != steps
    ]
    if errors:
        return errors
    table = np.array([quantiles[level] for level in levels])
    for step, column in enumerate(table.T, start=1):
        falls = np.flatnonzero(np.diff(column) < 0)
        if falls.size:
            errors.append(
                f"step {step} decreases from level {levels[falls[0]]} to {levels[falls[0] + 1]}"
            )
    return errors


def step_dates(reference_date: str, dates: list[str], unit: str) -> list[str]:
    """What is wrong with the day of each step.

    A calendar day's step h is reference_date plus h days. A trading day's steps are weekdays in order
    that skip at most two between them, as the archive dates them: the market holidays the price's own
    history shows, two at most in a row (Good Friday and Easter Monday, Christmas and Boxing Day).
    """
    errors, before = [], date.fromisoformat(reference_date)
    for step, text in enumerate(dates, start=1):
        day = date.fromisoformat(text)
        if unit == "day":
            expected = date.fromisoformat(reference_date) + timedelta(days=step)
            if day != expected:
                errors.append(f"step {step} is dated {text}, not {expected}")
        elif day.weekday() > 4:
            errors.append(f"step {step} is dated {text}, a weekend day")
        elif day <= before:
            errors.append(f"step {step} is dated {text}, not after the day before")
        elif (skipped := np.busday_count(before + timedelta(days=1), day)) > 2:
            errors.append(f"step {step} is dated {text}, skipping {skipped} weekdays")
        before = day
    return errors


def bounds(api_dir: Path) -> tuple[list[str], list[str]]:
    """The errors and warnings of each series' newest forecast, latest.json, against its own history."""
    errors, warnings = [], []
    catalog = _read(api_dir / "series.json")
    for entry in catalog["series"]:
        base = f"series/{entry['series_id']}/"
        latest = _read(api_dir / base / "latest.json")
        actuals = _read(api_dir / base / "actuals.json")
        observed = pd.Series(
            actuals["observation"], index=pd.DatetimeIndex(actuals["date"])
        )
        # The forecast the day before, from the replay: its values are rounded, which a warning can bear.
        before = next(
            (
                forecast
                for forecast in reversed(
                    _read(api_dir / base / "replay.json")["forecasts"]
                )
                if forecast["reference_date"] < latest["reference_date"]
            ),
            None,
        )
        found = check_forecast(
            latest["quantiles"],
            observed,
            latest["reference_date"],
            before and before["quantiles"],
            before
            and steps_between(
                observed,
                before["reference_date"],
                latest["reference_date"],
                trading=entry["horizon_unit"] == "trading_day",
            ),
        )
        errors += [f"{base}latest.json: {e}" for e in found[0]]
        warnings += [f"{base}latest.json: {w}" for w in found[1]]
    return errors, warnings


def check_forecast(
    quantiles: dict,
    observed: pd.Series,
    reference_date: str,
    before: dict | None = None,
    shift: int = 0,
) -> tuple[list[str], list[str]]:
    """The errors and warnings of a forecast against the 365 days of `observed` up to its reference date.

    Its median against their range, its 8 in 10 band against their mean daily move, and, given the
    forecast `before` it, `shift` steps earlier, how far its median moved on the days both forecast.
    """
    day = pd.Timestamp(reference_date)
    year = observed.loc[day - pd.Timedelta(days=364) : day].to_numpy()
    low, median, high = (np.array(quantiles[level]) for level in ("0.1", "0.5", "0.9"))
    errors, warnings = [], []

    span = max(year.max() - year.min(), 1e-9)
    outside = max(
        0.0, (median.max() - year.max()) / span, (year.min() - median.min()) / span
    )
    for limit, found in zip(reversed(OUTSIDE), (errors, warnings)):
        if outside > limit:
            found.append(
                f"the median leaves the range of its 365 days by {outside:.2g} of it, over {limit:g}"
            )
            break

    move = np.abs(np.diff(year)).mean()
    # A year without a move has no scale to judge a band by.
    for ratio in sorted(
        {(high - low).min() / move, (high - low).max() / move} if move else ()
    ):
        for (least, most), found in zip(reversed(WIDTH), (errors, warnings)):
            if not least <= ratio <= most:
                found.append(
                    f"the 8 in 10 band is {ratio:.2g} times the mean daily move of its 365 days, outside {least:g} to {most:g}"
                )
                break

    if before is not None:
        shared = min(len(median), len(before["0.5"]) - shift)
        then = slice(shift, shift + max(shared, 0))
        band = np.array(before["0.9"][then]) - np.array(before["0.1"][then])
        moves = np.abs(
            median[: max(shared, 0)] - np.array(before["0.5"][then])
        ) / np.maximum(band, 1e-9)
        if moves.size and moves.max() > CHANGE:
            warnings.append(
                f"the median moved by {moves.max():.2g} band widths of the forecast before on the same day, over {CHANGE:g}"
            )
    return errors, warnings


def steps_between(observed: pd.Series, before: str, after: str, trading: bool) -> int:
    """The steps from one reference date to a later one: days, or for trading days the prices between."""
    if trading:
        index = observed.index
        return int(((index > before) & (index <= after)).sum())
    return (pd.Timestamp(after) - pd.Timestamp(before)).days


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main(api_dir: Path, subset: bool = False) -> int:
    errors, warnings = contract(api_dir, subset=subset), []
    # The bounds read the files in the shapes the contract gives them.
    if not errors:
        errors, warnings = bounds(api_dir)
    # In GitHub Actions, as annotations on the run.
    form = "::{}::" if "GITHUB_ACTIONS" in os.environ else "{}: "
    for level, messages in (("warning", warnings), ("error", errors)):
        for message in messages:
            print(form.format(level) + message)
    print(f"{api_dir}: {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]), subset="--subset" in sys.argv[2:]))
