# Testing and continuously validating the aseri forecasting pipeline

Scope: which tests to add, at which layer, so that the numbers aseri publishes (nine daily series, Timestral-209M, 21 quantiles, 28-day horizon, Hubverse archive, WIS/coverage scoring, static JSON + React page) are provably sensible, not only produced by code that runs. Current as of 2026-10-30.

Baseline read from the repo (local files, no URL):
- Pipeline modules today: `pipeline/aseri/{archive,forecast,publish,series}.py` plus `sources/`. There is no scoring module yet, no `*.schema.json` file yet, and no clamping of negative count quantiles yet (spec 6.3 step 3 asks for it; `forecast.py` only does `np.sort(..., axis=1)`).
- Python tests: `test_forecast.py` (stub model: reference date, shape, whole history, crossing quantiles get sorted), `test_real_model.py` (`slow` marker, skipped unless the pinned weights are in the HF cache; checks 21 levels, shape 28x21, ordered), `test_archive.py`, `test_cli.py` (end to end with the recorded `gpr_daily_recent.dta` fixture and a stub model whose band is centred on `context[-1]`), `test_gpr.py` (missing day, implausible value, retries), `test_publish.py`. `pyproject.toml` runs `-m 'not slow'` by default; dev deps are only pytest and ruff (no Hypothesis).
- Web tests: `lib/chart.test.ts` (layout, `valueScale`, `forecastAt` starts from the last daily value, `dayAt(x(day)) === day` at three widths), `components/PixelForecastChart.test.tsx` (jsdom, canvas stubbed out, so nothing drawn is asserted), `App.test.tsx`, `lib/format.test.ts`, `lib/replay.test.ts`.
- `web/src/lib/chart.ts` `paintChart(plot, chart, forecast, color)` takes an injected `plot: (x, y, color) => void`. That is a ready-made seam for asserting the geometry of what is drawn without screenshots.
- Spec 6.3/6.4 (`docs/superpowers/specs/2026-10-29-aseri-design.md`): validate stage (continuous index, freshness, plausible ranges, failing series skipped and marked stale), clamp negative count quantiles, sort crossing quantiles, score coverage at 50/80%, WIS, median AE vs naive / seasonal naive / 28-day mean, MASE, against a stated observation vintage; publish validates every JSON against its schema; job fails loudly when nothing publishes or schemas fail; live record shown only after `min_n_to_display: 30` resolved forecasts; horizon buckets 1-7 and 8-28; the scout keep rule already uses an 8-in-10 coverage window of 0.70 to 0.90.

## 1. Which checks from the ML/forecasting testing literature apply (Breck et al., Amershi et al., Zhang et al., GluonTS, Nixtla, Darts)

### Takeaway
The ML Test Score rubric maps well onto aseri if read for a frozen, pretrained model: the training items drop out, and the data-schema, simple-baseline, slice, integration, pre-serving validation, numerical-stability and live-quality items become concrete tests. Library tooling (GluonTS, Nixtla utilsforecast) mostly offers ready-made backtest and metric functions that serve as cross-check oracles, not test suites to copy.

### Cited Findings
- The ML Test Score (Breck, Cai, Nielsen, Salib, Sculley; Google; IEEE Big Data 2017) has 28 tests in four sections of seven: Data, Model, Infrastructure, Monitoring. [Breck et al. 2017 PDF](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
  - Data: 1 feature expectations captured in a schema; 2 all features beneficial; 3 no feature's cost too much; 4 features meet meta-level requirements; 5 privacy controls; 6 new features added quickly; 7 all input feature code tested. (same source)
  - Model: 1 model specs reviewed; 2 offline and online metrics correlate; 3 hyperparameters tuned; 4 impact of model staleness known; 5 a simpler model is not better; 6 quality sufficient on important data slices; 7 tested for inclusion. (same source)
  - Infrastructure: 1 training reproducible; 2 model specs unit tested; 3 ML pipeline integration tested; 4 model quality validated before serving; 5 model debuggable; 6 models canaried before serving; 7 serving models can be rolled back. (same source)
  - Monitoring: 1 dependency changes result in notification; 2 data invariants hold for inputs; 3 training and serving not skewed; 4 models not too stale; 5 model numerically stable; 6 no regressions in speed/latency/RAM; 7 no regression in prediction quality on served data. (same source)
- Scoring: half a point per test run manually with documented results, a full point if run automatically on a repeated basis; sum per section; final score is the minimum of the four section sums, "because we believe all four sections are important". Bands: 0 = research project, (0,1] = serious holes possible, (1,2] = first pass, (2,3] = reasonably tested, (3,5] = strong, appropriate for mission-critical, >5 exceptional. [Breck et al. 2017](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
- Data 1 example: encode intuitions as a schema ("an adult human is surely between one and ten feet in height"); build it from statistics of the data adjusted by domain knowledge, or write expectations first to avoid anchoring. [Breck et al. 2017](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
- Model 5: "Regularly testing against a very simple baseline model ... is an effective strategy both for confirming the functionality of the larger pipeline and for helping to assess the cost to benefit tradeoffs." [Breck et al. 2017](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
- Infra 3: there must be "a fully automated test that runs regularly and exercises the entire pipeline"; faster versions "with a subset of training data or a simpler model" give fast feedback, backed by less frequent runs closer to production. [Breck et al. 2017](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
- Infra 4: before a model affects traffic an automated system must "bless the model or veto it"; test slow degradation with loose thresholds against a validation set, and sudden drops by comparing "predictions to the previous version of the model while setting tighter thresholds." [Breck et al. 2017](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
- Monitor 1: source-system outages, upgrades and changes "can radically change the feature's meaning ... without necessarily producing values that are strange enough to trigger other monitoring"; subscribe to dependencies' announcement lists. [Breck et al. 2017](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
- Monitor 2: measure whether data matches the schema and alert on divergence; "careful tuning of alerting thresholds is needed" to balance false positives and negatives. Monitor 5: "Explicitly monitor the initial occurrence of any NaNs or infinities." [Breck et al. 2017](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
- Monitor 7: validation data is always older than serving data; options include measuring statistical bias in predictions ("90% of predictions of probability 0.9 should in fact be positive") and judging quality as soon as labels arrive. [Breck et al. 2017](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
- Amershi et al. (Microsoft, ICSE-SEIP 2019) name three ways ML differs from other software: data discovery/management/versioning is harder; model customization and reuse need different skills; AI components are hard to treat as distinct modules, models may be "entangled" and show "non-monotonic error behavior". [Amershi et al. 2019](https://www.microsoft.com/en-us/research/uploads/prod/2019/03/amershi-icse-2019_Software_Engineering_for_Machine_Learning.pdf)
- Amershi et al.: "Automating tests is as important in machine learning as it is in software engineering; teams create carefully put-together test sets that capture what their models should do. However, it is important that a human remains in the loop" (spot-checking errors). Their nine-stage workflow ends with model evaluation on "tested or safeguard datasets using pre-defined metrics" and continuous monitoring of deployed inference. [Amershi et al. 2019](https://www.microsoft.com/en-us/research/uploads/prod/2019/03/amershi-icse-2019_Software_Engineering_for_Machine_Learning.pdf)
- Zhang, Harman, Ma, Liu, "Machine Learning Testing: Survey, Landscapes and Horizons", surveys 144 papers and organizes them by testing properties (e.g. correctness, robustness, fairness), components, workflow and application. [Zhang et al. (arXiv 1906.10742)](https://arxiv.org/abs/1906.10742)
- GluonTS `make_evaluation_predictions` predicts the trailing `prediction_length` points of each series "using only the data before them" and returns forecasts plus matching ground truth; `backtest_metrics` returns aggregate and per-series metric tables; the Evaluator's MSIS uses `alpha=0.05` (95% interval) from the M4 competition. [GluonTS evaluation API](https://ts.gluon.ai/stable/api/gluonts/gluonts.evaluation.html)
- Nixtla `utilsforecast.losses` provides `mase(..., seasonality, train_df)`, `rmae(..., baseline)`, `quantile_loss`, `mqloss`, `scaled_crps`, `coverage(..., level)`, `winkler_score`, and `calibration` ("Fraction of y that is lower than the model's predictions"). [utilsforecast losses](https://nixtlaverse.nixtla.io/utilsforecast/losses.html)
- Uber's Forecasting Platform built Omphalos (2018) for backtesting with sliding-window (preferred for daily/hourly data) and expanding-window modes, and automatic model evaluation with thresholds on wMAPE and median bias. [Uber Engineering: Omphalos](https://www.uber.com/blog/omphalos/)

### Inferences
- Applicable Breck items for aseri, with the test each becomes:
  - Data 1 + Monitor 2 -> the validate stage as an explicit, versioned expectations table per series (range, max day-over-day jump, freshness lag, allowed gaps), unit-tested with good and bad fixtures (`test_gpr.py` already does this for GPR; extend to each adapter).
  - Data 7 -> each source adapter has recorded-response tests, including PortWatch's error-in-HTTP-200 case (spec 6.1).
  - Model 5 -> skill vs naive, seasonal naive and 28-day mean, computed in the score stage and shown when the model loses (spec 6.4 already demands this). Add a test that the score code reports ratio = 1.0 when the "model" is the naive forecast itself.
  - Model 6 -> slices = per series x horizon bucket (1-7, 8-28). Never pool all nine series into one acceptance number.
  - Infra 1 -> reproducibility = pinned weights revision + pinned timestral commit (already in `forecast.py`/`pyproject.toml`) plus a golden-output test (question 5).
  - Infra 3 -> `test_cli.py` already is this test with a simpler model; it should also assert cross-file consistency (question 6) and no-leakage (question 2).
  - Infra 4 + Infra 6 -> a pre-publish gate inside `daily.yml` that runs on the real model output before deploy (question 4). Because the daily job runs the real model anyway, this gate is the "canary" at no extra cost.
  - Infra 7 -> rollback is already covered by append-only archive + errata; add a test that publishing never deletes or rewrites an existing `forecasts/{reference_date}.json`.
  - Monitor 1 -> a checklist/subscription, not a test (GPR file layout, PortWatch service, FRED series, GitHub repos of the two Ukrainian datasets).
  - Monitor 5 -> assert `np.isfinite` on every quantile before archiving.
  - Monitor 6 -> record wall time per series in the run manifest; warn on a large jump.
  - Monitor 7 -> rolling live coverage and quantile calibration (question 9).
- Not applicable: Data 2/3/6 (univariate, no feature engineering), Data 5 (public data), Model 3 (no training), Model 7 (inclusion), Monitor 3 (no training/serving split; the closest analogue is "the backfill and the live job compute the context the same way", which a test can check).
- Model 4 / Monitor 4 (staleness) reinterpreted: the weights are frozen, so the risk is a stale input series, already covered by the freshness check, and possible drift of the world away from the model's training data, covered by live calibration monitoring.
- Rough self-assessment: aseri today scores around 1 in the Monitoring section (no automated live-quality monitoring yet), so its overall ML Test Score is capped by Monitoring, whatever the other sections score. This is my reading of the rubric, not a formal audit.

### Gaps
- I did not fetch Darts or statsforecast testing docs; I cannot cite their specific guidance. GluonTS/Nixtla pages describe APIs, not a testing philosophy.
- The GluonTS page fetched did not define Coverage[q], QuantileLoss[q] or MASE; definitions live in its metrics module (not fetched).
- I found no Amazon or Nixtla engineering blog post describing their production test/monitoring setups for forecasts in this session.
- Zhang et al. is cited from the arXiv record (2019 versions); its IEEE TSE publication details were not verified.

## 2. Property-based tests (Hypothesis, fast-check): invariants for forecasting code

### Takeaway
Property tests fit the deterministic post-processing, archiving, scoring and chart code; they cannot prove the neural model behaves, but they can prove the code around it never publishes crossed, negative, NaN, mis-dated or leaked numbers for any input. Hypothesis's CI profile makes them deterministic on GitHub Actions automatically.

### Cited Findings
- Hypothesis `settings.derandomize`: "If True, seed Hypothesis' random number generator using a hash of the test function." Default False, but True on CI. `deadline` default 200 ms, None on CI. `max_examples` default 100. [Hypothesis API reference](https://hypothesis.readthedocs.io/en/latest/reference/api.html#hypothesis.settings.derandomize)
- Hypothesis has built-in `default` and `ci` profiles; if the `CI` environment variable is set to any value, the `ci` profile is active by default. Profiles can be registered/loaded with `settings.register_profile` / `settings.load_profile`. [Hypothesis API reference: built-in profiles](https://hypothesis.readthedocs.io/en/latest/reference/api.html#built-in-profiles)
- GitHub Actions sets `CI=true` as a default environment variable. [GitHub Docs: default environment variables](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables)
- `@example` adds explicit cases that do not count toward `max_examples` and are not shrunk; `assume()` "is like an assert that marks the test case as bad, rather than failing the test"; failing examples are cached in `.hypothesis/examples` (a cache "you never need to invalidate"). [Hypothesis API reference](https://hypothesis.readthedocs.io/en/latest/reference/api.html)
- pandera schemas can produce Hypothesis strategies: `schema.strategy(size=5)` for use with `@hypothesis.given`; built-in checks (`gt`, `lt`, `in_range`, `isin`, ...) constrain generated data; inline lambda checks fall back to filtering and can be slow or `Unsatisfiable`; needs `pandera[strategies]`. [pandera data synthesis](https://pandera.readthedocs.io/en/stable/data_synthesis_strategies.html)
- fast-check: `fc.assert(property, params?)` throws on failure; `params` accepts options such as `numRuns`; global defaults via `fc.configureGlobal({ numRuns: 10 })`, which "fully resets the settings", typically called from a Vitest `setupFiles` file. [fast-check runners](https://fast-check.dev/docs/core-blocks/runners/), [fast-check global settings](https://fast-check.dev/docs/configuration/global-settings/)
- GluonTS's evaluation helper encodes the no-leakage rule: forecast the trailing window "using only the data before them". [GluonTS evaluation API](https://ts.gluon.ai/stable/api/gluonts/gluonts.evaluation.html)
- hubValidations' `value_col_non_desc` check fails when quantile values decrease as `output_type_id` increases within a task-ID group. [hubValidations validate_submission](https://hubverse-org.github.io/hubValidations/articles/validate-submission.html)

### Inferences
Concrete property tests (Python unless noted). Add `hypothesis` to the `dev` dependency group; no other new dependency needed.

- P1 "published quantiles are ordered, finite and non-negative for count series" (proves the Hubverse/API monotonicity promise and the spec's clamp rule hold for any model output).
  - How: a `ArbitraryModel` stub returns a `quantiles` tensor drawn from `hypothesis.extra.numpy.arrays(np.float32, (1, 1, h, 21), elements=st.floats(-1e6, 1e6, width=32))`; call `forecast()` and the (to-be-written) clamp step; assert `np.all(np.diff(q, axis=1) >= 0)`, `np.isfinite(q).all()`, and `q.min() >= 0` for count series. Add an `@example` with NaN to pin what happens (the code should raise rather than archive NaN; Breck Monitor 5).
  - Note: clamping after sorting keeps order (max(0, .) is monotone), so the order of the two steps does not matter; the test proves it.
  - Source: spec 6.3; [hubValidations `value_col_non_desc`](https://hubverse-org.github.io/hubValidations/articles/validate-submission.html); [Breck Monitor 5](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf).
- P2 "shape and dates": for any history length >= 2 and any horizon in {7, 14, 28}, the forecast has exactly `horizon` rows and 21 columns, `reference_date == observed.index[-1]`, and the published `target_end_date == reference_date + horizon days` for every row (for Brent, the trading-day rule instead). Extends `test_forecast.py`, which checks these for one example. Source: [hubValidations note that `target_end_date` vs `horizon` is not checked by default and needs `opt_check_tbl_horizon_timediff()`](https://hubverse-org.github.io/hubValidations/articles/validate-submission.html).
- P3 "no leakage / appending future data changes nothing in the past" (proves backfill and batch forecasts use only data up to their own date, spec 6.2).
  - How: a `RecordingModel` stub that stores every `context` it receives. Drive `archive`/CLI backfill with a history of length N, then N+k. Assert (a) every recorded context for reference date d has length equal to the number of observations up to d and its last value equals `observed[d]`; (b) the forecasts archived for dates <= the first run's newest date are byte-identical after the second run (append-only).
  - Hypothesis: draw N, k, and which days are revised (GPR revises recent values) and assert revisions only affect forecasts whose reference date is after the revision was seen.
  - Source: [GluonTS `make_evaluation_predictions` "using only the data before them"](https://ts.gluon.ai/stable/api/gluonts/gluonts.evaluation.html); spec 6.2.
- P4 "the forecast starts at the origin" (data level): for every published forecast, `latest.json`'s last observed value equals `actuals.json`'s value at `reference_date`, and the replay entries carry the same `reference_date` and last value as the dated file. This is the data-side half of the chart bug; the chart-side half is in question 8.
- P5 scale and shift equivariance of the code path (not of the model): with an equivariant stub (`q = context[-1] * a + b`-style), assert `publish(forecast(c * y + d)) == c * publish(forecast(y)) + d` for c > 0, outside the clamped region. For count series the clamp at 0 breaks shift equivariance by design, so restrict `d` so that no quantile crosses 0, or test only non-count series (GPR, Brent). This catches unit bugs (rounding, float keys, wrong column) in publish/archive. For the real model, equivariance is a metamorphic test (question 3), not a property test.
- P6 scoring properties (proves the score code, question 7): for random ordered quantile vectors q and observations y,
  - WIS >= 0, and WIS == 0 iff all 21 quantiles equal y;
  - point forecast (all quantiles = m) gives WIS == |y - m| ([Bracher et al. 2021](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618): "The WIS and CRPS reduce to the absolute error when F is a point forecast");
  - translation invariance WIS(y + b, q + b) == WIS(y, q) and scale equivariance WIS(c y, c q) == c WIS(y, q) for c > 0;
  - interval form equals pinball form (question 7, P-identity);
  - nested intervals: per forecast, inside-80% >= inside-50% (holds once quantiles are monotone);
  - relative error of the naive forecast against itself is exactly 1.
- P7 web (TypeScript, fast-check; add `fast-check` as a dev dependency):
  - `forecastAt(last, ahead, 0) === last` and `forecastAt(last, ahead, k) === ahead[k-1]` for all integer k in 1..len and all arrays;
  - order preservation: if `lo[i] <= hi[i]` for all i then `forecastAt(last, lo, t) <= forecastAt(last, hi, t)` for all real t in [0, len] (bands never cross on screen);
  - `valueScale(...).y` is non-increasing in the value (higher value, higher on screen) and never returns outside [top, bottom];
  - `chart.dayAt(chart.x(day)) === day` for any width in [200, 1600], generalizing the existing three-width test in `chart.test.ts`.
  - Source: [fast-check runners](https://fast-check.dev/docs/core-blocks/runners/).
- Determinism: on GitHub Actions, Hypothesis derandomizes automatically (CI env var), so property tests do not flake between runs; locally they explore new inputs and store failures in `.hypothesis/` (add it to `.gitignore`). Source: [Hypothesis built-in profiles](https://hypothesis.readthedocs.io/en/latest/reference/api.html#built-in-profiles).

### Gaps
- I did not verify the exact signatures of `hypothesis.extra.numpy.arrays` and `hypothesis.extra.pandas` strategies (the fetched page was truncated before them).
- I did not verify from fast-check docs how a failure reports its `seed`/`path` for replay, or the `@fast-check/vitest` integration.
- `forecast()` currently passes the whole `observed` series; whether the backfill truncates before calling it is enforced in `archive.py`/`__main__.py`, which I only skimmed. P3 should be written against that call site.

## 3. Metamorphic testing for ML/forecasting models

### Takeaway
Metamorphic relations (MRs) are the practical answer to "there is no oracle for tomorrow's value": they check how outputs must change when inputs are transformed. The one published case study on a deep forecaster found real bugs with exactly the relations aseri needs (scaling/shifting, time ordering, constant series). For a pretrained foundation model the relations are approximate, so they belong in the opt-in real-model tier with tolerances.

### Cited Findings
- Dwarakanath, Ahuja, Podder, Vinu, Naskar, MV (Accenture), "Metamorphic Testing of a Deep Learning based Forecaster", 2019 IEEE/ACM 4th International Workshop on Metamorphic Testing: 19 MRs over a Pearson-correlation module and an LSTM forecaster; running them on the in-use application found 8 previously unknown issues; on a reference implementation, the MRs caught 29 of 44 valid mutants (65.9%), out of 403 generated with MutPy. [Dwarakanath et al. 2019](https://arxiv.org/abs/1907.06632)
- Their LSTM MRs include: MR-1 invariance of training/validation loss to linear scaling (the app min-max normalizes, so adding a constant to all data should leave losses approximately the same); MR-5 time ordering (shuffling validation rows must give exactly the same results, since the app must sort by time); MR-6/MR-7 introduce data with a range of 0 (constant series; division by range must be handled); MR-8 validate the TIME_STEPS (context length) actually used; MR-9 robustness: search for an input Xp close to Xs whose forecast is 2x the original. Failures in the real app: MR-5, MR-8, MR-9 for the LSTM. [Dwarakanath et al. 2019](https://arxiv.org/abs/1907.06632)
- Nasr, Nassar and Karray (2023, International Journal of Information Technology) customize literature MRs to time-series forecasting, group them into eight categories and add three new ones, using SVMs to detect MRs in code. [Nasr et al. 2023](https://link.springer.com/10.1007/s41870-023-01390-9) (from the abstract only)
- Jarman, Zhou and Chen (2017) applied metamorphic testing to Adobe's time-series anomaly detection with geometric transformations of simple generated series and found three bugs. [Jarman et al. 2017](https://ro.uow.edu.au/eispapers1/417) (from the abstract only)

### Inferences
MRs for aseri, split by what they can prove:

- Code-level MRs (stub model, fast, default CI; overlap with question 2 P5): unit change (multiply input by 1000, expect published values x1000, formatted correctly), time-order (shuffle the input rows before the validate stage: the pipeline must sort or reject, never forecast a shuffled series; cf. Dwarakanath MR-5), constant series (all values equal: no division-by-zero in MASE scale, `valueScale`, or "vs baseline" percentages; cf. MR-6/7), context-length (a `RecordingModel` proves the full history is passed, already in `test_reads_the_whole_history`; cf. MR-8).
- Model-level MRs (real Timestral, `@pytest.mark.slow`, run locally or in a weekly workflow, never on the publish path):
  - M1 scale equivariance: `forecast(c*y)` vs `c*forecast(y)` for c in {0.01, 1000}; assert relative difference of the median below a tolerance (start at 2-5% and tighten after observing). A large failure means the model is not scale-invariant (a property to document), or a dtype/overflow issue.
  - M2 shift equivariance: `forecast(y + d)` vs `forecast(y) + d` on a non-count series, same tolerance logic.
  - M3 constant series: a flat series should give a near-flat median at the constant and a narrow band; no NaN.
  - M4 strong weekly seasonality: the existing `test_real_model.py` sine fixture (period 7) can additionally assert the median's 7-day periodicity is preserved (e.g. correlation of median with the input's last 28-day pattern > 0.9).
  - M5 robustness (cheap version of MR-9): perturb the last value by 1% of the series' range; the 1-step median must move by less than k x that perturbation. Skip the adversarial search (heavy, optional).
  - M6 truncation monotonicity of uncertainty (soft): widths of the 80% band at h=28 should be >= widths at h=1 on smooth fixtures. This is a sanity expectation, not a theorem; treat failures as findings.
- MRs on the scorer are exact, not approximate (question 2 P6), so they live in default CI.

### Gaps
- No paper found that publishes MRs for a pretrained time-series foundation model; tolerances for M1-M6 must be set empirically on the first runs.
- I did not fetch Segura et al. 2016 ("A Survey on Metamorphic Testing", IEEE TSE) or the full Nasr et al. 2023 paper; only the abstract of the latter.
- Timestral's input normalization (which decides whether M1/M2 should hold exactly or approximately) is not described in `docs/research/timestral-model.md`; I found no source on it.

## 4. Statistical acceptance tests before publishing, and thresholds without flaky tests

### Takeaway
Split acceptance checks into (a) deterministic tests in pytest that use recorded fixtures and the stub model, which can never flake, and (b) a runtime gate in the daily job on real outputs, whose thresholds come from binomial acceptance regions sized to the sample, with "warn" vs "fail" bands like the Basel traffic light. Never put a statistical test of the real model in the default pytest run.

### Cited Findings
- Basel/VaR backtesting traffic light: zones defined by the cumulative binomial probability of observing up to x exceptions; red where it reaches 99.99%, yellow from 95% to below 99.99%, green below; only too many failures reject. [MathWorks: VaR backtesting overview](https://www.mathworks.com/help/risk/overview-of-var-backtesting.html)
- Kupiec's proportion-of-failures test: LR_POF = -2 log( (1-p)^(N-x) p^x / [ (1-x/N)^(N-x) (x/N)^x ] ), asymptotically chi-square(1). Christoffersen's independence test LR_CCI checks whether exceptions cluster on consecutive days (chi-square(1)); conditional coverage LR_CC = LR_POF + LR_CCI (chi-square(2)). [MathWorks: VaR backtesting overview](https://www.mathworks.com/help/risk/overview-of-var-backtesting.html)
- Computed in this session (scipy `binom.cdf`), the traffic-light cutoffs for N = 250, p = 0.01: P(X <= 4) = 0.892, P(X <= 5) = 0.959, P(X <= 9) = 0.9997, P(X <= 10) = 0.9999, i.e. green 0-4, yellow 5-9, red 10+, consistent with the MathWorks definitions above. (Reproduce with `scipy.stats.binom.cdf(range(3, 11), 250, 0.01)`.)
- Computed in this session (scipy `binom.ppf` at 0.025/0.975 and 0.005/0.995), the acceptance regions for empirical coverage if hits were independent:
  - nominal 80%: n=30 -> 95% region [0.63, 0.93], 99% region [0.60, 0.97]; n=60 -> [0.70, 0.90] / [0.67, 0.92]; n=120 -> [0.72, 0.87] / [0.70, 0.89]; n=250 -> [0.75, 0.85] / [0.73, 0.86].
  - nominal 50%: n=30 -> [0.33, 0.67] / [0.27, 0.73]; n=60 -> [0.37, 0.63] / [0.33, 0.67]; n=120 -> [0.41, 0.59] / [0.38, 0.62]; n=250 -> [0.44, 0.56] / [0.42, 0.58].
- aseri's own backtest: over 121 daily origins the 8-in-10 band held 72-87% of real values; median error 17-36% below naive on 8 of 9 series; Brent ties naive; "indicative only (overlapping origins, unknown training cutoff)". The spike notes the bootstrap "ignores the overlap between neighbouring origins' ... target windows, so the CIs are somewhat optimistic." (local: spec 6.2, `docs/research/spike-timestral-backtest.md`)
- Breck Infra 4: loose thresholds for slow degradation, tighter thresholds when comparing to the previous version's predictions for sudden changes. Monitor 2: thresholds need tuning to balance false positives and negatives. [Breck et al. 2017](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
- Uber's automatic model evaluation compares median wMAPE with thresholds for the least accurate wMAPE and median bias. [Uber Engineering: Omphalos](https://www.uber.com/blog/omphalos/)

### Inferences
- Tier A, deterministic (default pytest, stub model or recorded fixtures, cannot flake):
  - A1 Backtest machinery test: on a synthetic series where the truth is known (e.g. i.i.d. normal noise around a constant, and a stub model that outputs the true normal quantiles), run the score stage over many origins with a fixed `np.random.default_rng(seed)`; assert coverage of 50%/80% falls inside the 99% binomial region for that n and that WIS is close to the analytic expected value. This proves the coverage/WIS/backtest plumbing, not the model. Source: binomial regions above.
  - A2 Skill machinery test: a stub model that returns the naive forecast must score a relative MAE of exactly 1.0 vs naive; a stub that returns the truth must score 0 WIS and coverage 1.0. Source: [Breck Model 5](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf).
  - A3 Sanity-bound function tests: unit tests for the gate's own predicates with hand-built good and bad forecasts.
- Tier B, the pre-publish gate in `daily.yml` (real model, real data; outcome is warn or fail per spec 6.3's failure policy, never a flaky unit test):
  - B1 numerical: every quantile finite; counts >= 0; quantiles non-decreasing (Breck Monitor 5; hubValidations `value_col_non_desc`).
  - B2 sanity vs history (my proposal; no source gives specific k): median at every horizon within [min_365 - k*range_365, max_365 + k*range_365] with k = 0.5 to fail and a tighter band to warn; 80% band width at h=1 not more than m times the series' recent typical daily change (e.g. 28-day median absolute day-over-day change) and not exactly 0. Calibrate k and m by running the gate over the 120-day backfill: choose the loosest value that passes every backfill day, then the warn band at the 99th percentile. This uses the series' own history, so it is a data-derived schema in the sense of [Breck Data 1](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf).
  - B3 stability vs yesterday (Breck Infra 4, "compare predictions to the previous version ... tighter thresholds"): for target dates covered by both today's and yesterday's forecast, the change in median should be explainable by the new observation; warn if |median_today - median_yesterday| at the same target date exceeds, say, 3x the newest day-over-day move. Warn only; regime shifts (Hormuz) are real.
  - B4 input drift (Breck Monitor 2): the validate stage's plausible-range check plus a robust z-score of the newest value against the last 365 days (median/MAD) to label, not block, outliers. Publishing an extreme but real value is correct; the page should show it.
  - B5 schema validation of every published file (question 6); fail.
- Tier C, statistical acceptance on the accumulating record (score stage; question 9): traffic-light zones by binomial CDF, per series and bucket.
- Thresholds without flakiness, in practice:
  1. Anything random in a test uses a fixed seed (`np.random.default_rng(0)`), and Hypothesis is derandomized on CI.
  2. Anything that depends on the real model or on live data is not a pytest assertion; it is either `slow` (opt-in) or a runtime gate with warn/fail bands.
  3. Tolerance on a rate = binomial acceptance region for the actual n, at 99% (fail) and 95% (warn), widened when hits are autocorrelated. With daily origins and h up to 28, consecutive hits are strongly dependent, so the effective n is far smaller than the count. Use one origin per week per horizon (as the record dots in spec 6.4 already do) or Christoffersen's independence test to detect clustering.
  4. The scout keep rule's 0.70-0.90 window for 80% coverage (spec 6.5) corresponds to roughly the 99% binomial region at n of about 60-120 independent hits; at n = 30 the 99% region is wider, [0.60, 0.97]. That window is too tight for the `min_n_to_display: 30` stage if read as a pass/fail test.

### Gaps
- No source found that gives standard values for "median within k times the historical range" or band-width sanity ratios; the numbers above are proposals to calibrate on the backfill.
- I did not find a citable source on the effective sample size of overlapping multi-horizon coverage hits; the "use weekly origins" rule is my inference from the spike's own caveat and the Christoffersen test's purpose.
- I did not fetch Kupiec (1995) or Christoffersen (1998) originals; formulas are from the MathWorks documentation.

## 5. Golden/regression tests on model outputs, and a model too large for CI

### Takeaway
Keep the current split (stub model in default CI, real model behind `slow`) and add one golden-output test for the real model on a frozen fixture with a numeric tolerance, run on a schedule and whenever torch/timestral/weights pins change. The daily job itself is the real-model integration test, so its pre-publish gate carries most of the weight.

### Cited Findings
- Breck Infra 1 asks for reproducible training; Infra 3 endorses fast integration tests with "a simpler model" backed by less frequent runs "with a setup that more closely mirrors production"; Infra 6 asks that models be canaried before serving. [Breck et al. 2017](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
- Breck Infra 4: compare to the previous version with tight thresholds to catch sudden changes. [Breck et al. 2017](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
- Local: `forecast.py` pins `WEIGHTS_REVISION = "9874d252..."` and reads back the installed timestral commit (`PACKAGE_COMMIT`); `pyproject.toml` pins timestral to commit `a534bdbd...` and torch from the CPU index; `test_real_model.py` skips when the weights are not cached; spec 6.3 caches the 837 MB weights with `actions/cache` keyed by the model revision.

### Inferences
- G1 golden output (slow, opt-in): run the pinned model on a committed fixture (e.g. the first 2,000 days of the recorded GPR file and the 400-day sine already in `test_real_model.py`), store `quantiles` as a small `.npy` or CSV (28 x 21 floats, a few KB), and assert `np.allclose(actual, golden, rtol=1e-4, atol=1e-6)`. Exact equality is too strict across CPU builds; a tolerance this tight still catches any change of weights, preprocessing, context handling or quantile ordering. Regenerate the golden file only together with a MODEL_ID/weights change, in the same commit (the comment in `forecast.py` already says a change to these is a different model).
- G2 when to run the slow tier: a separate workflow (`model-check.yml`) on `workflow_dispatch`, weekly cron, and on pull requests that touch `pyproject.toml`, `uv.lock` or `forecast.py`, reusing the same `actions/cache` key for the weights. CPU-only is fine: the daily job already runs 9 series on CPU.
- G3 "same answer as the archive" regression (cheap, real model, slow tier): re-forecast one archived live reference date from the archived observation vintage and assert it reproduces the archived quantiles within the G1 tolerance. This proves provenance (inputs + model pins reproduce the published numbers), which is the strongest form of "the numbers make sense" for a reader who wants to audit them.
- G4 stub fidelity: keep the stubs honest by asserting in the slow tier that the real model returns the same output interface the stubs mimic (`quantile_levels` length 21, tensor shape `(1, 1, h, 21)`), as `test_real_model.py` partly does. If Timestral's API changes, the stubs would otherwise keep passing.
- Snapshot tests of published JSON (golden files of `test_cli.py` output) are optional; they duplicate the explicit assertions already in `test_publish.py` and churn on every schema addition.

### Gaps
- I did not fetch a source on CPU floating-point nondeterminism across PyTorch versions; the rtol choice is a proposal to confirm by running G1 twice on two runners.

## 6. Validating published data against schemas and data contracts in CI

### Takeaway
JSON Schema (Draft 2020-12, the dialect OpenAPI 3.1 uses) catches shape and type errors, but formats are not checked unless asked, and the invariants that matter most (ordered quantiles, horizon/date consistency, cross-file agreement) need small custom checks modeled on hubValidations. Validate the web test fixtures with the same schemas so the web tests cannot drift from what the pipeline publishes.

### Cited Findings
- python-jsonschema supports `Draft202012Validator` (and older drafts); `validate()` picks the draft from `$schema`; `iter_errors(instance)` yields every error; the `format` keyword is informational by default ("no validation is done") unless a format checker is passed, e.g. `format_checker=Draft202012Validator.FORMAT_CHECKER`, and some formats silently pass if an optional dependency is missing; `$ref` across files is resolved via a `referencing` registry (`resolver` is deprecated since 4.18.0). [python-jsonschema: validation](https://python-jsonschema.readthedocs.io/en/stable/validate/)
- hubValidations `validate_submission()` checks include `colnames`, `col_types`, `valid_vals`, `rows_unique`, `req_vals` (all required task-ID/output-type combinations present), `value_col_valid`, and `value_col_non_desc` (quantile monotonicity); some are early-return errors, others failures. Derived task IDs such as `target_end_date` vs `horizon` are not validated by the standard checks; the docs point to the optional `opt_check_tbl_horizon_timediff()`. [hubValidations validate_submission](https://hubverse-org.github.io/hubValidations/articles/validate-submission.html)
- pandera `DataFrameSchema` checks (`in_range`, `gt`, `isin`, ...) can validate DataFrames and generate Hypothesis test data from the same schema. [pandera data synthesis](https://pandera.readthedocs.io/en/stable/data_synthesis_strategies.html)
- Breck Data 1: encode expectations as a schema so they can be checked automatically, in training and serving. [Breck et al. 2017](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)

### Inferences
- S1 schema test in pytest: after `test_cli.py`'s end-to-end run, walk the output `api/v1/` tree and validate every file against `schemas/*.schema.json` with `Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)`, collecting all errors via `iter_errors`. The same function is the publish-stage gate in `daily.yml` (spec 6.3 step 6), so the test and the production check share code. Add `jsonschema` (and `rfc3339-validator` if `date-time` formats are used) as a runtime dependency since publish needs it.
- S2 fixture contract: validate `web/src/fixtures/*.json` with the same schemas in pytest (no new JS dependency). This turns "the web tests use a realistic fixture" into a checked fact; when a schema changes, stale fixtures fail.
- S3 Hubverse-equivalent checks on the round file (Python, a few lines each, mirroring the R checks rather than calling R): required columns and types; unique `(reference_date, target, horizon, output_type_id)`; all 21 `output_type_id` present for each `(target, horizon)`; values non-decreasing in `output_type_id`; `target_end_date == reference_date + horizon` (the derived-ID check hubValidations does not run by default). Optional: run the real `hubValidations` in an R job monthly, since the archive is meant to be Hubverse-compatible.
- S4 cross-file contract (catches the chart-bug class at the data level): `series.json`'s `last_observation` == last date in `actuals.json` == `latest.json` `reference_date` (unless stale); `forecasts.json` index lists exactly the dated files present; `replay.json` levels are the page's five and each equals the 21-level file at that level; `scores.json` `n` <= number of resolved live forecasts.
- S5 immutability contract: a test that publishes twice with new data and asserts every pre-existing `forecasts/{reference_date}.json` is byte-identical (spec 6.6 "immutable"; append-only archive).
- S6 OpenAPI: validate `openapi.json` itself and that every path it lists exists in the built tree. Optional unless the OpenAPI file is hand-edited.
- pandera is optional here: the round file is small and the S3 checks are a handful of pandas lines. It becomes worth it only if pandera's Hypothesis strategies replace hand-written generators for P1-P3.

### Gaps
- I did not find a Python port of hubValidations in this session; the docs page mentions none.
- I did not verify ajv/OpenAPI tooling for validating fixtures on the TypeScript side; S2 avoids needing it.

## 7. Testing scoring code against reference implementations and worked examples

### Takeaway
Test aseri's WIS three ways: a published worked example (scoringutils docs), an exact identity (interval form = pinball-loss form, which this session verified numerically on aseri's 21 levels), and algebraic properties. Do not trust a single reference library blindly: scoringrules 0.11.0's non-numba WIS has an open bug that a cross-check would have imported as a "golden" value.

### Cited Findings
- WIS definition (scoringutils docs): WIS = (1/(K + 1/2)) x (w0 |y - m| + sum_k w_k IS_alpha_k), default w_k = alpha_k/2, w0 = 1/2; IS_alpha = (u - l) + (2/alpha)(l - y) 1(y < l) + (2/alpha)(y - u) 1(y > u); intervals must be symmetric around the median. [scoringutils `wis()`](https://epiforecasts.io/scoringutils/reference/wis.html); same IS formula in [scoringrules interval API](https://frazane.github.io/scoringrules/api/interval/).
- Bracher, Ray, Gneiting, Reich (2021): WIS is a special case of the quantile score and can be written as an average of pinball losses (their Eq 4); for large K with equally spaced alphas it approximates the CRPS; WIS and CRPS reduce to absolute error for a point forecast; WIS decomposes into interval widths (sharpness) and penalties (calibration), with over/under-prediction shown separately. [Bracher et al. 2021, PLOS Comp Biol](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618)
- Bracher et al.'s worked example: forecasts F = negative binomial (mean 60, size 4) and G (mean 80, size 10), observation y = 190, with WIS(F, 190) = 103.9 and WIS(G, 190) = 87.8 (and log scores -9.37, -9.69). [Bracher et al. 2021](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618)
- scoringutils' documented example: `observed = c(1, -15, 22)`, `predicted = rbind(c(-1,0,1,2,3), c(-2,1,2,2,4), c(-2,0,3,3,4))`, `quantile_level = c(0.1, 0.25, 0.5, 0.75, 0.9)` gives `wis = 0.36, 15.34, 19.14`. [scoringutils `wis()`](https://epiforecasts.io/scoringutils/reference/wis.html)
- scoringrules docs example: `interval_score(0.1, 0.0, 0.4, 0.5)` returns 0.4. [scoringrules interval API](https://frazane.github.io/scoringrules/api/interval/)
- Verified in this session: an independent Python implementation of the pinball form, (2/(2K+1)) x sum over the 2K+1 levels of pinball loss, reproduces scoringutils' 0.36, 15.34, 19.14 exactly; and on aseri's 21 levels (K = 10, alphas 0.02, 0.1, 0.2, ..., 0.9) the interval form and pinball form agree to 6 decimals on random ordered quantile vectors. `scoringrules.interval_score(0.1, 0.0, 0.4, 0.5)` returned 0.4.
- Verified in this session: `scoringrules` 0.11.0 (latest release, 2026-06-06) `weighted_interval_score` on the same scoringutils example returns 0.56, 12.34, 15.94, not 0.36, 15.34, 19.14. Its core code does `WIS += w_median * median` instead of `w_median * |obs - median|`. The bug is tracked as open issue #140, "weighted_interval_score adds w_median * median instead of w_median * |obs - median| on all non-numba backends". [scoringrules issue #140](https://github.com/frazane/scoringrules/issues/140), [source `core/interval/_score.py`](https://github.com/frazane/scoringrules/blob/main/scoringrules/core/interval/_score.py), [scoringrules release list](https://github.com/frazane/scoringrules/releases). An earlier closed issue was titled "Interval scores are not tested correctly". [scoringrules issue #81](https://github.com/frazane/scoringrules/issues/81)
- Could not reproduce Bracher's 103.9 / 87.8: with scipy's negative binomial quantiles (`nbinom(size, size/(size+mean)).ppf`) and the 23-quantile set (alphas 0.02, 0.05, 0.1, ..., 0.9) this session got 105.26 / 88.90 (105.80 / 89.46 with interpolated quantiles). The article's equations are images and the quantile set used for the example is not stated in the text, so the mismatch is unexplained. [Bracher et al. 2021](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618)
- Nixtla `utilsforecast.losses` offers `mqloss`, `quantile_loss`, `coverage`, `calibration`, `mase`, `rmae`, `scaled_crps` as a second independent Python implementation. [utilsforecast losses](https://nixtlaverse.nixtla.io/utilsforecast/losses.html)

### Inferences
- W1 golden example (pytest, default CI, no new dependency): the scoringutils example above, asserting `[0.36, 15.34, 19.14]` with `pytest.approx(abs=1e-9)`. Note it uses 5 levels (K = 2), so aseri's scorer must accept any symmetric level set, not hard-code 21.
- W2 identity test (Hypothesis): for random ordered 21-quantile vectors and y, `wis_interval_form(y, q) == pytest.approx(wis_pinball_form(y, q))`. Two independent formulas agreeing is close to a proof of each; this would have caught the scoringrules bug (its median term breaks the identity).
- W3 algebraic properties: question 2 P6 (non-negativity, zero iff perfect, point forecast = absolute error, shift invariance, scale equivariance).
- W4 hand-computed tiny cases: y inside all intervals (WIS = weighted widths only), y below all (underprediction only), y above all (overprediction only); assert the three decomposition components sum to the total, matching scoringutils' `separate_results` / Bracher's width + penalty decomposition.
- W5 coverage and MASE: coverage at 80% uses levels 0.1 and 0.9, at 50% uses 0.25 and 0.75 (assert the level lookup, a classic off-by-one); MASE with seasonal naive scale on a series where the model equals seasonal naive gives exactly 1. Cross-check against `utilsforecast.losses.mase` / `coverage` only in an optional test, since utilsforecast is an extra dependency.
- W6 do not use as goldens: Bracher's 103.9 / 87.8 (not reproducible from the text) and scoringrules 0.11.0 `weighted_interval_score` without numba (issue #140). If scoringrules is used as an oracle, pin a version that fixes #140 or compare only `interval_score`.
- W7 vintage test: scoring uses a stated observation vintage (spec 6.3); a test where GPR revises a value after the target date must show the score computed against the declared vintage, and a re-score against a newer vintage must be recorded separately, not overwrite.

### Gaps
- R scoringutils itself was not run (no R in this session); its example values are taken from its rendered docs page and confirmed only by an independent Python computation.
- properscoring was not checked; it targets CRPS for ensembles/Gaussians rather than quantile WIS.
- Whether scoringrules' numba backend gives correct WIS was not tested (numba was not installed).

## 8. Chart correctness: asserting geometry, and snapshot/visual regression

### Takeaway
The recent bug (history drawn as a 7-day average, forecast continuing from the daily value) is a geometry contract between two drawn marks, and it is testable without screenshots because `paintChart` takes an injected `plot` function: record the pixels, then assert that the forecast's first vertex coincides with the drawn current value. Visual regression with Vitest 4 `toMatchScreenshot` is available but environment-sensitive; keep it optional.

### Cited Findings
- Local: `paintChart(plot, chart, forecast, color)` draws the median polyline starting at `[xo, y(last)]` with `last = values[origin]`, the daily dots `square(plot, x(day), y(values[day]), ...)` for `first..origin`, the 7-day average as a gold polyline, and a gold marker at `y(averages[origin])`; `Plot = (x, y, color) => void`. `PixelForecastChart.test.tsx` stubs `getContext` with `clearRect`/`fillRect` no-ops, so no current test sees what is drawn. (`web/src/lib/chart.ts`, `web/src/components/PixelForecastChart.test.tsx`)
- Vitest 4 added visual regression testing in browser mode: `await expect(element).toMatchScreenshot(name)` compares against a committed baseline with a configurable threshold (the guide's example uses the `pixelmatch` comparator); it needs a browser provider package (e.g. `@vitest/browser-playwright`); the official guide warns rendering is not deterministic across environments and recommends a standardized environment; browser mode became stable in Vitest 4.0. [Vitest visual regression guide](https://main.vitest.dev/guide/browser/visual-regression-testing.md), [Vitest 4 release post](https://cn.vitest.dev/blog/vitest-4), [InfoQ on Vitest 4](https://www.infoq.com/news/2025/12/vitest-4-browser-mode)

### Inferences
- V1 geometry test of the bug (Vitest, jsdom is enough because `paintChart` never touches the canvas itself):
  ```ts
  const pixels = new Map<string, string>()            // "x,y" -> last colour plotted
  const plot = (x: number, y: number, c: string) => pixels.set(`${x},${y}`, c)
  const chart = chartLayout(forecast, 692)
  paintChart(plot, chart, forecast, colors)
  const xo = chart.x(chart.origin), yNow = chart.y(forecast.values[chart.origin])
  // the median line starts on the pixel of the value the chart shows as "now"
  expect(firstVertexOf(colors.pale)).toEqual([xo, yNow])
  ```
  Simpler variant without a helper: spy on `plot`, collect calls with `colors.pale`, take the one with the smallest x, assert it equals `[xo, yNow]`; and assert a `colors.label` dot covers the same pixel. This fails on the old bug (the forecast would start at the 7-day line's y, not the daily dot's). Source: local code; the principle is Breck's "encode expectations so they can be checked automatically" applied to the drawing.
- V2 "what is labelled is what is drawn": the readout text ("Daily value X", "7-day avg Y") for day d must equal `values[d]` / `averages[d]`, and for a forecast day must equal the median quantile at that step; drive it with `fireEvent.pointerDown` at `chart.x(d)` as the existing test does.
- V3 band geometry: for every column px > xo, the plotted 80% band's top y <= 50% band's top y <= median y <= 50% bottom <= 80% bottom (ordering survives interpolation and rounding); fast-check over random ordered quantiles (question 2 P7).
- V4 data-scale honesty: the y-axis tick labels from `valueTicks` must lie inside [lo, hi], and `valueScale` must include the 7-day line and the bands (already tested); add that the forecast median is never clipped off-chart, or that clipping is signalled, since the scale deliberately drops the 2% most extreme daily values.
- V5 optional visual regression: one `toMatchScreenshot` per breakpoint (280, 440, 692 px) of the chart with the committed fixtures, run in the Playwright provider inside a pinned container image. Mark optional: a pixel-art canvas is deterministic in principle, but fonts/antialiasing of the HTML labels around it are not, and V1-V4 already pin the semantics.

### Gaps
- I did not find published guidance specific to testing canvas chart geometry; V1-V4 rest on aseri's injected-`plot` design rather than an external source.
- The Vitest guide was read through search-result summaries and a docs mirror, not fully fetched; check the current option names (threshold, comparator) before writing V5.

## 9. Monitoring live calibration after deployment

### Takeaway
Treat the live record like a VaR backtest: per series and horizon bucket, count misses of the 50% and 80% ranges on non-overlapping origins, classify with binomial traffic-light zones (green/yellow/red), add Kupiec/Christoffersen tests once n is large enough, track quantile calibration across all 21 levels, and open a GitHub issue on red. Adaptive conformal correction exists but changes the published model, so it is a later decision.

### Cited Findings
- Traffic light zones from cumulative binomial probability (green below 95%, yellow 95% to 99.99%, red from 99.99%); Kupiec POF (chi-square(1)); Christoffersen independence (exception clustering, chi-square(1)); conditional coverage (chi-square(2)). [MathWorks: VaR backtesting overview](https://www.mathworks.com/help/risk/overview-of-var-backtesting.html)
- Breck Monitor 7: measure statistical bias of predictions on slices ("90% of predictions of probability 0.9 should in fact be positive"); judge quality as soon as labels arrive. [Breck et al. 2017](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
- Nixtla's `calibration` metric is the fraction of observations below the model's predictions, the quantile analogue of that bias check. [utilsforecast losses](https://nixtlaverse.nixtla.io/utilsforecast/losses.html)
- Adaptive conformal inference (Gibbs and Candès, 2021) wraps any point or quantile forecaster, re-estimates a single parameter over time, and "provably achieves the desired coverage frequency over long-time intervals" under arbitrary distribution shift. [Gibbs and Candès 2021](https://arxiv.org/abs/2106.00170)
- Amershi et al.: deployed inference is "continuously monitored for possible errors during real-world execution", and a human stays in the loop to spot-check errors. [Amershi et al. 2019](https://www.microsoft.com/en-us/research/uploads/prod/2019/03/amershi-icse-2019_Software_Engineering_for_Machine_Learning.pdf)
- Spec 6.4: live-only headline, minimum 30 resolved live forecasts before showing scores, weekly dots at 7 days ahead, coverage and WIS per bucket, say plainly when the model ties or loses to naive. (local spec)

### Inferences
- M1 rolling coverage zones (score stage, every run): for each series x bucket x level (50%, 80%), on the last N resolved live forecasts using one origin per 7 days (independent-ish hits), compute misses x and zone from `binom.cdf(x, N, 1 - nominal)` for too many misses and `binom.cdf(N - x, N, nominal)` for too few misses (over-wide bands are also miscalibration, and the 72-87% backtest coverage suggests under-coverage is the likelier failure). Write the zone into `scores.json` (the page can show it) and the run manifest.
- M2 alarm: red in any series opens or updates a GitHub issue (`gh issue create` from the workflow; the repo already uses GitHub Issues per `CLAUDE.md`); yellow only logs. Do not fail the daily job on calibration; the forecasts are still the honest output of the published model, and spec 6.4's wording rules already handle "the model is doing badly".
- M3 quantile calibration (PIT-style): for each of the 21 levels tau, the fraction of observations below the tau-quantile should be about tau; report the max absolute deviation per series and bucket, with the binomial region at that n as the tolerance. One number per series catches skew (e.g. medians systematically low) that the two central ranges miss.
- M4 skill monitor: rolling relative MAE and relative WIS vs naive per series (Breck Model 5); flag when the ratio's upper bound crosses 1 so the page can say "ties/loses to naive" from data, not by hand.
- M5 Kupiec and Christoffersen tests (optional, once N >= about 60 per bucket): a few lines with `scipy.stats.chi2.sf`; useful in the monthly scout report rather than on the page.
- M6 backtest vs live drift: compare live coverage to the retrospective coverage of the same series; a large gap is a sign of leakage in the backfill or a world change. Never pool the two (spec 6.4).
- M7 adaptive conformal inference: optional and later. It would change the published intervals, so per spec 6.5 it would need a new model ID suffix and a fresh live record.
- Tests for the monitor itself (default CI): feed synthetic hit sequences with known miss counts and assert the zone boundaries (e.g. N = 250, nominal 99%: 4 misses green, 5 yellow, 10 red, matching the Basel cutoffs computed above); assert one-origin-per-week subsampling picks the right rows.

### Gaps
- No forecasting-team blog (Uber, Amazon, Nixtla) found in this session that documents a specific rolling-coverage alarm design; the traffic-light design is borrowed from VaR backtesting.
- The ACI update rule was not read (only the abstract).

## Objective: the layered test plan for aseri (what to add, where, why)

### Takeaway
Ten small additions give most of the assurance: property tests on post-processing and scoring, a recording stub for no-leakage, schema + cross-file contract tests on the E2E output, a geometry test on `paintChart`, a golden real-model test in an opt-in workflow, a pre-publish sanity gate in `daily.yml`, and a traffic-light calibration monitor in the score stage. Only `hypothesis`, `jsonschema` and `fast-check` are new dependencies; visual regression, R hubValidations, pandera, utilsforecast cross-checks and adaptive conformal are optional.

### Cited Findings
- Fast integration tests with a simpler model plus less frequent production-like runs. [Breck Infra 3](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
- Bless-or-veto before serving; compare with the previous version. [Breck Infra 4](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf)
- Hypothesis is derandomized automatically on CI. [Hypothesis built-in profiles](https://hypothesis.readthedocs.io/en/latest/reference/api.html#built-in-profiles)
- Quantile monotonicity and horizon/date checks from Hubverse. [hubValidations](https://hubverse-org.github.io/hubValidations/articles/validate-submission.html)
- WIS golden example and identity. [scoringutils `wis()`](https://epiforecasts.io/scoringutils/reference/wis.html), [Bracher et al. 2021](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618)
- Binomial traffic light. [MathWorks VaR backtesting](https://www.mathworks.com/help/risk/overview-of-var-backtesting.html)
- Metamorphic relations for forecasters. [Dwarakanath et al. 2019](https://arxiv.org/abs/1907.06632)

### Inferences
Layer 1: unit and property tests (default `pytest` / `vitest`, seconds, every push)
| ID | Test | Proves | How | Source |
|---|---|---|---|---|
| P1 | quantiles ordered, finite, >= 0 for counts, for any model output | published bands are valid distributions; spec clamp rule works | Hypothesis arrays into a stub model -> `forecast()` + clamp; `@example` with NaN must raise | hubValidations `value_col_non_desc`; Breck Monitor 5 |
| P2 | horizon rows, 21 levels, `target_end_date = reference_date + h` | dates and shapes are right for all horizons | Hypothesis over history length and h in {7, 14, 28} | hubValidations `opt_check_tbl_horizon_timediff` note |
| W1-W5 | WIS golden example, interval = pinball identity, algebraic properties, decomposition, coverage-level lookup, MASE = 1 for seasonal naive | the record's numbers are computed right | pytest + Hypothesis; no reference library at runtime | scoringutils docs; Bracher 2021 |
| A1-A2 | score stage on synthetic truth: calibrated stub lands in the 99% binomial region; naive-vs-naive ratio = 1; truth scores 0 | coverage/skill plumbing is right | fixed `default_rng(0)`, many origins | binomial regions; Breck Model 5 |
| P7 | `forecastAt`, `valueScale`, `dayAt` properties | chart math never crosses bands or misplaces days | fast-check in Vitest | fast-check docs |
| V1-V3 | median line starts on the drawn current daily value; readout equals data; band order per column | the chart shows what the data says (the recent bug) | spy `plot` passed to `paintChart` | local `chart.ts` seam |
| Mon | traffic-light zone function on synthetic hit sequences | the alarm logic is right | pytest with Basel cutoffs (4 green, 5 yellow, 10 red at N = 250, 99%) | MathWorks VaR backtesting |

Layer 2: pipeline integration (default pytest, recorded fixture + stub, already exists in `test_cli.py`; extend)
| ID | Test | Proves | How | Source |
|---|---|---|---|---|
| P3 | recording stub: each forecast's context ends at its own reference date; a later run never changes earlier files | no leakage in backfill/batches; append-only | stub stores contexts; run twice with more data and a revision | GluonTS evaluation helper; spec 6.2 |
| S1 | every published JSON validates (Draft 2020-12, formats on) | the API contract holds | `Draft202012Validator(..., format_checker=...)`, `iter_errors` | python-jsonschema docs |
| S2 | web fixtures validate against the same schemas | web tests use real-shaped data | same function over `web/src/fixtures/*.json` | python-jsonschema docs |
| S3 | Hubverse-equivalent round-file checks | archive is valid Hubverse | pandas checks mirroring hubValidations | hubValidations |
| S4/P4 | cross-file agreement (catalog, latest, actuals, replay, index, scores) | one number, one value everywhere | assertions on the E2E output tree | local spec 6.6 |
| S5 | dated forecast files byte-identical after later runs | immutability promise | hash before/after | spec 6.6 |
| MR-code | unit change x1000, shuffled rows rejected or sorted, constant series no div-by-zero | no unit/ordering/edge bugs | stub model | Dwarakanath MR-5/6/7 |

Layer 3: real model, opt-in (`pytest -m slow`; `model-check.yml` weekly + on changes to `pyproject.toml`/`uv.lock`/`forecast.py`)
| ID | Test | Proves | How | Source |
|---|---|---|---|---|
| G1 | golden quantiles on frozen fixtures, rtol 1e-4 | pinned model + preprocessing unchanged | `.npy` golden regenerated only with a MODEL_ID change | Breck Infra 1 |
| G3 | re-forecast an archived live date from its archived vintage | published numbers are reproducible from provenance | read archive, rerun, compare | Breck Infra 1; spec 6.6 provenance |
| M1-M5 | scale/shift equivariance, constant series, seasonality kept, small-perturbation robustness | model behaves sensibly on transformed inputs | tolerances set from first runs; document failures as model properties | Dwarakanath et al. 2019 |
| G4 | real output interface matches the stubs | stubs stay honest | shape/levels assertions (extend `test_real_model.py`) | Breck Infra 3 |

Layer 4: pre-publish gate in `daily.yml` (real data, real model, every run; warn or fail per spec 6.3)
| ID | Check | Outcome |
|---|---|---|
| B1 | finite, ordered, non-negative counts | fail the series (skip, mark stale) |
| B2 | median within history-derived bounds; band width not 0 and not absurd vs recent daily moves; k, m calibrated on the 120-day backfill | fail beyond the loose bound, warn beyond the tight one |
| B3 | change vs yesterday's forecast for shared target dates | warn |
| B4 | newest input value robust z-score vs 365 days | label only |
| B5 | schema validation (S1 function) | fail the job (spec 6.3) |
| Perf | wall time per series in the manifest | warn on a jump (Breck Monitor 6) |

Layer 5: live monitoring in the score stage (every run, results in `scores.json` and the manifest)
- M1 traffic-light zones for 50%/80% coverage per series x bucket on weekly origins; M2 red opens a GitHub issue; M3 21-level calibration deviation; M4 rolling skill vs naive; M5 Kupiec/Christoffersen in the monthly scout report (optional); M6 live vs backtest coverage gap. Sources: [MathWorks VaR backtesting](https://www.mathworks.com/help/risk/overview-of-var-backtesting.html), [Breck Monitor 7 and Model 5](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/aad9f93b86b7addfea4c419b9100c6cdd26cacea.pdf).

Optional / heavyweight (mark as later):
- V5 Vitest 4 `toMatchScreenshot` visual regression in a pinned container ([Vitest guide](https://main.vitest.dev/guide/browser/visual-regression-testing.md)).
- Monthly R job running real `hubValidations` on the archive ([hubValidations](https://hubverse-org.github.io/hubValidations/articles/validate-submission.html)).
- pandera schemas and strategies for DataFrames ([pandera](https://pandera.readthedocs.io/en/stable/data_synthesis_strategies.html)).
- utilsforecast cross-check of MASE/coverage ([utilsforecast](https://nixtlaverse.nixtla.io/utilsforecast/losses.html)).
- Adaptive conformal recalibration, which would be a new model ID ([Gibbs and Candès 2021](https://arxiv.org/abs/2106.00170)).
- MR-9-style adversarial search ([Dwarakanath et al. 2019](https://arxiv.org/abs/1907.06632)).

Order of work I would suggest (my judgement): V1 (closes the known bug class) -> P1 + clamp implementation (spec rule not yet in code) -> W1-W5 before the score stage is written (test-first) -> S1/S2/S4 with the schemas -> P3 -> B1-B5 gate -> M1-M4 once live forecasts resolve -> G1/G3/M-tier workflow.

### Gaps
- Thresholds for B2/B3 and tolerances for G1/M1-M5 are proposals; they must be calibrated on aseri's own backfill and first real-model runs.
- The plan assumes scoring, schemas and clamping will be implemented as the spec describes; none exist in `pipeline/aseri/` today.
