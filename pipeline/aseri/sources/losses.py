"""Drones claimed downed by Ukraine's General Staff, from the running totals of PetroIvaniuk/2022-Ukraine-Russia-War-Dataset."""

import hashlib
import json
from datetime import UTC, date, datetime

import pandas as pd

from aseri.sources import download


def fetch(url: str) -> tuple[pd.Series, date, dict]:
    """Today's vintage of the daily claims, its as_of (the UTC fetch date), and the file's hash and the days the total fell.

    Fails closed: a file that breaks the contract raises, so it never reaches the archive.
    """
    as_of = datetime.now(UTC).date()
    raw, headers = download(url)
    observed = parse(raw)
    if observed.index[-1].date() > as_of:
        raise ValueError(
            f"The losses have a day, {observed.index[-1].date()}, after the fetch day {as_of}"
        )
    upstream = {
        "source_url": url,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "etag": headers.get("ETag"),
        # Flagged, never clipped: a fall is the General Staff correcting its own total.
        "revisions": observed.index[observed < 0].strftime("%Y-%m-%d").tolist(),
    }
    return observed, as_of, upstream


def parse(raw: bytes) -> pd.Series:
    """The daily difference of the running total of drones, by report day.

    A day with no report adds nothing, and the next one carries it; the series ends on the last report,
    its freshness cutoff, so a stale file is never padded with zeros. A negative difference stays as it is.
    """
    reports = pd.DataFrame(json.loads(raw))
    total = reports.set_index(pd.DatetimeIndex(reports["date"]))["drone"]
    if not total.index.is_monotonic_increasing or not total.index.is_unique:
        raise ValueError("The losses have days out of order or repeated")
    if not pd.api.types.is_integer_dtype(total) or (total < 0).any():
        raise ValueError(
            "The losses have drone totals that are not integers of at least 0"
        )
    every_day = pd.date_range(total.index[0], total.index[-1], freq="D")
    daily = total.reindex(every_day).ffill().diff().iloc[1:]
    # The highest day is 2719 (2026-07-27); twice the highest before it is a typo in a total, not a claim.
    if (daily >= 2 * daily.cummax().shift(1).clip(lower=100)).any():
        raise ValueError("The losses have a day of twice the highest before it or more")
    return daily.astype(float)
