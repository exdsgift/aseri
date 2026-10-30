"""Brent's forecast steps as dates: weekdays less the holidays its own history shows."""

from pathlib import Path

import pandas as pd

from aseri.series import BRENT_SPOT, GPR_DAILY
from aseri.sources import fred
from aseri.trading_days import after, holiday

# FRED's prices from 2018 to 2026-10-27, as downloaded on 2026-10-30.
PRINTS = fred.parse(
    (Path(__file__).parent / "fixtures" / "fred" / "DCOILBRENTEU.csv").read_bytes()
).index


def through(last_day):
    """The prints to `last_day`, the days after 2026-10-27 filled in as the calendar expects them."""
    ahead = after(PRINTS, 400)
    return PRINTS.append(ahead[ahead <= last_day])


def labels(days):
    return [f"{d:%a %m-%d}" for d in days]


def test_steps_skip_the_weekend():
    days = after(PRINTS, 5)

    # The last print is Tuesday 2026-10-27.
    assert labels(days) == [
        "Wed 10-28",
        "Thu 10-29",
        "Fri 10-30",
        "Mon 11-02",
        "Tue 11-03",
    ]


def test_no_step_falls_on_a_weekend_in_a_year_of_forecasts():
    assert not (after(PRINTS, 260).day_of_week >= 5).any()


def test_steps_skip_christmas_and_new_year_but_not_the_monday_after_a_saturday_boxing_day():
    # 2026: Christmas on a Friday, Boxing Day on a Saturday. In 2020, laid out the same, the market traded on the Monday.
    days = after(through("2026-12-23"), 8)

    assert labels(days) == [
        "Thu 12-24",
        "Mon 12-28",
        "Tue 12-29",
        "Wed 12-30",
        "Thu 12-31",
        "Mon 01-04",
        "Tue 01-05",
        "Wed 01-06",
    ]


def test_steps_skip_easter_and_the_last_monday_of_may_found_in_the_history():
    assert holiday(pd.Timestamp("2027-03-26"), through("2027-03-25"))  # Good Friday
    assert holiday(pd.Timestamp("2027-03-29"), through("2027-03-25"))  # Easter Monday
    assert holiday(
        pd.Timestamp("2027-05-31"), through("2027-05-28")
    )  # the last Monday of May
    # The fourth Monday of May, the last one in 2024 to 2026, is not the habit.
    assert not holiday(pd.Timestamp("2027-05-24"), through("2027-05-21"))


def weekdays_less(holidays, first="2018-01-01", last="2026-12-18"):
    days = pd.bdate_range(first, last)
    return days[~days.isin(pd.to_datetime(holidays))]


def test_one_closure_is_not_a_habit():
    # Shut on 2022-09-19 alone, a Monday: 2025-09-19 trades.
    prints = weekdays_less(["2022-09-19"])

    assert not holiday(pd.Timestamp("2025-09-19"), prints)


def test_the_7_years_before_vote_and_the_most_votes_win():
    # Shut on July 4 in 2019 and 2022, open in 2018, 2023 and 2024; 2020's and 2021's fell on a weekend.
    prints = weekdays_less(["2019-07-04", "2022-07-04"])

    assert holiday(pd.Timestamp("2023-07-04"), prints)  # 2 votes to 1
    assert not holiday(pd.Timestamp("2025-07-04"), prints)  # 2 votes to 3


def test_a_day_with_no_history_before_it_is_a_weekday_like_any_other():
    prints = pd.bdate_range("2026-10-01", "2026-10-27")

    assert labels(after(prints, 3)) == ["Wed 10-28", "Thu 10-29", "Fri 10-30"]


def test_only_brent_counts_trading_days():
    history = pd.DatetimeIndex(["2026-10-22", "2026-10-23"])

    assert labels(BRENT_SPOT.target_dates(history, 2)) == ["Mon 10-26", "Tue 10-27"]
    assert labels(GPR_DAILY.target_dates(history, 2)) == ["Sat 10-24", "Sun 10-25"]
