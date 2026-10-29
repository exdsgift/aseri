# Forecast horizons for aseri, and what existing Timestral projects teach

Researched 2026-10-29. Question: how far ahead should aseri forecast each candidate series, and what can we learn from projects that already use Timestral? Builds on [timestral-model.md](timestral-model.md) (size, license, CPU fit), [data-sources.md](data-sources.md) (cadence and lag) and [prior-art-and-gaps.md](prior-art-and-gaps.md) (scheduled TSFM sites). Every claim has a source in the "Sources" list; unverified points are marked.

## TL;DR

| Series | Step | Context (default) | Publish horizon | Headline scored horizons | Why |
|---|---|---|---|---|---|
| PortWatch chokepoint transits | day | full history since 2019-01-01 (~2,800 days) | **28 days** from the last observed day | 7, 14, 28 | Data arrive in weekly batches with a lag (4 days observed at release, so up to ~11 days just before the next batch, inferred), so a 7-day horizon is mostly in the past when read. 28 matches the only Timestral PortWatch experiment and the fev-bench/M5 daily default (GIFT-Eval uses 30), and costs the same compute as 7 |
| GPR daily index | day | full history since 1985 (~15,000 days, under the 32,768 cap) | **14 days** | 1, 7, 14 | Noisy, spiky, mean-reverting news index, updated every Monday with revisions. Skill beyond about a week is likely just "decay to the mean"; the backtest decides whether 14 survives |
| Ukraine air-raid alerts (daily count or alert-hours) | day | since 2022-03-15 (~1,300 days) | **7 days** | 1, 7 | Bursty, regime-driven series; Timestral reacts slowly to level shifts. One week is the honest range for a level estimate, and the h=7 that live TSFM benchmarks use for daily counts |
| Ukraine drone/missile launches | day | since 2022 | **7 days** | 1, 7 | Heavy-tailed salvos: publish a base-rate band, not timing. If weekly totals are wanted, forecast a weekly-summed series instead of summing daily quantiles |
| UCDP fatalities | month | full history since 1989 GED (~450 months) | **6 months** from the last released month | 1, 3, 6 | Monthly release with up to one month lag, so h=1 is near-nowcast. ViEWS uses 1 to 36 months and ACLED CAST six 4-week periods, both with trained models and covariates. Benchmarks use 12 for monthly, but GIFT-Eval shows the smallest TSFM edge over seasonal naive on monthly data, so 6 is the cautious choice for a zero-shot univariate model |

Rules that apply to all series:

1. **Count the horizon from the last observation, not from the run date.** Re-forecast only when the last observed date changes. The cron is daily, but most sources are not.
2. **One call per series covers every horizon.** Timestral rounds every request up to a whole 32-step patch and only decodes block by block past 1,024 steps, so asking for 7 or 28 steps costs the same and stays in one forward pass (`forecaster.py` L344, L424-L437).
3. **Pick the final horizon empirically** with the rolling-origin backtest in section 5: the longest horizon where Timestral still beats the better of naive and seasonal-naive on MASE, with 80% interval coverage within about 5 points of nominal.
4. **Expect the edge over naive to shrink with horizon and the bands to be a bit too narrow.** Every independent Timestral evaluation that reports it shows this (section 1), and on GIFT-Eval's sub-daily data Timestral's MASE ratio to seasonal naive worsens from 0.57 to 0.69 between short and long horizons (section 3). Mistral publishes no per-horizon numbers.

## 1. Projects using Timestral

**Short answer: many more than "almost none", but almost none in our domain.** Two weeks after release, GitHub code search finds more than 60 public repos that import `timestral` or reference `mistralai/Timestral-*`, and Hugging Face lists 16 Spaces and 21 derived models (mostly ONNX, MLX, CoreML, GGUF ports) that declare a Timestral base [S1][S2][S3]. Roughly 30 of these forecast real data, most with some evaluation. **Only one touches our data**: a blog post running Timestral-209M on IMF PortWatch port and chokepoint series, without scoring [P4]. **Only one runs on a schedule with its own public scoreboard** (forecast-duel, stocks) [P1]; two more run weekly GitHub Actions that submit to public forecast hubs, which score them (flusight-fm, bdbv-fm) [P2][P3]. No project uses GPR, Ukraine war data or UCDP.

### 1a. Applied projects most relevant to aseri

| Project | What it forecasts | Step | Horizon | Context | Evaluation | Finding relevant to us |
|---|---|---|---|---|---|---|
| **forecast-duel** [P1] | Closing prices of 12 stocks (plus NVDA direction vs Polymarket) | trading day | 5 days | last 1,024 closes | Nightly GitHub Action (00:30 UTC) forecasts, scores matured forecasts, commits records, publishes a Pages site. Mean absolute % error vs naive "tomorrow = today", share of forecasts beating naive, coin-flip test | Closest template to aseri. Live so far (n=24): Timestral MAPE 3.36% vs naive 3.39%; warm-up backfill (n=240): 2.72% vs 2.72%. On prices, Timestral equals naive. Keeps "warm-up" and "live" scores separate |
| **flusight-fm** (CDDEP) [P2] | US weekly flu hospitalizations and ED visits for the CDC FluSight hub | week | -1 to 3 weeks (hub-mandated) | full history, NaN left-padded | Weekly GitHub Action; zero-shot ensemble of Chronos-2, TimesFM 2.5, Moirai 2.0 and Timestral; WIS and relative WIS vs FluSight-baseline, interval coverage; season replay with as-of-deadline data | Shows a nowcast for revised recent weeks, and warns that backtests on pre-release seasons may be inflated by training-data overlap, "especially for models released after the season (Timestral, Oct 2026)" |
| **bdbv-fm** (CDDEP) [P3] | Weekly Bundibugyo Ebola cases for a modeling hub, national to health-zone level | week | -6 to -2 nowcast, -1 to 3 forecast | full history | Weekly GitHub Action; CRPS and coverage **by horizon** relative to a random-walk baseline; scores a week only once it is 5 weeks old | Outbreak counts with many zeros, the closest analogue to conflict event counts. In-sample calibration under-covered out of sample, so they widened the nowcast s.d. by 1.3 to get 90% intervals to 84-90% coverage |
| **Devetak, "Testing Timestral-209M on Maritime Traffic"** [P4] | PortWatch daily port calls (Hong Kong, Rotterdam) and Suez transits | day | **28 days** (ports), 183 days (Suez counterfactual) | 1,732 to 1,917 days (all data since 2019-01-01) | Qualitative only, q10-q90 bands, no metrics | Same source as ours. The median "stays close to the usual daily level"; the only pattern picked up at Rotterdam was the weekend dip, fed as a day-of-week input; adding every other port and chokepoint as context "barely changes forecast accuracy" but took up to ~15 min CPU per forecast |
| **Dubach, "Forecasting Financial Markets with Timestral"** [P5] | Daily returns, log volume, range volatility of 14 stocks and 3 ETFs | trading day | 1 and 5 sessions | 512 days | MAE vs simple and regression baselines; interval coverage | Returns: no edge. Nominal 90% intervals covered 84.8-85.2% (original model): too narrow |
| **timestral-bank-forecasting** [P6] | 15 balance-sheet lines of 4 US banks | quarter | h = 1 to 8, one shot | 24 to 90 quarters | 24 rolling origins; relative MASE vs AutoARIMA **per horizon**, Diebold-Mariano, 80% coverage | Cleanest per-horizon curve: relative MASE 0.91 at h=1, 1.00 at h=5, 1.03 at h=8; win rate 57% at h=1 down to 48% at h=8. 80% intervals covered 75-76% |
| **timestral-weather** [P7] | Hourly temperature, Montreal | hour | 72 h backtest; 7-day forecast in the app | 60 days | 73 origins over a year; MAE by forecast day vs "repeat yesterday", ARIMA, weather service | MAE grows 2.17, 3.14, 3.65 °C over days 1-3 (univariate). Raw 10-90% bands held ~70% once a covariate was added; per-day widening factors 1.08-1.28 fit on half the windows gave 74-81% held-out. 209M was no better than 28M and ~6x slower |
| **demand-forecasting-benchmark** (Winder.AI) [P8] | Weekly retail units (300 series); GB daily electricity demand | week; half-hour | 8 weeks; day ahead | 8 to 78 weeks of history tested | Relative MASE and WQL vs seasonal naive (GIFT-Eval conventions), 10-90% coverage | Retail 8 weeks: Timestral-209M relative MASE 0.696, coverage 0.82 (nominal 0.80). Calendar covariates did not help on retail |
| **CharlieLZ/timestral-benchmark** [P9] | 8 M4 monthly series | month | 12 months | 108 months | MASE vs seasonal naive (m=12), 80% coverage | Mean 80% coverage 87.5%, but one series had MASE above 1 and 17% coverage: averages hide failures |
| **timestral-forecast** (M5) [P10] | 2,469 Walmart daily item series | day | 28 days | `max_context=1024` | 3 rolling origins plus holiday origins; WMAPE+bias, q10-q90 coverage, vs moving average, Croston, ETS, LightGBM | Uses the M5 28-day convention |
| **carga-sin-timestral** [P11] | Brazilian grid load (peak, minimum, mean) | half-hour/day | 1 to 7 days | n/a | Daily origins from 2024-03 to 2026-10; MAPE vs `naive7` and the operator's own forecast | Daily-origin backtest over 2.5 years, one forecast per origin |
| **sensorcast** [P12] | Home temperature sensors | ~40 min | 1, 6, 24 h | 504 h | Rolling origins every 12 h; MASE, WQL, 80% coverage | Model size 5M to 209M bought 1.3% MASE |
| **off-the-prior** [P13] | Synthetic stress tests plus real stand-ins | various | 16 and 128 steps | 2,048 | Error ratio vs an oracle "referee" | "Sixteen steps after a jump in level, the error is 3.77x the referee's at 5M and 2.43x at 209M": Timestral is slow to adopt a new level, which matters for war and shipping regime breaks |
| **CHAP dengue** (hansand02) [P14] | Monthly dengue cases, admin-1, Vietnam/Laos/Thailand | month | 3 months, 6 splits | full | CHAP benchmarking backtest vs seasonal naive | A monthly epidemiological series at h=3 (results not read) |

### 1b. Other projects found (one line each, from the README or repo description)

- **Energy and weather:** Belgian day-ahead load vs the TSO forecast, 365 daily windows (KlitiHamataj/tsfm-belgian-load-forecast); energy and retail vs Chronos-2 with rolling origins, MASE/WQL/coverage (dumko2001/timestral-benchmark); day-ahead electricity demand for 5 countries with 1-99% bands for anomaly detection (mourjo/zero-shot-forecasting); GPU power and grid prices, WQL vs seasonal naive (Cuuper22/heatwave); Bologna hourly bike counts, next week (HF Space Bayway/due-torri-due-ruote); French station weather vs persistence and AROME (HF Space ai-testack/weather-lab); hyperlocal temperature (michaelpeterswa/lfpweather-timestral); in-browser 24 h weather (ExplodingCB/weatherstral); Beijing PM2.5 6 h ahead (TomSchippke/air-quality-forecasting); load forecasting libraries (erc-fhv/loadforecasting, eloicampagne/gnn4elf); Italian power dashboard weekly forecast (aragn/it-power-dashboard).
- **Finance:** VWCE ETF one-step walk-forward (Federico-Conti/timestral-vwce); market calibration study (abhiram1809/Mistral-Timestral-Experiment); BTC 15-min vs Kalshi (RINNECODER/timestral-research); crypto and stocks experiments (100vip/orderflow-live, smoroni72/TimestralCryptoLab, aminekhasteh/timestral-stocks, lee101/stock-prediction, NimbleMarkets/tickstral); pre-registered earnings-move test with a hash-chained ledger, not yet frozen (deesatzed/beyond-implied).
- **Retail and business:** sales on Databricks vs Prophet (florent-brosse/timestral-databricks); M5 (baptistesoulard/M5_Timestral); industrial benchmarks vs Chronos-2 and AutoARIMA (fabbio00/timestral-demo); 12 use cases (avisceral8/timestral-use-cases); workload of a professional office (gabrymark06-max/previsione-carico-lavoro); PC usage that falls back to a baseline when Timestral's last-7-day error is worse (Fede046/Daycast).
- **Benchmarks and platforms:** official GIFT-Eval replication notebook (SalesforceAIResearch/gift-eval `notebooks/timestral.ipynb`), fev-bench and TIME adapters (autogluon/fev, zqiao11/TIME), TS-Arena model service (DAG-UPB/ts-arena-models), microprediction/skaters, RealCast-bench leaderboard on proprietary commercial panels (HF Space carbon-arc/RealCast-bench).
- **Wrappers, ports and demos (no forecasting study):** TimeCopilot/foundationforecast, OPAIRS/opairs-forecast, Leo00703/TSFM-Lab, hrczggyorgy TSFMs workbench, duckdb-timestral, grafana-timestral, DataFusion, R (timestralR), Rust (several), C++/ggml (timestral.cpp, LocalAI), MLX, CoreML, LiteRT, ONNX in-browser, fine-tuning (elarazju/timestral-ft), drawing games (HF Spaces sketch-a-series, unpredictable).
- **Kaggle, Reddit, X:** nothing found (web search returned no Kaggle notebook or Reddit thread; Reddit's JSON search was not reachable from here). **Hacker News:** the launch thread (623 points, 127 comments) has no project with code, but two comments matter for us: backtests on pre-release data may leak training data, and a forecaster should "freeze every forecast as it stood the day it was made" and show the naive baseline in the same table [S4].

### 1c. What to copy

- **Scheduled public scoring:** commit each night's forecasts before outcomes exist, score only matured forecasts, show naive in the same table, keep backfilled ("warm-up") scores apart from live ones [P1]. The nightly commit also counts as repository activity, which keeps the cron alive (inferred from the GitHub 60-day rule, see timestral-model.md).
- **Score per horizon, and only settled data:** bdbv-fm scores CRPS and coverage by horizon and waits until a week is 5 weeks old in the data [P3]. Our sources also revise (GPR preliminary values, UCDP Candidate vs final GED).
- **Expect under-coverage and fix it empirically:** 75-76% for nominal 80% [P6], ~85% for nominal 90% [P5], ~70% for nominal 80% with covariates [P7]. Two projects fixed it with a widening factor fit on held-out windows [P3][P7].
- **Fall back to the baseline** when Timestral loses on recent data [P1 shows the tie, Daycast automates the switch].
- **Small models are enough:** 28M matched 209M on temperature [P7]; 5M to 209M bought 1.3% [P12]. Vendor numbers agree the gap is small (GIFT-Eval MASE 0.678 vs 0.658) [T2].

## 2. What Timestral itself says about horizons

Sources are the GitHub repo at commit `a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff` (the only commit), the 209M model card, the blog and the docs page.

| Topic | What the vendor says | Where |
|---|---|---|
| Max horizon per pass | "forecasts up to 1,024 steps in a single forward pass"; "Up to 1,024 time steps (32 patches) in a single forward pass" | model card L69, L79 [T2] |
| Longer horizons | "Horizons longer than one decode block (32 patches = 1024 steps) are forecast block by block; each block's median is fed back as context." The class docstring calls it a "Block-autoregressive quantile forecaster" | README L82-L83 [T1]; `forecaster.py` L3-L6, L91 [T3] |
| Horizon rounding | `horizon = math.ceil(prediction_length / ps) * ps`; the decode loop counts whole patches (`remaining = math.ceil(prediction_length / ps)`) and trims at the end. So any horizon up to 32 steps costs one patch, up to 1,024 one block | `forecaster.py` L344, L424-L427, L455 [T3]; `patch_size: 32`, `block_size: 32` in config.json L2, L55 [T4] |
| Feedback beyond one block | Targets feed back their median, known covariates their real future, past-only covariates a blank | `forecaster.py` L407-L408, L438-L447 [T3] |
| Context | "capped at the trained length (32768 steps); the most recent steps are kept". `max_context` defaults to `config.context_length` = 32,768 | README L81 [T1]; `forecaster.py` L115, L373-L375 [T3]; config.json L56 [T4] |
| Recommended context per frequency | **None given** in README, model card, docs or blog. The vendor's own benchmark protocol uses "the forecaster defaults and the full history up to 32768 steps as context"; the GIFT-Eval notebook repeats "The full history is the context" | README L132-L133 [T1]; GIFT-Eval notebook cell 0 [T6] |
| Training context and horizons | "pre-trained at scale on purely synthetic data with context size 8192", then "post-trained on a mix of real and synthetic data with a 4x longer context"; "training horizon lengths and missing-data augmentation can be tuned independently of each other". Training horizon lengths are not stated | blog [T5] |
| Frequency input | None; `forecast()` takes arrays, `prediction_length`, a mask, covariates and two flags | `forecaster.py` L161-L172 [T3] |
| Quantile quality vs horizon | **Nothing published.** No per-horizon or per-frequency breakdown in the blog charts or model card; "Tech report: coming soon!" | model card L157 [T2]; blog [T5] |
| Defaults that touch bands | `symmetric_averaging=True` (forecast `-context` too and average), `clip_nonnegative=True`, quantiles clamped to `[min - k*s, max + k*s]` of the context with `k = 1e4` | `forecaster.py` L99-L100, L109, L170-L171, L221-L230 [T3] |
| Covariates | "Covariates are conditioning rows: they are not forecast, and covariate rows never read the targets. Known-future covariate rows whose values are all 0 or 1 are treated as indicators." Categorical codes are target-encoded for a univariate target. The blog suggests "a holiday calendar or a weather forecast" | README L104-L106, L119-L124 [T1]; blog [T5] |
| Training data cutoff | Asked in issue #3 (2026-10-17): "what was the latest date of any real data used". No maintainer answer as of 2026-10-29 | [T7] |
| Covariate pitfall | Issue #7: upper quantiles "explode" when a known-future covariate is constant over the context and changes inside the horizon, or is sign-fixed under symmetric averaging. Masking flat-in-context rows as NaN fixes most cases | [T8] |

Practical reading for aseri:
- Every horizon we need (7 to 32 daily steps, 6 to 12 monthly) sits in **one forward pass**; there is no autoregressive feedback, so any loss of quality with horizon is statistical, not an artefact of the decoder.
- Requesting 32 daily steps costs the same as 7, so produce the longest candidate horizon every time and decide what to publish from the backtest.
- All our histories (450 to 15,000 steps) are below the 32,768 cap, so the vendor default "full history" is the starting point. Test a shorter window only where a regime break makes old data misleading (Red Sea, raion-level sirens since Dec 2025).
- Covariates: a day-of-week categorical (known future) is the only one with evidence on PortWatch [P4]. Do not pass flags that are constant in the context and switch on in the horizon [T8].

## 3. Benchmark conventions

### 3a. How benchmarks set the horizon per frequency

| Convention | Daily | Weekly | Monthly | Source |
|---|---|---|---|---|
| GIFT-Eval "short" (`PRED_LENGTH_MAP`) | 30 | 8 | 12 | [B1] `data.py` L47-L54 |
| GIFT-Eval M4 datasets (`M4_PRED_LENGTH_MAP`) | 14 | 13 | 18 | [B1] L38-L45 |
| GIFT-Eval "medium" / "long" | x10 / x15 of short in code, but **no daily, weekly or monthly dataset is evaluated at medium or long**: the medium/long list holds only sub-daily configs (5T to H) | | | [B1] L68-L80; [T6] cell 3 `MED_LONG_DATASETS` |
| fev-bench | 28 in 16 tasks (also 14, 48, 61) | 13 in 11 tasks (also 8, 39, 52) | always 12 | [B5] `tasks.yaml` (counts from the file) |
| M4 competition | 14 | 13 | 18 | [B6] |
| M5 competition | 28 | | | [B6] (via fev-bench `m5_1D`, H=28; paper sentence not read) |

- GIFT-Eval paper: "medium and long settings extending the short-term length by factors of 10 and 15, respectively" (§3.2) [B2]. Rolling windows per dataset: `min(max(1, ceil(0.1 * min_len / H)), 20)` [B1].
- fev-bench chooses horizons by use case, not by a formula: "we select horizons that reflect domain-specific forecasting needs, such as 168 steps for hourly energy demand or 30 steps for daily retail sales" [B5]. It uses up to 20 rolling windows for datasets with fewer than 10 series, and needs at least 2H+1 past points before the first window [B5].
- Metrics: fev-bench's primary metric is SQL (scaled quantile loss over 0.1 to 0.9), plus MASE, WQL and WAPE. Its skill score is 1 minus the geometric mean of the model's error divided by seasonal naive's error, clipped [B5]. GIFT-Eval reports MASE and CRPS (`mean_weighted_sum_quantile_loss`), and its leaderboard normalizes each config by Seasonal_Naive before a geometric mean [B3]. GIFT-Eval scales MASE with GluonTS seasonality, which is `D: 1`, `W: 1`, `M: 12` [B4]. So the "seasonal" naive for daily data in GIFT-Eval's MASE scaling is in fact naive.
- **Our horizons sit inside these conventions:** 28 daily steps for PortWatch is exactly the fev-bench and M5 daily default; 7 and 14 daily steps are shorter than every benchmark; 6 monthly steps is half the fev-bench and GIFT-Eval monthly horizon.

### 3b. Published per-horizon results

Mistral, the Chronos-2 report and the TimesFM 2.5 material publish no per-horizon or coverage-by-horizon numbers [T2][T5][B7]. The best available evidence is GIFT-Eval's own result files. Method: per config, divide `MASE[0.5]` and `mean_weighted_sum_quantile_loss` (CRPS) by Seasonal_Naive's, then take the geometric mean, the leaderboard's own aggregation [B3]. Short/medium/long uses the same 21 sub-daily datasets for all three terms, so the curve is comparable. I recomputed the Timestral-209M rows; the other rows come from the delegated reading with the same method.

| Model | MASE / seasonal naive, short → medium → long | CRPS / seasonal naive, short → medium → long | Raw geometric-mean MASE, short → long |
|---|---|---|---|
| Timestral-209M | 0.566 → 0.676 → 0.694 | 0.410 → 0.421 → 0.423 | 0.640 → 0.912 |
| Chronos-2 | 0.611 → 0.725 → 0.757 | 0.448 → 0.471 → 0.472 | 0.690 → 0.994 |
| TimesFM-2.5 | 0.626 → 0.724 → 0.751 | 0.459 → 0.472 → 0.475 | 0.708 → 0.986 |

Short term only, by frequency (MASE ratio, CRPS ratio to seasonal naive; lower means a bigger edge):

| Frequency (configs) | Timestral-209M | Chronos-2 | TimesFM-2.5 |
|---|---|---|---|
| Daily (15) | 0.635, 0.391 | 0.653, 0.410 | 0.656, 0.413 |
| Weekly (8) | 0.714, 0.571 | 0.725, 0.592 | 0.761, 0.597 |
| Monthly (5) | 0.739, 0.676 | 0.756, 0.695 | 0.760, 0.703 |

What this says for aseri:
1. Going 10 to 15x further out, raw error rises 40 to 55%, and the median's edge over seasonal naive shrinks by about a fifth (MASE ratio 0.57 to 0.69). The quantile loss ratio barely moves, so the bands keep their relative value longer than the point forecast does.
2. The edge over seasonal naive is largest on daily data and smallest on monthly data (CRPS ratio 0.39 vs 0.68). Expect UCDP monthly to be the hardest series to beat a naive on.
3. The per-horizon curves from independent Timestral users (section 1) agree: relative MASE vs ARIMA 0.91 at h=1 to 1.03 at h=8 quarters [P6]; temperature MAE up 68% from day 1 to day 3 [P7]; 80% intervals at 75-82% coverage [P6][P8].
4. Older evidence of the same kind: the original TimesFM paper reports zero-shot MAE on ETTh2 rising from 0.35 to 0.62 between horizons 96 and 192 (Table 5) [B7].

## 4. Prior art from comparable models

Scheduled, public, scored forecasting is covered in more detail in [prior-art-and-gaps.md](prior-art-and-gaps.md) section 2. Here only the horizons and the reasons given for them.

| System | What, step | Horizons | Why that horizon (as stated) | Scoring |
|---|---|---|---|---|
| **CDC FluSight 2026-27** [A1] | Weekly flu admissions, 23 quantiles | -1, 0, 1, 2, 3 weeks | Mandated by the hub. Horizon -1 "will not be scored", but teams are encouraged to submit it "to aid in detecting potential calibration issues" | WIS, relative WIS vs a carry-forward baseline, 50% and 95% coverage |
| FluSight evaluation paper [A1] | same | 1 to 4 weeks | n/a | "Forecast skill and 95% coverage for the FluSight ensemble and most component models degrade over longer forecast horizons": ensemble 95% coverage fell from 89.61% to 83.74% (2021-22) and from 85.69% to 77.85% (2022-23) between 1 and 4 weeks |
| FluSight teams using TSFMs [A1] | same | same | Hub-mandated | OHTJHU-BM: median ensemble of zero-shot Chronos-2, TimesFM 2.5, Moirai 2.0 and Timestral-209M (code is flusight-fm [P2]). CU-STS uses Chronos-2 and TimesFM-3. ACCIDDA-insightcast picks among Chronos, TimesFM and Sundial by 4-week WIS |
| **ViEWS** (uses UCDP) [A2] | Monthly fatalities, country and grid | steps 1 to 36 months | Policy early warning, "each of the next 36 months"; built on structural covariates and trained models, not zero-shot | Step-wise CRPS, MIS, coverage, ignorance. The 2023/24 challenge: data to April 2024, forecasts July 2024 to June 2025 (leads 3 to 14 months), benchmarks exactly-zero, last-historical and a conflictology bootstrap; CRPS on the count scale "rewards models that are willing to inch up away from 0" |
| **ACLED CAST** [A3] | Event counts per ADMIN1, country, global; "four-week rolling period[s] ending on Fridays" | 6 periods (~6 months) | Not stated | LightGBM (Tweedie) with hierarchical reconciliation; intervals from empirical residual quantiles in rolling cross-validation; reports % error vs observed totals. No TSFM |
| **TS-Arena** [A4] | Energy, pre-registered before the data exist | 15-min data: 1 day; hourly: 3 days | Operational energy use cases | MASE vs naive, Elo with bootstrap CIs; CRPS "future integration" |
| **Impermanent** [A5] | GitHub activity counts, live | hourly h=24, daily h=7, monthly h=1 (weekly reported inconsistently as 1 or 4) | Not stated | MASE and scaled CRPS |
| **LiveHouse-TS** [A6] | 17 live datasets | daily, weekly, monthly leaderboards | n/a | CRPS; finds static rankings "reshuffle" under live evaluation |
| Hobby cron repos [A7] | Asset prices | TimesFM 2.5 daily H=30; Chronos-Bolt daily; TimesFM nightly | Not stated | None visible |

Lessons:
- **Nobody derives the horizon from model accuracy.** Horizons come from the user's decision (hub mandates, day-ahead markets, policy early warning). Systems that go far (ViEWS 36 months, CAST 6 periods) use trained models with covariates, not a zero-shot univariate model.
- **Live TSFM arenas keep horizons short:** 1 to 3 days for energy, 7 days for daily counts, 1 step for monthly [A4][A5]. That matches our 7-day choice for Ukraine and argues for a modest monthly horizon.
- **Coverage falls with horizon even for the best ensembles** [A1], so publish coverage per horizon, not pooled.
- **Score a "nowcast" horizon but keep it out of the skill claim**, as FluSight does with horizon -1 [A1]. For PortWatch and UCDP, the steps between the last observation and the publication date play that role.
- **For conflict counts, compare against exactly-zero and last-value baselines** and use CRPS on the count scale, as the ViEWS challenge did [A2].

## 5. Recommendation

### 5a. Per series

**PortWatch chokepoint transits (daily).** Context: full history since 2019 (~2,800 days). Horizon: 28 days counted from the last observed date, headline scores at 7, 14 and 28. Reasons: the data lag eats the first days of any horizon. data-sources.md observed a 4-day lag; Macrobond states "This daily dataset is updated by the IMF on a weekly basis" [D3], and third-party pages say Tuesdays (unverified against an IMF page), so the newest observation is 4 to ~11 days old when a reader sees the forecast and a 28-day horizon still reaches 2.5 to 3.5 weeks past "today"; 28 days matches the only Timestral PortWatch run [P4] and the M5 daily convention [P10]; one 32-step patch covers it at no extra cost. Add day of week as a categorical known-future covariate (the one pattern Timestral found at Rotterdam [P4]). Expect the median to lag a regime change by weeks [P13]; mark known breaks on the chart. Near-zero chokepoints (Hormuz at single digits) get MASE problems; score them with quantile loss and coverage only.

**GPR daily (daily).** Context: full history (1985 onward, below the cap). Horizon: 14 days, headline 1, 7, 14. Reasons: news-attention index, spiky and mean-reverting, so beyond a week the forecast is mostly reversion to the mean; prior-art-and-gaps.md calls it "only partly" forecastable. The index is updated every Monday and "the latest data are preliminary and subject to revisions", but dated vintages exist, so the backtest can use as-published data [D1]. Cut to 7 if the backtest shows no edge over naive past a week.

**Ukraine air-raid alerts (daily).** Context: since 2022-03-15 (official) or 2022-02-25 (volunteer), ~1,300 days; test the last 365 days too because of the Dec 2025 raion-level break. Horizon: 7 days, headline 1 and 7. Reasons: bursty and persistent; a level estimate one week out is meaningful (data-sources.md), while Timestral's slow reaction to level shifts [P13] makes longer horizons a drifting average.

**Ukraine drone/missile launches (daily).** Same context and 7-day horizon. Launch counts are heavy-tailed salvos, so publish the band as a base rate, never as strike timing. If a weekly total is wanted, build a weekly-summed series and forecast it 4 weeks ahead: summing daily quantiles does not give quantiles of the sum. Note the data caveats in data-sources.md (Kaggle CC BY-NC-SA, missile types dropped from reporting on 2026-08-10).

**UCDP fatalities (monthly).** Context: full monthly history (GED from 1989, ~450 months; Candidate from 2018). Horizon: 6 months from the last released month, headline 1, 3 and 6. Reasons: monthly release with up to a month's lag makes h=1 nearly a nowcast; ViEWS-style systems go to 36 months but with covariates and trained models (section 4); a zero-shot univariate model has no basis for that. Score Candidate-based forecasts against the later final GED where possible. Fatalities are zero-inflated and heavy-tailed per country; aggregate (global or regional totals) for the headline.

### 5b. Rolling-origin backtest to choose the horizon

**Setup.**
1. **Origins.** Daily series: one origin every 7 days over the last 2 years before the origin of the live record (~100 origins). Monthly: every month over the last 10 years (~120 origins), per series or per country. Keep a later block of origins untouched for a final check.
2. **Data as of the origin.** Context is everything up to the origin, using dated vintages where they exist (GPR) and respecting the publication lag (do not use data that would not yet have been published).
3. **One forecast per origin** of `H_max` steps: 32 for daily (one patch), 12 for monthly. Batch all origins of a series in one `forecast()` call: left-pad shorter contexts with NaN, as flusight-fm does [P2]. Run 28M and 209M; optionally context = full vs last 365 or 730 days.
4. **Baselines:** naive (last value) and seasonal naive (same weekday last week, m=7; same month last year, m=12). The bar is the better of the two, chosen per series on the backtest. For zero-heavy counts (UCDP per country, missile salvos) also run an exactly-zero baseline, which ViEWS found hard to beat [A2]. For probabilistic scores, treat the baseline's point forecast as every quantile, the fev-bench and GIFT-Eval convention (section 3), or add empirical quantiles of past h-step changes for a fairer interval baseline.

**Metrics, per horizon step h (and per bucket 1-7, 8-14, 15-28 for daily).**
- **MASE** of the median: `mean |y - q0.5| / s`, with `s` the mean absolute one-step (daily, weekly) or 12-step (monthly) difference over the context, as GIFT-Eval's GluonTS seasonality does (`D: 1`, `W: 1`, `M: 12`) [B4]. Report the **relative MASE** = model MASE / baseline MASE on the same windows, aggregated with a geometric mean over origins and series, with a block bootstrap CI over origins.
- **Scaled quantile loss (WQL, approximates CRPS):** `2 * sum_t sum_q pinball_q(y_t, q_t) / sum_t |y_t|`, averaged over the levels 0.1 to 0.9 (or all 21). Relative to the baseline.
- **Coverage** of the 50%, 80% and 90% central intervals (levels 0.25-0.75, 0.1-0.9, 0.05-0.95 are all among the 21 outputs) and the mean interval width. A PIT or "share of actuals below q_p vs p" plot over all 21 levels shows which tail is off.
- Skip MASE where `s` is 0 (all-zero context, e.g. quiet missile weeks); use WQL and coverage there.

**Decision rule.** For each series, the published horizon `H*` is the largest h such that, over the h bucket:
1. relative MASE < 1 and its 95% bootstrap upper bound < 1, and
2. 80% interval coverage is within about 5 points of 80% (allow ~8 points if fewer than ~100 origins; the binomial standard error at n=100 is 4 points).

If (1) holds but (2) fails, fit one widening factor per horizon on the first half of origins and check it on the second half, as timestral-weather did [P7]; publish the widened band and say so. If (1) fails at h=1, publish the baseline for that series and keep Timestral as a shadow model until it wins.

**Caveats to state with the results.**
- Mistral has not disclosed the real post-training data or its end date [T7]. Any backtest window before 2026-10-15 may overlap training data, so treat it as an optimistic upper bound (flusight-fm states the same caveat [P2]). Only the frozen live record is leakage-free.
- Re-run the decision after 90 days of live forecasts; switch the published horizon only on live evidence, and log the change.
- Compute: one origin is two passes (symmetric averaging) of one patch; a few hundred origins per series run in minutes on a CPU runner (estimate, not measured).

## Sources

Timestral vendor material
- [T1] README at commit a534bdb: https://github.com/mistralai/timestral/blob/a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff/README.md
- [T2] Model card, Timestral-209M: https://huggingface.co/mistralai/Timestral-209M (raw: https://huggingface.co/mistralai/Timestral-209M/raw/main/README.md)
- [T3] `forecaster.py` at commit a534bdb: https://github.com/mistralai/timestral/blob/a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff/src/timestral/forecaster.py
- [T4] config.json, Timestral-209M: https://huggingface.co/mistralai/Timestral-209M/blob/main/config.json
- [T5] Blog, 2026-10-15: https://mistral.ai/news/timestral/ ; docs page (no horizon guidance): https://docs.mistral.ai/models/timestral-1-0
- [T6] GIFT-Eval Timestral notebook, commit 425049468e: https://github.com/SalesforceAIResearch/gift-eval/blob/425049468e3ec504b6b509a35c5749d7dcf74823/notebooks/timestral.ipynb
- [T7] Issue #3, training data cutoff: https://github.com/mistralai/timestral/issues/3
- [T8] Issue #7, upper quantiles blow up with covariates: https://github.com/mistralai/timestral/issues/7

Projects using Timestral
- [P1] forecast-duel: https://github.com/RazAndAlex/forecast-duel (README, `.github/workflows/nightly.yml`, `duel/models.py` L56, `site/data.json` at commit 9626f2e, 2026-10-29); live page https://razandalex.github.io/forecast-duel/
- [P2] flusight-fm: https://github.com/CDDEP-DC/flusight-fm (README; `flusight_fm/models.py` L177-L199 at commit 53436845)
- [P3] bdbv-fm: https://github.com/CDDEP-DC/bdbv-fm (README)
- [P4] M. Devetak, "Testing Timestral-209M on Maritime Traffic": https://devetak.github.io/data/timestral_blog.html (horizons and context read from the page's embedded chart metadata: `horizonDays` 28/28/183, `contextDays` 1732/1917)
- [P5] P. Dubach, "Forecasting Financial Markets with Timestral": https://philippdubach.com/posts/forecasting-financial-markets-with-timestral/
- [P6] timestral-bank-forecasting: https://github.com/gustavorubim/timestral-bank-forecasting (README "Headline results")
- [P7] timestral-weather: https://github.com/aminekhasteh/timestral-weather (README "Results")
- [P8] demand-forecasting-benchmark: https://github.com/winderai/demand-forecasting-benchmark
- [P9] CharlieLZ/timestral-benchmark: https://github.com/CharlieLZ/timestral-benchmark
- [P10] skateddu/timestral-forecast: https://github.com/skateddu/timestral-forecast
- [P11] carga-sin-timestral: https://github.com/jackgraziano/carga-sin-timestral
- [P12] sensorcast: https://github.com/PanikParty/sensorcast
- [P13] off-the-prior: https://github.com/Cuuper22/off-the-prior
- [P14] CHAP dengue models: https://github.com/hansand02/minimalist-model-chronos
- Other repos in 1b: https://github.com/<owner>/<repo> as named.

Searches
- [S1] GitHub code search, 2026-10-29: `from timestral import`, `mistralai/Timestral`, `TimestralForecaster`, `Timestral-5M/28M/123M`, `timestral path:.github/workflows`, and repo search `timestral` (via `gh search`)
- [S2] HF Spaces using the models: https://huggingface.co/api/spaces?models=mistralai/Timestral-209M (and -5M, -28M, -123M)
- [S3] HF derived models: https://huggingface.co/api/models?filter=base_model:mistralai/Timestral-209M (and the other sizes)
- [S4] Hacker News launch thread: https://news.ycombinator.com/item?id=50150434 (comments 50163023, 50163045, 50153459); search via https://hn.algolia.com/api/v1/search?query=timestral

Data
- [D1] GPR page, update cadence and vintages: https://www.matteoiacoviello.com/gpr.htm
- [D2] UCDP downloads, Candidate release cadence: https://ucdp.uu.se/downloads/
- [D3] PortWatch weekly cadence: Macrobond release note https://help.macrobond.com/?p=18285 ; Tuesday claim (secondary, unverified): https://www.universalassetowners.com/chokepoint-pressure-index/
Benchmarks
- [B1] GIFT-Eval `data.py` at commit 3f77b8b: https://github.com/SalesforceAIResearch/gift-eval/blob/3f77b8b37f6655f8f68ef7f57b567d44ce25e3f9/src/gift_eval/data.py#L35-L81 (prediction lengths, term multipliers) and #L149-L156 (`prediction_length`)
- [B2] GIFT-Eval paper, arXiv 2410.10393: https://arxiv.org/abs/2410.10393
- [B3] GIFT-Eval results at commit 3f77b8b: https://github.com/SalesforceAIResearch/gift-eval/tree/3f77b8b37f6655f8f68ef7f57b567d44ce25e3f9/results (`Timestral-209M`, `Chronos-2`, `TimesFM-2.5`, `Seasonal_Naive`, each `all_results.csv`); leaderboard aggregation: https://huggingface.co/spaces/Salesforce/GIFT-Eval/blob/58e77d5cc9615cbb4cbb359f5ca58a67fcf9cc29/src/utils.py
- [B4] GluonTS default seasonalities (used by GIFT-Eval MASE): https://github.com/awslabs/gluonts/blob/d60556ca71167a3ec1ea807b491dd982d1de2112/src/gluonts/time_feature/seasonality.py#L23-L36
- [B5] fev-bench paper, arXiv 2509.26468 (§3.1): https://arxiv.org/abs/2509.26468 ; tasks at commit 193e4fc: https://github.com/autogluon/fev/blob/193e4fcdbafe37bd5f676a00db65cf02ca1f737e/benchmarks/fev_bench/tasks.yaml
- [B6] M4 horizons, `M4-info.csv`: https://github.com/Mcompetitions/M4-methods/blob/6c1067e5a57161249b17289a565178dc7a3fb3ca/Dataset/M4-info.csv ; M5: Makridakis et al. 2022, IJF, https://doi.org/10.1016/j.ijforecast.2021.11.013 (28-day sentence not read, unverified verbatim)
- [B7] Chronos-2 report, arXiv 2510.15821: https://arxiv.org/abs/2510.15821 (no per-horizon breakdown found); TimesFM paper, arXiv 2310.10688, Table 5: https://arxiv.org/abs/2310.10688

Prior art
- [A1] FluSight hub at commit 983be64: `hub-config/tasks.json` https://github.com/cdcepi/FluSight-forecast-hub/blob/983be64459c20aad8c418affcb16283216a2ce1b/hub-config/tasks.json#L235-L240 , README L26 https://github.com/cdcepi/FluSight-forecast-hub/blob/983be64459c20aad8c418affcb16283216a2ce1b/README.md#L26 , model metadata `OHTJHU-BM.yml`, `CU-STS_base.yml`, `ACCIDDA-insightcast.yml` in `model-metadata/`; CDC 2024-25 evaluation: https://www.cdc.gov/flu-forecasting/evaluation/2024-2025-report.html ; Mathis et al. 2024, Nat Commun, coverage by horizon: https://pmc.ncbi.nlm.nih.gov/articles/PMC11282251/ (text read via https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11282251/fullTextXML)
- [A2] ViEWS: horizon config https://github.com/views-platform/views-models/blob/120ff879d67c73e33b83953a45af352a792d651b/models/average_cmbaseline/configs/config_hyperparameters.py#L12-L13 ; Hegre et al. 2019 https://www.prio.org/publications/11231 ; evaluation https://github.com/views-platform/views-evaluation/blob/e01422dc3bebf790ad3e6f104d04ed1d613d39be/README.md ; 2023/24 challenge, arXiv 2407.11045: https://arxiv.org/abs/2407.11045
- [A3] ACLED CAST methodology: https://acleddata.com/methodology/cast-methodology
- [A4] TS-Arena: https://github.com/DAG-UPB/ts-arena/blob/6043096ddbf291f3cc2e59ec57b44b47478099ba/README.md ; arXiv 2512.20761: https://arxiv.org/abs/2512.20761
- [A5] Impermanent, arXiv 2603.08707: https://arxiv.org/abs/2603.08707
- [A6] LiveHouse-TS, arXiv 2608.17299: https://arxiv.org/abs/2608.17299
- [A7] Cron repos: https://github.com/namakshenas/asset-forecaster/blob/bbc2b947f7563f8b8bd1e4ab4ed4b6ad01d4f523/update_pred.py#L14 , https://github.com/nickujung-art/danjiondo/blob/HEAD/.github/workflows/compute-predictions-ai.yml , https://github.com/bhalekarabhijit/alphabets/blob/HEAD/.github/workflows/timesfm-nightly.yml

Section 3b and 4 items marked from "delegated reading" (Chronos-2 and TimesFM-2.5 GIFT-Eval ratios, ViEWS, CAST, TS-Arena, Impermanent, LiveHouse-TS, cron repos) were read by a helper agent with the URLs above; I re-checked the GIFT-Eval prediction lengths, the Timestral-209M ratios and the FluSight coverage numbers myself.
