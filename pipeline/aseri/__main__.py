"""The daily run: fetch each series, forecast every new day, archive and publish. Usage: python -m aseri API_DIR ARCHIVE_DIR"""

import json
import os
import shutil
import subprocess
import sys
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

from aseri import archive, bulk, record
from aseri.forecast import forecast, load_model, make_context, under_review
from aseri.gate import annotate, check_forecasts
from aseri.publish import publish, publish_catalog, publish_contract, publish_scores
from aseri.series import (
    BAB_EL_MANDEB_TRANSITS,
    BRENT_SPOT,
    GPR_DAILY,
    HORMUZ_TRANSITS,
    SUEZ_TRANSITS,
    TAIWAN_STRAIT_TRANSITS,
    UA_AIR_RAID_HOURS,
    UA_DRONES_DOWNED_CLAIMED,
    WIKI_WW3_VIEWS,
)
from aseri.sources import fred, gpr, losses, portwatch, sirens, wikimedia

# Each series with the adapter that fetches it and checks its contract, in the catalog's order.
SOURCES = (
    (GPR_DAILY, gpr),
    (SUEZ_TRANSITS, portwatch),
    (HORMUZ_TRANSITS, portwatch),
    (BAB_EL_MANDEB_TRANSITS, portwatch),
    (TAIWAN_STRAIT_TRANSITS, portwatch),
    (WIKI_WW3_VIEWS, wikimedia),
    (BRENT_SPOT, fred),
    (UA_AIR_RAID_HOURS, sirens),
    (UA_DRONES_DOWNED_CLAIMED, losses),
)
# Days past its expected lag at which a series' data warns, and at which the series is skipped as stale.
LATE_DAYS, STALE_DAYS = 2, 7


def late_since(series, last_day):
    """The day a series' data turns late: from it on, the page and the alert say so, the same day on every run."""
    return last_day + timedelta(days=series.expected_lag + LATE_DAYS)


def main(api_dir: Path, archive_dir: Path) -> None:
    # Resolved first, so a checkout without git fails before the costly model load.
    code_commit = (
        os.environ.get("GITHUB_SHA")
        or subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True
        ).stdout.strip()
    )
    run_url = (
        f"{os.environ['GITHUB_SERVER_URL']}/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
        if "GITHUB_RUN_ID" in os.environ
        else None
    )
    generated_at = datetime.now(UTC)
    today = generated_at.date()
    # Each series' download, and the series the run publishes from the archive instead, with why.
    fetched, skipped = {}, {}
    for series, source in SOURCES:
        try:
            fetched[series.id] = (series, *source.fetch(series.source["data_url"]))
        # Whatever breaks a download, a file or a contract fails its own series, never the run.
        except Exception as error:  # noqa: BLE001
            skipped[series.id] = ("failed", f"{type(error).__name__}: {error}")
    # First, so a deep rewrite holds its series before any of its data is archived: it keeps its last good files,
    # and daily.yml opens an issue. A manual run with accept_revisions ticked, after a human review, records it.
    # A deep revision that passes is archived, and named in the run summary.
    deep_revised = {}
    for series, observed, as_of, _ in list(fetched.values()):
        if os.environ.get("ASERI_ACCEPT_REVISIONS") == "true":
            print(
                f"{series.id}: revisions accepted for this run, unchecked", flush=True
            )
            continue
        try:
            if passed := archive.check_revisions(archive_dir, series, observed, as_of):
                deep_revised[series.id] = passed
        except archive.RevisionHold as hold:
            del fetched[series.id]
            skipped[series.id] = ("held", str(hold))
    ran_today = archive.ran_on(archive_dir, today)
    # Each series' new forecasts, and its retrospective ones dropped out of bounds, for the run summary.
    model, runs, issued, dropped = None, [], {}, {}
    for series, observed, as_of, upstream in fetched.values():
        lag = (as_of - observed.index[-1].date()).days
        if lag >= series.expected_lag + STALE_DAYS:
            skipped[series.id] = (
                "stale",
                f"days old: {lag}, expected up to {series.expected_lag}",
            )
            continue
        # A suspect newest value waits a day: archived and published as an actual, never forecast from.
        # shortcut: only the newest day is checked, so a dropout inside a PortWatch weekly batch is still a
        # retrospective origin; check every new day if the replay ever shows one.
        usable = observed.iloc[:-1] if under_review(series, observed) else observed
        archived = archive.read(archive_dir, series.id)
        new_dates = (
            []
            if ran_today
            else archive.new_reference_dates(
                # Only from a day with a value: the drones' day without a report starts none.
                usable.dropna(),
                # A new MODEL_ID forecasts the replay window again, for its replay and its record.
                [a.forecast.reference_date for a in archive.this_model(archived)],
            )
        )
        forecasts = []
        try:
            for day in new_dates:
                if model is None:
                    model = load_model()
                # Each forecast sees only the data up to its own date.
                forecasts.append(
                    forecast(model, make_context(series, observed, day), series)
                )
                # The launch backfill takes minutes, so the log shows it moving.
                print(
                    f"{series.id}: forecast {len(forecasts)} of {len(new_dates)}, from {day:%Y-%m-%d}",
                    flush=True,
                )
        # A model or post-processing error fails its own series; its new observations are still archived below,
        # since PortWatch keeps no vintages, and the next run forecasts the days this one missed.
        except Exception as error:  # noqa: BLE001
            skipped[series.id] = (
                "failed",
                f"forecast: {type(error).__name__}: {error}",
            )
            forecasts = []
        # Before anything is archived, for good: a new forecast far from its series' history is dropped alone and
        # named. The live one, the run's newest when no archived forecast is as new, also holds its series for
        # review, as a model error does; the others are archived all the same. Why here and not in the gate: gate.py.
        errors, warnings = check_forecasts(
            series, forecasts, observed, [a.forecast for a in archived]
        )
        for warning in warnings:
            annotate("warning", f"{series.id}: {warning}")
        newest = forecasts[-1].reference_date if forecasts else None
        live = (
            newest
            if newest and all(a.forecast.reference_date < newest for a in archived)
            else None
        )
        found = "; ".join(error for day in errors.values() for error in day)
        if live in errors:
            skipped[series.id] = ("out of bounds", found)
        elif errors:
            dropped[series.id] = found
        forecasts = [f for f in forecasts if f.reference_date not in errors]
        issued[series.id] = len(forecasts)
        if not ran_today and (
            forecasts
            or archive.has_new_observations(archive_dir, series.id, observed, as_of)
        ):
            runs.append(
                archive.SeriesRun(
                    series, forecasts, observed, as_of, upstream, tuple(errors)
                )
            )
    # One manifest, one round and one delta for the whole run.
    if runs:
        archive.write(
            archive_dir,
            runs,
            code_commit=code_commit,
            run_url=run_url,
            generated_at=generated_at,
        )
    # After the archive: a target due today is scored against the values this run has just archived.
    entries, rows, levels, records, red, scores = [], [], None, [], [], []
    for series, _ in SOURCES:
        archived = archive.read(archive_dir, series.id)
        # A fresh series with no archive waits for tomorrow: today's run was archived before it had data.
        status, detail = skipped.get(series.id, ("waiting", "today's run is archived"))
        if not archived:
            rows.append(
                (series.id, status, None, f"{detail}; nothing archived to publish")
            )
            continue
        note = None
        if series.id in skipped:
            observed = archive.as_of_view(archive_dir, series.id, today)
            # The vintage it republishes, not the day it failed to fetch a newer one.
            as_of = archive.newest_as_of(archive_dir, series.id)
            detail = f"{detail}; last good files kept"
            if status == "out of bounds":
                note = (
                    "The newest forecasts are held for review, far outside the series' last 365 days: "
                    f"the latest shown starts from {archived[-1].forecast.reference_date:%Y-%m-%d}."
                )
        else:
            _, observed, as_of, _ = fetched[series.id]
            # Said only while the latest forecast does start from the day before the suspect value.
            if (
                under_review(series, observed)
                and archived[-1].forecast.reference_date == observed.index[-2]
            ):
                note = (
                    f"The value of {observed.index[-1]:%Y-%m-%d} is under review, far outside its "
                    "previous 28 days, so the latest forecast starts from the day before."
                )
            lag = (as_of - observed.index[-1].date()).days
            status = "late" if lag >= series.expected_lag + LATE_DAYS else "ok"
            detail = (
                f"days old: {lag}, expected up to {series.expected_lag}; "
                f"{issued[series.id]} new forecasts, the latest from "
                f"{archived[-1].forecast.reference_date:%Y-%m-%d}"
                + (f". {note}" if note else "")
                + (
                    f"; dropped, out of bounds: {dropped[series.id]}"
                    if series.id in dropped
                    else ""
                )
            )
        # A failed or stale series can have passed the check too; say whether this run archived what it saw.
        if series.id in deep_revised:
            if any(run.series.id == series.id for run in runs):
                kept = "recorded"
            else:
                kept = (
                    "seen; today's run is already archived"
                    if ran_today
                    else "seen; not archived"
                )
            detail = f"{detail}; {deep_revised[series.id]}: {kept}"
        since = late_since(series, observed.index[-1].date())
        entries.append(
            publish(
                api_dir,
                series,
                archived,
                observed=observed,
                first_seen=archive.first_seen(archive_dir, series.id),
                as_of=as_of,
                generated_at=generated_at,
                note=note,
                # A failure before the data is late leaves the page as current as on any day: the summary says it failed.
                stale_since=since if today >= since else None,
            )
        )
        levels = archived[-1].forecast.levels
        try:
            # shortcut: reads every delta file again, once per series; read them once per run if that gets slow.
            vintages = archive.vintages(archive_dir, series.id)
            # The model in the code's record, or the model before's until it has a scored target.
            model_id, scored = record.shown(series, archived, vintages, today)
            summary = record.summary(
                series,
                scored,
                # shortcut: a second scoring of every due target; score only the revised ones if runs get slow.
                record.scored(
                    series, archived, vintages, today, latest=True, model_id=model_id
                ),
                model_id,
            )
            # The monitor watches the model in the code: a retired model's record raises no alert.
            zones = (
                record.calibration(series, scored)
                if model_id == archive.MODEL_ID
                else {}
            )
            # The bulk scores keep every model's, where the record shows one: the shown model's rows as
            # scored above, and each other model's.
            by_model = {model_id: scored} | {
                model: record.scored(series, archived, vintages, today, model_id=model)
                for model in sorted({a.model_id for a in archived} - {model_id})
            }
            # Kept only once all of it worked, so a series has its whole record or none.
            records.append(summary)
            scores += [
                frame.assign(model_id=model, target=series.id)
                for model, frame in by_model.items()
            ]
            if "red" in zones.values():
                red.append(series.id)
        # Whatever breaks its scores costs the series its scores only: it still publishes, as do the others.
        except Exception as error:  # noqa: BLE001
            del entries[-1]["links"]["scores"]
            detail = f"{detail}; scores failed: {type(error).__name__}: {error}"
        rows.append((series.id, status, f"{observed.index[-1]:%Y-%m-%d}", detail))
    # Under api/v1, so the page job's copy of the last deploy's api/v1 carries them too; before the
    # report, so that a failure is in the run summary.
    written = False
    if entries:
        started = time.monotonic()
        try:
            bulk.write(api_dir / "bulk", archive_dir, SOURCES, scores, generated_at)
            written = True
            print(
                f"Bulk files written in {time.monotonic() - started:.1f} s", flush=True
            )
        # Whatever breaks them costs the API its bulk files alone: the day is still archived and published,
        # where a failed run would never archive it, and fail again every day.
        except Exception as error:  # noqa: BLE001
            # A half-written file would pass for a whole one; the run's API directory starts empty.
            shutil.rmtree(api_dir / "bulk", ignore_errors=True)
            rows.append(
                (
                    "bulk files",
                    "failed",
                    None,
                    f"{type(error).__name__}: {error}; published without them",
                )
            )
    report(rows)
    if not entries:
        sys.exit("Nothing to publish: no series is fresh or has an archived forecast.")
    publish_catalog(api_dir, entries, levels, generated_at, bulk=written)
    publish_scores(api_dir, records, generated_at)
    publish_contract(api_dir)
    # The series the page now shows as late, read from what it reads, the held ones, and those whose live
    # ranges the monitor finds far off, for daily.yml's issues.
    if "GITHUB_OUTPUT" in os.environ:
        catalog = json.loads((api_dir / "series.json").read_text(encoding="utf-8"))
        late = [s["series_id"] for s in catalog["series"] if s["stale_since"]]
        held = [id for id, (status, _) in skipped.items() if status == "held"]
        bounded = [
            id for id, (status, _) in skipped.items() if status == "out of bounds"
        ]
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as file:
            file.write(
                f"stale={','.join(late)}\nrevision_hold={','.join(held)}\n"
                f"bounds_hold={','.join(bounded)}\ncalibration_red={','.join(red)}\n"
            )


def report(rows) -> None:
    """Each series' status, to the log and to the Actions run summary."""
    table = "| Series | Status | Data to | Detail |\n|---|---|---|---|\n" + "".join(
        f"| {series} | {status} | {data_to or '-'} | {detail} |\n"
        for series, status, data_to, detail in rows
    )
    print(table)
    if "GITHUB_STEP_SUMMARY" in os.environ:
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as file:
            file.write(table)


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
