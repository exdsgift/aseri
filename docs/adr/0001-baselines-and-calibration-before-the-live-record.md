---
status: accepted
---

# Baselines, calibration and model candidates, decided before the live record reaches 30

Issue #146; checklist items 11 and 18 to 21 of [Best practice previsioni probabilistiche](../research/reports/Best%20practice%20previsioni%20probabilistiche.md). Accepted by the owner on 2026-11-02: see [Decision](#decision). Any change to the published intervals or the model gets a new `MODEL_ID` in a later ticket.

## Summary for the owner

- **No model change helps, so the model stays.** Shorter contexts (512, 1,024 and 2,048 days), log1p inputs and an equal-weight ensemble with Chronos-2, TimesFM-2.5 and AutoETS never beat the production Timestral on WIS, in any bucket of any series. Several lose: every shorter context on GPR at 8-28 days (1.013 to 1.030) and on Hormuz at 8-14, and the ensemble on GPR at 8-28, Brent, the alert hours and the "World War III" views (1.158 and 1.254).
- **AutoETS is the strongest simple baseline on five series.** It clearly beats the registry's pick on GPR (mean absolute error 0.912 [0.868, 0.957] of the 28-day mean's) and on Hormuz (0.875 [0.809, 0.950] of naive's). It ties the best of the other baselines on the views, the alert hours and the drones. Suez, Bab el-Mandeb and Taiwan keep the 28-day mean, and Brent keeps naive. Against the stronger baseline, Timestral still beats on GPR, on Hormuz at 8-14 days, on the views and on the alert hours, and ties elsewhere.
- **Calibration offsets fix coverage without changing WIS.** Held out, two-fold by time, the rule keeps offsets on 8 of the 9 series. Together, Brent aside, they move the 80% band of the series that get offsets from 0.71 to 0.84 coverage to 0.79 to 0.81: Hormuz from 0.75 to 0.80 and 0.81, the views at 8-14 days from 0.71 to 0.81, the alert hours from 0.84 down to 0.80. WIS stays within 1.2% everywhere: a tie, except Hormuz at 1-7 days, where it improves slightly (0.991 [0.983, 1.000]). On Brent the kept side moves coverage away from 80%, so I propose leaving Brent out.
- **A 7-day-average target built from sample paths works on 8 of the 9 series.** It never does worse than Timestral run on the smoothed series, and it does better at 1-7 days on five series (0.905 to 0.936). For GPR, its band holds only 65% of 7-day means at 1-7 days: the six "known" days in each window are preliminary values that get revised later.
- **Three choices for you.** (1) Compute AutoETS in the daily job and make it the primary baseline where it wins (no new `MODEL_ID`), or keep the registry's three baselines. (2) Ship the calibration offsets under a new `MODEL_ID` now, while the live record is days old, or ship none. (3) Whether you want a 7-day-average target at all: that is a spec change, with its own model ID.

## Context

The live record started on 2026-10-30. Once it holds 30 resolved forecasts per series, changing the model, its intervals or the baseline its verdict compares with would restate or restart it. So the choices are made now, on a backtest, and recorded here. The prototype is `prototypes/baselines-calibration/` on branch [`ticket-146-baselines-calibration`](https://github.com/exdsgift/aseri/tree/ticket-146-baselines-calibration/prototypes/baselines-calibration) (see its README), kept off master; every number below is in `docs/research/baselines-calibration.json`.

## The backtest

- **Origins.** Weekly, on each series' `record_weekday`: the last 104 whose every step is observed (two years, which hold the 120-day backfill window). GPR has the 232 real-time origins of #145 (2022-03-09 to 2026-08-24): each context is the vintage known on its day and each target is scored against its value known 35 days later (`record.settled`), never the latest vintage.
- **Data.** GPR from the authors' archived vintages (`prototypes/gpr-realtime-backtest/`). The four PortWatch lanes from aseri's archive, its 2026-10-31 vintage. The other four through the production adapters on 2026-10-31.
- **Production model.** Timestral-209M through `aseri.forecast` (`load_model`, `make_context`, `forecast`), `aseri-timestral209m`, 4 torch threads.
- **Scores.** `aseri.scoring.score` per (origin, step): WIS on the 21 levels, 50% and 80% coverage, the absolute errors of the median and of the baselines. Buckets 1-7 and 8-28 (8-14 for the 14-step series; the 7-step series have only 1-7). A ratio is the mean over identical cells of one score over the other, from per-origin bucket means, with `scoring.bootstrap` (stationary block bootstrap, mean block 4 weekly origins, 2,000 resamples, seed 0, 95%) and `scoring.verdict`: "beats" when the whole interval is below 1, "loses" when above, "ties" otherwise.

## Rules, fixed before the run

Written and committed on 2026-10-31, before any backtest forecast of this ticket was made or scored.

### 1. Primary baseline

- Candidates: naive (the last value, which is also the median of the probabilistic naive), seasonal naive (`snaive7`), the 28-day mean (`mean28`), and AutoETS offline (a lean AutoETS: additive errors; no, additive or damped trend; with or without a weekly season; the lowest AICc on the last three years of each context; Gaussian quantiles).
- The pick per series is the candidate with the lowest mean absolute error over all its scored (origin, step) cells, as the registry's picks were made. Its ratio to each other candidate is reported with its interval, so a near-tie shows as one.
- Where the pick differs from `series.py`'s `primary_baseline`, this ADR says so, with the ratio of the two and its interval. The new backtest decides: it is longer, weekly rather than daily, and real-time for GPR.
- If AutoETS wins a series, it is still the pick, and the follow-up must compute it in the daily job.
- The record's WIS comparison stays against the probabilistic naive; AutoETS's WIS against it is reported, not decided on.

### 2. Calibration offsets (CQR)

- Fitted on the production model's backtest forecasts, per series, bucket and side of the 80% band.
- **Form.** A side's offset `d` scales the distance of every quantile on that side to the median: below, `q' = m - (1 + d)(m - q)`; above, `q' = m + (1 + d)(q - m)`. The median stays, the order stays, and the band keeps its asymmetric, heteroscedastic shape. An additive offset on all ten levels of a side would move the 45% level as far as the 1% one and could cross the median.
- **Fit.** `d` is the conformal quantile, at level `ceil((n + 1) * 0.9) / n` over the fold's n cells, of the 80% band's normalised miss on that side: `(q0.1 - y) / (m - q0.1)` below, `(y - q0.9) / (q0.9 - m)` above (Romano et al. 2019, with a scaled score).
- **Two-fold by time.** The origins split into an older and a newer half; the offset is fitted on one half and applied to the other, both ways, and the two held-out halves are pooled.
- **Keep a side** if, held out: (a) the share of days beyond the 80% band on that side moves closer to 10% than without the offset, and (b) the WIS ratio with the offset to without it does not lose (its whole interval is not above 1). The offset that would ship is refitted on all origins.

### 3. Candidate model changes

Each against the production model on the same cells, by its WIS ratio per bucket.

- **The general rule.** A candidate is kept for a series if its WIS ratio beats in at least one of the series' buckets and loses in none.
- **Shorter contexts:** the last 512, 1,024 and 2,048 days (prices for Brent) against the full history, on every series. A context no shorter than the history is the production forecast. If several lengths pass, the one with the lowest WIS over all cells.
- **log1p inputs:** on Hormuz, the "World War III" views, the alert hours and the drones, the report's spiky or near-zero series; Timestral forecasts `log1p` of the context (a negative day blank), `expm1` brings the quantiles back, then the series' range.
- **Equal-weight quantile-average ensemble:** the mean, at each of the 21 levels, of Timestral, Chronos-2 (`amazon/chronos-2`, Apache-2.0, 8,192 days of context at most), TimesFM-2.5 (`google/timesfm-2.5-200m-pytorch`, Apache-2.0, 4,096 days at most, its deciles extended to the outer four levels by a normal tail) and AutoETS. It must also have a point ratio of 0.95 or less in a bucket where it beats: it triples the inference and adds two model dependencies and their weights. The members alone are reported, not decided on.
- **A 7-day-average target from sample paths (design B).** The target at step h is the mean of the last 7 values ending on it (5 prices for Brent), observed days included. 4,000 paths per origin from a Gaussian AR(1) copula over the production model's daily quantiles, as `web/src/lib/paths.ts` draws them, with `rho` from the PIT normal scores of the other half's forecasts (`aseri.tie`, two-fold by time); each path is averaged with the observed days of its window, then the 21 quantiles are taken. Compared with `rho = 1`, `rho = 0`, Timestral run on the 7-day mean itself (direct), and the probabilistic naive of the 7-day mean. Design B is the way to build a 7-day target for a series if its WIS ratio against the direct forecast loses in no bucket and its WIS beats the probabilistic naive of the 7-day mean in every bucket. Self-checks: with `rho = 1` the median equals the mean of the daily medians and the observed days; `rho = 0` gives a narrower 80% band than `rho = 1`.
- **Multiplicity.** About 80 comparisons at 95% make two to four chance "beats" likely. A candidate kept on a single series is flagged as fragile.

### 4. What needs a new MODEL_ID

Anything that changes the published daily quantiles: a calibration offset, a shorter context, log1p, an ensemble. A change of primary baseline does not, since the forecasts stay the same; nor does a 7-day target, which would be a new target with its own model ID and record, the daily one untouched.

## Results

Run on 2026-10-31. The tables come from `docs/research/baselines-calibration.json`, and `prototypes/baselines-calibration/evaluate.py` prints them. Its self-checks pass: the scorer reproduces `scoring.score`, and #145's real-time GPR numbers (WIS 24.45 and 27.61, 80% coverage 0.781 and 0.789). A stub that is the naive forecast scores exactly 1 against the naive. The copula paths behave as expected: with `rho = 1` the median equals the mean of the daily medians, and with `rho = 0` the band is narrower.

### 1. Primary baselines

Mean absolute error over every scored (origin, step) cell; ratios are the pick's error to the other baseline's. GPR is real-time.

| Series | Origins | naive | seasonal naive | 28-day mean | AutoETS | Timestral | Registry | Rule's pick | Pick / registry | Best of the registry's three |
|---|---|---|---|---|---|---|---|---|---|---|
| GPR | 232 | 60.2 | 52.1 | 47.5 | 43.3 | 38.2 | 28-day mean | **AutoETS** | 0.912 [0.868, 0.957] beats | same as the registry |
| Suez | 104 | 7.20 | 7.10 | 5.11 | 5.20 | 5.11 | 28-day mean | **28-day mean** | same | same as the registry |
| Hormuz | 104 | 13.81 | 14.55 | 13.35 | 12.08 | 11.10 | naive | **AutoETS** | 0.875 [0.809, 0.950] beats | 28-day mean, 0.967 [0.801, 1.234] ties to the registry |
| Bab el-Mandeb | 104 | 6.91 | 7.11 | 5.17 | 5.32 | 5.16 | 28-day mean | **28-day mean** | same | same as the registry |
| Taiwan Strait | 104 | 36.8 | 37.1 | 25.7 | 25.7 | 25.2 | 28-day mean | **28-day mean** | same | same as the registry |
| "World War III" views | 104 | 4,445 | 4,205 | 4,211 | 4,098 | 2,314 | naive | **AutoETS** | 0.922 [0.811, 1.080] ties | seasonal naive, 0.946 [0.717, 1.470] ties to the registry |
| Brent | 104 | 4.99 | 5.61 | 6.65 | 5.17 | 5.03 | naive | **naive** | same | same as the registry |
| Alert hours | 104 | 18.89 | 18.74 | 13.87 | 13.76 | 13.34 | 28-day mean | **AutoETS** | 0.992 [0.979, 1.005] ties | same as the registry |
| Drones | 104 | 179.2 | 192.1 | 157.4 | 152.2 | 152.5 | 28-day mean | **AutoETS** | 0.966 [0.896, 1.034] ties | same as the registry |

The pick against its runner-up: on Hormuz, AutoETS against the 28-day mean is 0.905 [0.753, 1.043], a tie. On the views, every baseline ties every other. On Taiwan, the 28-day mean against AutoETS is 0.998 [0.985, 1.010], and on Brent naive against AutoETS is 0.965 [0.915, 1.001], both ties. On Suez and Bab el-Mandeb, the 28-day mean beats AutoETS: 0.984 [0.973, 0.994] and 0.973 [0.954, 0.990]. If AutoETS stays out of the daily job, GPR's 28-day mean is 1.096 [1.045, 1.152] of AutoETS's error: the record would then compare GPR with a baseline about a tenth weaker than the strongest available.

What the record's verdict would say against the rule's pick, and the WIS comparisons, which stay against the probabilistic naive:

| Series | Bucket | Timestral / pick, MAE | Timestral / probabilistic naive, WIS | AutoETS / probabilistic naive, WIS |
|---|---|---|---|---|
| GPR | 1-7 | 0.937 [0.913, 0.960] beats | 0.642 [0.604, 0.688] beats | 0.685 [0.643, 0.733] beats |
| GPR | 8-28 | 0.869 [0.828, 0.904] beats | 0.631 [0.584, 0.679] beats | 0.732 [0.692, 0.776] beats |
| Suez | 1-7 | 1.001 [0.994, 1.008] ties | 0.708 [0.655, 0.762] beats | 0.722 [0.667, 0.778] beats |
| Suez | 8-28 | 0.999 [0.993, 1.005] ties | 0.716 [0.667, 0.768] beats | 0.742 [0.692, 0.795] beats |
| Hormuz | 1-7 | 0.950 [0.907, 1.000] ties | 0.848 [0.765, 0.960] beats | 0.943 [0.867, 1.033] ties |
| Hormuz | 8-14 | 0.893 [0.835, 0.955] beats | 0.760 [0.658, 0.885] beats | 0.881 [0.810, 0.966] beats |
| Bab el-Mandeb | 1-7 | 0.997 [0.988, 1.006] ties | 0.732 [0.676, 0.787] beats | 0.757 [0.703, 0.810] beats |
| Bab el-Mandeb | 8-14 | 0.999 [0.987, 1.014] ties | 0.759 [0.712, 0.808] beats | 0.786 [0.741, 0.834] beats |
| Taiwan Strait | 1-7 | 0.997 [0.970, 1.021] ties | 0.696 [0.591, 0.812] beats | 0.741 [0.624, 0.871] beats |
| Taiwan Strait | 8-28 | 0.978 [0.948, 1.004] ties | 0.679 [0.583, 0.782] beats | 0.719 [0.621, 0.826] beats |
| "World War III" views | 1-7 | 0.644 [0.415, 0.913] beats | 0.510 [0.365, 0.878] beats | 1.154 [0.917, 2.840] ties |
| "World War III" views | 8-14 | 0.516 [0.321, 0.865] beats | 0.464 [0.273, 0.863] beats | 1.136 [0.942, 2.451] ties |
| Brent | 1-7 | 1.008 [0.993, 1.029] ties | 0.947 [0.896, 1.004] ties | 1.060 [1.020, 1.103] loses |
| Brent | 8-14 | 1.008 [0.985, 1.033] ties | 0.956 [0.913, 1.011] ties | 1.073 [1.007, 1.164] loses |
| Alert hours | 1-7 | 0.970 [0.940, 0.997] beats | 0.696 [0.649, 0.748] beats | 0.743 [0.693, 0.796] beats |
| Drones | 1-7 | 1.002 [0.962, 1.043] ties | 0.762 [0.698, 0.833] beats | 0.897 [0.793, 1.014] ties |

AutoETS here is the lean one of rule 1: additive errors only, fitted on the last three years, with Gaussian quantiles. Its median is a strong point baseline; its bands are not, which is why the WIS comparison stays against the probabilistic naive. On the views, its bands are more than twice as costly as Timestral's.

### 2. Calibration offsets

Each side alone, held out. A positive offset widens that side, a negative one narrows it. The offset in bold is the one refitted on all origins, which would ship.

| Series | Bucket | Side | Raw share beyond | Held-out share | Offset (fold 1, fold 2; all) | WIS ratio | Keep |
|---|---|---|---|---|---|---|---|
| GPR | 1-7 | below | 0.115 | 0.105 | -0.027, +0.164; **+0.043** | 1.003 [1.001, 1.005] loses | no |
| GPR | 1-7 | above | 0.103 | 0.099 | +0.023, +0.030; **+0.023** | 1.000 [1.000, 1.001] ties | yes |
| GPR | 8-28 | below | 0.103 | 0.101 | -0.068, +0.105; **+0.015** | 1.003 [1.001, 1.006] loses | no |
| GPR | 8-28 | above | 0.108 | 0.099 | -0.031, +0.155; **+0.044** | 1.002 [0.998, 1.006] ties | yes |
| Suez | 1-7 | below | 0.102 | 0.102 | -0.086, +0.050; **+0.007** | 1.001 [1.000, 1.003] ties | no |
| Suez | 1-7 | above | 0.095 | 0.091 | +0.052, -0.001; **-0.003** | 1.000 [1.000, 1.001] ties | no |
| Suez | 8-28 | below | 0.087 | 0.098 | -0.148, +0.013; **-0.060** | 1.001 [0.998, 1.004] ties | yes |
| Suez | 8-28 | above | 0.094 | 0.099 | +0.004, -0.054; **-0.019** | 1.000 [0.999, 1.001] ties | yes |
| Hormuz | 1-7 | below | 0.143 | 0.093 | +0.203, +0.211; **+0.203** | 0.991 [0.983, 1.000] beats | yes |
| Hormuz | 1-7 | above | 0.108 | 0.091 | +0.061, +0.094; **+0.061** | 1.001 [0.999, 1.004] ties | no |
| Hormuz | 8-14 | below | 0.161 | 0.091 | +0.184, +0.334; **+0.234** | 0.989 [0.979, 1.001] ties | yes |
| Hormuz | 8-14 | above | 0.093 | 0.096 | -0.019, -0.007; **-0.019** | 1.000 [0.999, 1.000] ties | yes |
| Bab el-Mandeb | 1-7 | below | 0.103 | 0.095 | +0.007, +0.077; **+0.032** | 1.001 [1.000, 1.002] ties | no |
| Bab el-Mandeb | 1-7 | above | 0.100 | 0.089 | +0.083, -0.030; **+0.017** | 1.002 [1.000, 1.004] ties | no |
| Bab el-Mandeb | 8-14 | below | 0.100 | 0.098 | -0.023, +0.071; **+0.009** | 1.001 [1.000, 1.002] ties | no |
| Bab el-Mandeb | 8-14 | above | 0.100 | 0.098 | +0.053, -0.037; **+0.011** | 1.002 [1.000, 1.003] loses | no |
| Taiwan Strait | 1-7 | below | 0.111 | 0.096 | +0.020, +0.128; **+0.057** | 1.001 [0.999, 1.004] ties | yes |
| Taiwan Strait | 1-7 | above | 0.100 | 0.100 | +0.075, -0.094; **+0.007** | 1.002 [1.000, 1.003] ties | no |
| Taiwan Strait | 8-28 | below | 0.092 | 0.097 | -0.077, +0.052; **-0.033** | 1.002 [1.000, 1.004] ties | yes |
| Taiwan Strait | 8-28 | above | 0.086 | 0.102 | -0.018, -0.100; **-0.052** | 1.000 [0.998, 1.002] ties | yes |
| "World War III" views | 1-7 | below | 0.139 | 0.095 | +0.085, +0.109; **+0.099** | 0.995 [0.983, 1.005] ties | yes |
| "World War III" views | 1-7 | above | 0.089 | 0.096 | +0.060, -0.162; **-0.049** | 0.995 [0.977, 1.011] ties | yes |
| "World War III" views | 8-14 | below | 0.184 | 0.095 | +0.219, +0.208; **+0.197** | 0.996 [0.986, 1.001] ties | yes |
| "World War III" views | 8-14 | above | 0.108 | 0.093 | +0.945, -0.026; **+0.371** | 1.013 [0.997, 1.065] ties | yes |
| Brent | 1-7 | below | 0.078 | 0.100 | -0.021, -0.124; **-0.080** | 1.001 [0.998, 1.004] ties | yes |
| Brent | 1-7 | above | 0.119 | 0.093 | -0.029, +0.300; **+0.107** | 1.006 [1.001, 1.014] loses | no |
| Brent | 8-14 | below | 0.088 | 0.108 | +0.085, -0.205; **-0.054** | 1.004 [0.997, 1.013] ties | yes |
| Brent | 8-14 | above | 0.137 | 0.125 | -0.123, +0.836; **+0.358** | 1.033 [1.012, 1.065] loses | no |
| Alert hours | 1-7 | below | 0.067 | 0.111 | -0.095, -0.194; **-0.137** | 1.001 [0.996, 1.006] ties | yes |
| Alert hours | 1-7 | above | 0.092 | 0.086 | -0.023, +0.053; **-0.019** | 1.002 [1.000, 1.003] loses | no |
| Drones | 1-7 | below | 0.107 | 0.094 | +0.049, +0.058; **+0.044** | 1.001 [0.999, 1.003] ties | yes |
| Drones | 1-7 | above | 0.124 | 0.099 | +0.308, +0.026; **+0.143** | 1.002 [0.984, 1.019] ties | yes |

The kept offsets together, held out:

| Series | Bucket | Kept | 80% band, raw to calibrated | below / above | 50% band, raw to calibrated | WIS ratio |
|---|---|---|---|---|---|---|
| GPR | 1-7 | above +0.023 | 0.781 to 0.786 | 0.115 / 0.099 | 0.482 to 0.487 | 1.000 [1.000, 1.001] ties |
| GPR | 8-28 | above +0.044 | 0.789 to 0.798 | 0.103 / 0.099 | 0.507 to 0.518 | 1.002 [0.998, 1.006] ties |
| Suez | 1-7 | none | 0.804 | 0.102 / 0.095 | 0.512 | |
| Suez | 8-28 | below -0.060, above -0.019 | 0.819 to 0.803 | 0.098 / 0.099 | 0.527 to 0.498 | 1.001 [0.998, 1.004] ties |
| Hormuz | 1-7 | below +0.203 | 0.749 to 0.798 | 0.093 / 0.108 | 0.438 to 0.488 | 0.991 [0.983, 1.000] beats |
| Hormuz | 8-14 | below +0.234, above -0.019 | 0.746 to 0.813 | 0.091 / 0.096 | 0.464 to 0.515 | 0.988 [0.978, 1.001] ties |
| Bab el-Mandeb | 1-7 | none | 0.797 | 0.103 / 0.100 | 0.485 | |
| Bab el-Mandeb | 8-14 | none | 0.799 | 0.100 / 0.100 | 0.482 | |
| Taiwan Strait | 1-7 | below +0.057 | 0.788 to 0.804 | 0.096 / 0.100 | 0.525 to 0.537 | 1.001 [0.999, 1.004] ties |
| Taiwan Strait | 8-28 | below -0.033, above -0.052 | 0.822 to 0.802 | 0.097 / 0.102 | 0.529 to 0.506 | 1.002 [0.999, 1.004] ties |
| "World War III" views | 1-7 | below +0.099, above -0.049 | 0.772 to 0.809 | 0.095 / 0.096 | 0.481 to 0.489 | 0.990 [0.961, 1.013] ties |
| "World War III" views | 8-14 | below +0.197, above +0.371 | 0.707 to 0.812 | 0.095 / 0.093 | 0.403 to 0.523 | 1.009 [0.993, 1.058] ties |
| Brent | 1-7 | below -0.080 | 0.802 to 0.780 | 0.100 / 0.119 | 0.500 to 0.482 | 1.001 [0.998, 1.004] ties |
| Brent | 8-14 | below -0.054 | 0.775 to 0.754 | 0.108 / 0.137 | 0.543 to 0.522 | 1.004 [0.997, 1.013] ties |
| Alert hours | 1-7 | below -0.137 | 0.841 to 0.797 | 0.111 / 0.092 | 0.544 to 0.483 | 1.001 [0.996, 1.006] ties |
| Drones | 1-7 | below +0.044, above +0.143 | 0.769 to 0.807 | 0.094 / 0.099 | 0.424 to 0.477 | 1.003 [0.986, 1.019] ties |

What to read from it:

- **Coverage moves, WIS does not.** Every combined WIS ratio lies between 0.988 and 1.009: offsets of this size buy honest coverage, not accuracy.
- **Three corrections are large and consistent:** the lower side of Hormuz, the views and the alert hours. Each moves coverage by 4 to 9 points, and its two folds agree in sign and size (Hormuz +0.203 and +0.211, +0.184 and +0.334; the views +0.085 and +0.109, +0.219 and +0.208; the alert hours -0.095 and -0.194). Hormuz and the views miss below their band 14 to 18% of the time, because the bands are too slow to follow a fall. The alert hours over-cover below. Most other kept offsets are a few percent, and several flip sign between the folds (GPR at 8-28 days above: -0.031 and +0.155; the views at 8-14 days above: +0.945 and -0.026). The rule keeps them because a small move toward 10% passes it.
- **GPR, in real time,** keeps only a small widening above (+2% and +4%). #145 expected a lower-side offset at a week. That one moves coverage toward nominal, but it costs WIS (1.003 [1.001, 1.005]), so it fails the rule.
- **Brent:** the rule keeps the lower side alone, which narrows a band whose misses sit above it. Its 80% coverage then moves away from nominal: from 0.802 to 0.780 at 1-7 days, and from 0.775 to 0.754 at 8-14.
- **The finite-sample budget** holds: each half fits on 364 to 2,436 cells (52 or 116 origins times the bucket's steps), so the conformal level `ceil((n + 1) * 0.9) / n` is at most 0.904. The cells of one origin share a future, so the effective n is smaller.

### 3. Candidates

WIS ratio of each candidate to the production model, the same cells:

| Series | Bucket | 512 days | 1,024 days | 2,048 days | log1p | Ensemble |
|---|---|---|---|---|---|---|
| GPR | 1-7 | 1.010 [0.992, 1.029] ties | 1.000 [0.988, 1.012] ties | 1.003 [0.996, 1.009] ties |  | 0.996 [0.984, 1.007] ties |
| GPR | 8-28 | 1.030 [1.005, 1.054] loses | 1.024 [1.002, 1.051] loses | 1.013 [1.005, 1.021] loses |  | 1.011 [1.000, 1.022] loses |
| Suez | 1-7 | 1.002 [0.999, 1.007] ties | 1.002 [0.999, 1.006] ties | 1.000 [1.000, 1.001] ties |  | 0.998 [0.994, 1.002] ties |
| Suez | 8-28 | 1.003 [0.999, 1.010] ties | 1.002 [0.998, 1.006] ties | 1.000 [0.999, 1.001] ties |  | 0.999 [0.994, 1.003] ties |
| Hormuz | 1-7 | 1.021 [0.998, 1.050] ties | 1.016 [0.998, 1.040] ties | 1.003 [0.998, 1.010] ties | 1.015 [0.998, 1.043] ties | 1.009 [0.983, 1.034] ties |
| Hormuz | 8-14 | 1.053 [1.019, 1.100] loses | 1.038 [1.012, 1.067] loses | 1.013 [1.002, 1.026] loses | 1.031 [1.003, 1.077] loses | 1.024 [0.999, 1.053] ties |
| Bab el-Mandeb | 1-7 | 1.008 [1.004, 1.013] loses | 1.002 [0.998, 1.006] ties | 0.999 [0.997, 1.001] ties |  | 1.005 [1.000, 1.011] ties |
| Bab el-Mandeb | 8-14 | 1.008 [1.002, 1.016] loses | 1.003 [0.998, 1.008] ties | 0.998 [0.994, 1.002] ties |  | 1.001 [0.994, 1.008] ties |
| Taiwan Strait | 1-7 | 1.017 [1.003, 1.033] loses | 1.005 [0.997, 1.015] ties | 1.001 [0.997, 1.005] ties |  | 1.006 [0.998, 1.013] ties |
| Taiwan Strait | 8-28 | 1.017 [1.002, 1.037] loses | 1.000 [0.990, 1.012] ties | 1.000 [0.998, 1.003] ties |  | 1.004 [0.997, 1.012] ties |
| "World War III" views | 1-7 | 0.972 [0.849, 1.098] ties | 0.964 [0.841, 1.084] ties | 1.046 [1.006, 1.073] loses | 1.123 [1.001, 1.244] loses | 1.158 [1.067, 1.596] loses |
| "World War III" views | 8-14 | 1.005 [0.958, 1.089] ties | 1.000 [0.971, 1.053] ties | 1.014 [1.002, 1.036] loses | 1.025 [0.994, 1.067] ties | 1.254 [1.114, 1.713] loses |
| Brent | 1-7 | 0.997 [0.985, 1.008] ties | 0.994 [0.979, 1.007] ties | 0.997 [0.989, 1.004] ties |  | 1.021 [1.002, 1.040] loses |
| Brent | 8-14 | 1.012 [0.996, 1.027] ties | 1.009 [0.989, 1.029] ties | 1.001 [0.991, 1.010] ties |  | 1.023 [1.000, 1.049] loses |
| Alert hours | 1-7 | 1.003 [0.996, 1.010] ties | 1.000 [0.997, 1.004] ties | 1.000 [1.000, 1.000] ties | 1.002 [0.999, 1.005] ties | 1.007 [1.000, 1.014] loses |
| Drones | 1-7 | 0.999 [0.989, 1.009] ties | 1.000 [0.993, 1.007] ties | 1.000 [1.000, 1.000] ties | 0.995 [0.974, 1.015] ties | 1.018 [0.990, 1.045] ties |

The alert hours and the drones have under 2,048 days of history at every origin, so their 2,048-day forecast is the production one. The members alone, reported but not decided on:

| Series | Bucket | Chronos-2 | TimesFM-2.5 | AutoETS |
|---|---|---|---|---|
| GPR | 1-7 | 1.008 [0.984, 1.030] ties | 0.991 [0.972, 1.010] ties | 1.066 [1.044, 1.088] loses |
| GPR | 8-28 | 1.018 [0.991, 1.040] ties | 1.004 [0.979, 1.025] ties | 1.160 [1.119, 1.210] loses |
| Suez | 1-7 | 1.000 [0.995, 1.005] ties | 0.995 [0.989, 1.002] ties | 1.019 [1.009, 1.030] loses |
| Suez | 8-28 | 1.000 [0.994, 1.005] ties | 0.993 [0.987, 0.998] beats | 1.036 [1.023, 1.050] loses |
| Hormuz | 1-7 | 1.006 [0.985, 1.029] ties | 1.001 [0.973, 1.028] ties | 1.113 [1.046, 1.188] loses |
| Hormuz | 8-14 | 1.026 [1.006, 1.055] loses | 1.006 [0.990, 1.028] ties | 1.160 [1.072, 1.270] loses |
| Bab el-Mandeb | 1-7 | 1.013 [1.001, 1.027] loses | 1.005 [0.999, 1.010] ties | 1.035 [1.018, 1.052] loses |
| Bab el-Mandeb | 8-14 | 1.013 [0.998, 1.032] ties | 1.002 [0.996, 1.010] ties | 1.035 [1.004, 1.066] loses |
| Taiwan Strait | 1-7 | 1.001 [0.992, 1.009] ties | 1.023 [1.011, 1.035] loses | 1.065 [1.039, 1.095] loses |
| Taiwan Strait | 8-28 | 1.000 [0.991, 1.006] ties | 1.014 [1.003, 1.022] loses | 1.059 [1.031, 1.095] loses |
| "World War III" views | 1-7 | 1.010 [0.863, 1.215] ties | 1.006 [0.906, 1.124] ties | 2.265 [1.724, 4.257] loses |
| "World War III" views | 8-14 | 1.013 [0.945, 1.087] ties | 0.995 [0.943, 1.024] ties | 2.449 [1.710, 4.849] loses |
| Brent | 1-7 | 1.050 [1.013, 1.082] loses | 1.007 [0.986, 1.030] ties | 1.120 [1.026, 1.224] loses |
| Brent | 8-14 | 1.056 [1.020, 1.093] loses | 0.994 [0.965, 1.019] ties | 1.123 [1.015, 1.259] loses |
| Alert hours | 1-7 | 1.005 [0.995, 1.016] ties | 1.005 [0.997, 1.014] ties | 1.067 [1.038, 1.100] loses |
| Drones | 1-7 | 1.010 [0.984, 1.035] ties | 1.055 [1.013, 1.095] loses | 1.176 [1.064, 1.275] loses |

In all, the 70 decided comparisons produce no "beats", where chance alone gives about two. The one member win, TimesFM-2.5 on Suez at 8-28 days (0.993), is the size chance gives. On most series the pretrained models land within about 2% of Timestral. The exceptions are Chronos-2 on Brent (5% worse) and TimesFM-2.5 on the drones (5.5% worse). The AutoETS member drags the average down wherever its Gaussian bands are wide.

### 4. The 7-day average (design B)

| Series | Bucket | rho (older, newer half) | B / direct | B / probabilistic naive | B / rho = 1 | B / rho = 0 | 80% band: B, rho = 1, direct | Keep |
|---|---|---|---|---|---|---|---|---|
| GPR | 1-7 | 0.56, 0.36 | 1.033 [0.988, 1.078] ties | 0.864 [0.794, 0.943] beats | 0.999 [0.976, 1.020] ties | 0.963 [0.953, 0.973] beats | 0.650, 0.778, 0.629 | yes |
| GPR | 8-28 | 0.56, 0.36 | 1.018 [0.978, 1.058] ties | 0.803 [0.743, 0.856] beats | 0.974 [0.934, 1.008] ties | 0.969 [0.956, 0.984] beats | 0.760, 0.925, 0.809 | yes |
| Suez | 1-7 | -0.2, -0.01 | 0.908 [0.875, 0.940] beats | 0.711 [0.668, 0.757] beats | 0.795 [0.747, 0.844] beats | 0.999 [0.992, 1.006] ties | 0.808, 0.974, 0.838 | yes |
| Suez | 8-28 | -0.2, -0.01 | 0.987 [0.965, 1.013] ties | 0.820 [0.764, 0.882] beats | 0.706 [0.659, 0.757] beats | 0.998 [0.992, 1.004] ties | 0.799, 0.999, 0.862 | yes |
| Hormuz | 1-7 | 0.41, 0.4 | 0.919 [0.864, 0.971] beats | 0.713 [0.655, 0.782] beats | 0.996 [0.957, 1.033] ties | 0.963 [0.952, 0.978] beats | 0.747, 0.885, 0.771 | yes |
| Hormuz | 8-14 | 0.41, 0.4 | 0.963 [0.928, 0.995] beats | 0.792 [0.677, 0.905] beats | 1.021 [0.947, 1.084] ties | 0.948 [0.936, 0.962] beats | 0.706, 0.911, 0.746 | yes |
| Bab el-Mandeb | 1-7 | 0.26, 0.16 | 0.910 [0.881, 0.941] beats | 0.702 [0.652, 0.756] beats | 0.875 [0.824, 0.921] beats | 1.003 [0.993, 1.016] ties | 0.819, 0.944, 0.761 | yes |
| Bab el-Mandeb | 8-14 | 0.26, 0.16 | 0.977 [0.946, 1.011] ties | 0.783 [0.705, 0.876] beats | 0.812 [0.736, 0.882] beats | 1.000 [0.988, 1.018] ties | 0.823, 0.989, 0.776 | yes |
| Taiwan Strait | 1-7 | 0.21, 0.25 | 0.936 [0.907, 0.969] beats | 0.665 [0.602, 0.741] beats | 0.928 [0.889, 0.961] beats | 0.999 [0.991, 1.010] ties | 0.821, 0.902, 0.835 | yes |
| Taiwan Strait | 8-28 | 0.21, 0.25 | 0.982 [0.959, 1.010] ties | 0.759 [0.691, 0.831] beats | 0.888 [0.846, 0.925] beats | 0.999 [0.990, 1.011] ties | 0.803, 0.960, 0.808 | yes |
| "World War III" views | 1-7 | 0.87, 0.84 | 1.020 [0.770, 1.256] ties | 0.464 [0.226, 0.876] beats | 1.034 [0.986, 1.075] ties | 0.872 [0.767, 1.067] ties | 0.817, 0.824, 0.793 | yes |
| "World War III" views | 8-14 | 0.87, 0.84 | 1.033 [0.952, 1.135] ties | 0.650 [0.408, 0.842] beats | 1.027 [1.003, 1.079] loses | 0.898 [0.783, 0.966] beats | 0.735, 0.758, 0.676 | yes |
| Brent | 1-7 | 0.91, 0.9 | 0.972 [0.909, 1.042] ties | 0.718 [0.628, 0.832] beats | 0.999 [0.994, 1.003] ties | 0.936 [0.915, 0.968] beats | 0.830, 0.838, 0.819 | no |
| Brent | 8-14 | 0.91, 0.9 | 1.000 [0.959, 1.051] ties | 0.950 [0.871, 1.065] ties | 0.999 [0.992, 1.004] ties | 0.916 [0.890, 0.955] beats | 0.764, 0.787, 0.782 | no |
| Alert hours | 1-7 | 0.27, 0.05 | 0.905 [0.868, 0.945] beats | 0.717 [0.617, 0.832] beats | 0.863 [0.826, 0.899] beats | 1.004 [0.995, 1.014] ties | 0.860, 0.962, 0.882 | yes |
| Drones | 1-7 | 0.57, 0.34 | 0.967 [0.884, 1.058] ties | 0.841 [0.735, 0.975] beats | 0.953 [0.912, 0.992] beats | 0.974 [0.960, 0.991] beats | 0.747, 0.868, 0.746 | yes |

- **Averaging daily quantiles (`rho = 1`) over-covers** wherever the days are only loosely tied: 0.97 to 1.00 on Suez, 0.94 to 0.99 on Bab el-Mandeb, 0.96 on the alert hours. The research warned of this. The paths fix it at no cost in WIS.
- **Design B inherits the daily band's under-coverage** on Hormuz (0.747 and 0.706) and on the views at 8-14 days (0.735). The calibration layer would come first.
- **On GPR, the six "known" days are not known.** At 1-7 days, B's 80% band holds only 0.650 of the 7-day means, and the direct forecast only 0.629. Each window mixes in six preliminary values that the authors revise later, while the truth uses the settled ones. A GPR 7-day target needs revision noise on those days before it ships.

### Runtime

Forecasts on 2026-10-31, laptop CPU (14 threads), in three processes at once: Timestral and its input variants; the smoothed Timestral, Chronos-2 and TimesFM-2.5; AutoETS. Each torch process used 4 threads. **78 minutes of wall time** (11:14 to 12:32), and **10,514 s (2.9 h) of model time** summed over the processes. The sum is inflated by the three processes sharing the cores: alone, Timestral takes 0.97 s on a 2,855-day context, against about 2 s in the run. By model: smoothed Timestral 2,654 s, AutoETS 1,772, TimesFM-2.5 1,356, the 2,048-day context 1,286, Timestral 1,117 (plus 1,027 reused from #145's GPR cache), the 1,024-day context 689, Chronos-2 654, the 512-day context 558, log1p 428. Scoring took 81 s. The ensemble's three extra members cost 3,782 s against Timestral's 2,144: 2.8 times the production inference. The weights download once: Chronos-2 478 MB, TimesFM-2.5 925 MB.

### Limits

- **Pseudo-real-time outside GPR.** Only GPR has vintages. The other eight series forecast from and score against their 2026-10-31 download, as the launch backfill does.
- **Training leakage is unknown** for all three pretrained models (`testdata_leakage: unknown`), and it may differ between them, so their ties with Timestral are not a clean comparison.
- **Overlap.** The block bootstrap keeps neighbouring origins together, but 104 weekly origins are two years of one regime per series. Hormuz's March 2026 break and the views' spikes dominate their numbers.
- **AutoETS is a lean one:** additive errors, the last three years, Gaussian quantiles. statsforecast's AutoETS pins pandas below 3, so it could not run beside `aseri`. A follow-up that computes AutoETS in the daily job must reproduce this version, or the evidence does not transfer.

## Decision

The owner chose on 2026-11-02:

1. **No AutoETS in the daily job.** The registry keeps its three simple baselines, which a reader understands ("a simple 4-week average"), with no new dependency or daily fit. By rule 1 among those three, Hormuz moves from naive to the 28-day mean and the "World War III" views from naive to seasonal naive, both ties with today's picks; the other seven keep theirs. No new `MODEL_ID`. AutoETS stays in this ADR as evidence that Timestral also beats a stronger statistical baseline on GPR.
2. **The calibration layer now,** under a new `MODEL_ID`, while the live record is days old. Every side that rule 2 keeps ships, Brent's lower side included: leaving Brent out, as proposed below, would be a choice made after seeing the data. Bab el-Mandeb keeps no offset.
3. **No 7-day-average target.** The charts show only the model's daily paths. The hero's like-with-like comparison is fixed on the page instead.

## Decisions (proposed before the owner chose)

1. **Primary baselines, by rule 1:** AutoETS for GPR, Hormuz, the "World War III" views, the alert hours and the drones; the 28-day mean for Suez, Bab el-Mandeb and Taiwan; naive for Brent. This differs from `series.py` on five series. GPR (28-day mean to AutoETS) and Hormuz (naive to AutoETS) change because AutoETS is clearly stronger. The views (naive), the alert hours and the drones (28-day mean) change on a tie, by the rule's lowest-error pick. The 120-day backfill could not show this: it had no AutoETS, it scored GPR on the latest vintage, and its daily origins overlap. No new `MODEL_ID`.
2. **Calibration offsets, by rule 2:** the kept offsets in the table above, refitted on all origins, as one calibration layer, except Brent. I propose leaving Brent out: the per-side rule keeps its lower side alone, and its 80% band then moves away from nominal (0.802 to 0.780, 0.775 to 0.754). That departs from the letter of rule 2, which judged each side alone, so it is flagged here for the owner. Bab el-Mandeb keeps no offset. This needs a new `MODEL_ID`.
3. **Candidates, by rule 3:** none kept. The production context (the full history), raw inputs, and Timestral alone stay.
4. **7-day-average target, by rule 3:** design B passes on eight series and fails on Brent. I propose not building one now. If the owner wants one, it comes from sample paths with the production `day_to_day_tie`, never from averaged quantiles or a model run on the smoothed series, after the calibration layer, without Brent, and with revision noise on GPR's known days. It is a new target with its own model ID; the daily model ID is unaffected.
5. **What needs a new `MODEL_ID`:** only decision 2. Nothing else changes the published daily quantiles.

## What the owner chooses

1. **AutoETS in the daily job, or not.** Yes: the record compares five series with AutoETS. A follow-up adds statsmodels to the pipeline, fits this lean AutoETS once per forecast at forecast time (about 2 s a series), and archives its median beside the forecast, so the record never refits it. No: the registry keeps its three baselines. The same rule then moves Hormuz to the 28-day mean and the views to seasonal naive (both ties with today's picks), and GPR's verdict stays against a baseline about a tenth weaker than AutoETS.
2. **The calibration layer now, or never.** Now: a new `MODEL_ID` (for example `aseri-timestral209m-cqr1`) restarts a live record that is only days old, and the 80% band then means 80% on Hormuz and the views, where it holds 71 to 77% today. Never: the bands stay as they are, and the record and the calibration monitor show their coverage with its interval. A middle path that ships only the three large, consistent offsets (the lower side of Hormuz, the views and the alert hours) would be chosen after seeing the data, not pre-registered.
3. **A 7-day-average target, or not** (decision 4).

## Follow-up tickets, once the owner has chosen

- **Calibration layer** (if chosen): a table of offsets per series, bucket and side, versioned like `anomalies.csv`, applied in `forecast.forecast` before the sort and the clip. Write the tests first: an offset of 0 is the identity, the median never moves, the quantiles stay ordered and in range, and a golden case per series. Add a new `MODEL_ID`, and split `record.scored` by `model_id`, which its own `shortcut:` comment asks for once `MODEL_ID` changes. Regenerate the replay window under the new ID.
- **Primary baselines:** update `primary_baseline` and its comments in `series.py`, and `test_each_series_is_compared_with_its_primary_baseline_chosen_on_the_backtest`, with this ADR's numbers. With AutoETS, also add it to `scoring.score`, `record.BASELINES`, `METHOD["baselines"]` and public-api.md, and archive it at forecast time.
- **GPR's revision window and score lag**, which #145 flagged, stay out of this ADR's scope.
