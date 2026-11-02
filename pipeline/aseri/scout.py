"""The covariate scout (spec 6.5, #139): once a month, re-test candidate covariates against the univariate model and propose those that pass the keep rule in scout.toml, for a human to decide.

It reads the archive and writes only its report and its forecast cache: never the archive, the site or the
daily forecasts. Usage: python -m aseri.scout ARCHIVE_DIR REPORT_DIR CACHE_DIR [--series ID ...] [--candidates NAME ...] [--origins N]
"""

import argparse
import copy
import hashlib
import os
import re
import time
import tomllib
from datetime import UTC, date, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from aseri import archive
from aseri import series as series_module
from aseri.forecast import (
    MODEL_ID,
    PACKAGE_COMMIT,
    WEIGHTS_REVISION,
    Forecast,
    forecast,
    load_model,
    make_context,
    measurement_errors,
)
from aseri.scoring import TRADING_YEAR, WINDOW, _binom_cdf, bootstrap, score
from aseri.series import Series

SERIES = {s.id: s for s in vars(series_module).values() if isinstance(s, Series)}
# Lunar New Year's day, 2015 to 2030. Outside these years the row is unknown, NaN, never a wrong 0.
LUNAR_NEW_YEAR = pd.to_datetime(
    [
        "2015-02-19",
        "2016-02-08",
        "2017-01-28",
        "2018-02-16",
        "2019-02-05",
        "2020-01-25",
        "2021-02-12",
        "2022-02-01",
        "2023-01-22",
        "2024-02-10",
        "2025-01-29",
        "2026-02-17",
        "2027-02-06",
        "2028-01-26",
        "2029-02-13",
        "2030-02-03",
    ]
)
CALENDARS = ("dow", "lny", "gw", "xmas")
# A candidate's name is its tag in the model ID, so short: see model_id.
TAG = re.compile(r"[a-z0-9]{1,6}")
# A member: a calendar or a series id, lagged by "@k" days.
MEMBER = re.compile(r"([a-z0-9_]+)(?:@(\d+))?")


def check(config: dict) -> dict:
    """`config` if every entry is sound, so a bad scout.toml stops the import, never a run halfway."""
    rule, bounds = config["rule"], config["run"]
    problems = []
    if not (
        0 < rule["wql_ratio"] <= 1
        and 0 < rule["interval"] < 1
        and rule["block"] >= 1
        and 0 < rule["mase_ratio"] <= 1
        and 0 < rule["coverage"] < 1
        and 0 < rule["coverage_alpha"] < 1
    ):
        problems.append("the rule must ask for a gain, its levels between 0 and 1")
    for target, candidates in config["candidates"].items():
        if target not in SERIES or target not in config["fewest_lag"]:
            problems.append(f"{target} is not a series with a fewest_lag")
        if len(candidates) > bounds["max_candidates"]:
            problems.append(f"{target} has over {bounds['max_candidates']} candidates")
        for name, members in candidates.items():
            if not TAG.fullmatch(name):
                problems.append(f"{target}'s {name!r} is not 1 to 6 a-z or 0-9")
            if not 1 <= len(members) <= bounds["max_members"]:
                problems.append(
                    f"{target}'s {name} needs 1 to {bounds['max_members']} members"
                )
            for member in members:
                found = MEMBER.fullmatch(member)
                # A series as its own covariate is the target itself, not a covariate.
                if (
                    not found
                    or found[1] not in (*CALENDARS, *SERIES)
                    or found[1] == target
                ):
                    problems.append(
                        f"{target}'s {name}: {member!r} is no calendar or other series"
                    )
    for target, name in config["enabled"].items():
        if name not in config["candidates"].get(target, {}):
            problems.append(f"enabled {target}: {name!r} is not one of its candidates")
    if problems:
        raise ValueError("scout.toml: " + "; ".join(problems))
    return config


CONFIG = check(
    tomllib.loads(Path(__file__).with_name("scout.toml").read_text(encoding="utf-8"))
)


def model_id(series_id: str, enabled: dict | None = None) -> str:
    """The model ID of `series_id`'s forecasts: MODEL_ID, or, once a human enables one of its candidates, that candidate's tag on it, so its live record restarts (spec 6.5).

    Hubverse caps each part of a model ID at 16 characters, and MODEL_ID's model part is at 16
    already, so the covariate form shortens "timestral" to "ts": aseri-ts209m_c1_lny.
    """
    tag = (CONFIG["enabled"] if enabled is None else enabled).get(series_id)
    if tag is None:
        return MODEL_ID
    team, abbr = MODEL_ID.split("-")
    return f"{team}-{abbr.replace('timestral', 'ts')}_{tag}"


def buckets(series: Series) -> dict[str, range]:
    """The buckets the keep rule reads for `series`: days 1-7, and 8 to its horizon when it reaches past a week."""
    late = {f"8-{series.horizon}": range(8, series.horizon + 1)}
    return {"1-7": range(1, 8)} | (late if series.horizon > 7 else {})


def acceptance_region(n: int, p: float, alpha: float) -> tuple[int, int]:
    """The hits a band of coverage `p` may hold in `n` independent targets, at two-sided level `alpha`: the binomial quantiles at alpha/2 and 1 - alpha/2, as scipy's binom.ppf gives them."""

    def ppf(q: float) -> int:
        return next(k for k in range(n + 1) if _binom_cdf(k, n, p) >= q)

    return ppf(alpha / 2), ppf(1 - alpha / 2)


def failures(
    wql: tuple[float, float, float],
    mase: float,
    coverage: float,
    origins: int,
    rule: dict,
) -> list[str]:
    """Why a bucket fails the keep rule, empty when it passes. A missing number fails: written so NaN compares false."""
    ratio, _, high = wql
    low_hits, high_hits = acceptance_region(
        origins, rule["coverage"], rule["coverage_alpha"]
    )
    checks = {
        f"WQL under {1 - rule['wql_ratio']:.0%} better": not ratio <= rule["wql_ratio"],
        f"its {rule['interval']:.0%} interval reaches 0": not high < 1,
        "MASE worse": not mase <= rule["mase_ratio"],
        "8 in 10 coverage outside its region": not (
            low_hits <= coverage * origins <= high_hits
        ),
    }
    return [reason for reason, failed in checks.items() if failed]


def hold_back(covariate: Series, target: Series) -> int:
    """Days a past-only covariate is held back behind the target's last day, so a backtest reads only what the daily run would have.

    The run forecasts the target at the earliest `fewest_lag` days after its last day, and the
    covariate's newest value is then up to its `expected_lag` days old. One fetch brings every
    PortWatch lane, so they hold nothing back from each other.
    """
    if covariate.source["title"] == target.source["title"]:
        return 0
    return max(0, covariate.expected_lag - CONFIG["fewest_lag"][target.id])


def past_row(
    values: pd.Series, context: pd.DatetimeIndex, held: int, lag: int = 0
) -> np.ndarray:
    """A past-only covariate on the context's days: on day d its value of day d - lag, blank unless that day lies `held` days or more before the context's last."""
    known = values[values.index <= context[-1] - pd.Timedelta(days=held)]
    return known.reindex(context - pd.Timedelta(days=lag)).to_numpy(dtype=float)


def calendar(name: str, days: pd.DatetimeIndex) -> np.ndarray:
    """A calendar row on `days`: a function of the date alone, so known on every day of a horizon."""
    if name == "dow":
        return days.day_of_week.to_numpy(dtype=float)
    if name == "lny":
        # The eve to day +6, the spike's holiday week.
        row = np.zeros(len(days))
        for day in LUNAR_NEW_YEAR:
            row[
                (days >= day - pd.Timedelta(days=1))
                & (days <= day + pd.Timedelta(days=6))
            ] = 1
        row[~days.year.isin(LUNAR_NEW_YEAR.year)] = np.nan
        return row
    month, day = days.month, days.day
    if name == "gw":
        return ((month == 10) & (day <= 7)).astype(float)
    if name == "xmas":
        return (((month == 12) & (day >= 24)) | ((month == 1) & (day == 1))).astype(
            float
        )
    raise ValueError(f"no calendar {name!r}")


def covariates(
    members: list[str],
    target: Series,
    context: pd.Series,
    future: pd.DatetimeIndex,
    observed: dict[str, pd.Series],
) -> dict[str, np.ndarray]:
    """The model's covariate arguments for a candidate's `members`: past-only rows over the context, calendar rows over the context and the horizon."""
    rows = {
        "past_covariates": [],
        "known_covariates": [],
        "categorical_known_covariates": [],
    }
    days = context.index.append(future)
    for member in members:
        name, lag = MEMBER.fullmatch(member).groups()
        shift = pd.Timedelta(days=int(lag or 0))
        if name in SERIES:
            held = hold_back(SERIES[name], target)
            rows["past_covariates"].append(
                past_row(observed[name], context.index, held, int(lag or 0))
            )
        else:
            # The day of week is a category, target-encoded by Timestral; the others are 0/1.
            kind = (
                "categorical_known_covariates" if name == "dow" else "known_covariates"
            )
            rows[kind].append(calendar(name, days - shift))
    return {kind: np.stack(r)[None] for kind, r in rows.items() if r}


def origins(series: Series, observed: pd.Series, n: int) -> list[pd.Timestamp]:
    """The newest `n` days on `series`' record weekday whose every step is observed, oldest first."""
    days = observed.dropna().index
    found = []
    for day in reversed(days[days.day_of_week == series.record_weekday]):
        if len(found) == n:
            break
        if series.target_dates(days[days <= day], series.horizon)[-1] <= days[-1]:
            found.append(day)
    return found[::-1]


def cached(model, context: pd.Series, series: Series, rows: dict, cache_dir: Path):
    """The production forecast of `context` with covariate `rows`, and the model's seconds for it: none when the cache has it.

    The key is every input: the model, the context with its dates, and each row. A revised value or a
    new MODEL_ID makes a new forecast; an unchanged origin is never made twice. `model` loads the model on first call.
    shortcut: the cache only grows, 2 to 5 KB a forecast and some 700 forecasts a month; delete what a run
    did not read once scout.yml's cache artifact passes 100 MB.
    """
    key = hashlib.sha256()
    for part in (
        MODEL_ID,
        WEIGHTS_REVISION,
        PACKAGE_COMMIT,
        series.id,
        str(series.horizon),
        archive.input_sha256(context),
    ):
        key.update(part.encode() + b"\0")
    for kind, row in sorted(rows.items()):
        key.update(
            kind.encode() + b"\0" + np.ascontiguousarray(row, dtype=float).tobytes()
        )
    path = cache_dir / f"{key.hexdigest()}.npz"
    if path.exists():
        saved = np.load(path)
        levels = tuple(saved["levels"].tolist())
        return Forecast(context.index[-1], levels, saved["quantiles"]), None
    start = time.perf_counter()
    made = forecast(model(), context, series, **rows)
    seconds = time.perf_counter() - start
    # Written whole, then renamed: a run stopped halfway leaves no broken file for the next one.
    partial = path.with_suffix(".partial.npz")
    np.savez(partial, levels=np.array(made.levels), quantiles=made.quantiles)
    os.replace(partial, path)
    return made, seconds


def judge(
    base: pd.DataFrame, candidate: pd.DataFrame, series: Series, rule: dict
) -> list[dict]:
    """Each bucket of a candidate against the univariate model on the same cells: its ratios, its coverage and why it fails the rule."""
    judged = []
    for name, steps in buckets(series).items():
        b, c = (frame[frame["horizon"].isin(steps)] for frame in (base, candidate))
        # One value per origin, in date order, as scoring.bootstrap expects.
        per_origin = [frame.groupby("reference_date")["wis"].mean() for frame in (c, b)]
        wql = bootstrap(
            *per_origin, block=rule["block"], tail=(1 - rule["interval"]) / 2
        )
        mase = c["ase_median"].mean() / b["ase_median"].mean()
        coverage = c["interval_coverage_80"].mean()
        n = c["reference_date"].nunique()
        judged.append(
            {
                "bucket": name,
                "origins": n,
                "wql": wql,
                "mase": mase,
                "coverage": coverage,
                "region": acceptance_region(
                    n, rule["coverage"], rule["coverage_alpha"]
                ),
                "failures": failures(wql, mase, coverage, n, rule),
            }
        )
    return judged


def run(
    archive_dir: Path,
    report_dir: Path,
    cache_dir: Path,
    today: date,
    *,
    config: dict = CONFIG,
    load=load_model,
) -> list[str]:
    """Re-test every candidate of `config`, write the report of `today` to `report_dir`, and return those that passed, as series:candidate."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    rule, candidates_of = config["rule"], config["candidates"]
    used = set(candidates_of) | {
        MEMBER.fullmatch(member)[1]
        for candidates in candidates_of.values()
        for members in candidates.values()
        for member in members
    }
    # Read-only: the archive's newest view of every series the run uses, as of today.
    observed = {
        id: archive.as_of_view(archive_dir, id, today) for id in used & set(SERIES)
    }
    as_of = max(archive.newest_as_of(archive_dir, id) for id in candidates_of)
    model = None

    def loaded():
        nonlocal model
        if model is None:
            model = load()
        return model

    results, runtime = {}, {"made": 0, "cached": 0, "seconds": 0.0}
    for target, candidates in candidates_of.items():
        series, y = SERIES[target], observed[target]
        trading = series.horizon_unit == "trading_day"
        found = origins(series, y, config["run"]["origins"])
        scored = {name: [] for name in (None, *candidates)}
        for i, day in enumerate(found, start=1):
            context = make_context(series, y, day)
            future = series.target_dates(context.index, series.horizon)
            # Brent's steps are its next prices, as the record scores them; a calendar series' are its next days.
            steps = y.index[y.index > day][: series.horizon] if trading else future
            actual = y.reindex(steps).mask(steps.isin(measurement_errors(series)))
            actual = np.r_[actual, np.full(series.horizon - len(actual), np.nan)]
            for name, members in ((None, []), *candidates.items()):
                rows = covariates(members, series, context, future, observed)
                made, seconds = cached(loaded, context, series, rows, cache_dir)
                runtime["made" if seconds is not None else "cached"] += 1
                runtime["seconds"] += seconds or 0.0
                scored[name].append(
                    score(
                        made,
                        context,
                        actual,
                        kind=series.kind,
                        week=5 if trading else 7,
                        year=TRADING_YEAR if trading else WINDOW,
                    ).assign(reference_date=day)
                )
            print(
                f"{target}: origin {i} of {len(found)}, from {day:%Y-%m-%d}", flush=True
            )
        tested = []
        for name, members in candidates.items() if found else ():
            judged = judge(
                pd.concat(scored[None]), pd.concat(scored[name]), series, rule
            )
            passed = all(not bucket["failures"] for bucket in judged)
            tested.append(
                {"name": name, "members": members, "buckets": judged, "passed": passed}
            )
        results[target] = {"origins": found, "candidates": tested}
    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / f"{today}.md").write_text(
        report(today, results, config, f"{as_of}", runtime),
        encoding="utf-8",
        newline="\n",
    )
    return [
        f"{target}:{c['name']}"
        for target, result in results.items()
        for c in result["candidates"]
        if c["passed"]
    ]


def report(day: date, results: dict, config: dict, as_of: str, runtime: dict) -> str:
    """The Markdown report of a run: what was tested, how, every candidate's numbers per bucket, and what passed."""
    rule, bounds = config["rule"], config["run"]
    passed = [
        f"{target} `{c['name']}`"
        for target, result in results.items()
        for c in result["candidates"]
        if c["passed"]
    ]
    lines = [
        f"# Covariate scout, {day}",
        "",
        (
            "The monthly re-test of candidate covariates (spec 6.5, `pipeline/aseri/scout.toml`). The scout proposes "
            "and a human decides: the daily forecasts stay as they are until a proposal is approved."
        ),
        "",
        f"**Passed: {', '.join(passed)}.**"
        if passed
        else "**Passed: none.** The daily forecasts stay univariate.",
        "",
        (
            f"- **Model:** `{MODEL_ID}`, the production forecast with its calibration offsets, made without and with "
            "each candidate's rows on the same origins."
        ),
        (
            f"- **Data:** the archive's vintage of {as_of}, read-only. Pseudo-real-time: each context is that vintage "
            "cut at its origin; each past-only covariate is held back by its publication lag (its `expected_lag` in "
            "series.py less the target's `fewest_lag` in the config); each calendar row is a function of the date alone."
        ),
        (
            f"- **Origins:** up to {bounds['origins']} a series, weekly on its record weekday, the newest whose every "
            "step is observed."
        ),
        (
            f"- **Keep rule,** in every bucket the series has: WQL on the 21 levels at least "
            f"{1 - rule['wql_ratio']:.0%} better, with its {rule['interval']:.0%} interval below 0 (a stationary "
            f"block bootstrap over origins, mean block {rule['block']}); MASE no worse; and the 8 in 10 range's "
            f"coverage inside the binomial acceptance region at {rule['coverage_alpha']:.0%} for n = the bucket's origins."
        ),
        (
            f"- **Runtime:** {runtime['made']} forecasts made, {runtime['cached']} from the cache, "
            f"{runtime['seconds']:.0f} s of model time."
        ),
    ]
    for target, result in results.items():
        found = result["origins"]
        lines += ["", f"## {target}", ""]
        if not found:
            lines.append("No origin has every step observed yet: nothing tested.")
            continue
        lines += [
            f"Origins: {len(found)}, {found[0]:%Y-%m-%d} to {found[-1]:%Y-%m-%d}.",
            "",
            (
                f"| Candidate | Members | Bucket | Origins | ΔWQL [{rule['interval']:.0%} CI] | ΔMASE "
                "| 8 in 10 coverage (region) | Verdict |"
            ),
            "|---|---|---|---|---|---|---|---|",
        ]
        for c in result["candidates"]:
            for b in c["buckets"]:
                ratio, low, high = (100 * (x - 1) for x in b["wql"])
                n, (fewest, most) = b["origins"], b["region"]
                verdict = (
                    "fails: " + "; ".join(b["failures"]) if b["failures"] else "passes"
                )
                lines.append(
                    f"| {c['name']} | {', '.join(c['members'])} | {b['bucket']} | {n} "
                    f"| {ratio:+.1f}% [{low:+.1f}, {high:+.1f}] | {100 * (b['mase'] - 1):+.1f}% "
                    f"| {b['coverage']:.2f} ({fewest / n:.2f} to {most / n:.2f}) | {verdict} |"
                )
    lines += [
        "",
        "## Caveats",
        "",
        (
            "- **A pass is a proposal, not a finding.** Each month re-tests mostly the same origins, so a candidate "
            "gets many chances to pass by luck. Confirm it on origins it has not been tested on before enabling it."
        ),
        (
            "- **Pseudo-real-time.** The archive holds real vintages only from 2026-10-30; older contexts are "
            "today's values, which a revising source (GPR, PortWatch) has since changed."
        ),
        "- **Training data.** Timestral's training cutoff is unknown, so older origins may be in it.",
        (
            "- **Enabling** a candidate is a human decision under `[enabled]` in scout.toml. The series then gets a "
            "model ID of its own (`scout.model_id`), and its live record restarts."
        ),
    ]
    return "\n".join(lines) + "\n"


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("archive_dir", type=Path)
    parser.add_argument("report_dir", type=Path)
    parser.add_argument("cache_dir", type=Path)
    # For a smoke run: fewer series, candidates or origins than the config's.
    parser.add_argument("--series", nargs="+")
    parser.add_argument("--candidates", nargs="+")
    parser.add_argument("--origins", type=int)
    args = parser.parse_args(argv)
    config = copy.deepcopy(CONFIG)
    candidates = config["candidates"]
    if args.series:
        candidates = {id: candidates[id] for id in args.series}
    if args.candidates:
        # A series left with no candidate is dropped: its univariate forecasts alone test nothing.
        candidates = {
            id: kept
            for id, c in candidates.items()
            if (kept := {name: c[name] for name in args.candidates if name in c})
        }
    config["candidates"] = candidates
    if args.origins:
        config["run"]["origins"] = args.origins
    today = datetime.now(UTC).date()
    passed = run(
        args.archive_dir, args.report_dir, args.cache_dir, today, config=config
    )
    print(
        f"Report: {args.report_dir / f'{today}.md'}. Passed: {', '.join(passed) or 'none'}."
    )
    if "GITHUB_OUTPUT" in os.environ:
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as file:
            file.write(f"passed={','.join(passed)}\nreport={today}.md\n")


if __name__ == "__main__":
    main()
