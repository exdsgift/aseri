"""The adapters of Brent, "World War III" views, air-raid hours and drones: recorded responses of 2026-10-30, and hand-made data for each transform and contract."""

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest

from aseri import sources
from aseri.series import (
    BRENT_SPOT,
    UA_AIR_RAID_HOURS,
    UA_DRONES_DOWNED_CLAIMED,
    WIKI_WW3_VIEWS,
)
from aseri.sources import fred, losses, sirens, wikimedia

RECORDED = Path(__file__).parent / "fixtures"
USER_AGENT = "aseri (+https://github.com/exdsgift/aseri)"


class Response:
    def __init__(self, body, headers):
        self.body, self.headers = body, headers

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return self.body


@pytest.fixture
def serve(monkeypatch):
    """Answer every download with `body` and `headers` on 2026-10-30 at 07:02 UTC, and keep the requests."""

    def start(module, body, headers=None):
        requests = []
        monkeypatch.setattr(
            sources.urllib.request,
            "urlopen",
            lambda request, timeout: (
                requests.append(request) or Response(body, headers or {})
            ),
        )
        monkeypatch.setattr(
            module,
            "datetime",
            SimpleNamespace(now=lambda tz: datetime(2026, 10, 30, 7, 2, tzinfo=UTC)),
        )
        return requests

    return start


# Brent, from FRED.

BRENT = (RECORDED / "fred" / "DCOILBRENTEU.csv").read_bytes()


def test_brent_reads_the_prints_of_trading_days_and_drops_the_blank_holidays(serve):
    requests = serve(fred, BRENT, {"Last-Modified": "Wed, 28 Oct 2026 17:18:14 GMT"})

    observed, as_of, upstream = fred.fetch(BRENT_SPOT.source["data_url"])

    assert observed.index[-1] == pd.Timestamp("2026-10-27")
    assert observed.iloc[-3:].tolist() == [128.30, 128.12, 123.10]
    assert not (observed.index.day_of_week >= 5).any()
    # Blank on Christmas, Boxing Day and New Year's Day: dropped, never carried forward.
    assert observed["2025-12-24":"2026-01-02"].index.strftime("%m-%d").tolist() == [
        "12-24",
        "12-29",
        "12-30",
        "12-31",
        "01-02",
    ]
    assert as_of.isoformat() == "2026-10-30"
    assert upstream == {
        "source_url": BRENT_SPOT.source["data_url"],
        "sha256": hashlib.sha256(BRENT).hexdigest(),
        "last_modified": "Wed, 28 Oct 2026 17:18:14 GMT",
    }
    assert requests[0].get_header("User-agent") == USER_AGENT


def brent_file(rows):
    return (
        "observation_date,DCOILBRENTEU\n" + "".join(f"{d},{p}\n" for d, p in rows)
    ).encode()


@pytest.mark.parametrize(
    ("rows", "problem"),
    [
        ([("2026-10-23", 128.3), ("2026-10-27", 123.1)], "one row for every weekday"),
        ([("2026-10-23", 128.3), ("2026-10-24", 128.3)], "one row for every weekday"),
        ([("2026-10-26", 128.1), ("2026-10-27", ".")], "not numbers"),
        ([("2026-10-26", 128.1), ("2026-10-27", 0)], "outside 0 to 500"),
        ([("2026-10-26", 128.1), ("2026-10-27", 1231.0)], "outside 0 to 500"),
    ],
    ids=[
        "a weekday absent",
        "a Saturday",
        "a dot for a blank",
        "zero",
        "a slipped decimal",
    ],
)
def test_brent_rows_that_break_the_contract_fail(rows, problem):
    with pytest.raises(ValueError, match=problem):
        fred.parse(brent_file(rows))


def test_brent_fails_a_print_after_the_fetch_day(serve):
    serve(fred, brent_file([("2026-10-30", 120.5), ("2026-11-02", 121.0)]))

    with pytest.raises(ValueError, match="2026-11-02, after the fetch day 2026-10-30"):
        fred.fetch(BRENT_SPOT.source["data_url"])


# "World War III" views, from Wikimedia.

WIKI_QUERY = (RECORDED / "wikimedia" / "query.txt").read_text(encoding="utf-8").strip()
WIKI = (RECORDED / "wikimedia" / "World_War_III.json").read_bytes()


def test_wikipedia_reads_the_daily_views_by_people_with_aseri_s_user_agent(serve):
    requests = serve(wikimedia, WIKI)

    observed, _, upstream = wikimedia.fetch(WIKI_QUERY)

    assert observed.index[0] == pd.Timestamp("2026-08-01")
    assert observed.index[-1] == pd.Timestamp("2026-10-29")
    assert observed.iloc[-3:].tolist() == [1801.0, 2122.0, 2699.0]
    assert upstream == {
        "source_url": WIKI_QUERY,
        "sha256": hashlib.sha256(WIKI).hexdigest(),
    }
    # Exactly the project's: no email or person in any request.
    assert [r.get_header("User-agent") for r in requests] == [USER_AGENT]
    assert requests[0].full_url == WIKI_QUERY


def test_wikipedia_asks_for_english_wikipedia_and_people_only():
    assert (
        "/per-article/en.wikipedia/all-access/user/World_War_III/daily/"
        in (WIKI_WW3_VIEWS.source["data_url"])
    )


def with_items(change):
    items = json.loads(WIKI)["items"]
    change(items)
    return json.dumps({"items": items}).encode()


@pytest.mark.parametrize(
    ("change", "problem"),
    [
        (
            lambda items: items[-1].update(agent="all-agents"),
            "another article or agent",
        ),
        (
            lambda items: items[-1].update(article="World_War_II"),
            "another article or agent",
        ),
        (lambda items: items.pop(-2), "missing or repeated days"),
        (lambda items: items.append(dict(items[-1])), "missing or repeated days"),
        (lambda items: items[-1].update(views=-1), "integers of at least 0"),
        (lambda items: items[-1].update(views=None), "integers of at least 0"),
    ],
    ids=[
        "bots too",
        "another article",
        "a day absent",
        "a day twice",
        "negative",
        "blank",
    ],
)
def test_wikipedia_answers_that_break_the_contract_fail(change, problem):
    with pytest.raises(ValueError, match=problem):
        wikimedia.parse(with_items(change), WIKI_QUERY)


# Air-raid alert hours, from the volunteer file.

ALERTS = (RECORDED / "sirens" / "volunteer_data_en.csv").read_bytes()


def test_alert_hours_from_the_recorded_file_end_the_day_before_its_newest_alert(serve):
    serve(sirens, ALERTS, {"ETag": '"31574ae8"'})

    observed, _, upstream = sirens.fetch(UA_AIR_RAID_HOURS.source["data_url"])

    # Every alert since 2026-10-27; the newest ended 2026-10-30 04:27, so the 30th is partial and left out.
    assert observed.index.strftime("%Y-%m-%d").tolist() == [
        "2026-10-27",
        "2026-10-28",
        "2026-10-29",
    ]
    assert observed.tolist() == [73.8914, 49.7608, 48.6425]
    assert upstream["freshness_cutoff"] == "2026-10-30T04:27:25Z"
    assert upstream["etag"] == '"31574ae8"'


def alerts_file(*alerts):
    return (
        "region,started_at,finished_at,naive\n"
        + "".join(f"{r},{s}+00:00,{e}+00:00,False\n" for r, s, e in alerts)
    ).encode()


def test_an_alert_is_split_at_utc_midnight_and_summed_over_the_oblasts():
    observed, _ = sirens.parse(
        alerts_file(
            # 22:00 to 01:30: 2 hours on the 27th, 1.5 on the 28th.
            ("Kyiv City", "2026-10-27 22:00:00", "2026-10-28 01:30:00"),
            ("Sumska oblast", "2026-10-28 10:00:00", "2026-10-28 10:45:00"),
            # The newest alert: the 29th is partial.
            ("Kyiv City", "2026-10-29 03:00:00", "2026-10-29 03:30:00"),
        )
    )

    assert observed.index.strftime("%Y-%m-%d").tolist() == ["2026-10-27", "2026-10-28"]
    assert observed.tolist() == [2.0, 2.25]


def test_a_day_without_alerts_is_0_up_to_the_cutoff_and_never_after_it():
    observed, cutoff = sirens.parse(
        alerts_file(
            ("Kyiv City", "2026-10-20 10:00:00", "2026-10-20 11:00:00"),
            ("Kyiv City", "2026-10-23 10:00:00", "2026-10-23 12:00:00"),
        )
    )

    # A file that stopped on the 23rd ends on the 22nd, however late it is read.
    assert observed.tolist() == [1.0, 0.0, 0.0]
    assert observed.index[-1] == pd.Timestamp("2026-10-22")
    assert cutoff == pd.Timestamp("2026-10-23 12:00", tz="UTC")


def test_an_alert_over_several_days_counts_24_hours_on_each_day_between():
    observed, _ = sirens.parse(
        alerts_file(
            ("Lvivska oblast", "2026-10-20 18:00:00", "2026-10-23 06:00:00"),
            ("Kyiv City", "2026-10-24 01:00:00", "2026-10-24 02:00:00"),
        )
    )

    assert observed.tolist() == [6.0, 24.0, 24.0, 6.0]


def every_oblast_all_day(count):
    return [
        (f"Oblast {n}", "2026-10-27 00:00:00", "2026-10-28 00:00:00")
        for n in range(count)
    ] + [("Kyiv City", "2026-10-28 05:00:00", "2026-10-28 06:00:00")]


def test_25_oblasts_alerted_all_day_make_the_bound_of_600_hours():
    observed, _ = sirens.parse(alerts_file(*every_oblast_all_day(25)))

    assert observed.tolist() == [600.0]


@pytest.mark.parametrize(
    ("alerts", "problem"),
    [
        (every_oblast_all_day(26), "outside 0 to 600"),
        (
            [
                ("Kyiv City", "2026-10-27 10:00:00", "2026-10-27 12:00:00"),
                ("Kyiv City", "2026-10-27 11:00:00", "2026-10-27 13:00:00"),
            ],
            "overlap within an oblast",
        ),
        (
            [("Kyiv City", "2026-10-27 12:00:00", "2026-10-27 11:00:00")],
            "end before its start",
        ),
    ],
    ids=["26 regions", "an oblast twice at once", "backwards"],
)
def test_alerts_that_break_the_contract_fail(alerts, problem):
    with pytest.raises(ValueError, match=problem):
        sirens.parse(alerts_file(*alerts))


def test_alerts_with_a_blank_end_fail():
    raw = b"region,started_at,finished_at,naive\nKyiv City,2026-10-27 10:00:00+00:00,,True\n"

    with pytest.raises(ValueError, match="blank start or end"):
        sirens.parse(raw)


# Drones claimed downed, from the running totals.

LOSSES = (RECORDED / "losses" / "russia_losses_equipment.json").read_bytes()


def test_drones_from_the_recorded_file_are_the_daily_difference_of_the_total(serve):
    serve(losses, LOSSES, {"ETag": '"b179ceda"'})

    observed, _, upstream = losses.fetch(UA_DRONES_DOWNED_CLAIMED.source["data_url"])

    # 60 reports to 2026-10-30, the report of the fetch day itself: 59 differences.
    assert len(observed) == 59
    assert observed.index[-1] == pd.Timestamp("2026-10-30")
    assert observed.iloc[-3:].tolist() == [1543.0, 1614.0, 1589.0]
    assert upstream["revisions"] == []
    assert upstream["etag"] == '"b179ceda"'


def losses_file(*totals, start="2026-10-25"):
    days = pd.date_range(start, periods=len(totals), freq="D")
    return json.dumps(
        [
            {"date": f"{d:%Y-%m-%d}", "day": 1700 + i, "drone": t}
            for i, (d, t) in enumerate(zip(days, totals))
        ]
    ).encode()


def test_drones_are_the_daily_difference_of_the_running_total():
    observed = losses.parse(losses_file(1000, 2500, 4100))

    assert observed.index.strftime("%Y-%m-%d").tolist() == ["2026-10-26", "2026-10-27"]
    assert observed.tolist() == [1500.0, 1600.0]


def test_a_day_without_a_report_adds_0_and_the_next_report_carries_it():
    reports = json.loads(losses_file(1000, 3000, 4500, 6000, 7600))
    del reports[3]

    observed = losses.parse(json.dumps(reports).encode())

    assert observed.tolist() == [2000.0, 1500.0, 0.0, 3100.0]
    assert observed.index[-1] == pd.Timestamp("2026-10-29")


def test_a_fall_in_the_total_is_kept_as_a_negative_day_and_flagged_as_a_revision(serve):
    serve(losses, losses_file(1000, 2500, 2450, 4000))

    observed, _, upstream = losses.fetch(UA_DRONES_DOWNED_CLAIMED.source["data_url"])

    assert observed.tolist() == [1500.0, -50.0, 1550.0]
    assert upstream["revisions"] == ["2026-10-27"]


@pytest.mark.parametrize(
    ("totals", "problem"),
    [
        ((1000, 2500, None), "not integers of at least 0"),
        ((1000, 2500, 3999.5), "not integers of at least 0"),
        ((1000, 2500, -1), "not integers of at least 0"),
        # 1500 a day, then a slipped digit in the total.
        ((1000, 2500, 25000), "twice the highest before it"),
    ],
    ids=["blank", "fractional", "negative total", "a typo in the total"],
)
def test_drone_totals_that_break_the_contract_fail(totals, problem):
    with pytest.raises(ValueError, match=problem):
        losses.parse(losses_file(*totals))


def test_drone_reports_out_of_order_fail():
    reports = json.loads(losses_file(1000, 2500, 4100))
    reports[1], reports[2] = reports[2], reports[1]

    with pytest.raises(ValueError, match="out of order or repeated"):
        losses.parse(json.dumps(reports).encode())


def test_a_day_just_under_twice_the_highest_before_it_passes():
    assert losses.parse(losses_file(1000, 2500, 5499)).iloc[-1] == 2999.0
