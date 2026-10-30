"""Caldara and Iacoviello's daily geopolitical risk index (GPRD)."""

import hashlib
import io
from datetime import UTC, date, datetime

import pandas as pd

from aseri.sources import download


def fetch(url: str) -> tuple[pd.Series, date, dict]:
    """Today's vintage of the index, its as_of (the UTC date it was downloaded), and the file's hash and upstream stamps.

    Fails closed: a file that breaks the contract (here, and in `parse`) raises, so it never reaches the archive.
    """
    as_of = datetime.now(UTC).date()
    raw, headers = download(url)
    observed = parse(raw)
    last_day = observed.index[-1].date()
    # A day after the download is a broken file, and would become the run's live forecast.
    if last_day > as_of:
        raise ValueError(f"GPR has a day, {last_day}, after the fetch day {as_of}")
    upstream = {
        "source_url": url,
        "sha256": hashlib.sha256(raw).hexdigest(),
        # The server's own freshness stamps, verbatim, or None when it sends none.
        "last_modified": headers.get("Last-Modified"),
        "etag": headers.get("ETag"),
    }
    return observed, as_of, upstream


def parse(raw: bytes) -> pd.Series:
    """The daily index from the upstream .dta file, by date, checked to be continuous."""
    frame = pd.read_stata(io.BytesIO(raw))
    observed = frame.set_index("date")["GPRD"].astype(float)
    every_day = pd.date_range(observed.index[0], observed.index[-1], freq="D")
    # Stata has no infinity, so a blank is the only non-finite value the file can hold.
    if observed.isna().any() or not observed.index.equals(every_day):
        raise ValueError("GPR has missing days: expected one value for every day")
    # 0 occurs on real days; the record is 1046 (after 9/11), so 5000 means a broken file.
    if not observed.between(0, 5000).all():
        raise ValueError("GPR has implausible values outside 0 to 5000")
    # Four decimals drop the float32 noise, so the model reads exactly the values the archive keeps.
    return observed.round(4)
