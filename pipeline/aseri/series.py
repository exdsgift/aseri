"""The series aseri forecasts, as data. `id` is public and permanent: it is the API path and the Hubverse target."""

from dataclasses import dataclass
from urllib.parse import urlencode


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
    # How many days back from its newest an upstream revision may reach; anything older holds the run.
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


GPR_DAILY = Series(
    id="gpr_daily",
    title="Geopolitical risk",
    unit="index (1985-2019 average = 100)",
    baseline=100,
    baseline_label="its 1985-2019 average",
    horizon=28,
    interval_steps=(7, 14, 28),
    # GPR rewrites its last month every week; 90 days still catches a rewrite like its 2024 fix back to 2021.
    revision_window=90,
    # Updated on Mondays, Tuesdays after a US holiday, with data to that same day at about 18:00 UTC (the
    # authors' 2026 vintages): the 07:00 run sees data 1 to 7 days old, 8 in a holiday week.
    expected_lag=8,
    # Off: on the 1985-2026 history the top hits of any IQR rule are real news, and 9/11 needs 31 IQRs.
    edge_iqr=None,
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
