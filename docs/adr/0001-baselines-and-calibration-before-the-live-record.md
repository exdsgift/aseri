---
status: proposed
---

# Baselines, calibration and model candidates, decided before the live record reaches 30

Issue #146; checklist items 11 and 18 to 21 of [Best practice previsioni probabilistiche](../research/reports/Best%20practice%20previsioni%20probabilistiche.md). Proposed, pending the owner's review: nothing here ships, and any change to the published intervals or the model gets a new `MODEL_ID` in a later ticket.

## Summary for the owner

_Filled in after the run._

## Context

The live record started on 2026-10-30. Once it holds 30 resolved forecasts per series, changing the model, its intervals or the baseline its verdict compares with would restate or restart it. So the choices are made now, on a backtest, and recorded here. The prototype is `prototypes/baselines-calibration/` (see its README); every number below is in `docs/research/baselines-calibration.json`.

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

_Filled in after the run._

## Decisions

_Filled in after the run._
