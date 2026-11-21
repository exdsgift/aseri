"""The delivery checks: the schedule lag, and the verification of the published catalog."""

import hashlib
import urllib.error
from datetime import UTC, datetime, timedelta

import pytest

from aseri import delivery


def utc(hour, minute, day=21):
    return datetime(2026, 11, day, hour, minute, tzinfo=UTC)


def test_scheduled_time_is_todays_slot():
    assert delivery.scheduled_time("23 7 * * *", utc(14, 5)) == utc(7, 23)


def test_scheduled_time_before_todays_slot_is_yesterdays():
    assert delivery.scheduled_time("23 7 * * *", utc(7, 10)) == utc(7, 23, day=20)


@pytest.mark.parametrize(
    "cron", ["", "*/5 * * * *", "0 7 * * 1", "61 7 * * *", "0 24 * * *"]
)
def test_scheduled_time_refuses_anything_but_a_daily_cron(cron):
    assert delivery.scheduled_time(cron, utc(14, 5)) is None


def test_lag_line_measures_a_schedule_run():
    line = delivery.lag_line("schedule", "23 7 * * *", utc(14, 5))
    assert "6 h 42 min behind the scheduled 07:23 UTC" in line


def test_lag_line_does_not_pretend_for_other_events():
    assert "not measured" in delivery.lag_line(
        "workflow_dispatch", "23 7 * * *", utc(14, 5)
    )
    assert "not measured" in delivery.lag_line("schedule", "garbage", utc(14, 5))


def test_format_lag():
    assert delivery.format_lag(timedelta(minutes=9)) == "9 min"
    assert delivery.format_lag(timedelta(hours=2, minutes=3)) == "2 h 03 min"


def sha(body):
    return hashlib.sha256(body).hexdigest()


def run(bodies, attempts=4):
    """verify() against a sequence of responses (bytes, or an exception to raise), recording the sleeps."""
    pending = list(bodies)
    sleeps = []

    def get(url):
        item = pending.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    result = delivery.verify(
        "https://x/api/v1/series.json", sha(b"new"), attempts, 7, get, sleeps.append
    )
    return result, sleeps, pending


def test_verify_passes_at_once():
    assert run([b"new"]) == ((True, 1), [], [])


def test_verify_waits_out_a_stale_cdn_then_passes():
    result, sleeps, _ = run([b"old", b"old", b"new"])
    assert result == (True, 3)
    assert sleeps == [7, 7]


def test_verify_counts_a_fetch_error_as_an_attempt():
    result, _, _ = run([urllib.error.URLError("503"), b"new"])
    assert result == (True, 2)


def test_verify_is_bounded_and_says_what_it_found():
    (ok, problem), sleeps, pending = run([b"old"] * 4, attempts=4)
    assert not ok
    assert sha(b"old") in problem and sha(b"new") in problem
    assert len(sleeps) == 3 and pending == []


def test_verify_rejects_a_malformed_expected_hash(capsys):
    assert delivery.main(["verify", "https://x/series.json", "not-a-hash"]) == 1
    assert "malformed" in capsys.readouterr().out


def test_sha_writes_the_workflow_output(tmp_path, monkeypatch):
    catalog = tmp_path / "series.json"
    catalog.write_bytes(b"{}")
    out = tmp_path / "out"
    monkeypatch.setenv("GITHUB_OUTPUT", str(out))
    assert delivery.main(["sha", str(catalog)]) == 0
    assert out.read_text() == f"catalog_sha={sha(b'{}')}\n"
