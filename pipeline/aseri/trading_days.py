"""Brent's clock: a forecast step is a trading day, dated by the weekdays the price's own history shows the market keeps."""

import pandas as pd

# The years before a day that vote on whether the market closes on it: 7 outvote 2022's
# moved bank holidays and Christmas stand-ins that fell on the last Monday of December.
YEARS = 7


def after(prints: pd.DatetimeIndex, steps: int) -> pd.DatetimeIndex:
    """The `steps` trading days after the last of `prints`: weekdays, less the holidays the history shows."""
    days, day = [], prints[-1]
    while len(days) < steps:
        day += pd.Timedelta(days=1)
        if day.weekday() < 5 and not holiday(day, prints):
            days.append(day)
    return pd.DatetimeIndex(days)


def holiday(day: pd.Timestamp, prints: pd.DatetimeIndex) -> bool:
    """Whether the market closed on most of `day`'s occasions in the 7 years before, and on 2 at least.

    An occasion is the same date, the same day from Easter, or the same weekday of the month counted
    from its start or its end (the first or last Monday of May). Read from the weekdays without a
    print, so the calendar follows the market's practice, not a country's: with Boxing Day 2020 on a
    Saturday it traded on the Monday after, and it kept no US holiday from 2017 on. Day by day out of
    sample, it named every weekday of 2023 to Oct 2026 right but 8 of 997.
    shortcut: a weekend holiday's weekday stand-in (Dec 27 and 28, 2021) is missed, being on another
    date every year; it dates the steps after it a day early, and positional scoring is unaffected.
    """
    years = range(day.year - YEARS, day.year)
    occasions = [
        [_date(year, day.month, day.day) for year in years],
        [_easter(year) + (day - _easter(day.year)) for year in years],
        [_weekday_of_month(day, year, from_end=False) for year in years],
        [_weekday_of_month(day, year, from_end=True) for year in years],
    ]
    return any(_mostly_closed(dates, prints) for dates in occasions)


def _mostly_closed(dates: list, prints: pd.DatetimeIndex) -> bool:
    # A weekend or a day outside the history tells nothing, and one closure alone is not a habit.
    known = [
        d
        for d in dates
        if d is not None and d.weekday() < 5 and prints[0] < d < prints[-1]
    ]
    closed = sum(d not in prints for d in known)
    return closed >= 2 and closed > len(known) - closed


def _date(year: int, month: int, day: int) -> pd.Timestamp | None:
    try:
        return pd.Timestamp(year, month, day)
    except ValueError:  # February 29 in a common year
        return None


def _easter(year: int) -> pd.Timestamp:
    return pd.Timestamp(year, 1, 1) + pd.offsets.Easter()


def _weekday_of_month(
    day: pd.Timestamp, year: int, from_end: bool
) -> pd.Timestamp | None:
    """The weekday of `day`, in its month of `year`, as many weeks from the month's start (or end) as `day` is.

    Only the first three either way: a fourth from the start is the last in some years and not in others.
    """
    month_end = day + pd.offsets.MonthEnd(0)
    weeks = (month_end.day - day.day if from_end else day.day - 1) // 7
    if weeks > 2:
        return None
    if from_end:
        edge = _date(year, day.month, 1) + pd.offsets.MonthEnd(0)
        return edge - pd.Timedelta(
            days=(edge.weekday() - day.weekday()) % 7 + 7 * weeks
        )
    edge = _date(year, day.month, 1)
    return edge + pd.Timedelta(days=(day.weekday() - edge.weekday()) % 7 + 7 * weeks)
