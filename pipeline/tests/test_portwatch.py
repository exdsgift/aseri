"""The PortWatch adapter on responses recorded on 2026-10-30: Hormuz from 2026-09-01, in pages of 25 rows."""

import json
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

import pandas as pd
import pytest

from aseri.sources import portwatch

RECORDED = Path(__file__).parent / "fixtures" / "portwatch"
# The query the pages answer; the registry's queries differ only in their `where`.
QUERY = (RECORDED / "query.txt").read_text(encoding="utf-8").strip()
# What ArcGIS sent, inside an HTTP 200, for about 1 query in 10 on 2026-10-30.
ERROR = (RECORDED / "error.json").read_bytes()


class Response:
    def __init__(self, body):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return self.body


class Server:
    """Stands in for ArcGIS: the recorded responses, each after any bodies queued for it first."""

    def __init__(self, **queued):
        self.queued = {name: list(bodies) for name, bodies in queued.items()}
        self.requests = []

    def __call__(self, request, timeout):
        self.requests.append(request)
        url = request.full_url
        query = parse_qs(urlsplit(url).query)
        if "returnCountOnly" in query:
            name = "count"
        elif "resultOffset" in query:
            assert query["resultRecordCount"] == ["25"]
            name = f"page-{query['resultOffset'][0]}"
        else:
            assert url == QUERY.split("/query?")[0] + "?f=json"
            name = "layer"
        if self.queued.get(name):
            return Response(self.queued[name].pop(0))
        return Response((RECORDED / f"{name}.json").read_bytes())


def recorded(name):
    return json.loads((RECORDED / f"{name}.json").read_bytes())


@pytest.fixture
def serve(monkeypatch):
    """Answer the adapter from `Server(**queued)`, in pages of 25, on 2026-10-30, without waiting between attempts."""
    sleeps = []

    def start(**queued):
        server = Server(**queued)
        monkeypatch.setattr(portwatch.urllib.request, "urlopen", server)
        server.sleeps = sleeps
        return server

    monkeypatch.setattr(portwatch, "PAGE", 25)
    monkeypatch.setattr(portwatch.time, "sleep", sleeps.append)
    monkeypatch.setattr(
        portwatch,
        "datetime",
        SimpleNamespace(now=lambda tz: datetime(2026, 10, 30, 7, 2, tzinfo=UTC)),
    )
    return start


def test_fetch_pages_through_the_query_and_reads_the_daily_transits_by_date(serve):
    server = serve()

    observed, as_of, upstream = portwatch.fetch(QUERY)

    assert observed.index[0] == pd.Timestamp("2026-09-01")
    assert observed.index[-1] == pd.Timestamp("2026-10-25")
    assert len(observed) == 55
    assert observed.iloc[:6].tolist() == [4.0, 3.0, 2.0, 2.0, 2.0, 6.0]
    assert observed.iloc[-5:].tolist() == [3.0, 4.0, 5.0, 2.0, 2.0]
    assert as_of.isoformat() == "2026-10-30"
    assert upstream["source_url"] == QUERY
    # The layer's own stamp: logged on every run, it is how the expected lag is measured.
    assert upstream["data_last_edit_date"] == "2026-10-28T07:51:08Z"
    assert len(upstream["sha256"]) == 64
    assert {r.get_header("User-agent") for r in server.requests} == {
        "aseri (+https://github.com/exdsgift/aseri)"
    }
    assert server.sleeps == []


def test_an_error_body_in_an_http_200_is_retried_with_backoff_and_then_succeeds(serve):
    server = serve(**{"page-25": [ERROR, ERROR]})

    observed, _, _ = portwatch.fetch(QUERY)

    assert len(observed) == 55
    assert server.sleeps == [10, 20]


def test_an_error_body_that_never_clears_fails_the_fetch_after_5_minutes_of_attempts(
    serve,
):
    server = serve(layer=[ERROR] * 8)

    with pytest.raises(ValueError, match="Invalid query parameters"):
        portwatch.fetch(QUERY)
    assert server.sleeps == [10, 20, 40, 60, 60, 60, 60]


def test_a_page_cut_off_mid_body_is_retried(serve):
    page = (RECORDED / "page-0.json").read_bytes()
    server = serve(**{"page-0": [page[: len(page) // 2]]})

    observed, _, _ = portwatch.fetch(QUERY)

    assert len(observed) == 55
    assert server.sleeps == [10]


def test_a_page_that_ends_the_query_short_fails_the_fetch(serve):
    # A whole JSON body that says it is the last page, 5 rows before the count.
    short = recorded("page-25")
    del short["exceededTransferLimit"]
    serve(**{"page-25": [json.dumps(short).encode()]})

    with pytest.raises(ValueError, match="50 of its 55 rows"):
        portwatch.fetch(QUERY)


def test_a_history_of_whole_pages_never_asks_for_an_empty_page(serve):
    # 50 rows: the second page is the last, though ArcGIS may still flag more.
    server = serve(count=[b'{"count":50}'])

    observed, _, _ = portwatch.fetch(QUERY)

    assert len(observed) == 50
    assert not any("resultOffset=50" in r.full_url for r in server.requests)
    assert server.sleeps == []


def with_rows(name, *rows):
    """A recorded page with `rows` (date, n_total) added at its end."""
    page = recorded(name)
    page["features"] += [{"attributes": {"date": d, "n_total": n}} for d, n in rows]
    return json.dumps(page).encode()


def test_a_day_counts_only_once_the_layer_was_edited_more_than_24_h_after_it_ended(
    serve,
):
    # Edited 2026-10-28 07:51 UTC: 2026-10-26 ended 31 h before, 2026-10-27 only 7 h before.
    serve(
        count=[b'{"count":57}'],
        **{"page-50": [with_rows("page-50", ("2026-10-26", 3), ("2026-10-27", 1))]},
    )

    observed, _, _ = portwatch.fetch(QUERY)

    assert observed.index[-1] == pd.Timestamp("2026-10-26")
    assert observed.iloc[-1] == 3.0


@pytest.mark.parametrize(
    ("rows", "problem"),
    [
        ([("2026-10-27", 3)], "missing or repeated days"),
        ([("2026-10-25", 3)], "missing or repeated days"),
        ([("2026-10-26", -1)], "integers of at least 0"),
        ([("2026-10-26", 2.5)], "integers of at least 0"),
        ([("2026-10-26", None)], "integers of at least 0"),
        # The highest count before it is 8, on 2026-09-11.
        ([("2026-10-26", 16)], "twice the highest"),
    ],
    ids=["a day absent", "a day twice", "negative", "fractional", "blank", "a jump"],
)
def test_rows_that_break_the_contract_fail_the_fetch(serve, rows, problem):
    # The layer edited late enough that every added day counts as complete.
    layer = recorded("layer")
    layer["editingInfo"]["dataLastEditDate"] = 1793500000000  # 2026-11-01
    serve(
        layer=[json.dumps(layer).encode()],
        count=[f'{{"count":{55 + len(rows)}}}'.encode()],
        **{"page-50": [with_rows("page-50", *rows)]},
    )

    with pytest.raises(ValueError, match=problem):
        portwatch.fetch(QUERY)


def test_a_count_just_under_twice_the_highest_before_it_passes(serve):
    layer = recorded("layer")
    layer["editingInfo"]["dataLastEditDate"] = 1793500000000
    serve(
        layer=[json.dumps(layer).encode()],
        count=[b'{"count":56}'],
        **{"page-50": [with_rows("page-50", ("2026-10-26", 15))]},
    )

    assert portwatch.fetch(QUERY)[0].iloc[-1] == 15.0
