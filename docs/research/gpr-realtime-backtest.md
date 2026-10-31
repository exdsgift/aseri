# Real-time GPR backtest: how much the latest vintage flatters Timestral

Run on 2026-10-31 for issue #145, checklist item 12 of [Best practice previsioni probabilistiche](reports/Best%20practice%20previsioni%20probabilistiche.md). Prototype and rerun commands: `prototypes/gpr-realtime-backtest/` (see its README). Every number below is in [gpr-realtime-backtest.json](gpr-realtime-backtest.json).

## TL;DR

- **The latest vintage flatters GPR, by about a tenth at a week and a sixteenth beyond.** On the same 232 weekly origins (2022-03-09 to 2026-08-24) and the same targets, the real-time backtest's WIS is **10.6% higher in the 1-7 bucket [7.2%, 14.0%]** and **6.5% higher in the 8-28 bucket [3.5%, 9.3%]**. Its median's mean absolute error is 9.5% and 5.8% higher.
- **The 80% band loses about 2 points.** It holds 78.1% [76.0%, 80.1%] of days in real time against 80.2% on the latest vintage at 1-7 days, and 78.9% against 80.4% at 8-28 days. The paired gap is -2.0 points [-3.5, -0.6] and -1.6 [-2.6, -0.5].
- **The skill claims survive.** In real time, Timestral still beats every baseline in both buckets, its whole interval below 1. Against GPR's primary baseline, the 28-day mean, its error ratio is 0.80 [0.75, 0.84] at 1-7 days and 0.81 [0.76, 0.85] at 8-28, against 0.76 and 0.79 on the latest vintage. The edge narrows from about 24% to 20% at a week; it does not vanish.
- **Half of the gap is the inputs, half the truth, at a week; beyond, it is the truth.** Real-time inputs scored against the latest vintage cost +1.2 WIS at 1-7 days and +0.2 at 8-28. Scoring against the settled value instead of the latest costs +1.5 and +1.7.
- **It is not the 2024 rewrite.** The WIS ratio is 1.10 before 2024-02-05 and 1.11 from it at 1-7 days, 1.08 and 1.06 at 8-28.
- **What it means:** read the spike's GPR scores and the page's retrospective (backfill) GPR scores as an upper bound, and expect the live record to land near the real-time column. The live record is already scored in real time, so it needs no change.
- **Runtime:** 464 forecasts of the production Timestral-209M in 2,054 s (4.4 s each, 4 torch threads, laptop CPU), plus about 35 s to score. The download of the 295 vintages took about 8 minutes.

## Method

### The vintages and their dates

The authors archive every update of `data_gpr_daily_recent.dta` as `data_gpr_daily_recent_YYYYMMDD.dta` in [`iacoviel.github.io/gpr_archive_files`](https://github.com/iacoviel/iacoviel.github.io/tree/master/gpr_archive_files), served from `www.matteoiacoviello.com/gpr_archive_files/`. On 2026-10-31 it held 295 daily-file vintages, from 2022-02-24 to 2026-10-26: daily from 2022-02-24 to 2022-03-28, then weekly (Mondays, Tuesdays after a US holiday), plus a monthly update on the 1st of most months. `fetch.py` downloaded them all, one a second at most, with the User-Agent `aseri (+https://github.com/exdsgift/aseri)`.

**Vintage dating.** A file's date is the day it was published, so its `as_of` is the next day: the first 07:00 UTC run that could have seen it, as the daily pipeline stamps a download. I checked the archive commits of 13 files. Ten were committed on their file date, between 13:45 and 21:50 UTC (the newest, 2026-10-26, at 17:41); the 2024-02-05 and 2024-02-07 files the next afternoon; and the 2022-02-24 file in a batch on 2022-03-01 (the first 2022 files are rejected anyway, below).

**What aseri would have archived.** Each file goes through the production adapter's contract (`aseri.sources.gpr.parse`: a `date` column, one value for every day, values from 0 to 5,000, rounded to 4 decimals). A file that breaks it, or one that drops days an earlier vintage held (`archive.check_revisions` holds such a file for a human, who would not accept it), is skipped, and the previous vintage stays in force, as in production. Rewrites deeper than the 90-day revision window are kept: production holds them for review too, but a reviewer would accept a genuine fix. 278 of the 295 files pass; the 17 others are listed under [Oddities](#oddities-in-the-vintages).

**The as-of view.** The accepted vintages become a table shaped like the archive's deltas (one row per vintage and new or changed day, `archive.observation_delta`). Every real-time context is read from it with `archive.view(deltas, as_of)`, the production as-of view.

### Origins, targets and the score lag

- **Origins:** the first accepted vintage of each week (Monday to Sunday). Its last day is the reference date: 198 Mondays, 28 Tuesdays and 6 later weekdays where a week's Monday file was rejected or missing. Origins are 6 to 8 days apart in 220 cases; two weeks with no usable file leave gaps of 14 and 15 days. The forecast covers horizons 1 to 28 (`GPR_DAILY.horizon`). An origin is kept only if every one of its targets is settled by the latest vintage, so the last origin, 2026-08-24, is 63 days (28 + 35) before it. That leaves 232 origins.
- **Real-time version:** the context is the origin's own vintage, through `archive.view` and `forecast.make_context`. Each target is scored against its value as known 35 days after it (`GPR_DAILY.score_lag`), with `record.settled`: the newest vintage whose `as_of` is on or before the target's date plus 35 days. That is what "the first vintage after the score lag" means here, exactly as the live record scores. `settled` falls back to the first vintage after that day only when none holds the target yet; that never happens here (asserted).
- **Latest-vintage version:** the context and the truth both come from the 2026-10-26 vintage, as the spike and the launch backfill did.
- **Same origins, same targets:** both versions forecast the same reference dates and score the same 6,496 (origin, horizon) cells.
- **Model:** the production Timestral-209M through `aseri.forecast` (`load_model`, `forecast`, `make_context`): `aseri-timestral209m`, weights revision `9874d252`, package commit `a534bdb`, 4 torch threads.

### Scores

Each version is scored with `aseri.scoring.score`, which also gives the baselines from that version's own context: the last value (naive), the same weekday a week back (snaive7), the 28-day mean (mean28) and, for WIS, the probabilistic naive. Per bucket (1-7 and 8-28), as the record publishes them:

- WIS on 21 levels and its components (dispersion, overprediction, underprediction);
- 50% and 80% coverage, with exact Clopper-Pearson 95% intervals over the scored days (too narrow for overlapping origins, as the record says);
- the share of days below and above the 80% band;
- the mean absolute error (MAE) of the median, and its ratio to each baseline, with a 95% stationary block bootstrap interval (`scoring.bootstrap`, 2,000 resamples, seed 0) and the record's verdict (`scoring.verdict`).

The bootstrap resamples one mean per origin, in date order. Its mean block is 4 weekly origins, 28 days, at least the longest horizon of either bucket, so origins that share targets stay together. The gap (real-time minus latest) is paired on the origins and bootstrapped the same way.

### Checks on the as-of view

Real-time came out worse, as Stark and Croushore predict, but the as-of view was checked before trusting either result:

- `archive.view(deltas, as_of)` gives back every one of the 278 accepted files exactly, so no context holds a value first seen after its day (asserted on every run).
- No settled value comes from a vintage after its scoring day (asserted).
- The two contexts of each origin cover the same days, so only their values differ (asserted).
- The real-time contexts do differ from the latest ones where they should: on their last 7 days, 93% of values are more than 1% away from the latest vintage (median 10.4%), and on days 7 to 27 back, 91% (median 9.8%). That matches the 7.6 to 9.2% the research measured on four vintages.

## Results

### Real-time and latest vintage, side by side

232 origins per row. Intervals are 95%: Clopper-Pearson for coverage, the block bootstrap for the ratios. Every verdict against a baseline is "beats".

| Bucket | Version | WIS | dispersion / over / under | 50% band | 80% band | below / above the 80% band | MAE | WIS / prob. naive | MAE / naive | MAE / snaive7 | MAE / mean28 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1-7 | real-time | 24.45 | 9.35 / 6.52 / 8.59 | 0.482 [0.458, 0.507] | 0.781 [0.760, 0.801] | 0.115 / 0.103 | 35.35 | 0.64 [0.60, 0.69] | 0.65 [0.61, 0.69] | 0.75 [0.72, 0.78] | 0.80 [0.75, 0.84] |
| 1-7 | latest | 22.12 | 8.91 / 5.29 / 7.91 | 0.502 [0.478, 0.527] | 0.802 [0.781, 0.821] | 0.103 / 0.095 | 32.27 | 0.65 [0.62, 0.69] | 0.66 [0.63, 0.70] | 0.75 [0.72, 0.78] | 0.76 [0.72, 0.81] |
| 8-28 | real-time | 27.61 | 10.25 / 5.92 / 11.44 | 0.507 [0.493, 0.521] | 0.789 [0.777, 0.800] | 0.103 / 0.108 | 39.20 | 0.63 [0.58, 0.68] | 0.63 [0.59, 0.68] | 0.73 [0.70, 0.76] | 0.81 [0.76, 0.85] |
| 8-28 | latest | 25.92 | 9.85 / 5.24 / 10.82 | 0.515 [0.500, 0.529] | 0.804 [0.793, 0.815] | 0.091 / 0.104 | 37.04 | 0.64 [0.59, 0.69] | 0.65 [0.60, 0.70] | 0.75 [0.71, 0.79] | 0.79 [0.73, 0.84] |

### The gap, real-time minus latest

Paired on the 232 origins, block bootstrap, 95%. Coverage gaps are in shares (-0.020 is 2 points).

| Bucket | WIS | WIS ratio | MAE | MAE ratio | 50% band | 80% band |
|---|---|---|---|---|---|---|
| 1-7 | +2.34 [1.61, 3.13] | 1.106 [1.072, 1.140] | +3.08 [2.08, 4.14] | 1.095 [1.064, 1.129] | -0.020 [-0.042, 0.002] | -0.020 [-0.035, -0.006] |
| 8-28 | +1.69 [0.93, 2.41] | 1.065 [1.035, 1.093] | +2.16 [1.19, 3.06] | 1.058 [1.031, 1.084] | -0.008 [-0.023, 0.010] | -0.016 [-0.026, -0.005] |

Split at the authors' February 2024 rewrite of everything since 2021, the gap is the same on both sides, so the rewrite does not drive it:

| Origins | Bucket | WIS ratio | 80% band |
|---|---|---|---|
| 98 before 2024-02-05 | 1-7 | 1.101 [1.067, 1.139] | -0.018 [-0.034, -0.002] |
| 98 before 2024-02-05 | 8-28 | 1.084 [1.054, 1.113] | -0.018 [-0.027, -0.008] |
| 134 from 2024-02-05 | 1-7 | 1.109 [1.063, 1.153] | -0.022 [-0.044, -0.001] |
| 134 from 2024-02-05 | 8-28 | 1.055 [1.017, 1.095] | -0.014 [-0.031, 0.003] |

### Where the gap comes from

Crossing the inputs with the truth separates the two halves (WIS, then the 80% band):

| Bucket | latest inputs, latest truth | real-time inputs, latest truth | latest inputs, settled truth | real-time inputs, settled truth |
|---|---|---|---|---|
| 1-7 | 22.12, 0.802 | 23.28, 0.792 | 23.62, 0.776 | 24.45, 0.781 |
| 8-28 | 25.92, 0.804 | 26.13, 0.809 | 27.58, 0.785 | 27.61, 0.789 |

- **Inputs.** Forecasting from preliminary data costs about 5% of WIS at a week (+1.16) and almost nothing beyond (+0.21). The first releases run high: a context's last week sits a median 1.2% (mean 2.9%) above its settled values, so its forecasts start high, and real-time inputs scored on the latest truth miss below the band more often (12.9% against 7.8% above at 1-7 days).
- **Truth.** Scoring against the value known 35 days on, rather than the latest, costs +1.5 and +1.7 WIS from the latest inputs, and about as much from the real-time ones. The settled values are not final: 59% of them still move by more than 1% before the 2026-10-26 vintage (51% of those from 2024-02-05 on, median 1.1%), more often down than up. The scores against them carry that leftover revision noise.
- **Baselines feel it too.** The ratios to naive and seasonal naive barely move, because those baselines read the same preliminary last days. The 28-day mean averages them away, so it is the one baseline that gains on Timestral in real time (0.76 to 0.80 at a week).

## Oddities in the vintages

- **A schema change.** The 9 files from 2022-02-24 to 2022-03-08 have no `date` column (a `DAY` string, `YYYYMMDD`, instead). The adapter rejects them, so the backtest starts at 2022-03-09.
- **Gaps.** Seven files miss days: the last 1 or 2 days blank in 2022-09-01, 2022-10-24, 2022-12-01 and 2023-03-01; all of January 2022 missing in 2023-02-06; the leap day 2024-02-29 missing in 2024-03-01 and 2024-03-04. The adapter rejects all seven.
- **A truncated file.** The 2023-01-02 file is the 2022-12-27 vintage cut at 2022-08-31: 118 days fewer. The archive would hold it.
- **Dating.** Six files end one to three days before their date (2022-10-03 ends on Friday 2022-09-30), and three (2022-11-01, 2023-11-01, 2025-12-02) are identical to the file before them.
- **Rewrites deep in the past are routine, not rare.** 148 of the 277 accepted updates change at least one day older than 90 days before their newest day, 82 of them by more than 1 index point: 34 of 50 updates in 2026, 26 of them by more than a point. The largest single change is 62.1 points (the 2026-10-01 file). Some old days flip between two values: 2023-03-15 reads 118.71 in the 2024-02-05 file, 101.75 on 2024-02-07, 118.71 on 2024-02-12 and 101.75 on 2024-02-20, and the same change sizes (50.19, 58.03, 38.41 points) recur in files months apart. The February 2024 fix itself is the 2024-02-07 file, which rewrote 881 days back to 2021-01-04.

The last point matters beyond this backtest: GPR's `revision_window` of 90 days, which then held the series on any older change, would have held it for review in more than half of its weekly updates, and in two thirds of them in 2026. Issue #149 replaced that rule before the 2026-11-02 update, the first the archive checks: see [The deep-revision rule](#the-deep-revision-rule-149).

## The deep-revision rule (#149)

The archive used to hold a series for review whenever an update changed any archived value older than its `revision_window`. On GPR that would have held 148 of the 277 real updates. The rule is now per series, in the registry: an update holds when it moves more than `deep_revision_days` values older than the window by more than `deep_revision_tolerance` of their archived value. The defaults, 0 days and 0%, keep the old rule for every series whose revisions are unmeasured. GPR sets 150 days and 1%.

### Calibration

`prototypes/gpr-realtime-backtest/revisions.py` replays each of the 277 updates (consecutive vintages aseri would have archived) through the production `archive.check_revisions`, with the archive's view set to the vintage before it. It counts the days older than 90 days that each update moves by more than a tolerance:

| Old days moved by more than | Most in a normal update | Fewest in a February 2024 file |
|---|---|---|
| 0% | 130 (2026-03-16) | 298 (2024-02-12) |
| 1% | 77 (2024-05-13) | 298 (2024-02-12) |
| 5% | 47 (2024-05-13) | 283 (2024-02-05) |
| 10% | 11 (2024-05-13) | 215 (2024-02-05) |

- **The size of a change cannot separate them.** A normal update moved one old day by 57.1% (2026-10-13), and the median change of a normal update's old days reached 22%, while the February 2024 files' medians were 4.7% to 15.8%. Any rule on the largest or the median change holds normal weeks.
- **The number of days moved separates them at every tolerance.** 1% is the smallest tolerance that leaves room on both sides: 150 is about twice the most a normal update moved (77) and half the fewest the fix moved (298). It also holds a shift of the whole history by more than 1%, such as a rebase or a new set of newspapers, which a 10% tolerance would let through. Counting every change (0%) leaves the normal side at 130, too close to any threshold below 298.
- **Result:** 129 updates change nothing older than 90 days, 144 pass and are recorded, and 4 hold: the four files of the February 2024 fix. The script asserts this, and `tests/test_archive.py` replays five of the pairs from a recorded fixture (`tests/fixtures/gpr_revision_pairs.csv`): the fix's first file, and the four normal updates nearest the rule.

### The February 2024 rewrite holds, by design

The authors fixed missing articles from 2021 on. The 2024-02-05 file rewrote 300 old days, 2024-02-07 rewrote 881 back to 2021-01-04, 2024-02-12 reverted 298 of them and 2024-02-20 applied them again, by a median of 5% to 16% each time. Years of history rewritten, then flipped back and forth, is what the hold is for: a human reads the authors' log and accepts each file with a manual run (`accept_revisions`), so the change is known before it is archived. That costs four reviews in three weeks, once in four and a half years. Passing it would need a threshold above 746 days moved past 1% (the 2024-02-07 file), about two years of history, so a method change that rewrites one year would pass unseen.

### Broken files, and the check that stops each

| Files | What is wrong | Stopped by |
|---|---|---|
| 9, 2022-02-24 to 2022-03-08 | the old layout, no `date` column | the input contract (`gpr.parse`): the fetch fails and the series keeps its last good files |
| 7: 2022-09-01, 2022-10-24, 2022-12-01, 2023-02-06, 2023-03-01, 2024-03-01, 2024-03-04 | blank or missing days | the input contract |
| 2023-01-02 | the 2022-12-27 vintage cut at 2022-08-31, 118 days fewer | the dropped-days check of `check_revisions`, which runs before the deep-revision rule (replayed by the script) |
| a file in a new scale or base, the whole history moved | a method change or a unit bug | the deep-revision rule (a 3% rebase holds in `tests/test_archive.py`) |

The new rule changes neither of the first two checks.

### What passes is still recorded

A passing update is archived like any other: its revised values go into the day's delta, so the as-of view and the record see them, and a test reads the archive back after one. The run summary names it in the series' row, as the 2026-10-26 update would read: "1 archived values older than its 90-day revision window revised, the oldest on 2025-11-01, 1 by more than 1% (it holds above 150): recorded". A hold names the count, the tolerance and the oldest moved day, for the issue daily.yml opens.

**Limits.** The rule is calibrated on GPR's own history, so a future normal update past 150 days would hold once, for one manual review. Days that flip between two values pass, as they did 144 times. The other series keep the old rule until their revisions are measured from the archive.

## What it means for the page's claims

- **The live record is already real-time.** Its contexts come from the archive's own as-of view and its targets are scored at 35 days, the real-time column above. Expect its GPR WIS to run about 10% above the latest-vintage numbers at a week and 6% beyond, and its 80% band to hold about 78 to 79% of days rather than 80%.
- **The retrospective record and the spike are upper bounds for GPR.** Both forecast from, and score against, a vintage newer than the forecast: the backfill forecasts every reference date from the launch vintage. Read their GPR WIS and error as about a tenth too good at a week, and their 80% coverage as about 2 points too high.
- **"Beats the 28-day mean" holds in real time,** in both buckets, with the whole interval below 1 (upper bounds 0.84 and 0.85). The margin to quote at a week is about 20% lower error, not the 24% the latest vintage shows.
- **The latest-vintage sensitivity score** that the record publishes for GPR will look better than the live score by about this gap, and it keeps drifting as old values are revised: 35 days does not settle GPR.
- **Coverage claims stay modest.** The real-time 80% band is about 2 points narrow at a week, inside the noise of a 30-forecast record. The Clopper-Pearson intervals here count every day as independent, so even 6,496 cells overstate the evidence.

## What #146 should take from it

- **Fit and test GPR's calibration on real-time scores, never on the latest vintage.** On the latest vintage the 80% band looks calibrated (80.2%, 80.4%); in real time it is about 2 points narrow, with misses on both sides (11.5% below and 10.3% above at 1-7 days, 10.3% and 10.8% at 8-28). A CQR offset for GPR would be small and nearly symmetric, so it may well fail the keep rule; if one side, the lower one at a week (11.5% of days below the band against 10% nominal), where the high first releases push the band up.
- **Keep the 28-day mean as GPR's primary baseline.** It is the strongest of the three point baselines in both versions and both buckets; real time narrows Timestral's edge over it but does not change which baseline is strongest. Against the probabilistic naive, WIS ratios are 0.64 and 0.63 in real time.
- **Run every GPR candidate through this harness's real-time version.** Preliminary inputs alone cost about 5% of WIS at a week, and a shorter context, a log1p input, a 7-day-average target or an ensemble member can react to the high first releases differently from Timestral. A candidate that wins only on the latest vintage has not won.
- **Expect the gap in the live record.** A 30-forecast live record should come in about 10% worse in WIS than the retrospective one at a week; that is the revisions, not a broken model.
- **The score lag does not settle GPR.** 59% of the values scored 35 days after their date still move by more than 1% before the latest vintage (51% from 2024-02-05 on, median 1.1%), far from the "95% of revisions under 1%" rule in `series.py`. Old days keep moving for months after (see [Oddities](#oddities-in-the-vintages)), so treat the latest-vintage sensitivity score as drifting, and do not tune calibration against it.
- **The revision window** that would have held most weekly updates is replaced by #149's rule: see [The deep-revision rule](#the-deep-revision-rule-149).

## Limits

- **One series, one model.** PortWatch keeps no vintages, so this measures GPR only.
- **Overlap and dependence.** The block bootstrap keeps origins that share targets together; the Clopper-Pearson coverage intervals do not, and are too narrow.
- **Training-data leakage** is not addressed: Timestral's training cutoff is unknown, so both versions may flatter the model alike (see the spike's [leakage caveat](spike-timestral-backtest.md#leakage-caveat)). The gap between them does not depend on it.
- **Vintage dating** rests on the file names, checked against 13 commits. A file published a day late moves a context by one week at most, and only at the edges.
- **Hardware.** The runtime is from a laptop CPU with 4 torch threads, not a GitHub runner.
