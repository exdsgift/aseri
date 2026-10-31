"""The series aseri forecasts, as data. `id` is public and permanent: it is the API path and the Hubverse target."""

from dataclasses import dataclass
from urllib.parse import urlencode

import pandas as pd

from aseri import trading_days


@dataclass(frozen=True)
class Series:
    id: str
    title: str
    unit: str
    # What the "vs" figures compare with; None is the mean of its last 365 days, as of each publish.
    baseline: float | None
    baseline_label: str
    horizon: int
    interval_steps: tuple[int, ...]
    # How many days back from its newest an upstream revision may reach freely. Past it, see `deep_revision_days`.
    revision_window: int
    # How many days old its newest data can be at a run in normal times; 2 days past it the run warns, 7 past it skips the series.
    expected_lag: int
    source: dict
    license: dict
    # The baseline the record's verdict is against, pre-registered: the one with the lowest error on the
    # backtest, "naive" (last value), "snaive7" (same weekday a week back) or "mean28". Picked on a local run
    # of the 120-day backfill, scored as of 2026-10-31; #146 may revisit it before the live record reaches 30.
    primary_baseline: str
    # The weekday of the record's weekly forecasts, Monday 0: the day its live forecasts start from,
    # so that each week has one live forecast for the squares and the calibration monitor.
    record_weekday: int
    # What its values are, which sets the range of its quantiles: "index", "count" (0 and up) or "alert_hours" (0 to 600).
    kind: str = "index"
    # The edge check: a newest value more than this many IQRs outside its 28 days before waits a day. None turns it off.
    edge_iqr: float | None = None
    # A standing caveat on the data, for the page to show with the series.
    note: str | None = None
    # Days a target waits for its observation to settle before it is scored, once (research report, "Score
    # against a vintage fixed in advance"). To measure later from the archive: the age past which 95% of
    # revisions are under 1%.
    score_lag: int = 7
    # An update holds the run, for a human to review a method change or a broken file, when it moves more than
    # `deep_revision_days` values older than `revision_window` by more than `deep_revision_tolerance`, relative
    # to the archived value. The defaults hold on any change there: a source whose revisions are unmeasured.
    deep_revision_tolerance: float = 0.0
    deep_revision_days: int = 0
    # What a forecast step is: a calendar "day", or a "trading_day" for a price that has none on weekends and holidays.
    horizon_unit: str = "day"
    # Whether its values follow the week, so the page says to compare a day with the same weekday.
    weekly: bool = False

    def target_dates(self, history: pd.DatetimeIndex, steps: int) -> pd.DatetimeIndex:
        """The dates of a forecast's `steps`, from `history`, the series' days up to its reference date."""
        if self.horizon_unit == "trading_day":
            return trading_days.after(history, steps)
        return pd.date_range(
            history[-1] + pd.Timedelta(days=1), periods=steps, freq="D"
        )


GPR_DAILY = Series(
    id="gpr_daily",
    title="Geopolitical risk",
    unit="index (1985-2019 average = 100)",
    baseline=100,
    baseline_label="its 1985-2019 average",
    horizon=28,
    interval_steps=(7, 14, 28),
    # GPR rewrites its last month every week, and older days too: 148 of the authors' 277 weekly updates
    # from 2022-03 to 2026-10 changed a day older than 90 days, single days by up to 57%. Counted as days
    # moved by more than 1%, a normal update moved at most 77 (2024-05-13), and the February 2024 fix of
    # missing articles since 2021 moved 298 to 746 in each of its four files. 150 sits about twice as far
    # from both. The fix holds by design: a rewrite of years is for a human to review. A uniform shift of the
    # whole history above 1%, as a rebase would make, holds too. Calibration: prototypes/gpr-realtime-backtest/
    # revisions.py, docs/research/gpr-realtime-backtest.md "The deep-revision rule".
    revision_window=90,
    deep_revision_tolerance=0.01,
    deep_revision_days=150,
    # Updated on Mondays, Tuesdays after a US holiday, with data to that same day at about 18:00 UTC (the
    # authors' 2026 vintages): the 07:00 run sees data 1 to 7 days old, 8 in a holiday week.
    expected_lag=8,
    # Off: on the 1985-2026 history the top hits of any IQR rule are real news, and 9/11 needs 31 IQRs.
    edge_iqr=None,
    # Its weekends run 12 to 14% under its 28-day median on calm days, and the weekday explains 14% of their swing.
    weekly=True,
    # Mean absolute error on the backfill as of 2026-10-31, 2,142 settled days: the 28-day mean 42.7,
    # seasonal naive 50.6, naive 59.3 (Timestral 35.7).
    primary_baseline="mean28",
    # Its live forecasts start on Mondays, the day its weekly update runs to.
    record_weekday=0,
    # It revises its last month: revisions above 1% reach 3 to 4 weeks back.
    score_lag=35,
    source={
        "title": "Caldara and Iacoviello, Geopolitical Risk Index, daily",
        "url": "https://www.matteoiacoviello.com/gpr.htm",
        "data_url": "https://www.matteoiacoviello.com/gpr_files/data_gpr_daily_recent.dta",
        "field": "GPRD",
    },
    license={
        # The source page says "Creative Commons BY" without a version.
        "name": "CC BY",
        "url": "https://creativecommons.org/licenses/by/",
        "attribution": (
            'Caldara, D. and M. Iacoviello (2022), "Measuring Geopolitical Risk", '
            "American Economic Review 112(4), 1194-1225. "
            "Data: https://www.matteoiacoviello.com/gpr.htm"
        ),
    },
)


PORTWATCH_LAYER = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0"


def chokepoint(
    id: str,
    title: str,
    portname: str,
    horizon: int,
    interval_steps: tuple[int, ...],
    **extra,
) -> Series:
    """A chokepoint of IMF PortWatch: ships through it a day, all vessel types, one transit per ship per 48 h."""
    return Series(
        id=id,
        title=title,
        unit="ships a day",
        baseline=None,
        baseline_label="its 365-day mean",
        horizon=horizon,
        interval_steps=interval_steps,
        # PortWatch's revisions are unmeasured: a late AIS fix within a month passes, a deeper rewrite waits for review.
        revision_window=30,
        # Weekly batches to a Sunday, edited Tuesday to Thursday after 07:00 UTC (dataLastEditDate, 8 edits
        # logged from 2026-03 to 2026-10): the 07:00 run sees data 3 to 10 days old, 11 after a Thursday batch.
        expected_lag=11,
        kind="count",
        # Each weekly batch runs to a Sunday, the day its live forecast starts from.
        record_weekday=6,
        # Its revisions are unmeasured.
        score_lag=14,
        source={
            "title": "IMF PortWatch, Daily Chokepoints Data",
            "url": "https://portwatch.imf.org/",
            # The query the adapter pages through, ordered by date.
            "data_url": f"{PORTWATCH_LAYER}/query?"
            + urlencode(
                {
                    "where": f"portname='{portname}'",
                    "outFields": "date,n_total",
                    "orderByFields": "date",
                    "f": "json",
                }
            ),
            "field": "n_total",
        },
        license={
            "name": "IMF Copyright and Usage",
            "url": "https://www.imf.org/en/About/copyright-and-terms",
            "attribution": "Sources: UN Global Platform; IMF PortWatch (portwatch.imf.org).",
            "modifications": "aseri forecasts are model output derived from IMF PortWatch daily transit counts; they are not IMF data.",
            "commercial_use": "permission required from the IMF (copyright@imf.org)",
        },
        **extra,
    )


# Edge check off: its largest departures are real, the Ever Given blockage of March 2021 first, and no error is known.
SUEZ_TRANSITS = chokepoint(
    "suez_transits",
    "Suez Canal",
    "Suez Canal",
    28,
    (7, 14, 28),
    # Mean absolute error on the backfill as of 2026-10-31, 2,758 settled days: the 28-day mean 5.27,
    # seasonal naive 7.32, naive 7.35 (Timestral 5.23).
    primary_baseline="mean28",
)
# Edge check off: its departures are the news, the fall from 78 a day to 3 in March 2026 and convoys of up to 51 since.
HORMUZ_TRANSITS = chokepoint(
    "hormuz_transits",
    "Strait of Hormuz",
    "Strait of Hormuz",
    14,
    (3, 7, 14),
    # Mean absolute error on the backfill as of 2026-10-31, 1,477 settled days: naive 3.59, seasonal
    # naive 4.30, the 28-day mean 4.69 (Timestral 3.04).
    primary_baseline="naive",
)
# Edge check off: no day since 2019 lies more than 4 IQRs outside its 28 days before, so it would hold nothing.
BAB_EL_MANDEB_TRANSITS = chokepoint(
    "bab_el_mandeb_transits",
    "Bab el-Mandeb",
    "Bab el-Mandeb Strait",
    14,
    (3, 7, 14),
    # Mean absolute error on the backfill as of 2026-10-31, 1,477 settled days: the 28-day mean 5.25,
    # naive 6.72, seasonal naive 7.02 (Timestral 5.43).
    primary_baseline="mean28",
)
TAIWAN_STRAIT_TRANSITS = chokepoint(
    "taiwan_strait_transits",
    "Taiwan Strait",
    "Taiwan Strait",
    28,
    (7, 14, 28),
    # Mean absolute error on the backfill as of 2026-10-31, 2,758 settled days: the 28-day mean 27.8,
    # naive 45.8, seasonal naive 45.9 (Timestral 27.9).
    primary_baseline="mean28",
    # On: each of the 10 days since 2019 past 6 IQRs is a fall to 10-35% of the usual count, back within two days,
    # and no high value reaches 6. A forecast from such a day would carry the fall into its whole band.
    edge_iqr=6.0,
    note=(
        "Counted from AIS ship tracking, which misses ships on some days: a single day far below "
        "the usual count can be a tracking gap rather than less traffic. Typhoons also cut traffic for a day or two."
    ),
)


WIKI_WW3_VIEWS = Series(
    id="wiki_ww3_views",
    title='"World War III"',
    unit="Wikipedia views a day",
    baseline=None,
    baseline_label="its 365-day mean",
    horizon=14,
    interval_steps=(3, 7, 14),
    # Wikimedia reclassified 2025's bot traffic after the fact (#138): a month of reach, a deeper rewrite waits for review.
    revision_window=30,
    # A day's views reach the API the next day (#138): 1 day old at the 07:00 run, 2 if they land later, short of a warning.
    expected_lag=1,
    kind="count",
    # Off: its departures are the news, 788 IQRs on 2020-01-03 (Soleimani) and 169 on 2026-02-28.
    edge_iqr=None,
    # On calm days of the last 3 years Saturday runs 9% under its 28-day median, and the weekday explains 8% of the swing.
    weekly=True,
    # Mean absolute error on the backfill as of 2026-10-31, 1,519 settled days: naive 311.3, the 28-day
    # mean 313.1, seasonal naive 346.4 (Timestral 232.4).
    primary_baseline="naive",
    # Every day's views arrive the next day, so every weekday has a live forecast: Sunday, as for the
    # sea lanes and the war in Ukraine, so that the squares of the page line up.
    record_weekday=6,
    # A day's views are final the next day but for a rare bot reclassification.
    score_lag=7,
    note="Counts attention, not events: views of the English Wikipedia article by people, not bots.",
    source={
        "title": "Wikimedia Foundation, Analytics API (pageviews), English Wikipedia, World War III, agent type user",
        "url": "https://pageviews.wmcloud.org/?project=en.wikipedia.org&platform=all-access&agent=user&pages=World_War_III",
        # Every day from the API's first; it answers up to its newest.
        "data_url": "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/World_War_III/daily/20150701/20991231",
        "field": "views",
    },
    license={
        "name": "CC0 1.0",
        "url": "https://creativecommons.org/publicdomain/zero/1.0/",
        "attribution": "Data: Wikimedia Foundation, Analytics API (pageviews), English Wikipedia, CC0.",
    },
)


BRENT_SPOT = Series(
    id="brent_spot",
    title="Brent oil",
    unit="$ a barrel",
    baseline=None,
    baseline_label="its 365-day mean",
    horizon=14,
    interval_steps=(3, 7, 14),
    # No vintages to measure: a month of reach for an EIA correction, a deeper rewrite waits for review.
    revision_window=30,
    # FRED adds a weekly batch on Wednesday evenings UTC (Last-Modified 2026-10-28 17:18), up to the Tuesday before:
    # the 07:00 run sees prices 2 to 8 days old (#138), 9 if a holiday moves the batch to a Thursday, short of a warning.
    expected_lag=8,
    # A price: unbounded like an index, as 14 trading days never reach 0 from its low of $9.10.
    kind="index",
    # Off: its departures are real moves, the March 2026 shock first (15 IQRs on 2026-03-06), then March 2022.
    edge_iqr=None,
    horizon_unit="trading_day",
    # Mean absolute error on the backfill as of 2026-10-31, 1,001 settled trading days: naive 8.71,
    # seasonal naive (5 prices back) 10.08, the mean of 20 prices 12.21 (Timestral 8.75).
    primary_baseline="naive",
    # FRED's weekly batch ends on the Tuesday before its Wednesday release: the live forecast starts from it.
    record_weekday=1,
    # Past its worst publication delay: a weekly batch reaches 8 days, and 7 would leave its targets unscorable.
    score_lag=14,
    note="Prices on trading days only, none on weekends and market holidays, so its days ahead count trading days.",
    source={
        "title": "U.S. Energy Information Administration, Europe Brent Spot Price FOB, through FRED (DCOILBRENTEU)",
        "url": "https://fred.stlouisfed.org/series/DCOILBRENTEU",
        "data_url": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU",
        "field": "DCOILBRENTEU",
    },
    license={
        "name": "Public domain (U.S. government publication)",
        "url": "https://www.eia.gov/about/copyrights_reuse.php",
        "attribution": (
            "Source: U.S. Energy Information Administration, Europe Brent Spot Price FOB, retrieved through "
            "FRED (DCOILBRENTEU). EIA's price source is Refinitiv, an LSEG business."
        ),
    },
)


UA_AIR_RAID_HOURS = Series(
    id="ua_air_raid_hours",
    title="Air-raid alerts",
    unit="alert hours a day, all regions",
    baseline=None,
    baseline_label="its 365-day mean",
    horizon=7,
    interval_steps=(1, 3, 7),
    # Four vintages, July to October 2026: alerts that end after a download add to its last day or two, and one
    # late fix reached 26 days back. A 2022 alert appended in October 2026 is the deep rewrite that waits for review.
    revision_window=30,
    # Committed every day of 2026, before 07:00 UTC on all but 3 of the last 100: the 07:00 run sees the day
    # before complete, or the one before it after a late commit.
    expected_lag=2,
    kind="alert_hours",
    # Off: no day since 2022 lies more than 6 IQRs outside its 28 days before; the 10 past 4 are mass attacks.
    edge_iqr=None,
    # Mean absolute error on the backfill as of 2026-10-31, 763 settled days: the 28-day mean 11.72,
    # naive 15.45, seasonal naive 17.10 (Timestral 11.82).
    primary_baseline="mean28",
    # Committed every day, so every weekday has a live forecast: Sunday, as for the drones.
    record_weekday=6,
    # The file holds an alert only once it has ended, so one still running at a download is missing
    # from the days before the cutoff: they read low until it lands. In four vintages the newest
    # day or two rose by 0.5 to 1.5 hours (1 to 2%); an alert running for days can take more. Past the
    # longest alert, 7.4 days, every target has its alerts in.
    score_lag=10,
    note=(
        "Volunteer records of the official alerts, by oblast. Luhansk and Crimea, under one alert since 2022, "
        "are left out. An alert is recorded once it ends, so the newest days can read low until it does. "
        "A few alerts in the west run for days, which may be an end the records missed."
    ),
    source={
        "title": "Ukrainian air raid sirens dataset, volunteer data",
        "url": "https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset",
        "data_url": "https://raw.githubusercontent.com/Vadimkin/ukrainian-air-raid-sirens-dataset/main/datasets/volunteer_data_en.csv",
        "field": "started_at, finished_at",
    },
    license={
        "name": "MIT",
        "url": "https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset/blob/main/LICENSE",
        "attribution": (
            "Data: Ukrainian air raid sirens dataset, Copyright (c) 2022 Vadym Klymenko, MIT License, "
            "from official alert channels and volunteer records."
        ),
        "modifications": "aseri sums the hours of alert per UTC day over the oblasts, splitting alerts at midnight.",
    },
)


UA_DRONES_DOWNED_CLAIMED = Series(
    id="ua_drones_downed_claimed",
    title="Drones downed",
    # In the unit, so the label goes wherever a value does.
    unit="drones a day, claimed by Ukraine's General Staff, one side's figures",
    baseline=None,
    baseline_label="its 365-day mean",
    horizon=7,
    interval_steps=(1, 3, 7),
    # No day changed between the vintages of 2026-03-03, 05-03 and 06-28 and today's: a fix within a month
    # passes, a deeper one waits for review.
    revision_window=30,
    # Committed with the day's report, mostly 07:00 to 11:00 UTC, with no commit on 43 days since March: the 07:00
    # run sees the day before's report, 2 or 3 days old after a day without one (4 once).
    expected_lag=3,
    kind="count",
    # On: 3 days since 2022 lie past 6 IQRs. One is 2026-07-26, a 0 while every other category moved, its drones
    # reported the next day; the other two are attack days of 2022-23, 33 and 53 when most days held under 12.
    edge_iqr=6.0,
    # Mean absolute error on the backfill as of 2026-10-31, 763 settled days: the 28-day mean 203.2,
    # naive 261.2, seasonal naive 280.4 (Timestral 208.3).
    primary_baseline="mean28",
    # Its report day goes without a commit most rarely on Sundays: 3 of 50 days with no live forecast
    # since March fell on a Sunday, against 4 to 13 on the other weekdays.
    record_weekday=6,
    # Its newest report is at most 4 days old, and no report has been revised since March.
    score_lag=7,
    note="Not independently verified.",
    source={
        "title": "2022 Ukraine Russia War Dataset, Russia's equipment losses as reported by Ukraine's General Staff",
        "url": "https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset",
        "data_url": "https://raw.githubusercontent.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset/main/data/russia_losses_equipment.json",
        "field": "drone",
    },
    license={
        "name": "MIT",
        "url": "https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset/blob/main/LICENSE",
        "attribution": (
            "Data: 2022 Ukraine Russia War Dataset, Copyright (c) 2022 Petro Ivaniuk, MIT License, from the General "
            "Staff of the Armed Forces of Ukraine: claimed by Ukraine's General Staff, one side's figures."
        ),
        "modifications": "aseri takes the daily difference of the running total of drones; a fall is kept, not clipped.",
    },
)
