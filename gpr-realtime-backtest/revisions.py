"""Calibrates GPR's deep-revision rule (#149) on the authors' weekly updates, and records the test fixture. Usage: see README.md.

Every pair of consecutive vintages aseri would have archived is one real update; pairs 2 to 4 updates
apart are what the archive compares after missed weeks. For each, it counts the days older than the
revision window that the update moves, through the production `archive.deep_revision`, and replays it
through `archive.check_revisions`. It asserts that only the February 2024 fix holds, and writes a few
pairs to pipeline/tests/fixtures/gpr_revision_pairs.csv for the replay test.
"""

import sys
from dataclasses import replace
from pathlib import Path
from unittest import mock

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from backtest import DATA, ROOT, load  # also puts pipeline/ on the path

from aseri import archive
from aseri.series import GPR_DAILY
from aseri.sources import gpr

FIXTURE = ROOT / "pipeline" / "tests" / "fixtures" / "gpr_revision_pairs.csv"
TOLERANCES = (0.0, 0.01, 0.05, 0.10)
GAPS = (1, 2, 3, 4)
# The four files of the authors' February 2024 fix of missing articles since 2021 (the third reverts it).
FIX = {"2024-02-05", "2024-02-07", "2024-02-12", "2024-02-20"}
PRE_FIX = "2024-01-29"
# Replayed by the tests, as (since, file): the fix's first file (300 old days past 1%, near its fewest),
# and the normal pairs nearest the rule: the most old days past 1% in one update (77) and over three (91),
# and the largest single-day ratio (1.571).
SAMPLE = [
    ("2024-01-29", "2024-02-05"),
    ("2024-05-06", "2024-05-13"),
    ("2026-03-09", "2026-03-30"),
    ("2026-04-13", "2026-04-20"),
]


def replay(old: pd.Series, new: pd.Series) -> tuple[str, str]:
    """What `archive.check_revisions` makes of `new` when the archive holds `old` ("holds", "passes" or "quiet"), and its words."""
    # The archive's view before an update is the vintage before it, as backtest.py asserts for every vintage.
    with mock.patch.object(archive, "as_of_view", lambda *_: old):
        try:
            passed = archive.check_revisions(None, GPR_DAILY, new, None)
            return ("passes", passed) if passed else ("quiet", "")
        except archive.RevisionHold as hold:
            return "holds", str(hold)


def measure(old: pd.Series, new: pd.Series) -> dict:
    """The old days `new` moves past each tolerance, and the smallest and largest ratio new/old of one of them."""
    counts = {
        f"over {t * 100:g}%": len(
            archive.deep_revision(
                replace(GPR_DAILY, deep_revision_tolerance=t), old, new
            ).moved
        )
        for t in TOLERANCES
    }
    days = archive.deep_revision(GPR_DAILY, old, new).days
    ratio = new[days] / old[days]
    return counts | {"lowest ratio": ratio.min(), "highest ratio": ratio.max()}


def main():
    vintages, rejected = load()
    files = [f"{a - pd.Timedelta(days=1):%Y-%m-%d}" for a in vintages]
    series = list(vintages.values())
    rows, fixture = [], []
    for gap in GAPS:
        for i in range(len(series) - gap):
            old, new = series[i], series[i + gap]
            since, file = files[i], files[i + gap]
            rows.append(
                {
                    "gap": gap,
                    "since": since,
                    "file": file,
                    "fix": bool(FIX & set(files[i + 1 : i + gap + 1])),
                }
                | {"verdict": replay(old, new)[0]}
                | measure(old, new)
            )
            if (since, file) in SAMPLE:
                # Every day the update changes or adds, and the newest day before it; the tests fill the rest.
                days = archive.observation_delta(new, old).index.union([old.index[-1]])
                fixture.append(
                    pd.DataFrame(
                        {
                            "since": since,
                            "file": file,
                            "date": days.strftime("%Y-%m-%d"),
                            "before": old.reindex(days).to_numpy(),
                            "after": new.reindex(days).to_numpy(),
                        }
                    )
                )
    table = pd.DataFrame(rows)
    one = table[table["gap"] == 1].set_index("file")
    fix = one.index.isin(FIX)
    print(
        f"{len(one)} updates; {int((one['over 0%'] > 0).sum())} change a day older than {GPR_DAILY.revision_window} days\n"
    )
    print(
        "| Old days moved by more than | Most in a normal update | Fewest in a February 2024 file |\n|---|---|---|"
    )
    for t in TOLERANCES:
        column = one[f"over {t * 100:g}%"]
        print(
            f"| {t * 100:g}% | {column[~fix].max()} ({column[~fix].idxmax()}) | {column[fix].min()} ({column[fix].idxmin()}) |"
        )

    normal = table[~table["fix"]]
    threshold = GPR_DAILY.deep_revision_days
    print(
        f"\n| Updates apart | Most old days past 1%, normal | Margin to {threshold} | Lowest and highest ratio, normal |\n|---|---|---|---|"
    )
    for gap, rows_ in normal.groupby("gap"):
        most = rows_.loc[rows_["over 1%"].idxmax()]
        print(
            f"| {gap} | {most['over 1%']} ({most['since']} to {most['file']}) | {threshold / most['over 1%']:.2f}x "
            f"| {rows_['lowest ratio'].min():.3f} to {rows_['highest ratio'].max():.3f} |"
        )
    pre = files.index(PRE_FIX)
    against_pre = {
        f: measure(series[pre], series[files.index(f)])["over 1%"] for f in sorted(FIX)
    }
    fewest = min(one.loc[sorted(FIX), "over 1%"].min(), min(against_pre.values()))
    print(
        f"\nFebruary 2024 files past 1%, against the vintage before each: {one.loc[sorted(FIX), 'over 1%'].to_dict()}"
    )
    print(
        f"against the pre-fix vintage {PRE_FIX}: {against_pre}; fewest {fewest}, {fewest / threshold:.2f}x {threshold}"
    )
    fixed = table[table["fix"]]
    print(
        f"February 2024 ratios: {fixed['lowest ratio'].min():.3f} to {fixed['highest ratio'].max():.3f}"
    )
    print(
        f"ratio limit {GPR_DAILY.deep_revision_ratio:g}-fold: {GPR_DAILY.deep_revision_ratio / normal['highest ratio'].max():.2f}x the highest normal ratio"
    )

    print(
        f"\nverdicts by gap: {table.groupby('gap')['verdict'].value_counts().unstack(fill_value=0).to_dict('index')}"
    )
    held = table[table["verdict"] == "holds"]
    assert held["fix"].all(), (
        f"a normal update holds: {held[~held['fix']][['since', 'file']].to_dict('records')}"
    )
    assert list(one.index[one["verdict"] == "holds"]) == sorted(FIX), (
        "every file of the fix must hold"
    )
    with mock.patch.object(archive, "as_of_view", lambda *_: series[pre]):
        for f in FIX:
            try:
                archive.check_revisions(None, GPR_DAILY, series[files.index(f)], None)
                raise AssertionError(f"{f} passes against the pre-fix vintage")
            except archive.RevisionHold:
                pass

    print("\nfiles aseri would not archive, and the check that stops each:")
    for file, why in rejected.items():
        print(f"  {file}: {why}")
    # The truncated file passes the contract, so the archive's own check must stop it.
    truncated = gpr.parse((DATA / "data_gpr_daily_recent_20230102.dta").read_bytes())
    print(
        "  2023-01-02 through check_revisions, after 2022-12-27:",
        replay(vintages[pd.Timestamp("2022-12-28")], truncated)[1],
    )

    pd.concat(fixture).to_csv(FIXTURE, index=False, lineterminator="\n")
    print(
        f"\nwrote {FIXTURE.relative_to(ROOT)}: {sum(len(f) for f in fixture)} rows, {len(fixture)} pairs"
    )


if __name__ == "__main__":
    main()
