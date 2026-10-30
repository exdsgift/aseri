"""The daily run: fetch each series, forecast every new day, archive and publish. Usage: python -m aseri API_DIR ARCHIVE_DIR"""

import json
import os
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

from aseri import archive
from aseri.forecast import forecast, load_model, make_context, under_review
from aseri.publish import publish, publish_catalog
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
    for series, observed, as_of, _ in list(fetched.values()):
        if os.environ.get("ASERI_ACCEPT_REVISIONS") == "true":
            print(
                f"{series.id}: revisions accepted for this run, unchecked", flush=True
            )
            continue
        try:
            archive.check_revisions(archive_dir, series, observed, as_of)
        except archive.RevisionHold as hold:
            del fetched[series.id]
            skipped[series.id] = ("held", str(hold))
    ran_today = archive.ran_on(archive_dir, today)
    model, runs, issued = None, [], {}
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
        new_dates = (
            []
            if ran_today
            else archive.new_reference_dates(
                usable,
                [
                    a.forecast.reference_date
                    for a in archive.read(archive_dir, series.id)
                ],
            )
        )
        forecasts = []
        try:
            for day in new_dates:
                if model is None:
                    model = load_model()
                # Each forecast sees only the data up to its own date.
                forecasts.append(
                    forecast(
                        model,
                        make_context(series, observed, day),
                        series.horizon,
                        series.kind,
                    )
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
        issued[series.id] = len(forecasts)
        if not ran_today and (
            forecasts
            or archive.has_new_observations(archive_dir, series.id, observed, as_of)
        ):
            runs.append(archive.SeriesRun(series, forecasts, observed, as_of, upstream))
    # One manifest, one round and one delta for the whole run.
    if runs:
        archive.write(
            archive_dir,
            runs,
            code_commit=code_commit,
            run_url=run_url,
            generated_at=generated_at,
        )
    entries, rows, levels = [], [], None
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
            )
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
        rows.append((series.id, status, f"{observed.index[-1]:%Y-%m-%d}", detail))
    report(rows)
    if not entries:
        sys.exit("Nothing to publish: no series is fresh or has an archived forecast.")
    publish_catalog(api_dir, entries, levels, generated_at)
    # The series the page now shows as late, read from what it reads, and the held ones, for daily.yml's issues.
    if "GITHUB_OUTPUT" in os.environ:
        catalog = json.loads((api_dir / "series.json").read_text(encoding="utf-8"))
        late = [s["series_id"] for s in catalog["series"] if s["stale_since"]]
        held = [id for id, (status, _) in skipped.items() if status == "held"]
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as file:
            file.write(f"stale={','.join(late)}\nrevision_hold={','.join(held)}\n")


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
