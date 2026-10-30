# Modelling best practices for zero-shot probabilistic forecasting with pretrained time-series foundation models vs simple baselines (aseri, daily, 28 days, CPU)

Researched 2026-10-30. Scope: modelling only (models, baselines, ensembles, calibration, target, origin, transforms, covariates). Builds on, and does not redo, `docs/research/timestral-model.md`, `spike-timestral-backtest.md`, `spike-covariates.md` and `forecast-horizons.md`.

Conventions used below:
- **[CPU-OK]** means it fits aseri as is: about 9 daily series, one CPU job per day, a 4 vCPU / 16 GB GitHub runner, offline backtests on a laptop. **[NEEDS-MORE]** means it needs resources, data or licences aseri does not have.
- **†** marks a source I cite from prior knowledge and did not re-fetch on 2026-10-30 (URL and claim believed correct but not re-verified in this session). Everything without † was read in this session (abstract, HTML or docs page). "snippet only" means only a search-engine summary was seen.
- aseri facts come from the repo docs, cited by path.

## 1. Zero-shot foundation models vs strong statistical baselines on daily data: what benchmarks show, and when simple baselines win

### Takeaway
On the two large current benchmarks (fev-bench, GIFT-Eval) every recent pretrained model (Chronos-2, TiRex, TimesFM-2.5, Toto, Moirai-2, Chronos-Bolt, Timestral) beats seasonal naive, AutoETS, AutoARIMA, AutoTheta and their ensemble on aggregate, and GIFT-Eval says the edge is clearest from daily to yearly frequency; but a NeurIPS 2025 workshop study on 15 competition datasets finds the opposite (statistical ensembles ahead by 8% sCRPS and 20% MASE), and per-series failures are common, so aseri must keep scoring every series against naive, seasonal naive and a flat recent mean, as its own backtest already shows naive tying or beating Timestral on regime shifts (Hormuz) and a 28-day mean tying it on point accuracy (Suez).

### Cited Findings
- fev-bench has 100 tasks in 7 domains, 46 with covariates, scored by win rate and skill score with bootstrapped CIs, seasonal naive as the reference (skill 0) ([fev-bench, Shchur et al., arXiv 2509.26468](https://arxiv.org/abs/2509.26468)).
- fev-bench v2 probabilistic results (SQL, win rate % / skill %): Chronos-2 91.4 / 47.3; TiRex 82.7 / 42.6; TimesFM-2.5 77.6 / 42.2; Toto-1.0 70.2 / 40.7; Moirai-2.0 64.4 / 39.3; Chronos-Bolt 64.4 / 38.9; TabPFN-TS 63.0 / 39.6; Sundial-Base 46.0 / 33.4; statistical ensemble (SCUM: AutoETS+AutoARIMA+AutoTheta+AutoCES) 45.5 / 20.2; AutoARIMA 40.7 / 20.6; AutoTheta 27.1 / 5.5; AutoETS 33.7 / -26.8; Seasonal Naive 20.2 / 0.0; Naive 13.8 / -45.4; Drift 9.3 / -45.8 ([fev-bench HTML v2, Table 13](https://arxiv.org/html/2509.26468v2)).
- fev-bench point results (MASE, win % / skill %): Chronos-2 88.1 / 35.5; TiRex 76.9 / 30.0; TimesFM-2.5 75.1 / 30.2; Sundial 53.4 / 24.7; statistical ensemble 48.5 / 15.7; AutoARIMA 36.7 / 11.2; AutoTheta 34.9 / 11.0; AutoETS 33.2 / 2.3; Seasonal Naive 21.0 / 0.0; Naive 19.3 / -16.7 ([fev-bench HTML v2, Table 14](https://arxiv.org/html/2509.26468v2)).
- fev-bench verdict: "All pretrained models are substantially more accurate and faster than the best statistical approach (SCUM Ensemble)"; the statistical ensemble failed on 11 tasks and took a median 148.6 s per 100 series ([fev-bench HTML v2](https://arxiv.org/html/2509.26468v2)). fev-bench gives no per-frequency breakdown, so it says nothing specific about daily data (same source).
- The Chronos-2 report shows slightly different fev-bench numbers for the same models (Chronos-2 90.7% / 47.3%, TiRex 80.8 / 42.6, AutoETS 29.1 / -26.8, Seasonal Naive 14.5 / 0.0), so win rates depend on the model pool and benchmark version ([Chronos-2, arXiv 2510.15821 HTML](https://arxiv.org/html/2510.15821v1)).
- Timestral's own card (vendor-reported) puts Timestral-209M first on GIFT-Eval (MASE 0.658, CRPS 0.446), TIME and fev-bench (SQL skill 50.39 vs Chronos-2 47.28), with results merged into the official GIFT-Eval repo as zero-shot, "testdata_leakage: No" (`docs/research/timestral-model.md`, section 6).
- GIFT-Eval (original paper, older model generation): on daily data, CRPS normalised to seasonal naive = 1.00 is Moirai-Large 0.392, Chronos-Large 0.421, TimesFM 0.492, Auto_ARIMA 0.499, Auto_Theta 0.575; "from daily to yearly frequencies, foundation models consistently outperform other approaches"; deep models (PatchTST, iTransformer, TFT) win at minutely/hourly and in Web/CloudOps and Transport; overall Auto_Theta (1.41) is worse than seasonal naive; protocol is non-overlapping rolling windows over the last 10% of each series, metrics normalised by seasonal naive ([GIFT-Eval, Aksu et al., arXiv 2410.10393 HTML](https://arxiv.org/html/2410.10393v2); code [SalesforceAIResearch/gift-eval](https://github.com/SalesforceAIResearch/gift-eval)†).
- GIFT-Eval also reports that TimesFM and Chronos (v1) "significantly declined" at long horizons from recursive error accumulation, and PatchTST had the best long-horizon CRPS ([GIFT-Eval HTML](https://arxiv.org/html/2410.10393v2)).
- On the GIFT-Eval aggregate, Sundial scores CRPS 0.5590 and MASE 0.7502 relative to seasonal naive 1.0, as reported in the t0 paper (snippet only) ([t0, arXiv 2609.24559](https://arxiv.org/abs/2609.24559)).
- Counter-evidence: on 15 large public forecasting-competition datasets, "statistical models and their ensembles outperform existing foundation forecasting models by more than 8.2% in sCRPS and more than 20% in MASE"; the authors blame small evaluation sets, poor treatment of sample size, weak statistical baselines and train/test overlap for overstated FM gains ([Olivares et al., NeurIPS 2025 workshop, arXiv 2509.19465](https://arxiv.org/abs/2509.19465)).
- Older counter-evidence: a Nixtla experiment reported an AutoARIMA+AutoETS+AutoCES+DynamicOptimizedTheta ensemble about 10% better than the original Chronos (T5, 710M) on CRPS and MASE, and about 5x faster (claim read via a mirror of the commit, vendor self-report) ([Nixtla commit 6ec87cf](https://github.com/Nixtla/nixtla/commit/6ec87cf67d666b0907860847375555bd87e2bef6)).
- Break-even study on 30 datasets: FMs (Chronos, Moirai, Lag-Llama) beat Naive/ETS/ARIMA/XGBoost at every training fraction on 15 of 30 datasets; on 6, zero-shot FMs lose to classical methods even with only 21 to 2,768 training samples ([Tan Jerome and Simon, arXiv 2607.04919](https://arxiv.org/abs/2607.04919), code [nicolaisi/fm-breakeven](https://github.com/nicolaisi/fm-breakeven)).
- aseri's own rolling-origin backtest (52 weekly origins): Timestral-209M beats seasonal naive by 17 to 36% median error on 8 of 9 series, and the 80% band holds 72 to 87% of actuals; on Hormuz the last-value naive ties 209M at h=30 (MASE 0.94 vs 0.94) and beats it at h=60 (1.43 vs 1.60); on Suez the point forecast equals a flat 28-day mean (1-7 bucket MASE 0.60 vs 0.60) (`docs/research/spike-timestral-backtest.md`, TL;DR and tables).
- Applied Timestral projects show the same pattern: on stock prices Timestral MAPE equals naive (3.36% vs 3.39% live), and on quarterly bank data relative MASE vs AutoARIMA goes 0.91 at h=1 to 1.03 at h=8 (`docs/research/forecast-horizons.md`, table 1a, sources P1 and P6 there).
- Timestral is slow to adopt a new level after a jump: 16 steps after a level shift its error is 2.43x an oracle referee's at 209M ([off-the-prior](https://github.com/Cuuper22/off-the-prior), via `forecast-horizons.md`).
- Licences matter for the candidate pool: Chronos-2 and TimesFM-2.5 are Apache-2.0, Moirai-2.0 is CC-BY-NC-4.0, TiRex uses a custom licence (`docs/research/timestral-model.md`, section 3); TimesFM 3.0 weights are under a "non-commercial, non-production" licence while weights up to 2.5 are Apache-2.0 ([google-research/timesfm README](https://github.com/google-research/timesfm)).

### Inferences
- Simple baselines win when (a) the series is close to a random walk (prices: naive), (b) the signal is mostly level plus noise with no exploitable dynamics (Suez: a flat 28-day mean), or (c) a recent regime break makes the long context misleading (Hormuz: last value). All three cases appear among aseri's 9 series, so a per-series, per-horizon "beats the best simple baseline" gate is necessary, not just aggregate benchmark ranks.
- The conflict between fev-bench/GIFT-Eval and Olivares et al. is mostly about dataset choice and leakage; neither has a daily geopolitical/news subset, so aseri's own backtest is the only evidence that transfers. Leakage cannot be ruled out for Timestral (unknown training cutoff, `spike-timestral-backtest.md`), so keep a live, post-release scorecard separate from the backtest.
- For a 28-day horizon, Timestral, Chronos-2 and TimesFM-2.5 all decode in one pass (no recursive rollout), which avoids the long-horizon decay GIFT-Eval saw in older recursive models.
- [CPU-OK] Timestral-209M, Chronos-2 (120M) and TimesFM-2.5 (200M) inference on 9 series; statsforecast baselines. [NEEDS-MORE] Toto-2.0-2.5B (2.5B params, from the Timestral card) is heavy for a daily CPU runner; TimesFM 3.0 and Moirai-2 are licence-blocked for any commercial use.

#### Implement and test in Python
```python
# Baselines with the same rolling origins as the Timestral backtest (52 origins, step 7, h=28).
from statsforecast import StatsForecast
from statsforecast.models import Naive, SeasonalNaive, AutoETS, AutoTheta, AutoARIMA
sf = StatsForecast(models=[Naive(), SeasonalNaive(season_length=7), AutoETS(season_length=7),
                           AutoTheta(season_length=7), AutoARIMA(season_length=7)], freq="D", n_jobs=-1)
# df: columns unique_id, ds, y. Truncate long histories like fev-bench does (stat models capped at 1000 steps).
cv = sf.cross_validation(df=df.groupby("unique_id").tail(1000 + 52 * 7 + 28), h=28, step_size=7,
                         n_windows=52, level=[50, 80, 98])   # lo-80/hi-80 = q0.1/q0.9, lo-98/hi-98 = q0.01/q0.99
```
- Score every model with the metrics aseri already uses (MASE with lag-7 scale, WQL over q0.1..q0.9, cov50/cov80), add a flat 28-day mean, and report the paired bootstrap CI over origins, as fev-bench does over tasks.
- Gate per series and horizon bucket: publish the FM only where its WQL beats min(naive, snaive, mean28, AutoETS) with the CI excluding 0; otherwise publish the baseline or the ensemble (section 2).

### Gaps
- No independent daily-frequency numbers for the newest models (Timestral, Chronos-2, TimesFM-2.5, TiRex) on GIFT-Eval or fev-bench were found; GIFT-Eval's per-frequency table in the paper covers only the 2024 generation.
- Moirai-MoE: not covered by anything I read in this session.
- I did not find which models and datasets Olivares et al. used (abstract only).

## 2. Ensembling: averaging quantiles of a foundation model with statistical models

### Takeaway
Equal-weight combination is the most robust single upgrade in the forecasting literature (M4, M5, COVID/FluSight hubs), and for quantile forecasts the usual operational choice is quantile averaging (Vincentization), which keeps the mean and is sharper than averaging probabilities; with only 2 to 4 members aseri should use the equal-weight mean of quantiles, switch to the median only with 5 or more members, and pick between quantile averaging and probability averaging by backtested coverage, because aseri's bands are slightly too narrow on some series and too wide on others.

### Cited Findings
- M4: of the 17 most accurate methods, 12 were combinations of mostly statistical approaches; the two most accurate methods also got 95% intervals right, which the authors call the first methods to do so rather than "underestimating the uncertainty considerably" (secondary summaries of the paper) ([Makridakis et al. 2018, IJF 34(4)](https://ideas.repec.org/a/eee/intfor/v34y2018i4p802-808.html); [INSEAD summary](https://knowledge.insead.edu/operations/decision-makers-should-rely-hybrid-forecasting-models)).
- M5: the companion paper's abstract says combining forecasts, explanatory variables and special days "remain critical", and that simple local statistical methods may still be competitive for high-granularity data and for estimating the tails of the distribution (snippet only; indirect for the uncertainty track) ([Makridakis et al. 2022, "The M5 uncertainty competition", IJF 38(4)](https://ideas.repec.org/a/eee/intfor/v38y2022i4p1365-1385.html)).
- COVID-19 Forecast Hub: an untrained, equally weighted median of all component forecasts is recommended because component forecasts are sometimes misaligned with the data and relative skill shifts over time; trained weights help only when some contributors have a stable track record; these experiments set the Hub's ensemble method ([Ray et al., arXiv 2201.12387](https://arxiv.org/abs/2201.12387)).
- The COVID-19 mortality ensemble was among the most consistently accurate forecasts compared with individual models ([Cramer et al. 2022, PNAS](https://www.pnas.org/doi/10.1073/pnas.2113561119)†, page returned 403, claim from prior knowledge).
- Quantile averaging vs probability averaging: both give the same mean, but the quantile average is always sharper (lower variance) than the probability average ([Lichtendahl, Grushka-Cockayne and Winkler 2013, Management Science](https://pubsonline.informs.org/doi/10.1287/mnsc.1120.1667)); a 50-year review summarises Lichtendahl et al. and Busetti (2017) as finding quantile averaging "overall a preferable and viable approach", especially when individual forecasts are biased ([Wang et al., "Forecast combinations: an over 50-year review", arXiv 2205.04216](https://arxiv.org/abs/2205.04216)).
- Averaging probabilities (linear pool) across members "is known to yield underconfident forecasts that lack sharpness" (search snippet; the result list held [arXiv 2204.02291](https://arxiv.org/abs/2204.02291) and [arXiv 2106.09512](https://arxiv.org/abs/2106.09512), and I did not confirm which one the sentence is from); the linear pool of calibrated forecasts is itself uncalibrated (overdispersed) ([Ranjan and Gneiting 2010, JRSSB](https://doi.org/10.1111/j.1467-9868.2009.00726.x)†).
- The hubEnsembles package (R) implements both quantile averaging and linear pooling for forecast hubs and analyses real influenza forecasts (results not read: 403) ([Shandross et al., medRxiv 2024.06.24.24309416](https://www.medrxiv.org/content/10.1101/2024.06.24.24309416v1)).
- FM portfolios: an ensemble or model-selection portfolio of small pretrained models is competitive with single large models at far fewer parameters, and ensembling/selection is more compute-efficient than test-time fine-tuning (ICLR 2026) ([Kayaalp et al., arXiv 2510.06419](https://arxiv.org/abs/2510.06419)).
- Stacking: across 33 ensemble methods on 50 datasets, stacking consistently improves accuracy but no single stacker is best everywhere ([Bosch et al., AutoML 2025, arXiv 2511.15350](https://arxiv.org/abs/2511.15350)).
- On electricity load, bagging, regression stacking and residual models on top of FMs beat standalone FMs, with near-nominal interval coverage ([Modi and Pan, arXiv 2508.16641](https://arxiv.org/abs/2508.16641); single dataset, no code link).
- Statistical-only ensembles on fev-bench (SCUM) reach skill 20.2% vs 47.3% for Chronos-2, so a stats-only ensemble does not replace an FM there ([fev-bench HTML v2](https://arxiv.org/html/2509.26468v2)).
- A live public precedent: flusight-fm runs a zero-shot ensemble of Chronos-2, TimesFM 2.5, Moirai 2.0 and Timestral in a weekly GitHub Action for the CDC FluSight hub ([CDDEP-DC/flusight-fm](https://github.com/CDDEP-DC/flusight-fm), via `forecast-horizons.md`).

### Inferences
- With 2 to 4 members, the median of quantiles equals the mean (2 members) or is erratic (3 to 4); the Hub's median argument is about robustness to a broken member among many. For aseri, use the equal-weight mean of quantiles at each of the 21 levels; it preserves monotonicity because an average of non-decreasing quantile functions is non-decreasing.
- Candidate members [CPU-OK]: Timestral-209M, Chronos-2 (Apache-2.0), TimesFM-2.5 (Apache-2.0), and one statistical model (AutoETS or AutoTheta with season 7). Different pretraining corpora make Chronos-2 and TimesFM errors partly independent of Timestral's; adding AutoETS adds a structurally different, local model that adapts to recent level shifts.
- Calibration direction decides the pooling rule: GPR and parts of Hormuz under-cover (cov80 0.67 to 0.69 at long horizons), Suez over-covers at h=60/90 (0.93 to 0.95) (`spike-timestral-backtest.md`). Quantile averaging narrows relative to the linear pool; the linear pool widens. Test both and keep the one with better WQL and coverage closer to nominal per series. Post-hoc conformal (section 3) can fix either residual bias.
- Trained weights (inverse-WQL over a trailing window) are only worth it if one member is consistently better over many origins; with 52 weekly origins per series that evidence is thin, matching the Hub's advice to stay untrained.
- [NEEDS-MORE] multi-layer stacking (AutoGluon style) needs many series and windows to train the stacker; not suitable for 9 series.

#### Implement and test in Python
```python
import numpy as np
LEVELS = np.array([.01, .05, .1, .15, .2, .25, .3, .35, .4, .45, .5, .55, .6, .65, .7, .75, .8, .85, .9, .95, .99])

def vincentize(qs_list, w=None):            # each qs: (h, 21) on LEVELS
    return np.average(np.stack(qs_list), axis=0, weights=w)

def linear_pool(qs_list, n=20000, rng=np.random.default_rng(0)):
    # shortcut: tails beyond q0.01/q0.99 are clipped, upgrade with a parametric tail if 98% bands matter
    H = qs_list[0].shape[0]
    m = rng.integers(len(qs_list), size=n); u = rng.uniform(LEVELS[0], LEVELS[-1], size=n)
    out = np.empty((H, len(LEVELS)))
    for h in range(H):
        draws = np.array([np.interp(u[i], LEVELS, qs_list[m[i]][h]) for i in range(n)])
        out[h] = np.quantile(draws, LEVELS)
    return out
```
- Map statsforecast `lo-X`/`hi-X` columns to LEVELS (lo-80 = 0.1, hi-80 = 0.9, lo-98 = 0.01, ...) and fill missing levels by requesting more `level=` values (statsforecast intervals are Gaussian for ETS, so any level is available).
- Test: on the 52 origins, compare WQL, cov50, cov80 and the 98% band for each member, the quantile average and the linear pool; paired bootstrap over origins for the WQL ratio vs Timestral alone. Keep the ensemble only where the CI is below 1.

### Gaps
- No FluSight paper read in this session gives the numeric comparison of quantile averaging vs linear pool (hubEnsembles medRxiv blocked).
- No study found that ensembles Timestral specifically with statistical models and reports scores; flusight-fm's scores were not read.

## 3. Post-hoc calibration of quantile forecasts: conformal methods, recalibration, and data needs

### Takeaway
TSFMs are usually reasonably calibrated on average but under-cover in volatile periods and drift by horizon, which is exactly aseri's pattern (72 to 87% for a nominal 80% band); the cheapest robust fix is a per-series, per-horizon-bucket conformalized quantile regression (CQR) offset fitted on the existing 52-origin backtest, followed in production by an online quantile tracker (adaptive conformal inference / conformal PID P-control) that updates as each forecast resolves; EnbPI is a poor fit because it needs a retrainable bootstrap ensemble and discards the FM's quantile shape.

### Cited Findings
- Calibration of TSFMs: Chronos-Bolt, TimesFM, Moirai 2.0, TiRex and YingLong are "consistently better calibrated than baseline models" (ARIMA, N-BEATS), not systematically over- or under-confident in short-term forecasts, with calibration error near or below 5% on most datasets; ARIMA and N-BEATS are consistently under-confident; but "All autoregressive TSFMs are consistently overconfident in long-term forecasting", while non-autoregressive TiRex and YingLong were not; "WQL alone is not necessarily a reliable indicator of calibration performance" ([Adler et al., arXiv 2510.16060](https://arxiv.org/abs/2510.16060); earlier version [Google Research](https://research.google/pubs/calibration-properties-of-time-series-foundation-models-an-empirical-analysis/)). No code yet (same source).
- Marginal coverage can hide conditional failure: several TSFMs' intervals under-cover in high-volatility periods while average coverage is near nominal (snippet only) ([ICLR 2026, "Improving Conditional Coverage in Time-Series Foundation Models via Direct Volatility Modeling"](https://iclr.cc/virtual/2026/10013844)).
- Patch-based transformers are competitive on accuracy but show calibration problems at long horizons (snippet only) ([Michael et al., arXiv 2609.25788](https://arxiv.org/abs/2609.25788)); on energy load, Chronos-2 gave about 95% coverage for nominal 90% while Moirai-2 gave about 70% (snippet only, single-author study) ([arXiv 2602.10848](https://arxiv.org/abs/2602.10848)).
- Applied Timestral evidence: nominal 90% intervals covered 84.8 to 85.2% on stocks; 80% intervals 75 to 76% on bank data; bdbv-fm widened the nowcast s.d. by 1.3 to bring 90% intervals to 84 to 90%; timestral-weather fitted per-day widening factors 1.08 to 1.28 on half the windows and got 74 to 81% held-out coverage for an 80% band (`forecast-horizons.md`, table 1a; [bdbv-fm](https://github.com/CDDEP-DC/bdbv-fm), [timestral-weather](https://github.com/aminekhasteh/timestral-weather)).
- FMs + conformal: zero-shot TSFMs give more reliable conformal intervals than statistical and gradient-boosting models when data are scarce, partly because no data is spent on training, so more is left for calibration; the benefit grows as data get scarcer ([Achour et al., arXiv 2507.08858](https://arxiv.org/abs/2507.08858)).
- Split conformal guarantee under exchangeability: with n calibration scores, using the ceil((n+1)(1-alpha))/n empirical quantile gives coverage of at least 1-alpha (and at most 1-alpha+1/(n+1)) ([Angelopoulos and Bates, "A Gentle Introduction to Conformal Prediction", arXiv 2107.07511](https://arxiv.org/abs/2107.07511)†).
- CQR: score E_i = max(q_lo(x_i) - y_i, y_i - q_hi(x_i)) on a calibration set, then publish [q_lo - Q, q_hi + Q] with Q the conformal quantile of E; it keeps the model's heteroscedastic shape and can also shrink intervals (Q < 0) ([Romano, Patterson and Candes 2019, arXiv 1905.03222](https://arxiv.org/abs/1905.03222)†).
- Adaptive conformal inference (ACI): update the working miscoverage alpha_{t+1} = alpha_t + gamma(alpha - err_t); no exchangeability needed; long-run coverage error is bounded by (max(alpha_1, 1-alpha_1) + gamma)/(gamma T) ([Gibbs and Candes 2021, arXiv 2106.00170](https://arxiv.org/abs/2106.00170)†).
- AgACI aggregates ACI over several gamma values to avoid choosing gamma ([Zaffran et al. 2022, arXiv 2202.07282](https://arxiv.org/abs/2202.07282)†, the paper is confirmed as MAPIE's ACI reference, the AgACI detail is from prior knowledge); MAPIE's `TimeSeriesRegressor` implements only "enbpi" and "aci", EnbPI requires `cv` to be a `BlockBootstrap`, and `partial_fit` replaces the oldest scores with the newest ([MAPIE docs, TimeSeriesRegressor](https://mapie.readthedocs.io/en/stable/generated/mapie.regression.TimeSeriesRegressor.html); [API reference](https://mapie.readthedocs.io/en/latest/api/)).
- Conformal PID control generalises ACI to quantile tracking (P control: q_{t+1} = q_t + eta(err_t - alpha)), plus an error integrator and a "scorecaster"; the official repo exposes `quantile(scores, alpha, lr, ahead, proportional_lr=True, ...)` where `ahead` is the forecast horizon in steps and data are a DataFrame with a datetime index and a `y` column ([Angelopoulos, Candes and Tibshirani 2023, arXiv 2307.16895](https://arxiv.org/abs/2307.16895); code [aangelopoulos/conformal-time-series](https://github.com/aangelopoulos/conformal-time-series)).
- EnbPI builds intervals from leave-one-out residuals of a bootstrap ensemble of a trained regressor and updates them with recent residuals; approximately valid under strong mixing ([Xu and Xie 2021, arXiv 2010.09107](https://arxiv.org/abs/2010.09107); MAPIE docs above).
- Newer TSFM-specific variants: "Temporal Conformal Prediction" (rolling split-conformal on quantile forecasts with an online update) and "Bias-Corrected ACI" (re-centres multi-horizon intervals by estimating online bias) are listed in a 2026 post-training survey (snippet only, papers not read) ([Post-Training in TSFMs survey, arXiv 2607.20002](https://arxiv.org/abs/2607.20002)).
- Quantile-level recalibration: fit an isotonic map from nominal level to empirical frequency P(y <= q_tau) on held-out data and invert it ([Kuleshov, Fenner and Ermon 2018, arXiv 1807.00263](https://arxiv.org/abs/1807.00263)†).
- Proper scoring: assess calibration and sharpness jointly ("maximise sharpness subject to calibration") with PIT histograms, coverage and proper scores ([Gneiting, Balabdaoui and Raftery 2007, JRSSB](https://doi.org/10.1111/j.1467-9868.2007.00587.x)†); the weighted interval score used by the forecast hubs is a quantile-based CRPS approximation ([Bracher et al. 2021, PLoS Comp Bio](https://doi.org/10.1371/journal.pcbi.1008618)†).

### Inferences
- Data needs, derived from the split-conformal formula: a finite conformal quantile needs ceil((n+1)(1-alpha)) <= n, i.e. n >= 1/alpha - 1. With aseri's 52 origins per horizon bucket: 80% band (alpha=0.2) needs n >= 4 (fine, uses the 43rd of 52 sorted scores); 90% needs n >= 9; the 98% band (q0.01/q0.99, alpha=0.02) needs n >= 49, so 52 origins are just enough and the result is noisy. Overlapping 28-day windows make scores dependent, so effective n is smaller than 52; pool horizons into buckets (1-7, 8-14, 15-28) to raise n.
- ACI data needs, derived from the bound: with gamma = 0.05 and T = 365 daily resolutions the worst-case long-run coverage error is (0.9+0.05)/(0.05*365) = 5.2 points; with gamma = 0.005 it is 52 points. So with one year of live data per series, ACI needs a fairly large gamma (0.02 to 0.05), which makes intervals jumpy; initialise from the offline CQR offset rather than from zero.
- Multi-horizon delay: a forecast for h=28 resolves only 28 days later, so online updates per horizon lag by h; use one tracker per (series, horizon bucket, side) and feed it the score of the forecast issued h days earlier (the repo's `ahead` parameter).
- Level recalibration can only remap within the 21-level grid: it cannot push a band wider than the model's own q0.01..q0.99 range. A toy check (model twice too narrow) gave a recalibrated q0.1 of -2.33 against a true -2.56, clamped at the model's q0.01. Use it for mild miscalibration and CQR offsets for strong under-coverage.
- Prefer CQR-style additive offsets on the FM's own quantiles over EnbPI or plain absolute-residual conformal: they keep Timestral's asymmetric, heteroscedastic band shape and work without retraining.
- Two-sided vs one-sided: under-coverage on GPR may be asymmetric (spikes up). Calibrate lower and upper tails separately (score_lo = q_lo - y, score_hi = y - q_hi, each at alpha/2) to fix skew.
- [CPU-OK] all of this is arithmetic on stored backtest and live forecasts. [NEEDS-MORE] conditional-coverage methods that model volatility explicitly need more history of resolved forecasts than aseri will have for a year.

#### Implement and test in Python
```python
import numpy as np

def conformal_offset(scores, alpha):
    n = len(scores); k = int(np.ceil((n + 1) * (1 - alpha)))
    return np.inf if k > n else np.sort(scores)[k - 1]

def cqr_two_sided(lo, hi, y, alpha):        # backtest arrays for one (series, horizon bucket)
    q_lo = conformal_offset(lo - y, alpha / 2)   # how far below the lower quantile y falls
    q_hi = conformal_offset(y - hi, alpha / 2)
    return q_lo, q_hi                            # publish [lo - q_lo, hi + q_hi]; offsets may be negative

class QuantileTracker:                       # conformal PID, P-term only (Angelopoulos et al. 2023)
    def __init__(self, q0, alpha, lr):       # q0 from cqr_two_sided; lr ~ 0.1 * MAD of backtest scores
        self.q, self.alpha, self.lr = q0, alpha, lr
    def update(self, score):                 # score of the forecast issued h days ago, now resolved
        self.q += self.lr * (float(score > self.q) - self.alpha)

def recalibrate_levels(Q_bt, y_bt, LEVELS, qs_new):   # Kuleshov-style, per horizon bucket
    F = np.maximum.accumulate((y_bt[:, None] <= Q_bt).mean(0))   # empirical freq per nominal level
    src = np.interp(LEVELS, F, LEVELS)        # model level whose empirical freq equals the target level
    rows = np.atleast_2d(qs_new)              # (H, 21)
    return np.sort(np.stack([np.interp(src, LEVELS, r) for r in rows]), axis=-1)
```
- Test without leakage: fit offsets on origins 27 to 52 (older), evaluate cov80, cov50, 98% coverage and WQL on origins 1 to 26 (newer), then swap and average (2-fold by time). Also simulate the online tracker forward over the 52 origins in time order and report its rolling coverage.
- Accept the calibration layer per series only if held-out coverage moves toward nominal without raising WQL by more than its CI (sharpness must not be bought blindly).

### Gaps
- No paper found that tests conformal methods on TSFM quantile forecasts with about 50 calibration windows on daily non-stationary series; Achour et al.'s calibration sizes and methods were not visible in the abstract.
- I did not verify which of ACI, PID integrator and scorecaster are exposed as named functions in the conformal-time-series repo beyond `quantile(...)`.

## 4. Target choice: raw daily value vs 7-day average, aggregating daily quantiles, weekly seasonality

### Takeaway
Quantiles of a 7-day average cannot be obtained by averaging daily quantiles (that silently assumes perfectly rank-correlated errors and overstates the spread); the standard solution is to simulate joint sample paths and average within each path, and because Timestral outputs only marginal quantiles, aseri has to add a dependence model (Gaussian copula with dependence estimated from backtest PITs, or a Schaake-shuffle empirical copula); the trailing 7-day-average forecast built this way starts automatically at the current 7-day average, because six of the first window's seven days are already observed.

### Cited Findings
- fpp3: "If the point forecasts are means, then adding them up will give a good estimate of the total. But prediction intervals are more tricky due to the correlations between forecast errors. A general solution is to use simulations": `generate(times = 10000, h = 12)`, sum per replicate, then take intervals of the simulated totals ([Hyndman and Athanasopoulos, fpp3 13.5 "Prediction intervals for aggregates"](https://otexts.com/fpp3/aggregates.html)).
- Summing quantiles is exact only for comonotonic (perfectly rank-dependent) variables, and the comonotonic sum is the largest in convex order, i.e. the widest-spread aggregate for given marginals ([Dhaene et al. 2002, "The concept of comonotonicity in actuarial science and finance: theory"](https://doi.org/10.1016/S0167-6687(02)00134-8)†).
- Empirical copula reordering: the Schaake shuffle draws samples from each univariate (per-lead-time) forecast and reorders them to match the rank pattern of historical trajectories, restoring temporal persistence; ensemble copula coupling (ECC) uses the raw ensemble as template instead; SimSchaake picks historical dates similar to the current forecast ([Schefzik, arXiv 1507.02079](https://arxiv.org/abs/1507.02079); [Schefzik, Thorarinsdottir and Gneiting, ECC, arXiv 1302.7149](https://arxiv.org/abs/1302.7149)); original method ([Clark et al. 2004, J. Hydrometeorology](https://doi.org/10.1175/1525-7541(2004)005%3C0243:TSSAMF%3E2.0.CO;2)†).
- Gaussian copula processes are an established way to model dependence across time and series on top of arbitrary marginals in probabilistic forecasting ([Salinas et al. 2019, arXiv 1910.03002](https://arxiv.org/abs/1910.03002)†).
- Timestral outputs 21 quantiles and no samples; for horizons past 1,024 steps it feeds back the median block by block (`docs/research/timestral-model.md`, section 4). Chronos-2 also predicts 21 quantiles directly from the head, with no sample paths described ([Chronos-2 HTML](https://arxiv.org/html/2510.15821v1)).
- Temporal aggregation: forecasting at several aggregation levels and reconciling them (temporal hierarchies) improves accuracy over a single level ([Athanasopoulos et al. 2017, EJOR, "Forecasting with temporal hierarchies"](https://doi.org/10.1016/j.ejor.2017.02.046)†).
- `forecast-horizons.md` already recommends, for heavy-tailed drone counts, forecasting a weekly-summed series rather than summing daily quantiles (`docs/research/forecast-horizons.md`, TL;DR).
- aseri's MASE scale uses the lag-7 difference and seasonal naive repeats the last 7 days (`spike-timestral-backtest.md`, Setup); Timestral has no frequency input, and day-of-week as a covariate did not improve it, i.e. it already picks up the weekly cycle from context (`spike-covariates.md`, TL;DR: `dow` +0.3% / +0.1% on GPR).
- Devetak's PortWatch test found that the only pattern Timestral picked up at Rotterdam was the weekend dip (`forecast-horizons.md`, P4).

### Inferences
- The user-reported chart is a target mismatch, not a model bug: the history line is a trailing 7-day mean (181), the forecast is the daily value (h=1 = 165, then weekend dips to 104 to 127). Comparing them visually invites a false "drop" reading.
- Three valid designs, in order of preference for accuracy and honesty:
  1. **Daily model, derived 7-day-average forecast (recommended).** Keep forecasting daily (that is what the backtest validated), build sample paths with a copula, and compute the trailing 7-day mean per path, mixing the 6 observed days into the early windows. The 7-day-mean forecast then starts at the current 7-day mean by construction and its band is narrow early (6/7 known at h=1). Show this as the main line, with the daily fan as a secondary layer.
  2. **Model the smoothed series directly.** Run Timestral on the 7-day-mean history. Simple, smooth and calibrated only for that target, but the model does not know that the first six days of each future window are already fixed, and a trailing mean lags the true level by about 3 days (half the window). Must be re-backtested on the smoothed target.
  3. **Non-overlapping weekly aggregates** (weekly sums or means as their own series, step = 1 week, 4-step horizon): cleanest statistically for heavy-tailed counts (drones), but only 4 forecast points and ~1/7 the history length.
- Dependence matters a lot for the band: daily FM errors have a persistent level component (strong positive correlation across h) plus near-independent day noise. Summing quantiles (comonotonic) gives the widest band, independence the narrowest; the truth lies between, so estimate it from the backtest rather than assuming either.
- Weekly seasonality should be kept in the daily layer (the weekday pattern is real and calibrated) and removed only by aggregation in the 7-day layer; do not deseasonalise the input for Timestral, which already learns the cycle.
- [CPU-OK] 4,000 paths x 28 days x 9 series is trivial; the dependence is estimated once from the existing backtest.

#### Implement and test in Python
```python
import numpy as np
from scipy.stats import norm

def pit(y, qs, LEVELS):                     # qs: (21,) quantiles for one (origin, h)
    return np.interp(y, qs, LEVELS, left=LEVELS[0] / 2, right=(1 + LEVELS[-1]) / 2)

def estimate_rho(Z):                         # Z: (origins, H) normal scores norm.ppf(pit) from the backtest
    return np.nanmean([np.corrcoef(Z[:, h], Z[:, h + 1])[0, 1] for h in range(Z.shape[1] - 1)])

def sample_paths(qs, LEVELS, rho, n=4000, rng=np.random.default_rng(0)):  # qs: (H, 21)
    H = qs.shape[0]
    R = rho ** np.abs(np.subtract.outer(np.arange(H), np.arange(H)))       # AR(1) copula across horizons
    u = norm.cdf(rng.multivariate_normal(np.zeros(H), R, size=n))
    u = u.clip(LEVELS[0], LEVELS[-1])        # shortcut: no tails beyond q0.01/q0.99, upgrade if 98% band of the mean matters
    return np.stack([np.interp(u[:, h], LEVELS, qs[h]) for h in range(H)], axis=1)  # (n, H)

def trailing_mean_quantiles(paths, observed, LEVELS, k=7):
    hist = np.broadcast_to(observed[-(k - 1):], (paths.shape[0], k - 1))
    full = np.concatenate([hist, paths], axis=1)                              # (n, k-1+H)
    ma = np.lib.stride_tricks.sliding_window_view(full, k, axis=1).mean(-1)   # (n, H): MA at T+1..T+H
    return np.quantile(ma, LEVELS, axis=0).T                                   # (H, 21)
```
- Self-check: with rho = 1 the median of the 7-day mean must equal the average of the daily medians in the window (comonotonic case); with rho = 0 the band must be narrower. Assert both on a toy input.
- Test on the 52 origins: score the 7-day-mean target (WQL, cov80) for (a) copula paths with estimated rho, (b) rho = 1 (sum of quantiles), (c) rho = 0, (d) Timestral run directly on the 7-day-mean series, (e) seasonal naive and flat-mean baselines on the same target. Pick per series by WQL and coverage.
- If an AR(1) copula misfits (check the lag-k correlations of Z against rho^k), switch to a Schaake shuffle: take the backtest PIT trajectories (origins x H), and for each simulation reuse the rank order of a randomly chosen historical trajectory.

### Gaps
- No source found that evaluates copula-based aggregation specifically for TSFM quantile outputs; the method is standard in weather post-processing, not yet documented for TSFMs.
- How well 52 origins pin down the cross-horizon dependence is unknown; pooling Z across the PortWatch series is a reasonable but untested assumption.

## 5. The forecast origin: should step 0 coincide with the last observation, and how packages anchor forecasts

### Takeaway
No: the forecast distribution starts at h=1 and should never be shifted to match the last observation (that would be an ad hoc level correction that breaks calibration); established tools either leave a visible gap between history and forecast (fable's default) or draw a connector from the last observed value to the first forecast as a display option (`show_gap = FALSE`); a jump at the join is informative (mean reversion or a weekday effect) as long as history and forecast show the same quantity.

### Cited Findings
- fable/fabletools: `autoplot.fbl_ts()` has `show_gap`, default `TRUE`; "Setting this to FALSE will connect the most recent value in data with the forecasts", and the historical data must be passed via `data` because "the original data is not included in the fable object"; the function moved to `ggtime::autoplot.fbl_ts()` from fabletools 0.6.0 ([fabletools reference](https://fabletools.tidyverts.org/reference/autoplot.fbl_ts.html); [ggtime reference](https://pkg.mitchelloharawild.com/ggtime/reference/autoplot.fbl_ts.html)).
- Nixtla: `utilsforecast.plotting.plot_series(df, forecasts_df, ids, models, level, max_insample_length, engine)` plots in-sample values and forecasts from two separate frames; `StatsForecast.plot` takes history and forecasts together with `level` for intervals ([utilsforecast plotting](https://nixtlaverse.nixtla.io/utilsforecast/plotting); [statsforecast getting started](https://nixtlaverse.nixtla.io/statsforecast/docs/getting-started/2_Getting_Started_complete)).
- aseri rule already set: count the horizon from the last observation, not the run date (`forecast-horizons.md`, rule 1).
- Timestral's h=1 median differing from the last value is expected for mean-reverting or weekly-seasonal series; for GPR the backtest shows a single-step band that is too narrow at h=1 (cov80 0.67), so the jump itself is not evidence of error (`spike-timestral-backtest.md`, GPR table).

### Inferences
- The step-0 point is the observation itself (a degenerate distribution). Drawing a dashed connector from (T, y_T) to (T+1, median_1) is honest only when both are the same quantity (daily to daily, or 7-day mean to 7-day mean). Connecting a 7-day-mean history to a daily forecast is what created the user's confusion.
- With design 1 of section 4, the 7-day-mean forecast line starts at the current 7-day mean (its h=1 window contains 6 observed days), so the main chart becomes continuous without any forced anchoring.
- Do not "anchor" by subtracting (median_1 - y_T) from all quantiles: that turns the model into a naive-plus-shape hybrid whose calibration was never tested. If a level correction is wanted, test it as a separate model in the backtest.
- [CPU-OK] purely a front-end change.

#### Implement and test in Python
```python
import matplotlib.pyplot as plt
fig, ax = plt.subplots()
ax.plot(dates_hist, y_hist, lw=0.6, alpha=0.5, label="daily")
ax.plot(dates_hist, ma_hist, lw=2, label="7-day mean")
ax.fill_between(dates_fc, q_daily[:, 2], q_daily[:, 18], alpha=0.15)          # daily 10-90 band
ax.plot([dates_hist[-1], *dates_fc], [ma_hist[-1], *q_ma[:, 10]], lw=2, ls="--")  # MA median, starts at observed MA
ax.fill_between(dates_fc, q_ma[:, 2], q_ma[:, 18], alpha=0.3)
```
- Test: an assert that the MA forecast at h=1 lies within the range of [min, max] of (6 observed days + daily q0.01/q0.99 for day 1)/7, and a visual check on the series the user flagged.

### Gaps
- I did not verify how Darts (`TimeSeries.plot`) and GluonTS (`Forecast.plot`) join history and forecast; only fable and Nixtla docs were read.

## 6. Quantile crossing, non-negativity, log transforms, context length, fine-tuning vs zero-shot

### Takeaway
Timestral already emits non-crossing, non-negative quantiles, so the only crossing risk is introduced by aseri's own post-processing (per-level conformal offsets, recalibration), which a sort (monotone rearrangement) fixes; log transforms are exact for quantiles but untested for TSFMs and should be decided by backtest; longer context generally helps but can anchor to an old regime, so test truncation; and fine-tuning is not worth it for 9 short-to-medium daily series on CPU, where recent evidence shows it often hurts.

### Cited Findings
- Timestral's quantile head outputs 21 non-crossing quantiles; `clip_nonnegative=True` (default) clamps forecasts at 0 when the observed history is non-negative; max context 32,768 steps; default `symmetric_averaging=True` also forecasts the negated series and averages (`docs/research/timestral-model.md`, sections 2 and 4).
- TimesFM-2.5's `ForecastConfig` exposes `max_context`, `max_horizon`, `normalize_inputs`, `use_continuous_quantile_head`, `force_flip_invariance`, `infer_is_positive` and `fix_quantile_crossing` (all set True in the official example); output is point (B, h) and quantiles (B, h, 10) = mean plus q0.1..q0.9; Apache-2.0 ([HF model card google/timesfm-2.5-200m-pytorch](https://huggingface.co/google/timesfm-2.5-200m-pytorch)); context up to 16k ([timesfm README](https://github.com/google-research/timesfm)).
- Monotone rearrangement (sorting the estimated quantile curve) removes crossing and the rearranged curve is closer to the true one ([Chernozhukov, Fernandez-Val and Galichon 2010, arXiv 0704.3649](https://arxiv.org/abs/0704.3649)†).
- Context length: Chronos-2 extended context from 2,048 to 8,192 in post-training, and "Extending the context length yields gains, particularly on the GIFT-Eval benchmark" with many high-frequency, long-season datasets ([Chronos-2 HTML](https://arxiv.org/html/2510.15821v1)). fev-bench runs each model at its own maximum context (Chronos-2 8192, TimesFM-2.5 16000, Toto 4096, Moirai-2 4000, Chronos-Bolt 2048, TiRex 2048, Sundial 2880) and truncates statistical models to 1,000 steps ([fev-bench HTML v2, Table 12](https://arxiv.org/html/2509.26468v2)).
- Regime shifts: Timestral adopts a new level slowly after a jump ([off-the-prior](https://github.com/Cuuper22/off-the-prior)); in aseri's backtest the 209M beats the 28M by 10 to 20% on Hormuz from h=14 (`spike-timestral-backtest.md`, TL;DR).
- Fine-tuning: on Chronos Benchmark II, fine-tuning Chronos-T5 (Small) per dataset "significantly improves the aggregate performance" ([Chronos, Ansari et al. 2024, arXiv 2403.07815](https://arxiv.org/abs/2403.07815)); but on 30 datasets, if n_train < 700 and seasonality is non-negligible, zero-shot should be used without fine-tuning, and LoRA can make short series worse (one dataset with 966 samples: Chronos-Bolt-S error 2.472 zero-shot vs 2.766 with LoRA); LoRA beats zero-shot on 17 of 30 datasets at full data ([arXiv 2607.04919](https://arxiv.org/abs/2607.04919) abstract; the 966-sample numbers are from a search snippet of the same paper); for Chronos 2, every fine-tuning strategy degraded small datasets (snippet only) ([arXiv 2607.23146](https://arxiv.org/abs/2607.23146)).
- Ensembling/model selection across small pretrained models is more compute-efficient than test-time fine-tuning ([Kayaalp et al., arXiv 2510.06419](https://arxiv.org/abs/2510.06419)).
- TimesFM added a LoRA fine-tuning example in April 2026 (`timesfm-forecasting/examples/finetuning/`) ([timesfm README](https://github.com/google-research/timesfm)). I found no fine-tuning API for Timestral (`timestral-model.md` lists none).
- Log transforms: Olivares et al. criticise weak statistical baselines but say nothing on transforms (abstract) ([arXiv 2509.19465](https://arxiv.org/abs/2509.19465)); the classic result is that a log transform improves forecasts only when it stabilises the variance ([Lutkepohl and Xu 2012, Empirical Economics](https://doi.org/10.1007/s00181-010-0440-1)†).

### Inferences
- Quantiles are equivariant under monotone transforms: quantiles of log1p(y) map back exactly via expm1, and clipping at 0 is exact for quantiles (q of max(Y,0) = max(q,0)). So log1p on heavy-tailed, multiplicative counts (drones downed, Wikipedia pageviews, alert hours) is a safe experiment for quantiles; the mean does not map back (ignore it, aseri publishes medians and bands).
- Crossing guard: after any per-level offset or recalibration, apply `np.sort(qs, axis=-1)`; it is free and cannot hurt the pinball loss in expectation per the rearrangement result.
- Bounded series: if a series has a hard upper bound (for example alert-hours for a single region cannot exceed 24 per day; check how aseri aggregates regions), clip the upper quantiles at the bound too, by the same equivariance argument.
- Context: test full history vs the last 512, 1,024 and 2,048 days for GPR (15k days back to 1985) and for post-2022 Ukraine series; a shorter context can adapt faster after regime breaks, a longer one gives better seasonal and tail estimates. Decide per series by backtest WQL.
- Fine-tuning is [NEEDS-MORE] for aseri: it needs GPU time, risks overfitting on ~1,300-day Ukraine series (below the 700-sample-per-split heuristic once you hold out validation), has no Timestral API, and must be redone on every model update. Zero-shot plus ensembling plus conformal is the better use of effort.

#### Implement and test in Python
```python
qs = np.sort(qs, axis=-1)                      # rearrangement after any post-processing
qs = np.clip(qs, 0, upper_bound)               # count/bounded series
# log experiment: forecast on log1p, map quantiles back
fc = forecaster.forecast(np.log1p(context), prediction_length=28)
qs_log = np.expm1(fc.quantiles)                # exact for quantiles, not for the mean
# context experiment
for L in (512, 1024, 2048, None):
    ctx = context if L is None else context[..., -L:]
    ...                                        # rerun the 52-origin backtest, compare WQL and cov80
```
- Test log1p vs raw and each context length on the 52 origins, per series, with the paired bootstrap on WQL; keep a change only if the CI excludes 0 and coverage does not get worse.

### Gaps
- No study found on log transforms for TSFM inputs (Timestral, Chronos-2, TimesFM all normalise internally, so the effect is empirical).
- Timestral context-length ablations: none published; the tech report is "coming soon" (`timestral-model.md`).

## 7. Covariates: when exogenous regressors help foundation models

### Takeaway
Covariates help pretrained models when they are known (or forecast) over the horizon and drive the target at the same time (energy prices with load and wind/solar forecasts, retail sales with promotions and holidays); on fev-bench's covariate tasks this gives covariate-aware models (Chronos-2, TabPFN-TS) a clear edge; aseri's spike found no gain because its covariates are past-only, same-day or published with lags, which is consistent with that evidence, so the job should stay univariate except possibly for calendar events.

### Cited Findings
- fev-bench: on the 42 tasks with dynamic covariates, "models that support covariates (Chronos-2 and TabPFN-TS) achieve higher skill scores", which "demonstrates that covariate support provides meaningful performance gains when such information is available"; 30 tasks have known dynamic covariates, 24 past-only, 19 static; TabPFN-TS's accuracy "consistently degraded" with past covariates ([fev-bench HTML v2](https://arxiv.org/html/2509.26468v2)).
- Chronos-2: in-context learning with covariates delivers its largest gains on the covariate subset; case studies are energy prices (EPF-DE) using load and solar/wind forecasts, and retail (Rossmann) using promotion and holiday covariates; supports past-only and known-future, numeric and categorical covariates ([Chronos-2 HTML](https://arxiv.org/html/2510.15821v1); [Amazon Science blog](https://www.amazon.science/blog/introducing-chronos-2-from-univariate-to-universal-forecasting)); usage via `Chronos2Pipeline.predict_df(context_df, future_df=..., prediction_length, quantile_levels)` ([chronos-forecasting README](https://github.com/amazon-science/chronos-forecasting)).
- TimesFM-2.5: covariate support "Added back ... through XReg for TimesFM 2.5" on 2025-10-29 ([timesfm README](https://github.com/google-research/timesfm)); XReg fits a linear regression on covariates combined with TimesFM (`xreg_mode` "xreg + timesfm" or "timesfm + xreg") and needs JAX (third-party docs, snippet only, unverified against the official API) ([AI Horizon Forecast](https://aihorizonforecast.substack.com/p/timesfm-25-external-covariates-a)).
- aseri's covariate spike: 16 covariate sets, none passed a pre-registered keep rule; the best gain was -1.7% WQL (Taiwan Strait with Lunar New Year); four sets made forecasts significantly worse; a synthetic positive control with a 5-day lead cut error by 89%, so the model uses covariates and the null result is about the data (same-day or lagged links) (`docs/research/spike-covariates.md`, TL;DR).
- Calendar covariates did not help Timestral on weekly retail (Winder.AI benchmark), and adding every other port as context "barely changes forecast accuracy" on PortWatch (`forecast-horizons.md`, P4 and P8).

### Inferences
- The covariates that help have three properties: known over the forecast horizon, a strong contemporaneous causal effect, and no publication lag. aseri's candidates (Brent, other chokepoints, GPR, drone counts) are past-only and same-day, so the expected gain is near zero, as measured.
- The only class worth a re-test is known-future event calendars (Lunar New Year for Taiwan Strait, scheduled holidays for pageviews, announced exercises), and only with a pre-registered rule and more than one event in the backtest.
- Cross-learning (Chronos-2 group attention over related univariate series) is a different mechanism from covariates and could be tested cheaply by forecasting the PortWatch chokepoints as one group, but Devetak's PortWatch result suggests little gain.
- [CPU-OK] Chronos-2 covariate inference; [NEEDS-MORE] none, but each cross-series covariate adds a same-day data dependency (`spike-covariates.md`, Costs).

#### Implement and test in Python
- Reuse the `spike-covariates` harness: same origins, paired bootstrap on ΔWQL, keep rule fixed in advance. For Chronos-2: `pipeline.predict_df(context_df, future_df=calendar_df, prediction_length=28, quantile_levels=LEVELS.tolist(), id_column="id", timestamp_column="timestamp", target="target")`, with `future_df` holding only known-future calendar columns.

### Gaps
- No independent study of covariate gains for Timestral beyond aseri's own spike and vendor material.
- TimesFM-2.5 XReg's exact current API was not verified in the official repo docs, only in the README news line and third-party pages.
