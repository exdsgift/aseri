"""Delivery observability for the daily workflow: how late a scheduled run was, and whether the published catalog is the deployed one.

Standard library only, so the workflow runs it by path (`python3 pipeline/aseri/delivery.py ...`) with no install. GitHub says
scheduled runs "can be delayed during periods of high loads", so this measures the delay and promises no exact time.
"""

import hashlib
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime, timedelta
from pathlib import Path

CRON = re.compile(r"^(\d{1,2}) (\d{1,2}) \* \* \*$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")


def scheduled_time(cron: str, now: datetime) -> datetime | None:
    """The latest occurrence of a daily `M H * * *` cron at or before `now`, in UTC; None for any other cron."""
    match = CRON.match(cron.strip())
    if not match or int(match[1]) > 59 or int(match[2]) > 23:
        return None
    due = now.astimezone(UTC).replace(
        hour=int(match[2]), minute=int(match[1]), second=0, microsecond=0
    )
    return due if due <= now else due - timedelta(days=1)


def format_lag(lag: timedelta) -> str:
    minutes = int(lag.total_seconds() // 60)
    return (
        f"{minutes // 60} h {minutes % 60:02d} min"
        if minutes >= 60
        else f"{minutes} min"
    )


def lag_line(event: str, cron: str, now: datetime) -> str:
    """One line for the run summary: the lag behind the scheduled time, or why there is none."""
    if event != "schedule":
        return (
            f"Delivery lag: not measured, this run was a `{event}`, not the schedule."
        )
    due = scheduled_time(cron, now)
    if due is None:
        return f"Delivery lag: not measured, the schedule `{cron}` is not a daily cron."
    return (
        f"Delivery lag: {format_lag(now - due)} behind the scheduled {due:%H:%M} UTC "
        f"(now {now:%H:%M} UTC). GitHub gives no exact start time."
    )


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fetch(url: str, timeout: float = 30) -> bytes:
    # The query string and the header both ask the CDN for a fresh copy; neither is guaranteed to get one, hence the retries.
    request = urllib.request.Request(
        f"{url}?cb={time.time_ns()}", headers={"Cache-Control": "no-cache"}
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def verify(url, expected, attempts=6, delay=20, get=fetch, sleep=time.sleep):
    """Fetch `url` until its SHA-256 is `expected`, at most `attempts` times, `delay` seconds apart.

    Returns (True, tries) or (False, the last problem). A fetch error counts as an attempt: the CDN may not serve the site yet.
    """
    problem = "no attempt made"
    for attempt in range(1, attempts + 1):
        try:
            found = hashlib.sha256(get(url)).hexdigest()
        except (urllib.error.URLError, OSError) as error:
            problem = f"attempt {attempt}: could not fetch {url}: {error}"
        else:
            if found == expected:
                return True, attempt
            problem = (
                f"attempt {attempt}: {url} has SHA-256 {found}, expected {expected}"
            )
        print(problem)
        if attempt < attempts:
            sleep(delay)
    return False, problem


def summary(text: str) -> None:
    print(text)
    if "GITHUB_STEP_SUMMARY" in os.environ:
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as file:
            file.write(text + "\n\n")


def main(argv: list[str]) -> int:
    match argv:
        case ["lag"]:
            summary(
                lag_line(
                    os.environ.get("GITHUB_EVENT_NAME", ""),
                    os.environ.get("SCHEDULE_CRON", ""),
                    datetime.now(UTC),
                )
            )
        case ["sha", path]:
            sha = sha256_of(Path(path))
            print(f"catalog_sha={sha}")
            with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as file:
                file.write(f"catalog_sha={sha}\n")
        case ["verify", url, expected]:
            if not SHA256.match(expected):
                print(
                    f"::error::The expected SHA-256 is missing or malformed: {expected!r}"
                )
                return 1
            ok, detail = verify(url, expected)
            if not ok:
                print(
                    f"::error::The published catalog does not match the deployed artifact. {detail}"
                )
                summary(f"Published catalog: **not verified**. {detail}")
                return 1
            summary(
                f"Published catalog: verified, SHA-256 `{expected}` at {url} (attempt {detail})."
            )
        case _:
            print(
                "usage: delivery.py lag | sha FILE | verify URL SHA256", file=sys.stderr
            )
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
