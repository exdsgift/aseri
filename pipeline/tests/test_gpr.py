import io
from http.client import IncompleteRead
from urllib.error import HTTPError

import pandas as pd
import pytest

from aseri.sources import gpr


def gpr_file(values, dates):
    """A GPR daily file shaped like the upstream one: a date column and the index in GPRD."""
    frame = pd.DataFrame(
        {
            "DAY": [d.replace("-", "") for d in dates],
            "GPRD": pd.Series(values, dtype="float32"),
            "date": pd.to_datetime(dates),
        }
    )
    raw = io.BytesIO()
    frame.to_stata(raw, write_index=False, convert_dates={"date": "td"})
    return raw.getvalue()


def test_reads_the_daily_index_by_date():
    raw = gpr_file([120.5, 98.25, 0.0], ["2026-10-24", "2026-10-25", "2026-10-26"])

    observed = gpr.parse(raw)

    assert observed.index.strftime("%Y-%m-%d").tolist() == [
        "2026-10-24",
        "2026-10-25",
        "2026-10-26",
    ]
    assert observed.tolist() == [120.5, 98.25, 0.0]


@pytest.mark.parametrize(
    ("values", "dates"),
    [
        ([120.5, 98.25], ["2026-10-24", "2026-10-26"]),
        ([120.5, float("nan"), 98.25], ["2026-10-24", "2026-10-25", "2026-10-26"]),
    ],
    ids=["a day absent", "a day blank"],
)
def test_rejects_a_missing_day(values, dates):
    with pytest.raises(ValueError, match="missing"):
        gpr.parse(gpr_file(values, dates))


@pytest.mark.parametrize(
    "value", [-1.0, 1e6], ids=["negative", "far above any recorded peak"]
)
def test_rejects_an_implausible_value(value):
    raw = gpr_file([120.5, value], ["2026-10-25", "2026-10-26"])

    with pytest.raises(ValueError, match="implausible"):
        gpr.parse(raw)


def test_download_does_not_retry_a_client_error(monkeypatch):
    calls = []

    def refuse(url, timeout):
        calls.append(url)
        raise HTTPError(url, 404, "Not Found", None, None)

    monkeypatch.setattr(gpr.urllib.request, "urlopen", refuse)
    monkeypatch.setattr(gpr.time, "sleep", lambda seconds: None)

    with pytest.raises(HTTPError):
        gpr.download("https://example.org/gpr.dta")
    assert len(calls) == 1


def test_download_retries_a_connection_cut_mid_body(monkeypatch):
    attempts = iter([IncompleteRead(b"partial"), b"whole file"])

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def read(self):
            outcome = next(attempts)
            if isinstance(outcome, Exception):
                raise outcome
            return outcome

    monkeypatch.setattr(gpr.urllib.request, "urlopen", lambda url, timeout: Response())
    monkeypatch.setattr(gpr.time, "sleep", lambda seconds: None)

    assert gpr.download("https://example.org/gpr.dta") == b"whole file"
