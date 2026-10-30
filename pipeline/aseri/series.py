"""The series aseri forecasts, as data. `id` is public and permanent: it is the API path and the Hubverse target."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Series:
    id: str
    title: str
    unit: str
    # What the "vs" figures compare with.
    baseline: float
    baseline_label: str
    horizon: int
    interval_steps: tuple[int, ...]
    # How many days back from its newest an upstream revision may reach; anything older holds the run.
    revision_window: int
    # How many days old its newest data can be at a run in normal times; 2 days past it the run warns, 7 past it skips the series.
    expected_lag: int
    source: dict
    license: dict
    # What its values are, which sets the range of its quantiles: "index", "count" (0 and up) or "alert_hours" (0 to 600).
    kind: str = "index"
    # The edge check: a newest value more than this many IQRs outside its 28 days before waits a day. None turns it off.
    edge_iqr: float | None = None


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
