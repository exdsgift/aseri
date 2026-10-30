# Input data for aseri's daily forecasts: validating, cleaning and versioning

Research date: 2026-10-30. Scope: input-data practices that keep the nine published 28-day forecasts and their scores accurate and honest. Already covered elsewhere and not repeated here: source choice and licences ([data-sources.md](../../data-sources.md)), model skill by horizon ([spike-timestral-backtest.md](../../spike-timestral-backtest.md)), covariates and publication-lag masks ([spike-covariates.md](../../spike-covariates.md)).

Labels used below: **[aseri]** means the practice is specific to this pipeline or one of its series. **[generic]** means standard advice that applies to any forecasting pipeline. "Measured" findings are small checks the researcher ran on 2026-10-30 against the cited public archive or endpoint; the method is stated with each one.

## 1. Data revisions and vintages: real-time vs revised data, vintage archives, scoring against a stated vintage

### Takeaway
Scoring against revised data makes forecasts look better than they were in real time, so the literature and the forecast hubs keep two separate data versions: the vintage available at the forecast origin (the model's input) and a scoring vintage defined in advance (the "truth"). For aseri this is not a theoretical concern: the GPR index revises its last month by a median of about 8 to 9% and up to 57% on single days, its authors publish an archive of about 295 weekly vintages since February 2022, and PortWatch publishes no vintages at all, so aseri has to keep its own snapshots.

### Cited Findings
- Croushore and Stark built the Philadelphia Fed real-time data set as quarterly "vintages, or snapshots" of US macro data, for forecast evaluation among other uses. It was published in the Journal of Econometrics 105 (2001), pp. 111-130 ([Croushore and Stark, WP 99-4](https://www.philadelphiafed.org/-/media/FRBP/Assets/working-papers/1999/wp99-4.pdf?sc_lang=en); [journal copy](https://bfi.uchicago.edu/wp-content/uploads/1.pdf)).
- Stark and Croushore, "Forecasting with a real-time data set for macroeconomists" (Philadelphia Fed WP 01-10, Journal of Macroeconomics 2002): data vintage matters for some modelling choices, such as the lag length of a univariate model. Accuracy measures are sensitive to the vintage over short evaluation periods. RMSE and MAE "can look deceptively low" when computed against latest-available data, so comparisons with real-time benchmark forecasts should use real-time data ([EconPapers abstract](https://econpapers.repec.org/RePEc:fip:fedpwp:01-10)).
- ALFRED/FRED formalise vintages as a "real-time period" that "marks when facts were true or when information was known until it changed". It is set with `realtime_start` and `realtime_end`, a closed interval that defaults to today ("FRED mode: what information about the past is available today") ([FRED API docs, real-time periods](https://fred.stlouisfed.org/docs/api/fred/realtime_period.html)).
- The hubverse (the CDC/academic forecast-hub tooling) separates the version used to generate forecasts from the one used to score them:
  - Retrospective forecasts must use the data "as of" each reference date.
  - Scoring uses a "finalized" version "defined *in advance* as the prediction target", for example "the value after a set number of weeks of revisions".
  - Forecasting from finalized data and scoring against the same data "can make retrospective performance look substantially better than it really was in real time".
  - The hubverse recommends an `as_of` column recording when each value was reported.
  ([hubverse docs, target data](https://docs.hubverse.io/en/latest/user-guide/target-data.html))
- GPR revisions and vintages ([GPR page](https://www.matteoiacoviello.com/gpr.htm), read 2026-10-30):
  - Revision policy: "The latest data are preliminary and subject to revisions since some newspapers are added to the search database with delay". There can also be "minor revisions of the data extending further back when duplicate or missing articles or newspaper editions are removed from or added to the database".
  - Schedule: daily data are "updated every Monday", and on the next business day after a federal holiday.
  - Vintage archive: older vintages are archived as `data_gpr_daily_recent_YYYYMMDD.dta/.xls`.
  - Citation: the authors ask users to cite the download date.
  - Methodology: the search terms "were last changed in 2021".
- The GPR update log has one entry: "February 7, 2024: Fixed an issue regarding some missing articles from 2021 onwards" ([log.txt](https://github.com/iacoviel/iacoviel.github.io/blob/master/gpr_files/log.txt)).
- Measured: the GPR vintage archive holds 589 daily-vintage files (`.dta` plus `.xls`), from `data_gpr_daily_recent_20220224` to `..._20261026`. The holiday-week vintage is named `20261013`, not `20261012` ([archive folder](https://github.com/iacoviel/iacoviel.github.io/tree/master/gpr_archive_files), listed via the GitHub API).
- Measured, GPR revision size: the researcher compared column `GPRD` across vintages 20260928, 20261005, 20261019 and 20261026 from the [archive](https://github.com/iacoviel/iacoviel.github.io/tree/master/gpr_archive_files).
  - **One week later** (20261019 vs 20261026): 5 of the last 7 days changed. The last day, 2026-10-19, went from 248.7 to 220.8 (−11.2%). 2026-10-16 went from 104.4 to 95.6 (−8.4%), and 2026-10-15 from 209.7 to 202.5. 14 of the last 30 days changed (max 27.4%), and only 16 days changed in the whole 15,267-day history.
  - **Four weeks later** (20260928 vs 20261026): all of the last 30 days changed, median |relative change| 9.2% and max 56.2%. 61 days changed within the last year and 65 in the whole history.
  - **Three weeks later** (20261005 vs 20261026): all of the last 30 days changed, median 7.6% and max 57.2%.
- IMF PortWatch's chokepoint metadata describes how transits are counted: AIS from Spire via the UN Global Platform, a 48-hour rule before re-counting a ship, and dates in UTC. It says nothing about update cadence, preliminary status or revisions ([ArcGIS item metadata](https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer/info/metadata)). Third-party trackers claim that PortWatch revises history and pin their figures to retrieval snapshots. These are secondary and unverified ([World Monitor chokepoint methodology](https://www.worldmonitor.app/docs/methodology/chokepoints.md); [Ballast Markets post](https://ballast-markets-seo.pages.dev/blog/2024-11-05-imf-portwatch-changed-forecasting)).
- Measured, PortWatch: on 2026-10-30 08:48 UTC the layer's `editingInfo` reported `dataLastEditDate` = `schemaLastEditDate` = 2026-10-28T07:51Z, and data still ended 2026-10-25. The 400 most recent days for Suez, Taiwan Strait, Hormuz and Bab el-Mandeb were identical to the spike's 2026-10-29 pull, including the Taiwan Strait dropout on 2026-10-23 ([layer JSON](https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0?f=json)). This contradicts the "item updated daily" observation in [data-sources.md](../../data-sources.md): with data ending 2026-10-25 on 2026-10-30, the lag was 5 days and growing.
- Wikimedia changed bot detection in 2025 and reclassified past data:
  - Around May 2025, unusually high "apparently human traffic, mostly from Brazil" turned out to be bots "built to evade detection".
  - Wikimedia "reclassif[ied] our traffic data for March-August 2025".
  - Human pageviews fell "roughly 8% as compared to the same months in 2024".
  - Its warning: "we have to interpret it with care, as our bot detection systems apply different rules at different points in time".
  ([Wikimedia Diff, 2025-10-17](https://diff.wikimedia.org/2025/10/17/new-user-trends-on-wikipedia/))
- The pageview API labels self-identified bots as `spider` and heuristically detected bots as `automated` ([Wikimedia Analytics API, page views](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/concepts/page-views.html)).
- Revision-aware foundation models are still research-grade. The one 2026 proposal found (VINTAGE-TS, arXiv 2609.28576) has only a synthetic demonstration, says "Real ALFRED and Chronos-2 experiments have not been executed", and claims no empirical advantage ([arXiv 2609.28576](https://arxiv.org/abs/2609.28576)).
- A third-party Python tool defines "first-release" scoring as scoring each target date against the first vintage after that date with a non-missing value. This is one tool's convention, not a standard ([macroforecast docs, vintages](https://macroforecast.readthedocs.io/en/latest/guide/vintages.html)).

### Inferences
- **The spike's GPR numbers are probably optimistic.** [aseri] The baseline spike fed revised values into every origin's context and scored against revised actuals, and it flags this itself ([spike-timestral-backtest.md](../../spike-timestral-backtest.md), "Data vintage"). Live, the last 1 to 4 weeks of context are preliminary and move by about 8 to 9% (median) after revision, which is comparable in size to the model's GPR WQL of 0.18 to 0.23. Stark and Croushore predict that the live track record will look worse than the backtest.
- **P1. Keep an append-only raw snapshot store.** [generic, essential for PortWatch]
  - Implement: on every fetch, write the raw bytes to `data/raw/{source}/{fetched_at_utc}.{ext}` with a manifest row: `source`, `fetched_at`, the upstream timestamp (HTTP `Last-Modified` for GPR, `editingInfo.dataLastEditDate` for PortWatch, the git commit SHA for the GitHub datasets), `sha256` and row count. Parse into one long table (`series`, `date`, `value`, `as_of`) where `as_of` is the first fetch time a value was seen. Write a new row only when a value changes, the hubverse `as_of` pattern. Store as Parquet or CSV in git, so git history becomes a second archive.
  - Test: (a) re-ingesting identical bytes adds zero rows; (b) `as_of_view(series, t)` never returns a `date` > t, or a value whose `as_of` > t; (c) a two-vintage fixture where one value changes returns the old value before the change and the new one after.
- **P2. Seed the store with the authors' GPR vintages.** [aseri] Backfilling the vintage store from the GPR archive (about 295 weekly vintages since 2022-02-24) makes a true real-time GPR backtest possible: origin t uses the vintage dated ≤ t.
  - Implement: one script that downloads each `data_gpr_daily_recent_YYYYMMDD.dta` and ingests it with `as_of = YYYYMMDD`.
  - Test: rerun the spike's GPR backtest twice, once real-time and once on the latest vintage, and report both. Expect real-time to be worse. If it is not, suspect a bug in the as-of view.
- **P3. Define the scoring vintage in advance and publish it.** [aseri]
  - Implement: per series, a config key `score_after_days` (for example GPR 35, since revisions above 1% appear 3 to 4 weeks back; PortWatch about 14 until its revision behaviour is measured; the others 7). A forecast point is "pending" until `as_of_view(target_date + score_after_days)` exists, then it is scored once and frozen. Store `scored_against_as_of` with each score. Optionally also publish a "first-release" score, so readers can see the revision effect.
  - Test: a pytest fixture with three vintages of one date, where the scorer must use exactly the vintage at `target_date + score_after_days`. A regression test that a frozen score never changes when later vintages arrive.
- **P4. Monitor revisions and treat surprising ones as incidents.** [generic, with aseri thresholds]
  - Implement: on each ingest, diff overlapping dates against the previous snapshot and log the number of changed dates, the max |relative change| and the oldest changed date. Alert and hold publication if changes reach further back than a per-source window (GPR 90 days, given the 2024 back-revision; PortWatch and pageviews 30 days), or if more than X% of history changes. That pattern means a methodology change, like Wikimedia's 2025 reclassification, not a routine revision.
  - Test: synthetic snapshots with (a) routine tail revisions, which must pass, and (b) a rewrite of 2023 values, which must raise.
- **Label the vintage on the site.** [aseri] Show "data as published on <as_of>", and state that GPR values are preliminary for about 4 weeks. Scores should say which vintage they were computed against, mirroring the GPR authors' request to cite the download date.

### Gaps
- Direction and bias of GPR revisions: the 4 compared vintages show mixed signs (the last days were revised down 3 to 11%, others up about 0.5%). Measuring it needs all ~295 vintages; not done.
- PortWatch revision behaviour is undocumented by the IMF. The one-day comparison shows no change, but the layer had not been updated in between, so it says nothing about revisions at update time. aseri needs several weeks of its own snapshots to measure this.
- Whether ALFRED holds vintages of the Brent series `DCOILBRENTEU` was not verified: the ALFRED page fetch failed.
- No peer-reviewed evidence was found on how a foundation model's accuracy changes when its context contains preliminary vs revised data.

## 2. Reporting lags, ragged edges and missing days: impute, carry forward, or leave gaps

### Takeaway
Each series ends on a different day (a ragged edge), so forecasts must be anchored at each series' own last complete observation, with horizons counted from there. Missing values should go to the model as NaN, since Timestral masks them natively. Actuals that are missing or imputed must never be scored, and the most dangerous gap is the one silently encoded as zero.

### Cited Findings
- FPP3 on missing values:
  - "Some methods allow for missing values without any problems": the naïve method, ARIMA, dynamic regression and NNAR do. `ETS()` and `STL()` do not.
  - "it is worth considering whether the missingness will induce bias in the forecasting model". If "the timing of the missing data is not informative", missing values "can be handled more easily".
  - Options are to use only the data after the last missing value, or to "use the model to interpolate the missing observations" (with ARIMA).
  ([Hyndman and Athanasopoulos, FPP3 §13.9](https://otexts.com/fpp3/missing-outliers.html))
- Timestral takes NaN in the context as missing, plus an optional `observation_mask` (False = missing). Internally it forward-fills the masked positions with a mask (`ffill_with_mask` in `forecaster.py`), so imputing upstream is unnecessary ([timestral repo](https://github.com/mistralai/timestral); [timestral-model.md](../../timestral-model.md), "Missing values").
- The hubverse rule for retrospective work is "restrict each forecast's inputs to the data as it was available **as of** that forecast's reference date" ([hubverse docs](https://docs.hubverse.io/en/latest/user-guide/target-data.html)).
- Hewamalage, Ackermann and Bergmeir: "Data leakage can also happen simply due to using the wrong forecast horizon", for example a day-ahead model that uses full-day statistics ([arXiv 2203.10716, §3.4](https://arxiv.org/html/2203.10716v2)).
- Already established for aseri:
  - Effective horizons: PortWatch lags about 4 days and GPR updates weekly, so "the horizon shown on the site should be counted from the last data point, not from today" ([spike-timestral-backtest.md](../../spike-timestral-backtest.md), "Data lag").
  - The covariate spike set lagged covariate days to NaN and did not forward-fill Brent weekends ([spike-covariates.md](../../spike-covariates.md)).
- The source already imputes some values: the Ukraine volunteer alert file marks alerts without an end time `naive=True`, with an imputed 30-minute duration ([data-sources.md](../../data-sources.md); [dataset README](https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset/blob/main/datasets/README.md)).
- Measured: PortWatch data ended on 2026-10-25 both on 2026-10-29 and on 2026-10-30, after a layer edit on 2026-10-28 ([layer JSON](https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0?f=json)). The lag varies with the batch cadence (4 to at least 5 days), so a fixed "4 days" assumption is fragile.
- Ledolter (IJF 1989): an aberrant value has a small effect on point forecasts "provided that the outlier occurs not too close to the forecast origin", and prediction intervals "are found to be quite sensitive to additive outliers". A bad edge value is therefore the most harmful kind ([EconPapers record](https://econpapers.repec.org/RePEc:eee:intfor:v:5:y:1989:i:2:p:231-240)).

### Inferences
- **P5. Anchor each series at its own last complete day.** [aseri]
  - Implement: `origin = last_complete_date(series)`, and forecast `28 + (today − origin)` steps, so the site always covers today+28. Store `origin` and `published_on` with every forecast, and label horizons relative to `origin`.
  - Test: for each source, a fixture with a known lag must yield the right origin and number of steps. Scoring code must key on `(origin, h)`, not on `(published_on, h)`.
- **P6. Drop partial days explicitly.** [aseri]
  - Implement: drop the current UTC day for event-derived series (alerts, drones). For PortWatch, treat the last row as complete only if `dataLastEditDate` is more than 24 h after the end of that UTC date.
  - Test: an alerts fixture with events up to 05:00 UTC today must yield yesterday as the last day.
- **P7. Tell a true zero from a missing day.** [aseri; the trap is event-aggregated counts]
  - Problem: for alert-hours and drone increments, a day with no rows is a real zero only if the source is known to be fresh past that day. Otherwise it is missing.
  - Implement: build the daily index from `min_date` to the freshness cutoff, where the cutoff is the latest event or commit timestamp. Days up to the cutoff with no events get 0. Days after it are absent.
  - Test: a stale-file fixture (last commit 3 days ago) must not produce three trailing zeros.
- **P8. Pass gaps as NaN and never impute scored actuals.** [generic]
  - Implement: interior gaps in the context stay NaN (Timestral masks them). Never fill target actuals. A day whose actual is missing at the scoring vintage is "unscorable" and excluded, with the count reported next to each score.
  - Test: (a) a context containing NaN gives a finite forecast; (b) the scorer's denominator excludes NaN actuals; (c) a property test: forward-filling actuals must change nothing, because filled values are never read.
  - Why: imputed actuals bias scores toward the model or method that generated them. Forward-filled actuals favour the naive baseline in particular. This is an inference; no empirical paper on the size of the effect was found.
- **P9. Check the lag against a freshness SLA every run.** [generic]
  - Implement: `lag = today − last_date` per source. Warn at the expected lag + 2 days and fail at + 7 days. On failure, keep the previous forecast online with a "stale since" banner. Do not re-forecast from stale data and present it as fresh.
  - Test: freeze the date in a pytest fixture and assert the warn and fail transitions.

### Gaps
- No study was found that quantifies forecast or score bias from forward-filling vs masking for foundation models.
- The Ragged-edge nowcasting literature (Giannone, Reichlin and Small 2008, among others) was not fetched in this round. It addresses multivariate nowcasting, which aseri does not do because covariates were dropped.
- PortWatch's real update cadence (weekly batches? the secondary sources say Tuesdays) needs a few weeks of `dataLastEditDate` logging.

## 3. Trading-day series (Brent): business-day or calendar-day forecasting, and aligning with daily-calendar series

### Takeaway
Forecast Brent on a trading-day index (consecutive trading sessions), then map the steps to calendar dates for display. Score only on trading days. Forward-filling weekends into the context or the actuals adds days of zero change, which narrows the bands and makes scores look better than they are.

### Cited Findings
- FPP3: "Because stock prices are not observed every day, we first set up a new time index based on the trading days rather than calendar days", re-indexing with `mutate(day = row_number())` and `update_tsibble(index = day, regular = TRUE)` ([FPP3 §5.2](https://otexts.com/fpp3/simple-methods.html)).
- Brent arrives in weekly batches: FRED showed "Updated Oct 28, 2026, Next Release Date Nov 4, 2026" ([data-sources.md](../../data-sources.md); [FRED DCOILBRENTEU](https://fred.stlouisfed.org/series/DCOILBRENTEU)). The covariate spike used an 8-day worst-case lag and left weekends and holidays as NaN rather than forward-filling them ([spike-covariates.md](../../spike-covariates.md)).
- The naïve forecast is the necessary benchmark for integrated, random-walk-like series: "without comparing against it, quality of more complex models cannot be meaningfully assessed" ([Hewamalage et al., arXiv 2203.10716](https://arxiv.org/html/2203.10716v2)). The spike already found Brent "close to a random walk" ([data-sources.md](../../data-sources.md)).
- Timestral masks NaN and forward-fills it internally with a mask ([timestral repo](https://github.com/mistralai/timestral)). A calendar index with NaN weekends is therefore valid input, but it spends about 2/7 of the context on masked steps.

### Inferences
- **P10. Use a trading-day index for Brent.** [aseri]
  - Implement: build the context from the observed rows only (`reset_index`, positional steps). Forecast `n` trading steps, where `n` covers today+28 calendar days (about 20). Map step k to a date with `pandas.bdate_range` plus a holiday list derived from the history: dates on which other years have no print. Publish only trading-day points; the chart can draw a line across weekends.
  - Test: (a) no Saturday or Sunday in the forecast or scored dates; (b) step-to-date mapping on a fixture spanning Christmas and New Year; (c) an A/B backtest (trading index vs calendar index with NaN vs calendar index forward-filled), reporting cov80 and WQL against the naive baseline. Expectation, an inference: the forward-filled variant will show narrower bands and flattering scores on weekend "actuals".
- **P11. Never score non-trading days.** [aseri] A forward-filled weekend "actual" equals Friday's price, so last-value naive scores perfectly on it, and any model looks good. Score only dates with a real print, and describe a horizon in both trading days and calendar days on the site.
- **Aligning with calendar series.** [aseri] This matters only for cross-series use (charts, or covariates if ever reintroduced). Join on calendar date with Brent's non-trading days left NaN, and never fill them. The covariate spike already did this.

### Gaps
- No peer-reviewed comparison of business-day vs calendar-day indexing for foundation models was found.
- Brent's exact holiday calendar (ICE/UK holidays as reflected in EIA's Refinitiv source) was not verified.

## 4. Count and zero-inflated series: non-negativity, integers, transformations, effect on quantile forecasts

### Takeaway
Quantile forecasts survive monotone transformations exactly. A log1p scale therefore guarantees non-negativity and keeps interval coverage, but the back-transformed median is not the mean. For low counts (Hormuz at 2 to 5 transits a day) and spiky series, evaluate with tools built for discrete outcomes (randomized PIT, proper scores) and add a log-scale score. Whether log1p input helps Timestral is an empirical question to settle with a backtest.

### Cited Findings
- FPP3 on transformations:
  - Back-transformed point forecasts are "usually ... the median of the forecast distribution". The mean requires a bias adjustment, and "The larger the forecast variance, the bigger the difference between the mean and the median".
  - Back-transforming the interval "preserves the probability coverage of the prediction interval", although it becomes asymmetric.
  - A log transform "ensure[s] the forecasts and the prediction intervals stay positive".
  ([FPP3 §5.6](https://otexts.com/fpp3/ftransformations.html))
- Bosse et al., "Scoring epidemiological forecasts on transformed scales" (PLOS Computational Biology, 2023):
  - Applying CRPS or WIS to raw counts "may not be the most appropriate" when magnitudes vary widely. Scoring log-transformed counts approximates a probabilistic relative error.
  - Under a quadratic mean-variance relationship, log-scale expected CRPS is independent of magnitude.
  - Scoring on the transformed scale changed model rankings in the European COVID-19 Forecast Hub, and the authors recommend reporting transformed-scale scores too.
  - Code: [epiforecasts/transformation-forecast-evaluation](https://github.com/epiforecasts/transformation-forecast-evaluation).
  ([PMC full text](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10495027/))
- Kolassa (IJF 2016) argues that count forecasts should be judged as full discrete predictive distributions, explains why MAD, MASE and wMAPE are poorly suited to count data, and uses a randomized PIT and proper scoring rules on daily retail counts ([Lancaster eprint](https://eprints.lancs.ac.uk/id/eprint/134005); [RePEc](https://ideas.repec.org/a/eee/intfor/v32y2016i3p788-803.html)).
- Czado, Gneiting and Held (Biometrics 2009) propose a nonrandomized PIT, marginal calibration diagrams and proper scoring rules for counts ([ZORA record](https://www.zora.uzh.ch/entities/publication/3a6b88b2-4bc3-4929-80ef-010bdd2b69ce)). The `scoringutils` docs note that for discrete outcomes "the PIT is no longer uniform even when forecasts are ideal", so a randomised PIT is used ([scoringutils pit_sample](https://rdrr.io/github/epiforecasts/scoringutils/man/pit_sample.html)).
- Hewamalage et al. on measures for counts and skewed data:
  - "percentage based measures only make sense with the existence of a meaningful zero".
  - Squared-error measures "optimise for the mean", absolute-error measures "optimise for the median", and for skewed and intermittent series these differ.
  ([arXiv 2203.10716, §6](https://arxiv.org/html/2203.10716v2))
- Timestral output constraints:
  - `clip_nonnegative=True` (the default) clamps forecasts at 0 when every observed context value is non-negative.
  - `quantile_real_cap_k` clamps forecasts to `[min − k·s, max + k·s]` of the observed context.
  - The 21 quantiles are non-crossing.
  ([timestral repo](https://github.com/mistralai/timestral), `forecaster.py`; [timestral-model.md](../../timestral-model.md))
- The baseline spike found that the MASE scale computed over the full Hormuz history makes recent errors look tiny (0.1 to 0.2), while the level-relative WQL (0.4 to 1.9) "tells the real story" ([spike-timestral-backtest.md](../../spike-timestral-backtest.md)).

### Inferences
- **P12. Check the domain of each series.** [aseri] Non-negative everywhere. Integer for transits, pageviews and drone increments. Alert-hours lie in [0, 600], from 25 regions × 24 h. Keep the default `clip_nonnegative=True`. Never clip negative drone increments silently: a negative difference of a cumulative series is a correction, and should be flagged and handled as a revision under P4.
  - Test: schema checks (P20). A unit test showing that a −5 increment raises a data-quality flag instead of becoming 0.
- **P13. Handle integer outcomes when evaluating.** [aseri, mainly Hormuz]
  - Implement: compute coverage with inclusive bounds and report the share of ties. Add a randomized PIT histogram for the low-count series. Publish continuous quantiles; if the site shows integers, round with one fixed rule (for example ceil, which is non-decreasing, so quantile equivariance holds for the rounded variable) and apply the same rule in scoring.
  - Test: a synthetic Poisson(3) series with the true Poisson quantiles as the "forecast": the randomized PIT must pass a uniformity check (KS p > 0.01 over 5,000 draws), while the nonrandomized PIT should fail. This reproduces the scoringutils point.
- **P14. Treat log1p input as a hypothesis, not a default.** [aseri, for pageviews, alerts, drones and Hormuz]
  - Why it is open: Timestral scales each context internally (causal patch location and scale), so a log1p input changes what the model sees in non-trivial ways. Quantiles back-transform exactly via `expm1`, but the back-transformed median is not a mean.
  - Implement: an A/B backtest per series (raw vs log1p context, with `expm1` applied to every quantile), under a keep rule fixed in advance, as in the covariate spike.
  - Test: an assert that `expm1(q_log)` stays monotone across the 21 levels and ≥ 0.
- **P15. Score spiky series on two scales.** [aseri] Publish WQL on the raw scale and on the log1p scale (Bosse et al.) for "World War III" pageviews, alert-hours and drones. Avoid MAPE. Prefer level-relative WQL over MASE where the level shifted (Hormuz).

### Gaps
- No evidence was found, for Timestral or other time-series foundation models, on whether log or Box-Cox input transforms improve probabilistic accuracy on count or spiky series. It must be tested in the backtest.
- The exact offset Bosse et al. use for zeros (log(x+1) or another) was not verified in the full text.
- Kolassa's and Czado et al.'s full texts were not read; findings rest on abstracts and package docs.

## 5. Outliers, structural breaks and regime shifts: detection, and whether to clean the context window

### Takeaway
Clean only what is a measurement error with a known mechanism (AIS dropouts, bot surges, partial days, duplicates), and do it by masking the value as NaN in the context, with a logged reason, never in the scored actuals. Keep real events (the Hormuz collapse, the 2024 Red Sea diversion, attention spikes) in the context, because they are the signal. A bad value at the forecast origin is the most harmful case, so check the edge before every run.

### Cited Findings
- FPP3 on outliers:
  - "Simply replacing outliers without thinking about why they have occurred is a dangerous practice". Replacement is reasonable only if "we are willing to assume that the outliers are genuinely errors".
  - Detection: run `STL(robust=TRUE)` and flag remainders beyond 3 interquartile ranges.
  - "None of the methods we have considered in this book will work well if there are extreme outliers in the data".
  ([FPP3 §13.9](https://otexts.com/fpp3/missing-outliers.html))
- Ledolter (IJF 1989), on additive outliers:
  - A distant outlier leaves point forecasts "largely unaffected", but the carry-over effect grows near the forecast origin.
  - Prediction intervals "are found to be quite sensitive", because outliers inflate the estimated innovation variance.
  ([EconPapers](https://econpapers.repec.org/RePEc:eee:intfor:v:5:y:1989:i:2:p:231-240); [IAOR abstract](https://iaorifors.com/paper/1619))
- Castle, Clements and Hendry, "Robust approaches to forecasting" (IJF 31(1), 2015): robust forecasting devices compared with equilibrium-correction models under measurement error, impulses and unanticipated location shifts, and evaluated over the Great Recession ([RePEc](https://econpapers.repec.org/RePEc:eee:intfor:v:31:y:2015:i:1:p:99-112); [Reading repository](https://centaur.reading.ac.uk/37611)).
- Hewamalage et al.:
  - "with abrupt structural breaks and level shifts occurring in the unknown future ... it will be impossible for the models to address this change", and "even tsCV would grossly underestimate the generalisation error" in that case (§5.4).
  - A constant scale estimator is "a comparatively poor form of scaling" for non-stationary series (§6.1).
  ([arXiv 2203.10716](https://arxiv.org/html/2203.10716v2))
- Breck et al. (SysML 2019): in production, rather than auto-patching data, "the common approach in practice is for the on-call engineer to investigate the problem, isolate the bug in the code, and submit a fix" ([MLSys PDF](https://mlsys.org/Conferences/2019/doc/2019/167.pdf)).
- Measurement artifacts already seen in aseri's series:
  - Taiwan Strait AIS dropouts: single days at about 25 transits between days of 240 to 400, on 2025-11-11, 2026-07-10 and 2026-10-23 ([spike-timestral-backtest.md](../../spike-timestral-backtest.md)). The 2026-10-23 value was still unrevised on 2026-10-30 (measured, see §1).
  - Bot traffic counted as "user" pageviews in May-June 2025 until Wikimedia reclassified it ([Wikimedia Diff](https://diff.wikimedia.org/2025/10/17/new-user-trends-on-wikipedia/)).
  - A Kaggle dataset notes that the Ukrainian Air Force "stopped reporting some missile types on 2026-08-10", a break in reporting rather than in the war ([data-sources.md](../../data-sources.md)).
- AIS coverage limits: AIS is "a self-reporting system", open-sea signals depend on satellite receivers, and "congestion may make it difficult for satellites to capture all emitted messages" ([PortWatch metadata](https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer/info/metadata)).
- Real regime shifts in aseri's data: Hormuz fell from 78 transits a day (February 2026) to 3.2 (March), and after the collapse the last-value naive is "the real competitor" ([spike-timestral-backtest.md](../../spike-timestral-backtest.md)).
- Timestral already guards its outputs: forecasts are capped at the context range ± k·s (`quantile_real_cap_k`), and fed-back medians above `extreme_value_threshold` are set to 0 ([timestral repo](https://github.com/mistralai/timestral), `forecaster.py`). A spike left in the context therefore also widens the allowed output range.

### Inferences
- **P16. Keep an anomaly register, separate from the data.** [generic pattern, aseri contents]
  - Implement: a version-controlled `anomalies.csv` (`series`, `date`, `kind` ∈ {measurement_error, reporting_change, real_event}, `rule_or_person`, `evidence_url`, `added_on`). The context builder masks only `measurement_error` rows to NaN. `real_event` rows are annotations for the chart. `reporting_change` rows trigger a review of whether the history before the break stays in the context.
  - Test: (a) the context builder masks exactly the registered dates; (b) a guard test that the scorer never reads the register, so actuals are never cleaned; (c) when a new register entry would have changed an already published forecast, that forecast is kept and the entry is dated.
- **P17. Detect, then decide, with rules fixed in advance.** [aseri]
  - Implement: a robust z-score on the log1p scale against a rolling 28-day median and MAD, plus series-specific rules. Example for Taiwan Strait: a value below 25% of the 28-day median, with the next day back above 75%, is an isolated dropout. The rule is only confirmable one day later, so at the edge it holds the value (P18).
  - An attention spike in pageviews or GPR is a real event: never auto-clean it. Optionally run FPP3's `STL(robust=True)` with the 3×IQR rule as a second opinion, offline.
  - Test: fixtures with an injected dropout, an injected real level shift (a sustained drop such as Hormuz) and an injected single-day spike. Only the dropout is masked.
- **P18. Check the edge before forecasting.** [aseri; Ledolter: the origin is the worst place for an outlier]
  - Implement: if the last observed value fails P17's rule, forecast with that day set to NaN (origin moved back one day) and show a "last value under review" note. Do not publish a band inflated by a likely artifact.
  - Test: a fixture where the last day equals 10% of the median yields a forecast whose origin is the day before.
- **P19. Validate regime handling, do not hand-truncate.** [aseri]
  - Do not cut the context at a break by hand: the post-break regime may be too short (Hormuz). Treat context length as a hyperparameter checked in the rolling backtest, which the spike flagged as untested.
  - Report skill relative to naive and mean28 separately for pre-break and post-break origins, and use level-relative WQL, not full-history-scaled MASE, for series with level shifts.
  - Test: a backtest table per regime, with the regime boundary dates taken from the anomaly register.

### Gaps
- No paper was found that tests whether cleaning outliers from the context helps or hurts a pretrained time-series foundation model. The evidence above is for classical ARIMA-type models and econometric devices.
- Pesaran and Timmermann's work on choosing the estimation window under breaks (J. Econometrics 2007) was not fetched.
- The full texts of Ledolter (1989) and Castle et al. (2015) were not read; findings rest on abstracts.

## 6. Leakage: look-ahead bias in backtests, revised data used as real-time, normalisation leakage

### Takeaway
Three leaks matter for aseri:

1. Revised data used as if it were real-time, which affects GPR and possibly PortWatch.
2. Any statistic computed over the full series: scaling, outlier rules, MASE denominators, thresholds.
3. The foundation model's unknown training cutoff, which no backtest can rule out.

Serious evaluations prevent these with an as-of data layer shared by the backtest and the live job, preprocessing restricted to each origin's context, and pre-registered live forecasts, which are the only contamination-free test.

### Cited Findings
- Hewamalage et al. (§3.4):
  - Leakage comes from "performing smoothing, decomposition (mode decomposition), normalisation etc. over the whole series". "Features can be extracted only from the training set data".
  - Cross-series leakage occurs when "one series ... contain[s] in its training period potential information about the future of another series".
  - Random k-fold can put "future observations" in the training data.
  - Expanding-window evaluation "is known to provide overestimation for the validation error" (§5.2).
  ([arXiv 2203.10716](https://arxiv.org/html/2203.10716v2))
- Stark and Croushore: error measures computed against latest-available data "can look deceptively low" ([EconPapers](https://econpapers.repec.org/RePEc:fip:fedpwp:01-10)). The hubverse says retrospective performance can look "substantially better than it really was in real time" ([hubverse docs](https://docs.hubverse.io/en/latest/user-guide/target-data.html)).
- GIFT-Eval re-ran the original Moirai models and found that training-set leakage usually boosted performance on the affected test sets, more so at longer prediction lengths. GIFT-Eval also ships a non-leaking pretraining corpus ([GIFT-Eval, arXiv 2410.10393](https://arxiv.org/pdf/2410.10393)).
- "Rethinking Evaluation in the Era of Time Series Foundation Models" finds that benchmark datasets were in the pretraining data of TimesFM, UniTS and TTM. It also describes indirect leakage through correlated series; its example is a model trained on global stock indices through 2020 learning the COVID-19 crash ([arXiv 2510.13654](https://arxiv.org/html/2510.13654v3)).
- TS-Arena (ICLR 2026) uses live forecast pre-registration, so models are scored on data that did not exist at submission time ([TS-Arena](https://iclr.cc/virtual/2026/10013852)).
- Timestral's training cutoff is unknown: GitHub issue mistralai/timestral#3 was unanswered on 2026-10-29. Origins before the 2026-10-15 release may score better than live forecasts ([spike-timestral-backtest.md](../../spike-timestral-backtest.md)).
- Breck et al. describe "feature skew", where a feature is computed differently at training and at serving time. They check it by comparing the two paths ([MLSys PDF](https://mlsys.org/Conferences/2019/doc/2019/167.pdf)).

### Inferences
- **P20. One context builder for backtest and live.** [generic, essential]
  - Implement: a single function `make_context(store, series, as_of)` that reads `as_of_view`, applies the anomaly register and returns the array passed to `forecast()`. The daily job is literally `make_context(store, s, now)`, and the backtest calls the same function with past `as_of` values. No other code path may read raw data.
  - Test: a "future poisoning" test. For a random origin, replace every value dated after the origin, and every vintage fetched after it, with 1e9. The forecast must be bit-identical, which the spike's bit-for-bit reproducibility (`max abs diff 0`) shows is achievable.
- **P21. Compute every statistic inside the context.** [generic]
  - Thresholds for P17 (rolling median and MAD), any input scaling, and the MASE scale must be computed only from data ≤ origin, as of the origin's vintage. The MASE scale in the spike already follows this rule (it is computed over each origin's context).
  - Test: the poisoning test above also covers the detectors. Add a unit test that the scale of origin t is unchanged when data after t is appended.
- **P22. Make honesty about the training cutoff structural.** [aseri]
  - Store every published forecast immutably (git commit plus hash) before its target dates occur. On the site, separate the "live track record" (forecasts issued after the model release, 2026-10-15) from the "backtest (pseudo out-of-sample, possible training contamination)". The live record is aseri's own TS-Arena-style pre-registration.
  - Test: CI refuses to modify any file under `forecasts/published/` that already exists (append-only check in the PR workflow).
- **P23. Fix the evaluation protocol before looking at results.** [generic] Freeze the metrics, baselines (naive, seasonal naive, mean28), scoring vintage (P3), exclusion rules (P8, P16) and keep rules in a versioned config, as the covariate spike did with its keep rule. Changes are dated and apply only to future scores.

### Gaps
- Kapoor and Narayanan's leakage taxonomy (Patterns, 2023) and Tashman (IJF 2000) on rolling-origin evaluation were not fetched in this round.
- Whether Timestral's pretraining included PortWatch, GPR or Wikipedia pageviews cannot be resolved without Mistral's answer to issue #3.

## 7. Data validation and contracts in production (schema, plausibility ranges, freshness)

### Takeaway
Google's production experience says to codify expectations in a schema, alert with high precision and few false positives, prefer interpretable distance thresholds to significance tests, and fix root causes rather than auto-patch data. For a small daily job like aseri, a pandera schema per source, plus freshness, revision-window and edge checks, run fail-closed, covers this at almost no cost.

### Cited Findings
- Breck, Polyzotis, Roy, Whang and Zinkevich, "Data Validation for Machine Learning" (SysML 2019), deployed in TFX at Google ([MLSys PDF](https://mlsys.org/Conferences/2019/doc/2019/167.pdf)):
  - A schema "codifies the expectations for correct data". Disagreements are flagged as anomalies, and the system proposes schema updates for natural evolution of the data.
  - Alert quality: "on-calls tend to ignore alerts that are either spammy or not actionable, which can cause important errors to go unnoticed".
  - Why not significance tests: a chi-square test between 100M N(0,1) points and the same sample with 0.01% replaced from N(0,2) fired at the 1% level in 7 of 10 trials. They use the L∞ distance d∞(p,q) = maxᵢ|pᵢ − qᵢ| instead, "the largest change in probability for a value", because it is interpretable and easy to tune.
  - Fleet statistics (Table in §6), as share of pipelines using the check / where it fired / fixed after firing:

    | Check | Used | Fired | Fixed after firing |
    |---|---|---|---|
    | New feature column | 100% | 10% | 65% |
    | Data completely missing | 100% | 3% | 65% |
    | Missing feature column | 97% | 6% | 53% |
    | Incorrect data type | 98% | <1% | 100% |

  - Model unit tests ran more than 80K times in a month; 6% failed, showing that "either the training code had incorrect assumptions about the data or the schema itself was under specified".
- pandera ([docs](https://pandera.readthedocs.io/en/stable/)):
  - Schemas via `DataFrameSchema` or the pydantic-style `DataFrameModel`.
  - Field constraints such as `pa.Field(ge=0)` and `pa.Field(isin=[...])`; built-in checks `pa.Check.ge/lt/isin`; custom checks via `pa.Check(lambda s: ...)` and `@pa.check`.
  - `strict=True` rejects undeclared columns; index validation is supported.
  - `schema.validate(df, lazy=True)` aggregates every failure into one `SchemaErrors` report.
  - It can "Synthesize data from schema objects for property-based testing".
- Great Expectations provides declarative checks such as `expect_column_values_to_be_between`, and `expect_column_max_to_be_between` with `parse_strings_as_datetimes`, which can act as a freshness check on a date column ([GX expectation docs](https://greatexpectations.io/legacy/v1/expectations/expect_column_max_to_be_between/)).
- aseri-specific failure modes already observed:
  - PortWatch returns errors inside HTTP 200 bodies (`{"error":{"code":400,...}}`), 12 times over 9 page requests in the spike ([spike-timestral-backtest.md](../../spike-timestral-backtest.md)). It happened again on 2026-10-30: 2 of 6 requests (measured).
  - The service was down for about 15 minutes on 2026-10-29. The recommendation then was to "Retry with backoff, and do not overwrite good data on failure" ([data-sources.md](../../data-sources.md)).
- Usable freshness signals:
  - GPR: HTTP `Last-Modified` on the data file ([data-sources.md](../../data-sources.md)).
  - PortWatch: `editingInfo.dataLastEditDate` on the layer JSON (measured, [layer JSON](https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0?f=json)).
  - FRED: the "Next Release Date" on the series page ([FRED](https://fred.stlouisfed.org/series/DCOILBRENTEU)).

### Inferences
- **P24. One pandera contract per source, run on the parsed frame before ingest.** [aseri]
  - Implement, common rules: `date` unique, monotonic increasing and daily without gaps (Brent: trading days, no weekends); value non-null except where allowed; `strict=True`.
  - Implement, ranges:

    | Series | Rule |
    |---|---|
    | GPR | ≥ 0, and below 5× the historical max as a sanity ceiling |
    | Transits | integer ≥ 0, below 2× the chokepoint's historical max |
    | Brent | > 0 and < 500 |
    | Alert-hours | in [0, 600] |
    | Pageviews | integer ≥ 0 |
    | Drone increments | integer ≥ 0, with negatives routed to the revision flag of P12 |

  - Implement, cross-snapshot rules: row count does not shrink; the first date does not move.
  - Run with `lazy=True` so one run reports every violation.
  - Test: one pytest per rule with a hand-made bad frame (duplicate date, negative count, missing day, extra column), plus a property test that fuzzes the downstream builder with frames synthesized from the schema.
- **P25. Check the HTTP body as well as the status.** [aseri] Treat any JSON with an `error` key, an empty `features` list or a row count below what was expected as a failed fetch: retry with backoff, and never overwrite the store.
  - Test: replay the spike's recorded error body as a fixture.
- **P26. Fail closed, visibly.** [generic] A contract, freshness (P9), revision-window (P4) or edge (P18) failure for one series blocks only that series. The site keeps its last good forecast with a "stale since"/"data under review" label, and the job opens a GitHub issue with the pandera report. Keep the check list short and every alert actionable (Breck et al.). A check that fires weekly without action gets ignored and should be fixed or removed.
- **P27. Detect drift with simple, interpretable thresholds.** [generic, optional] When the input distribution itself is in question, for example after a source change, compare the last 28 days to the prior year with a binned L∞ distance (largest change in bin probability) on the log1p scale, alerting above a fixed value such as 0.25. Do not use p-values, which fire on trivial differences at large n (Breck et al.'s chi-square result). For aseri's short daily series this is a low priority next to P4 and P17.
- **Why pandera over Great Expectations for aseri.** [aseri] pandera fits a single-file daily job: it is a library import, the schemas live as Python next to the code, and failures surface as pytest-able exceptions. Great Expectations adds a project, a context and checkpoints, which pay off with many datasets and teams. This is a judgement call, not a sourced finding.

### Gaps
- Current Great Expectations (GX Core 1.x) documentation was not reviewed; the cited page is the legacy v1 gallery.
- The ML Test Score paper (Breck et al. 2017), Deequ (Schelter et al., VLDB 2018) and Polyzotis et al. on data-management challenges in production ML were not fetched.
- No engineering write-up specific to daily public forecasting sites (as opposed to ML training pipelines) was found. The forecast-hub docs (hubverse) are the closest match.
