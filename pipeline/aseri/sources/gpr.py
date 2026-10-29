"""Caldara and Iacoviello's daily geopolitical risk index (GPRD)."""

import io

import pandas as pd


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
    return observed
