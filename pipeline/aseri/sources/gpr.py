"""Caldara and Iacoviello's daily geopolitical risk index (GPRD)."""

import io
import time
import urllib.request
from datetime import UTC, date, datetime
from http.client import HTTPException
from urllib.error import HTTPError

import pandas as pd


def fetch(url: str) -> tuple[pd.Series, date]:
    """Today's vintage of the index, and its as_of: the UTC date it was downloaded."""
    as_of = datetime.now(UTC).date()
    return parse(download(url)), as_of


def download(url: str) -> bytes:
    """The file at `url`, retried with exponential backoff (10 s to 80 s) before giving up."""
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                return response.read()
        except (OSError, HTTPException) as error:
            # A 4xx will not fix itself; a 5xx, a timeout or a cut connection may.
            if attempt == 4 or (isinstance(error, HTTPError) and error.code < 500):
                raise
            time.sleep(10 * 2**attempt)


def parse(raw: bytes) -> pd.Series:
    """The daily index from the upstream .dta file, by date, checked to be continuous."""
    frame = pd.read_stata(io.BytesIO(raw))
    observed = frame.set_index("date")["GPRD"].astype(float)
    every_day = pd.date_range(observed.index[0], observed.index[-1], freq="D")
    if observed.isna().any() or not observed.index.equals(every_day):
        raise ValueError("GPR has missing days: expected one value for every day")
    # 0 occurs on real days; the record is 1046 (after 9/11), so 5000 means a broken file.
    if not observed.between(0, 5000).all():
        raise ValueError("GPR has implausible values outside 0 to 5000")
    # Four decimals drop the float32 noise, so the model reads exactly the values the archive keeps.
    return observed.round(4)
