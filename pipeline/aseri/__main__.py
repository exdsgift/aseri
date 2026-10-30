"""The daily run: fetch each series, forecast every new day, archive and publish. Usage: python -m aseri API_DIR ARCHIVE_DIR"""

import json
import os
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

from aseri import archive
from aseri.forecast import forecast, load_model, make_context, under_review
from aseri.publish import publish
from aseri.series import GPR_DAILY
from aseri.sources import gpr

# Each series with the adapter that fetches it and checks its contract.
SOURCES = ((GPR_DAILY, gpr),)
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
    model = None
    rows = []
    # shortcut: archive.write and publish take one series each (one manifest per run day, one catalog
    # entry), so the second series (#132) needs both to take every series at once.
    for series, source in SOURCES:
        try:
            observed, as_of, upstream = source.fetch(series.source["data_url"])
        # Whatever breaks a download, a file or a contract fails its own series, never the run.
        except Exception as error:  # noqa: BLE001
            problem = f"{type(error).__name__}: {error}"
            rows.append(
                publish_stale(
                    api_dir, archive_dir, series, generated_at, "failed", problem
                )
            )
            continue
        # First, so a deep rewrite stops the run before it archives or publishes anything, actuals included.
        # A manual run with accept_revisions ticked, after a human has reviewed the rewrite, records it instead.
        if os.environ.get("ASERI_ACCEPT_REVISIONS") == "true":
            print(
                f"{series.id}: revisions accepted for this run, unchecked", flush=True
            )
        else:
            archive.check_revisions(archive_dir, series, observed, as_of)
        lag = (as_of - observed.index[-1].date()).days
        age = f"days old: {lag}, expected up to {series.expected_lag}"
        if lag >= series.expected_lag + STALE_DAYS:
            rows.append(
                publish_stale(api_dir, archive_dir, series, generated_at, "stale", age)
            )
            continue
        # A suspect newest value waits a day: archived and published as an actual, never forecast from.
        note, usable = None, observed
        if under_review(series, observed):
            usable = observed.iloc[:-1]
            note = (
                f"The value of {observed.index[-1]:%Y-%m-%d} is under review, far outside its "
                "previous 28 days, so the latest forecast starts from the day before."
            )
        archived = archive.read(archive_dir, series.id)
        ran_today = archive.ran_on(archive_dir, generated_at.date())
        new_dates = (
            []
            if ran_today
            else archive.new_reference_dates(
                usable, [a.forecast.reference_date for a in archived]
            )
        )
        if not ran_today and (
            new_dates
            or archive.has_new_observations(archive_dir, series.id, observed, as_of)
        ):
            forecasts = []
            if new_dates and model is None:
                model = load_model()
            for day in new_dates:
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
            archive.write(
                archive_dir,
                series,
                forecasts,
                observed=observed,
                as_of=as_of,
                upstream=upstream,
                code_commit=code_commit,
                run_url=run_url,
                generated_at=generated_at,
            )
            archived = archive.read(archive_dir, series.id)
        since = late_since(series, observed.index[-1].date())
        publish(
            api_dir,
            series,
            archived,
            observed=observed,
            as_of=as_of,
            generated_at=generated_at,
            note=note,
            stale_since=since if as_of >= since else None,
        )
        status = "late" if lag >= series.expected_lag + LATE_DAYS else "ok"
        rows.append(
            (
                series.id,
                status,
                f"{observed.index[-1]:%Y-%m-%d}",
                f"{age}; {len(new_dates)} new forecasts, the latest from "
                f"{archived[-1].forecast.reference_date:%Y-%m-%d}"
                + (f". {note}" if note else ""),
            )
        )
    report(rows)
    # A row without a "data to" date published nothing.
    if not any(data_to for _, _, data_to, _ in rows):
        sys.exit("Nothing to publish: no series is fresh or has an archived forecast.")
    # The series the page now shows as late, read from what it reads, for daily.yml to open an issue on.
    if "GITHUB_OUTPUT" in os.environ:
        catalog = json.loads((api_dir / "series.json").read_text(encoding="utf-8"))
        late = [s["series_id"] for s in catalog["series"] if s["stale_since"]]
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as file:
            file.write(f"stale={','.join(late)}\n")


def publish_stale(api_dir, archive_dir, series, generated_at, status, problem):
    """Publish a skipped series' last good forecast and data, from the archive, labelled stale; the summary row."""
    archived = archive.read(archive_dir, series.id)
    if not archived:
        return series.id, status, None, f"{problem}; nothing archived to publish"
    today = generated_at.date()
    observed = archive.as_of_view(archive_dir, series.id, today)
    last_day = observed.index[-1].date()
    since = late_since(series, last_day)
    publish(
        api_dir,
        series,
        archived,
        observed=observed,
        # The vintage it republishes, not the day it failed to fetch a newer one.
        as_of=archive.newest_as_of(archive_dir, series.id),
        generated_at=generated_at,
        # A failure before the data is late leaves the page as current as on any day: the summary says it failed.
        stale_since=since if today >= since else None,
    )
    return series.id, status, f"{last_day:%Y-%m-%d}", f"{problem}; last good files kept"


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
    try:
        main(Path(sys.argv[1]), Path(sys.argv[2]))
    except archive.RevisionHold as hold:
        print(hold, file=sys.stderr)
        # 3, not 1, so daily.yml can tell a hold from a crash and open an issue.
        sys.exit(3)
