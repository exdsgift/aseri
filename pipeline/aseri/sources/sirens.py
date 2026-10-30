"""Ukraine's air-raid alerts, oblast by oblast, from the volunteer file of Vadimkin/ukrainian-air-raid-sirens-dataset."""

import hashlib
import io
from datetime import UTC, date, datetime

import pandas as pd

from aseri.sources import download

HOUR = pd.Timedelta(hours=1)
DAY = pd.Timedelta(days=1)


def fetch(url: str) -> tuple[pd.Series, date, dict]:
    """Today's vintage of the daily alert hours, its as_of (the UTC fetch date), and the file's hash and freshness cutoff.

    Fails closed: a file that breaks the contract raises, so it never reaches the archive.
    """
    as_of = datetime.now(UTC).date()
    raw, headers = download(url)
    observed, cutoff = parse(raw)
    if observed.index[-1].date() > as_of:
        raise ValueError(
            f"The alerts have a day, {observed.index[-1].date()}, after the fetch day {as_of}"
        )
    upstream = {
        "source_url": url,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "etag": headers.get("ETag"),
        # The latest end in the file: the days are complete only before its day.
        "freshness_cutoff": f"{cutoff:%Y-%m-%dT%H:%M:%SZ}",
    }
    return observed, as_of, upstream


def parse(raw: bytes) -> tuple[pd.Series, pd.Timestamp]:
    """Hours of alert per UTC day, summed over the oblasts, and the freshness cutoff they are complete to.

    Each alert is split at UTC midnight. The cutoff is the file's latest end, its newest event: the
    cutoff's day is dropped as partial, and a day with no alert before it is 0, never one after it, so
    a stale file ends early rather than in a run of zeros that would read as a ceasefire. Luhansk
    (since 2022-04-04) and Crimea (since 2022-12-10) are under one alert that never ends, which the
    file leaves out, and so does aseri: 48 hours a day that never change would say nothing.
    """
    alerts = pd.read_csv(io.BytesIO(raw))
    start = pd.to_datetime(alerts["started_at"], utc=True, format="ISO8601")
    end = pd.to_datetime(alerts["finished_at"], utc=True, format="ISO8601")
    if start.isna().any() or end.isna().any() or (end < start).any():
        raise ValueError(
            "The alerts have a blank start or end, or an end before its start"
        )
    # Two alerts of one oblast at once would count its hours twice.
    order = pd.DataFrame({"region": alerts["region"], "start": start, "end": end})
    order = order.sort_values(["region", "start"])
    if (order["start"] < order.groupby("region")["end"].shift()).any():
        raise ValueError("The alerts overlap within an oblast")
    cutoff = end.max()
    # One row per alert and UTC day it touches, with the time of that day it covers.
    first = start.dt.floor("D")
    rows = pd.DataFrame({"start": start, "end": end, "first": first}).loc[
        start.index.repeat((end - first) // DAY + 1)
    ]
    rows["day"] = rows["first"] + rows.groupby(level=0).cumcount() * DAY
    covered = rows["end"].clip(upper=rows["day"] + DAY) - rows["start"].clip(
        lower=rows["day"]
    )
    hours = (covered / HOUR).groupby(rows["day"].dt.tz_localize(None)).sum()
    every_day = pd.date_range(hours.index[0], cutoff.tz_localize(None).floor("D") - DAY)
    observed = hours.reindex(every_day, fill_value=0.0)
    if not observed.between(0, 600).all():
        raise ValueError("The alerts have a day outside 0 to 600 hours")
    return observed.round(4), cutoff
