"""Calibrates GPR's deep-revision rule (#149) on the authors' weekly updates, and records the test fixture. Usage: see README.md.

Every pair of consecutive vintages aseri would have archived is one real update. For each, it counts
the days older than the revision window that the update moves by more than each tolerance, replays it
through the production `archive.check_revisions`, asserts that only the February 2024 fix holds, and
writes a few pairs to pipeline/tests/fixtures/gpr_revision_pairs.csv for the replay test.
"""

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from backtest import DATA, ROOT, load  # also puts pipeline/ on the path

from aseri import archive
from aseri.series import GPR_DAILY
from aseri.sources import gpr

FIXTURE = ROOT / "pipeline" / "tests" / "fixtures" / "gpr_revision_pairs.csv"
TOLERANCES = (0.0, 0.01, 0.05, 0.10)
# The four files of the authors' February 2024 fix of missing articles since 2021 (the third reverts it).
FIX = ["2024-02-05", "2024-02-07", "2024-02-12", "2024-02-20"]
# Replayed by the tests: the fix's first file (300 old days past 1%, near its fewest), and the normal
# updates nearest the rule: the most days past 1% (2024-05-13, 2026-03-30), the most changed days at all
# (2026-03-16) and the largest relative change of a day (2026-10-13).
SAMPLE = [
    "2024-02-05",
    "2024-05-13",
    "2026-03-30",
    "2026-03-16",
    "2026-10-13",
]


def replay(old: pd.Series, new: pd.Series) -> tuple[str, str]:
    """What `archive.check_revisions` makes of `new` when the archive holds `old` ("holds", "passes" or "quiet"), and its words."""
    # The archive's view before an update is the vintage before it, as backtest.py asserts for every vintage.
    archive.as_of_view = lambda *_: old
    try:
        passed = archive.check_revisions(None, GPR_DAILY, new, None)
        return ("passes", passed) if passed else ("quiet", "")
    except archive.RevisionHold as hold:
        return "holds", str(hold)


def main():
    vintages, rejected = load()
    files = [f"{a - pd.Timedelta(days=1):%Y-%m-%d}" for a in vintages]
    pairs = list(
        zip(files[1:], list(vintages.values())[:-1], list(vintages.values())[1:])
    )
    rows, fixture = [], []
    for file, old, new in pairs:
        revised = archive.observation_delta(new, old).index.intersection(old.index)
        deep = revised[
            revised < new.index[-1] - pd.Timedelta(days=GPR_DAILY.revision_window)
        ]
        relative = (new[deep] - old[deep]).abs() / old[deep].abs()
        rows.append(
            {"file": file, "verdict": replay(old, new)[0], "largest": relative.max()}
            | {f"over {t:.0%}": int((relative > t).sum()) for t in TOLERANCES}
        )
        if file in SAMPLE:
            # Every day the update changes or adds, and the newest day before it; the tests fill the rest.
            days = archive.observation_delta(new, old).index.union([old.index[-1]])
            fixture.append(
                pd.DataFrame(
                    {
                        "file": file,
                        "date": days.strftime("%Y-%m-%d"),
                        "before": old.reindex(days).to_numpy(),
                        "after": new.reindex(days).to_numpy(),
                    }
                )
            )
    table = pd.DataFrame(rows).set_index("file")
    fix = table.index.isin(FIX)
    print(
        f"{len(table)} updates; {int((table['over 0%'] > 0).sum())} change a day older than {GPR_DAILY.revision_window} days"
    )
    print(
        f"largest relative change of one old day in a normal update: {table.loc[~fix, 'largest'].max():.1%}\n"
    )
    print(
        "| Old days moved by more than | Most in a normal update | Fewest in a February 2024 file |\n|---|---|---|"
    )
    for t in TOLERANCES:
        column = table[f"over {t:.0%}"]
        print(
            f"| {t:.0%} | {column[~fix].max()} ({column[~fix].idxmax()}) | {column[fix].min()} ({column[fix].idxmin()}) |"
        )
    verdicts = table["verdict"].value_counts().to_dict()
    print(
        f"\nrule (more than {GPR_DAILY.deep_revision_days} old days moved by more than {GPR_DAILY.deep_revision_tolerance:.0%}): {verdicts}"
    )
    print("held:", list(table.index[table["verdict"] == "holds"]))
    assert list(table.index[table["verdict"] == "holds"]) == FIX, (
        "the rule must hold the February 2024 fix and nothing else"
    )

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
        f"\nwrote {FIXTURE.relative_to(ROOT)}: {sum(len(f) for f in fixture)} rows, {len(SAMPLE)} updates"
    )


if __name__ == "__main__":
    main()
