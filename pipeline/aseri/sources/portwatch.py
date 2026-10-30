"""IMF PortWatch daily chokepoint transits (`n_total`), from its keyless ArcGIS layer."""

import hashlib
import json
import time
import urllib.request
from datetime import UTC, date, datetime
from http.client import HTTPException
from urllib.error import HTTPError

import pandas as pd

from aseri.sources import USER_AGENT

# The layer's maxRecordCount: the history since 2019 comes in pages.
PAGE = 1000


def fetch(url: str) -> tuple[pd.Series, date, dict]:
    """Today's vintage of one chokepoint, its as_of (the UTC fetch date), and the layer's edit stamp and the rows' hash.

    `url` is a query of the layer for one chokepoint, ordered by date, as the registry builds it.
    Fails closed: anything that breaks the contract raises, so it never reaches the archive.
    """
    as_of = datetime.now(UTC).date()
    layer = get(url.split("/query?")[0] + "?f=json")
    edited = pd.Timestamp(layer["editingInfo"]["dataLastEditDate"], unit="ms")
    count = get(url + "&returnCountOnly=true")["count"]
    rows = []
    # Paged up to the count, so a history of whole pages never asks for an empty one.
    while not rows or len(rows) < count:
        page = get(f"{url}&resultOffset={len(rows)}&resultRecordCount={PAGE}")
        rows += [feature["attributes"] for feature in page["features"]]
        if not page.get("exceededTransferLimit"):
            break
    # A page can come back whole yet end the query early.
    if len(rows) != count:
        raise ValueError(f"PortWatch sent {len(rows)} of its {count} rows")
    observed = parse(rows, edited)
    last_day = observed.index[-1].date()
    if last_day > as_of:
        raise ValueError(
            f"PortWatch has a day, {last_day}, after the fetch day {as_of}"
        )
    upstream = {
        "source_url": url,
        "sha256": hashlib.sha256(json.dumps(rows).encode()).hexdigest(),
        # Logged on every run: the series' expected_lag comes from these stamps.
        "data_last_edit_date": f"{edited:%Y-%m-%dT%H:%M:%SZ}",
    }
    return observed, as_of, upstream


def get(url: str) -> dict:
    """The JSON at `url`, retried with backoff (10 s, doubling to 60 s) for about 5 minutes before giving up.

    ArcGIS reports errors inside HTTP 200 bodies. On 2026-10-30 it failed from 1 query in 10 to 9 in 10,
    in spells of minutes, and one lane in four still failed in each of three runs, with 2.5 or 5 minutes
    of attempts: that lane is published from the archive, and the next day's run tries again.
    """
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(8):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                # A body cut off mid-way fails here, as a JSONDecodeError.
                body = json.loads(response.read())
            if "error" in body or body.get("features") == []:
                raise ValueError(f"PortWatch answered {body.get('error', 'no rows')}")
            return body
        except (OSError, HTTPException, ValueError) as error:
            # A real 4xx will not fix itself; an error body, a 5xx, a timeout or a cut connection may.
            if attempt == 7 or (isinstance(error, HTTPError) and error.code < 500):
                raise
            time.sleep(min(10 * 2**attempt, 60))


def parse(rows: list[dict], edited: pd.Timestamp) -> pd.Series:
    """The daily transits by date, without the days the layer may still be filling, checked to be continuous whole counts."""
    frame = pd.DataFrame(rows)
    observed = frame.set_index(pd.DatetimeIndex(frame["date"], name="date"))["n_total"]
    # A day is complete only once the layer was edited more than 24 h after it ended.
    observed = observed[observed.index + pd.Timedelta(days=2) < edited]
    every_day = pd.date_range(observed.index[0], observed.index[-1], freq="D")
    if not observed.index.equals(every_day):
        raise ValueError(
            "PortWatch has missing or repeated days: expected one row for every day"
        )
    if not pd.api.types.is_integer_dtype(observed) or (observed < 0).any():
        raise ValueError("PortWatch has transits that are not integers of at least 0")
    # No day since 2019 reaches twice the highest count before it, at any of the four chokepoints.
    if (observed >= 2 * observed.cummax().shift(1)).any():
        raise ValueError("PortWatch has a count of twice the highest before it or more")
    return observed.astype(float)
