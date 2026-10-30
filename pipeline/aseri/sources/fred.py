"""Brent crude spot price (EIA), from FRED's keyless CSV of DCOILBRENTEU: one print per trading day."""

import hashlib
import io
from datetime import UTC, date, datetime

import pandas as pd

from aseri.sources import download


def fetch(url: str) -> tuple[pd.Series, date, dict]:
    """Today's vintage of the prices, its as_of (the UTC fetch date), and the file's hash and Last-Modified stamp.

    Fails closed: a file that breaks the contract (here, and in `parse`) raises, so it never reaches the archive.
    """
    as_of = datetime.now(UTC).date()
    raw, headers = download(url)
    observed = parse(raw)
    last_day = observed.index[-1].date()
    if last_day > as_of:
        raise ValueError(f"FRED has a day, {last_day}, after the fetch day {as_of}")
    upstream = {
        "source_url": url,
        "sha256": hashlib.sha256(raw).hexdigest(),
        # Logged on every run: FRED releases Brent in weekly batches, and expected_lag comes from these stamps.
        "last_modified": headers.get("Last-Modified"),
    }
    return observed, as_of, upstream


def parse(raw: bytes) -> pd.Series:
    """The prices by trading day, checked: one row for every weekday, blank on the days the market was shut."""
    frame = pd.read_csv(io.BytesIO(raw))
    prices = frame.set_index(pd.DatetimeIndex(frame["observation_date"]))[
        "DCOILBRENTEU"
    ]
    # FRED lists every weekday since 1987, so a day missing or out of order is a broken file.
    if not prices.index.equals(pd.bdate_range(prices.index[0], prices.index[-1])):
        raise ValueError(
            "FRED has missing, repeated or weekend days: expected one row for every weekday"
        )
    if not pd.api.types.is_numeric_dtype(prices):
        raise ValueError("FRED has prices that are not numbers")
    # A blank is a holiday: dropped, never carried forward, so every step the model reads is a real print.
    prices = prices.dropna()
    # The record is 143.95 (July 2008) and the low 9.10 (December 1998).
    if not ((prices > 0) & (prices < 500)).all():
        raise ValueError("FRED has implausible prices outside 0 to 500")
    return prices.astype(float)
