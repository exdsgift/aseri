# Covariates for aseri's forecasts: when they help, how much, and whether "more significant covariates = more accurate" holds

Scope: evidence as of 2026-10-30 on exogenous covariates for probabilistic forecasting with time-series foundation models (TSFMs) and classical models, for aseri's nine daily series (GPR, Brent, "World War III" pageviews, four PortWatch chokepoints, Ukraine air-raid alert-hours, drones downed). It builds on, and does not redo, aseri's own covariate spike ([spike-covariates.md](../../spike-covariates.md)) and the covariate paragraph of the best-practice report ([Best practice previsioni probabilistiche.md](../../reports/Best%20practice%20previsioni%20probabilistiche.md)).

Conventions: "SQL" is fev-bench's scaled quantile loss (lower is better); "skill" is 1 minus the geometric mean of the SQL ratio against seasonal naive; ratios below 0% mean the covariate-using model has lower error. Numbers marked **[computed]** are my own aggregation of the public per-task fev-bench result CSVs, reproducible with [code/fev_covariate_split.py](code/fev_covariate_split.py) (it has an assert self-check and downloads the CSVs from [autogluon/fev results](https://github.com/autogluon/fev/tree/main/benchmarks/fev_bench/results)).

## 1. Benchmarks: what covariate tasks show, with effect sizes

### Takeaway
On benchmarks, covariates give large gains only when they are **known over the horizon and drive the target mechanically**: weather for energy load, published load and renewable forecasts for power prices, store openings and promotions for retail. In those cases, error falls by 10 to 50%. On fev-bench's 42 covariate tasks, the only clean within-model ablation shows a 10 to 13% lower SQL for Chronos-2 and TabPFN-TS. Splitting those tasks shows the gain comes from the known-future tasks. On past-only tasks (macro, COVID, wind-farm sensors), covariate-capable models gain nothing over univariate ones. GIFT-Eval has no covariate tasks at all.

### Cited Findings
**fev-bench: the within-model ablation**
- fev-bench has 100 tasks. 30 include known dynamic covariates, 24 past dynamic covariates and 19 static covariates (non-exclusive). The source collections (Monash, GIFT-Eval, BOOM) "lack covariates", so covariate tasks were added from Kaggle and domain repositories ([fev-bench v4, §3.1](https://arxiv.org/pdf/2509.26468)).
- On the 42 tasks with dynamic covariates, Chronos-2 has an SQL skill of 47.0% with covariates vs 40.9% without, and TabPFN-TS 42.5% vs 34.1%. The authors conclude that "covariate information is a key driver of their strong results" ([fev-bench v4, §7.2](https://arxiv.org/pdf/2509.26468)). Converted to error ratios, that is −10.3% SQL for Chronos-2 (0.530 / 0.591) and −12.7% for TabPFN-TS (0.575 / 0.659) **[computed from the reported skills]**.
- Native multivariate modelling (several targets jointly, no covariates) is worth much less. On 35 multivariate tasks, Chronos-2 scores 55.0% vs 54.4% and Toto-1.0 54.7% vs 54.1% ([fev-bench v4, §7.2](https://arxiv.org/pdf/2509.26468)), about −1.3% SQL **[computed]**.
- In the fev-bench runs, only some models receive covariates:
  - Chronos-2 uses past and known covariates, and TabPFN-TS uses known ones only ([fev-bench v4, §7](https://arxiv.org/pdf/2509.26468)).
  - TimesFM-2.5 is run univariate: its wrapper calls `convert_input_data(..., as_univariate=True)` ([fev timesfm-2.5 wrapper](https://github.com/autogluon/fev/blob/main/models/timesfm-2.5/model.py)). Moirai-2.0 runs with `ignore_covariates: true` ([moirai-2_0.csv](https://github.com/autogluon/fev/blob/main/benchmarks/fev_bench/results/moirai-2_0.csv)).
  - Timestral's wrapper passes past and known dynamic columns as covariates ([fev timestral wrapper](https://github.com/autogluon/fev/blob/main/models/timestral/model.py)).
  - TabPFN-TS past covariates were withheld because they "consistently degraded its accuracy" ([fev-bench v2, Appendix B](https://arxiv.org/html/2509.26468v2)).

**fev-bench split by covariate type [computed]**
- These are paired geometric-mean SQL ratios, covariate-using model over univariate model, with a 90% bootstrap CI over tasks. Tasks flagged `trained_on_this_dataset` are excluded. Source: the [fev-bench results CSVs](https://github.com/autogluon/fev/tree/main/benchmarks/fev_bench/results) and [tasks.yaml](https://github.com/autogluon/fev/blob/main/benchmarks/fev_bench/tasks.yaml).

  | Pair | No-covariate tasks (58) | Known-future tasks (30) | Past-only tasks (12) |
  |---|---|---|---|
  | Chronos-2 / TiRex | −4.0% [−6.1, −2.1] | **−17.6% [−22.9, −12.3]** | −1.2% [−5.1, +2.5] |
  | Chronos-2 / TimesFM-2.5 (univariate) | −3.7% [−5.1, −2.2] | **−15.8% [−21.6, −9.9]** | −4.0% [−12.5, +5.4] |
  | Timestral-209M / TiRex | −8.9% [−12.0, −6.1] | **−24.5% [−31.3, −17.7]** | −5.3% [−8.9, −1.4] |
  | Timestral-209M / TimesFM-2.5 | −8.4% [−10.6, −6.2] | **−21.1% [−27.7, −14.4]** | −8.7% [−15.9, +0.4] |
  | TabPFN-TS (known only) / TiRex | +8.2% [+5.0, +11.7] | **−12.9% [−19.9, −6.1]** | +6.6% [+1.5, +12.2] |

- Net of each model's edge on no-covariate tasks, known-future covariates are worth about −14% (Chronos-2), −17% (Timestral) and −20% (TabPFN-TS) **[computed: ratio on known tasks / ratio on no-covariate tasks]**.
- On past-only tasks the net effect is +3% (Chronos-2) and +4% (Timestral), i.e. no gain **[computed]**.
- TabPFN-TS is a placebo check. It ignores past covariates, and its ratio on past-only tasks (+6.6%) matches its no-covariate ratio (+8.2%). So the past-only subset is not intrinsically easier or harder for an ignoring model **[computed]**.
- Univariate models lose skill on known-future tasks: TiRex falls from 0.452 to 0.379, Toto-1.0 from 0.446 to 0.333, Moirai-2.0 from 0.424 to 0.366. Chronos-2 holds (0.475 → 0.488) and Timestral rises (0.501 → 0.531) **[computed]**.

**Per-task gains (Chronos-2 / TiRex SQL ratio, with Timestral / TiRex in brackets) [computed from the results CSVs]**
- **Energy, 1 known covariate (air temperature), h = 168 hourly (proenfo GFC12/14/17):** 0.71, 0.60, 0.55 (0.55, 0.38, 0.37).
- **Day-ahead power prices with published load and renewable forecasts, h = 24:**
  - epf_de 0.48 (0.47), epf_np 0.68 (0.56);
  - epf_fr 0.90, epf_be 0.95, epf_pjm 0.94.
- **Retail with business-controlled known drivers:**
  - rossmann_1D (Open, Promo, holidays; h = 48 days): 0.53 (0.46);
  - favorita_transactions_1D (holiday; h = 28 days): 0.66 (0.70);
  - rohlik_sales_1D (13 known incl. prices and holidays; h = 14): 0.77 (0.74).
- **No gain with 8 known event-calendar dummies (M5 1D/1W/1M):** 1.01, 1.00, 1.00.
- **Past-only, macro and epidemiological series, Chronos-2 / TiRex:**
  - fred_md_2025/cee (4 past monetary series) 1.04;
  - fred_qd_2025/cee 1.07;
  - gvar (past oil, metal and materials prices) 1.00;
  - uk_covid (5 past hospital and vaccination series) 1.02, 1.02, 0.87, 1.10;
  - kdd_cup_2022 wind power (9 past weather and turbine sensors) 0.96 to 1.02.

  Timestral does slightly better on the macro ones (0.86 to 0.95).
- The whole fev-bench covariate gain therefore comes from a handful of tasks where the covariate is a mechanical or decided driver of the target over the horizon.

**Chronos-2 technical report**
- "The largest gains with ICL are observed on tasks with covariates." Multivariate tasks show "only modest gains". Exact values appear only in Figures 3 to 5 ([Chronos-2 report, §5](https://arxiv.org/html/2510.15821v1)).
- The case studies are known-future:
  - On EPF-DE, the univariate forecast was "reasonable but imprecise" and the load and solar+wind forecasts sharpened it.
  - On Rossmann, the univariate forecast is "nearly flat" while promotion and holiday covariates capture the dynamics ([Chronos-2 report, Figs 6 to 7](https://arxiv.org/html/2510.15821v1)).
- Chronos-2 reports no task where covariates hurt ([Chronos-2 report](https://arxiv.org/html/2510.15821v1)).
- TabPFN-TS's own README: on the 25 fev-bench tasks with numeric known covariates, adding lag features of the known covariates "lowers SQL by 4.5%", with 21 of 25 tasks improved and the worst at +1.5% ([tabpfn-time-series README](https://github.com/PriorLabs/tabpfn-time-series)).

**GIFT-Eval, Moirai, Toto**
- GIFT-Eval and the other general benchmarks "largely ignore covariates". Their collections lack covariates ([fev-bench v4, §3.1 and §6.1](https://arxiv.org/pdf/2509.26468)). No GIFT-Eval covariate result exists.
- Moirai-2 "is the only model from the Moirai family that does not support covariates". In a 2026 EPF study, Moirai-1 and Moirai-MoE (which do) "performed considerably worse than Moirai-2" ([Lipiecki and Weron 2026, §4.1](https://arxiv.org/abs/2609.00089)).
- Toto-1.0 ignores covariates in fev-bench ([fev-bench v4, §7](https://arxiv.org/pdf/2509.26468)). The Toto-2.0 wrapper handles target columns only ([fev toto-2.0 wrapper](https://github.com/autogluon/fev/blob/main/models/toto-2.0/model.py)).

**Energy and electricity-price papers (known-future covariates)**
- **Belgian day-ahead prices (2026):** Chronos-2 with exogenous inputs (ARX) reached MAE 12.43 EUR/MWh vs 15.61 in its univariate (AR) mode, about −20%. It was 5% better than the best ML ensemble (13.22). On imbalance prices it was about 10% worse than the ensemble except at the 2-hour horizon ([arXiv 2605.17045](https://arxiv.org/abs/2605.17045); figures as reported by [an aggregator summary](https://www.themoonlight.io/es/review/empirical-evaluation-of-time-series-foundation-models-for-day-ahead-and-imbalance-electricity-price-forecasting-in-belgium), not checked against the PDF).
- **EPF in Germany, Poland and Spain, 2021 to 2025 (Lipiecki and Weron 2026)**, German CRPS:
  - Moirai-2 (no covariates) 16.20;
  - TimesFM-2.5 with XReg 14.26;
  - Chronos-2 11.80;
  - TabPFN-3 9.15, against the DDNN-JSU benchmark at 10.70.

  TabPFN cut CRPS vs DDNN by 14.5%, 12.3% and 12.4% in the three markets. The paper restates an earlier finding on Moirai that "gains from including exogenous variables are limited" for models "designed primarily for univariate forecasting" ([arXiv 2609.00089, Table 3 and §2.2](https://arxiv.org/abs/2609.00089)).
- **Electricity demand in Singapore and Australia (about 30 features: weather, price, calendar, air quality)**, MAPE change from adding all features (positive = better):
  - Chronos-2 daily Singapore: +5.4% at h = 1, +3.7% at h = 30, +25.7% at h = 365.
  - Chronos-2 hourly Singapore: −0.3% to −3.7%, worse at every horizon.
  - Moirai zero-shot daily Singapore: −22% to −46% worse at h = 1 to 60, then +60% to +76% better at h = 180 to 365.
  - ChronosX at 1-hour Singapore: MAPE rose from 0.63 to 8.81.

  The authors find that a simple baseline "frequently outperforms all foundation models in Singapore's stable climate" ([arXiv 2602.05390](https://arxiv.org/html/2602.05390); values read from its tables by a summariser).

**Covariates that are noisy, misaligned or missing**
- Exogenous-fusion models "degrade 32–62% above the endogenous-only floor" on EPF when covariates are corrupted (EPF, 5 markets, h = 24, % vs a univariate PatchTST floor):
  - TimeXer is −17.9% with clean covariates, +34.3% with Gaussian noise, +19.0% when misaligned and +27.5% when missing.
  - iTransformer is +15.5% even with clean covariates.

  The "clean" condition hands the models perfect future covariates on two of three datasets ([arXiv 2607.05452, Table 2](https://arxiv.org/html/2607.05452)).

### Inferences
- The benchmark gains are real, but they come from a different kind of covariate than anything aseri has. fev-bench's winners are temperature, published TSO forecasts, store-open flags and promotions. Each is a near-deterministic driver, and its future value is known or forecast far better than the target. aseri's candidates (Brent, GPR sub-indexes, pageviews, other chokepoints, drones) are contemporaneous, noisy and past-only. They match fev-bench's past-only tasks, where the gain is zero.
- Some fev-bench "known" covariates are probably realised values rather than forecasts. The GEFCom-derived proenfo tasks list `airtemperature` as known, and GEFCom distributed observed station temperatures. So a part of the largest gains is likely oracle information that would shrink with real weather forecasts. This is inference: fev-bench does not discuss oracle vs forecast covariates. The EPF tasks do use genuine published forecasts.
- The cross-model split confounds task mix and model quality. TiRex, Toto and Moirai lose skill on the known-future tasks, so part of the "gain" is that these tasks are hard without covariates. The within-model ablation (−10 to −13%) is the cleaner number.

### Gaps
- No numeric univariate-vs-ICL Chronos-2 result per task or per domain is published in text. The report's Figures 3 to 5 hold it, and I did not digitise them.
- fev-bench cannot isolate horizon effects: each dataset has a single horizon.
- I found no benchmark with geopolitical, conflict or shipping-traffic covariate tasks.
- Moirai-1 covariate ablations were not retrieved.
- The building-energy Chronos-2 covariate study ([Electronics 2026](https://doi.org/10.3390/electronics15153474)) was found but not read.

## 2. Past-only vs known-future covariates for 7 to 28 days ahead

### Takeaway
A past-only covariate can help a multi-step forecast only if it leads the target by at least the horizon, or if the model forecasts it well. On fev-bench, past-only covariates gave covariate-capable TSFMs no measurable gain (net +3 to +4% SQL vs 14 to 20% better on known-future tasks). TabPFN-TS drops them because they hurt. aseri's spike found the same thing for every past-only candidate: the lead disappears once publication lags are applied. Known-future covariates also help at 28 to 48 days, but only when deterministic (calendar, store hours, promotions).

### Cited Findings
- **Textbook rule.** To make ex-ante forecasts, "the model requires forecasts of the predictors". Calendar predictors are the exception, being "all known in advance". Scenario forecasts' intervals "do not include the uncertainty" of the future predictors. The workaround is predictors lagged by h, so that "the predictor set is formed by values of the xs that are observed h time periods prior to observing y" ([FPP3 §7.6](https://otexts.com/fpp3/forecasting-regression.html)).
- **Classical tools say the same.**
  - statsforecast: "If the future values of the exogenous regressors are not available, then they must be forecasted... Without them, it is not possible to generate the forecast" ([statsforecast exogenous guide](https://nixtlaverse.nixtla.io/statsforecast/docs/how-to-guides/exogenous.html)).
  - mlforecast requires "the future values of exogenous features" in `X_df` at predict time ([mlforecast exogenous guide](https://nixtlaverse.nixtla.io/mlforecast/docs/how-to-guides/exogenous_features.html)). The fev-bench mlforecast wrapper drops past dynamic columns entirely ([fev mlforecast wrapper](https://github.com/autogluon/fev/blob/main/models/mlforecast/model.py)).
- **TSFMs mask past-only covariates over the horizon.**
  - Chronos-2 sets "targets and past-only covariates" to missing in the future part of the input ([Chronos-2 report, §3.1](https://arxiv.org/html/2510.15821v1)).
  - TabPFN-TS: past covariates "Dropped — no future values available". The README warns of lower performance on tasks that depend on them ([tabpfn-time-series README](https://github.com/PriorLabs/tabpfn-time-series)).
  - TimesFM-2.5 XReg infers the horizon from the covariate length minus the context length. Its dynamic covariates must therefore span context plus horizon, i.e. be known-future ([timesfm_2p5_base.py, `forecast_with_covariates`](https://github.com/google-research/timesfm/blob/master/src/timesfm/timesfm_2p5/timesfm_2p5_base.py)).
  - Timestral gives past-only covariates a blank, not a forecast, beyond one 1,024-step block ([spike-covariates.md, Setup](../../spike-covariates.md)).
- **fev-bench, past-only subset (12 tasks) [computed]:**
  - Net of their no-covariate edge, Chronos-2 is +2.9% and Timestral +4.0% vs TiRex, against −14% and −17% on known-future tasks.
  - Chronos-2 vs TiRex on past-only tasks: −1.2% [−5.1, +2.5].
  - Per task, macro (fred_md/qd, gvar), COVID and wind-farm past covariates sit at ratios 0.96 to 1.10 for Chronos-2 ([results CSVs](https://github.com/autogluon/fev/tree/main/benchmarks/fev_bench/results)).
- **Known-future gains reach the 28 to 48 day range when the driver is deterministic [computed]:** rossmann_1D (h = 48 days) 0.53, favorita_transactions_1D (h = 28) 0.66, rohlik_sales_1D (h = 14) 0.77. But M5's 8 event dummies (h = 28) give 1.01.
- **Horizon dependence is not monotone across studies.**
  - In the Singapore and Australia demand study, Chronos-2's daily gain from features grows with horizon (+3.7% at h = 30, +25.7% at h = 365).
  - Moirai's flips from −46% at h = 30 to +76% at h = 365 ([arXiv 2602.05390](https://arxiv.org/html/2602.05390)).
- **aseri's own spike (Timestral-209M, 52 origins, 4 to 8 day publication masks):**
  - Every past-only set fails, and several are significantly worse on longer buckets:
    - World War III views for GPR: +1.5% WQL on h 8 to 30;
    - drones for alert-hours: +0.8% (8 to 30) and +1.9% (31 to 90);
    - Brent for Hormuz: +1.7% on 31 to 90.
  - The only known-future candidate with an effect, Lunar New Year for Taiwan, gives −1.7% on h 8 to 30. It improves with horizon (−1.9% on 31 to 90) and cuts holiday-week MAE by 27%, on a single event ([spike-covariates.md](../../spike-covariates.md)).
- **Lagged ground truth beats a contemporaneous big-data proxy.** Google Flu Trends had out-of-sample MAE 0.486 vs 0.311 for a lagged-CDC model with 52-week seasonality, and 0.232 for GFT combined with lagged CDC. "Even 3-week-old CDC data do a better job of projecting current flu prevalence than GFT" ([Lazer et al. 2014, Science](https://dash.harvard.edu/server/api/core/bitstreams/7312037d-0e0d-6bd4-e053-0100007fdf3b/content)).

### Inferences
- For aseri, the realistic known-future set is calendar-only:
  - day of week (already learnt by Timestral);
  - Lunar New Year and Eid/Ramadan windows for shipping;
  - possibly scheduled events, such as OPEC+ meeting dates for Brent or announced elections.

  Everything else (Brent, GPR, pageviews, other chokepoints, drones) is past-only. It would need to lead the target by 7 to 28 days after publication lags, which the spike's lag analysis rules out: the Suez and Bab-el-Mandeb lead peaks at a 5 to 6 day lag with r = 0.18.
- Forecasting a past-only covariate and feeding the forecast back in adds no information beyond the joint history. That is what a multivariate model does, and native multivariate modelling is worth only about 1.3% on fev-bench.

### Gaps
- I found no study isolating past-only covariate gains by horizon (1 to 7 vs 8 to 28 days) for TSFMs.
- I found no study of covariates' value for event-driven regime shifts (e.g. Hormuz in 2026), other than aseri's own spike.

## 3. More is not always better: number of covariates, overfitting, factors, combination

### Takeaway
"More significant covariates → more accurate" is contradicted at every level:
- **Within fev-bench**, the covariate-model advantage shrinks as the number of covariates grows (−26% with 1 covariate, −7% with 8 or more, vs TiRex).
- **In macro forecasting**, a few factors or a pre-screened 40-series panel match or beat 147 to 215 raw predictors, and shrinkage over many regressors loses to factor models.
- **In nowcasting**, Google Flu Trends' search over 50 million candidate terms overfit 1,152 points.

In-sample significance is weak evidence of out-of-sample value. The robust remedies are compressing (factors), targeting (pre-screening), regularising, or simple averaging.

### Cited Findings
- **fev-bench by number of dynamic covariates, Chronos-2 / TiRex [computed]:**
  - 1 covariate (6 tasks): −25.8% [−35.7, −15.2];
  - 2 to 3 (15 tasks): −14.3% [−21.6, −7.6];
  - 4 to 7 (8 tasks): −11.6% [−24.7, +2.0];
  - 8 or more (13 tasks): −6.8% [−11.1, −2.6].

  Timestral / TiRex runs −37.2%, −19.3%, −19.2% and −10.3% ([results CSVs](https://github.com/autogluon/fev/tree/main/benchmarks/fev_bench/results), [tasks.yaml](https://github.com/autogluon/fev/blob/main/benchmarks/fev_bench/tasks.yaml)). The confound: the 1-covariate tasks are the strong-driver energy tasks.
- **Many weak covariates can add nothing.** M5 with 8 known event dummies: Chronos-2 / TiRex 1.00 to 1.01. kdd_cup_2022 with 9 past sensors: 0.96 to 1.02 **[computed]**.
- **More features can hurt TSFMs.** In the Singapore and Australia demand study, using about 30 features instead of none made Moirai zero-shot 22 to 46% worse at daily h = 1 to 60, made ChronosX's 1-hour MAPE 14 times larger (0.63 → 8.81), and made Chronos-2 hourly Singapore slightly worse at every horizon ([arXiv 2602.05390](https://arxiv.org/html/2602.05390)).
- **Diffusion indexes (Stock and Watson 2002).** 215 predictors compressed into a few principal-component indexes outperformed "univariate autoregressions, small vector autoregressions, and leading indicator models" for eight monthly US series at 6, 12 and 24 months ([Stock and Watson 2002, JBES](https://econpapers.repec.org/RePEc:bes:jnlbes:v:20:y:2002:i:2:p:147-62)). The gain came from compressing many series, not from adding them as raw regressors.
- **Shrinkage vs factors (Stock and Watson 2012).** On 143 quarterly US series (1960 to 2008), pretest, Bayesian model averaging, empirical Bayes and bagging forecasts "are inferior to the DFM forecasts" for most series ([Stock and Watson 2012, JBES](https://econpapers.repec.org/RePEc:taf:jnlbes:v:30:y:2012:i:4:p:481-493)). Factor models beat throwing many raw regressors into a shrunk regression.
- **Are more data better for factors? (Boivin and Ng 2006)** "Factors extracted from as few as 40 pre-screened series often yield satisfactory or even better results than using all 147 series". The failure mode is cross-correlated idiosyncratic errors, and "a factor that is dominant in a small dataset but is a dominated factor in a larger dataset".
  - Nominal factors from 46 series beat factors from all 147 series for forecasting real variables.
  - A down-weighting rule beat the plain 147-series factors on about 65% of series.

  Their words: "use of more data to extract the factors does not necessarily yield better results" ([Boivin and Ng, NBER w9829](https://nber.org/system/files/working_papers/w9829/w9829.pdf)).
- **Targeted predictors (Bai and Ng 2008).** Factors from a thresholded subset of informative predictors improved on standard diffusion-index forecasts at every horizon. The selected predictors changed with horizon and sample period, and one-month inflation needed heavy targeting "to filter out noisy predictors" ([Bai and Ng 2008, J. Econometrics](https://econpapers.repec.org/RePEc:eee:econom:v:146:y:2008:i:2:p:304-317)).
- **Overfitting in big-data nowcasting (Google Flu Trends).** "The methodology was to find the best matches among 50 million search terms to fit 1152 data points". GFT then "missed high for 100 out of 108 weeks" from August 2011, by more than 50% in 2011/12, and its errors were autocorrelated and seasonal ([Lazer et al. 2014](https://dash.harvard.edu/server/api/core/bitstreams/7312037d-0e0d-6bd4-e053-0100007fdf3b/content)).
- **Forecast-combination puzzle.** Simple averages beat estimated "optimal" weights mainly because the weights must be estimated, and that estimation error dominates when the number of forecasts is large relative to T. Unstable estimated weights perform poorly out of sample ([Elliott, Combination survey](https://econweb.ucsd.edu/~gelliott/Combination.pdf); [Qian et al. 2019, Econometrics](https://doaj.org/article/f822f1fec1fd4fa8910b85bbb692dd52)). Weighting covariates by in-sample fit is the same estimation problem.
- **aseri spike.** The 3-covariate set for Hormuz (Brent + GPR Threats + Bab-el-Mandeb) was worse than Brent alone on h 31 to 90 (+2.4% vs +1.7% WQL, both CIs above 0). On Bab-el-Mandeb, the 3-covariate set helped only on 31 to 90 (−1.4%) ([spike-covariates.md](../../spike-covariates.md)).

### Inferences
- For aseri, adding covariates one by one, because each is "significant" in-sample, is the GFT and kitchen-sink pattern. With 52 origins and 1 to 3% effects, several sets will look significant by chance. The spike's pre-registered keep rule is the right defence. Any extension should count the number of sets tried.
- If cross-series information is wanted, the factor-model lesson suggests one compressed "geopolitical stress" factor (e.g. the first principal component of GPR, Brent volatility, chokepoint deviations) rather than raw rows. Even then, it is past-only and faces the lead-time problem in section 2.

### Gaps
- No TSFM study varies the number of covariates holding the task fixed; the fev-bench split is cross-task.
- The exact Stock and Watson 2002 relative-MSE tables and the Smith and Wallis (2009) and Claeskens et al. (2016) primary texts were not retrieved: the Harvard PDFs returned 403 and those papers were reached only through secondary summaries.

## 4. Geopolitical and conflict forecasting: what covariates add

### Takeaway
In conflict forecasting, the target's own recent history is the dominant and hardest-to-beat predictor. In the 2023/24 VIEWS challenge, a benchmark that simply replays each country's last 12 months led the live leaderboard. Structural covariates mostly predict where conflict happens, not when. Within-country, their power collapses to near chance (AUC 0.46 to 0.68). News-text topics are the one covariate family with robust within-country timing signal, at a yearly horizon. Machine-coded event data (GDELT) are unreliable, and big-data proxies overfit (Google Flu Trends).

### Cited Findings
- **VIEWS feature importance.** Derived UCDP conflict history is "the most important driver of our forecasts" ([CORDIS, VIEWS project report](https://cordis.europa.eu/project/id/101069312/reporting/it)). A 2023 Hegre slide shows importances of 0.877 (conflict history), 0.360 (neighbouring conflict) and 0.123 (democracy) for an unspecified model, so it is illustrative only ([Hegre 2023 slides](https://www.gdsd.statistik.uni-muenchen.de/2023_neu/presentations_speaker/hegre_gdsd_2023_corrected.pdf)). Onset forecasting "is very hard" (same slides).
- **2023/24 VIEWS Prediction Challenge (probabilistic fatalities, 13 teams, 24 contributions):**
  - The benchmark `conflictology_country12` "uses the set of values from each of the past 12 months for the same country as the forecast distribution" ([VIEWS challenge paper, arXiv 2407.11045, §3](https://arxiv.org/abs/2407.11045)).
  - As of February 2025, "Conflictology" led the rankings at both country and sub-national level ([PRIO news](https://www.prio.org/news/3602)).
  - Contributions included a random forest on conflict history plus 15 LDA news topics ("ConflictForecast"), and models with "about 100 features" ([arXiv 2407.11045](https://arxiv.org/abs/2407.11045)).
- **2020 escalation competition.** The organisers note that decades of in-sample studies of simple functional forms "failed to substantively improve predictions of armed conflict relative to a simple bivariate model" ([Hegre, Vesco and Colaresi, Lessons from an escalation prediction competition](https://www.prio.org/publications/13334); quoted from a search snippet, full text not read).
- **Mueller and Rauh (APSR 2018), annual onset:**
  - Published covariate models score well overall but poorly within country. Rainfall: AUC 0.85 → 0.58 (civil war) and 0.74 → 0.64 (armed conflict). Economic shocks and institutions: 0.87 → 0.57 and 0.77 → 0.48. Instability model: 0.83 → 0.64 and 0.76 → 0.48 ([Mueller and Rauh 2016 WP](https://conference.nber.org/conf_papers/f88439/f88439.pdf)).
  - News topics (LDA, 15 topics) fall only from 0.87 to 0.82 and 0.77 to 0.73, while other models lose "around 20 percentage points".
  - In previously peaceful countries, the within-topic model beats the overall model: 0.83 vs 0.76 (civil war) and 0.70 vs 0.61 (armed conflict) ([Mueller and Rauh 2018 version, Table 2](https://www.bde.es/f/webpi/SES/seminars/2018/Fich/sie1824.pdf); [APSR article](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/4EABB473AFE18F157EEDE4339F34ABB0/S0003055417000570a.pdf/reading_between_the_lines_prediction_of_political_violence_using_newspaper_text.pdf)).
- **Mueller and Rauh (JEEA 2022), "The Hard Problem of Prediction for Conflict Prevention".** A random forest on LDA topics from 3.8 million articles. Several topics are negatively associated with outbreaks and "gain importance when predicting hard onsets" ([CEPR DP13748](https://cepr.org/publications/DP13748)). AUC numbers were not retrieved.
- **GDELT and ICEWS reliability (Wang, Kennedy, Lazer and Ramakrishnan, Science 2016):**
  - Correlation between event datasets is weak (r < 0.3): GDELT vs hand-coded GSR 0.222, ICEWS vs GSR 0.229, GDELT vs ICEWS 0.317.
  - SPEED and GDELT agree on 17.2% of protest days, SPEED and ICEWS on 10.3%.
  - After filtering, "only 21% of GDELT's valid URLs" referred to real protests. GDELT and ICEWS were not designed to de-duplicate.
  - Correlations improve at weekly or monthly aggregation and in large upticks ([Science 353:1502](https://people.cs.vt.edu/~naren/papers/1502.full.pdf)).
- **Google Trends.** Choi and Varian frame query data as useful for "predicting the present" (nowcasting contemporaneous indicators) rather than forecasting ahead ([Choi and Varian 2012 abstract](https://dataedge.berkeley.edu/2012/schedule/predicting-present-google-trends.html)). Its canonical failure is GFT (section 3: 100 of 108 weeks too high, beaten by lagged official data).
- **Prediction markets.** In a geopolitical forecasting tournament (more than 2,400 forecasters, 261 events), last-day market prices beat simple poll averages. Team polls with temporal decay, performance weighting and recalibration beat markets, especially early in long questions ([Atanasov et al. 2017, Management Science, via Penn Today](https://penntoday.upenn.edu/news/penn-scientists-show-prediction-polls-can-outdo-prediction-markets)).

### Inferences
- aseri's series sit on the "incidence and intensity" side, where conflict history dominates. They are not "onset in peaceful places", where text helps. Covariate-free TSFMs replaying the series' own dynamics are the analogue of VIEWS' winning benchmark.
- Text-topic signals work at yearly, country-level onset horizons. No evidence was found that they help daily intensity series 7 to 28 days ahead.
- Pageviews and search data are nowcasting signals with documented drift and overfitting risk. aseri's spike already found "World War III" views hurting GPR at 8 to 30 days.
- Prediction-market prices are plausible known-at-origin covariates only for discrete events (e.g. "ceasefire by date X"). There is no evidence on using them as covariates for continuous daily series.

### Gaps
- No final (post-June 2025) VIEWS 2023/24 scores were retrieved.
- No study was found that measures covariate gains for daily shipping-traffic, oil-price or air-raid series.
- No replication study specific to GDELT-based conflict forecasting was retrieved beyond the 2016 reliability audit.
- No study was found that uses Polymarket or Metaculus prices as time-series covariates.

## 5. What can use covariates on CPU today, and at what cost

### Takeaway
Six options can take covariates on a CPU today:
- **Chronos-2** (Apache-2.0, 120M parameters, CPU supported, past and known numeric and categorical covariates) is the most capable commercially usable covariate-native TSFM. It tops the fev-bench paper's table at 47.3% skill. In the current results CSVs, Timestral-209M (50.4%) and TimesFM-3 (49.0%) score higher, and both also use covariates **[computed]**.
- **TimesFM-2.5 XReg** (Apache-2.0) is a linear ridge correction on known-future covariates only. It needs JAX and scikit-learn.
- **TabPFN-TS** handles known-future covariates only, and is slow without a GPU or its cloud client.
- **Moirai-2 and Toto** take no covariates.
- **Timestral**, already in use, takes both kinds at 3 to 4.5 times the inference cost.
- **LightGBM/MLForecast and AutoARIMA in statsforecast** are cheap but need future covariate values or explicit lags.

For aseri, the cost that matters is data coupling, not compute.

### Cited Findings

| Option | Covariate types | Licence | CPU and cost evidence |
|---|---|---|---|
| **Chronos-2** | Past-only and known-future, real and categorical, "all covariate types natively"; context 8,192, horizon 1,024 ([HF card](https://huggingface.co/amazon/chronos-2)) | Apache-2.0 ([HF card](https://huggingface.co/amazon/chronos-2)); `commercial_use: true` ([fev models.yaml](https://github.com/autogluon/fev/blob/main/benchmarks/fev_bench/models.yaml)) | "Supporting both GPU and CPU inference". GPU: more than 300 series/s on an A10G ([HF card](https://huggingface.co/amazon/chronos-2)). The 28M small variant is "nearly 2×" faster at up to 1 point lower skill ([Chronos-2 report](https://arxiv.org/html/2510.15821v1)). No published CPU timing. Median fev-bench task time 2.7 s on GPU **[computed from chronos-2.csv]** |
| **TimesFM-2.5 + XReg** | `forecast_with_covariates`: dynamic numerical and categorical, static numerical and categorical. Dynamic ones must span context plus horizon, so known-future only. Modes "xreg + timesfm" and "timesfm + xreg", `ridge` penalty, `force_on_cpu` option for the linear model ([source](https://github.com/google-research/timesfm/blob/master/src/timesfm/timesfm_2p5/timesfm_2p5_base.py)) | Code and weights up to 2.5: Apache-2.0 ([README](https://github.com/google-research/timesfm)) | XReg imports `jax` and `sklearn` ([xreg_lib.py](https://github.com/google-research/timesfm/blob/master/src/timesfm/utils/xreg_lib.py)). It is a linear regression on TimesFM residuals added to the forecast ([Lipiecki and Weron 2026, §4.1.3](https://arxiv.org/abs/2609.00089)). Not exercised on fev-bench, where TimesFM-2.5 ran univariate ([wrapper](https://github.com/autogluon/fev/blob/main/models/timesfm-2.5/model.py)) |
| **TimesFM 3.0** | "Native support for past-only and past-and-future dynamic covariates" ([README](https://github.com/google-research/timesfm)) | Weights "non-commercial, non-production" ([README](https://github.com/google-research/timesfm)) | fev-bench skill 0.490 (with covariates) **[computed]**; median task time 20.5 s on GPU **[computed]** |
| **Moirai** | Moirai-1 and MoE support covariates; Moirai-2 does not ([Lipiecki and Weron 2026](https://arxiv.org/abs/2609.00089)) | Moirai-2 `commercial_use: false` ([fev models.yaml](https://github.com/autogluon/fev/blob/main/benchmarks/fev_bench/models.yaml)) | Moirai-1 and MoE "performed considerably worse than Moirai-2" on EPF ([same](https://arxiv.org/abs/2609.00089)) |
| **TabPFN-TS** | Known-future only. Past and static covariates dropped ([README](https://github.com/PriorLabs/tabpfn-time-series)) | Code Apache-2.0. Local weights need licence acceptance ([README](https://github.com/PriorLabs/tabpfn-time-series)). fev metadata: tabpfn-ts `true`, tabpfn-ts-3 `false` ([models.yaml](https://github.com/autogluon/fev/blob/main/benchmarks/fev_bench/models.yaml)) | Defaults to a cloud client, "no GPU needed" ([README](https://github.com/PriorLabs/tabpfn-time-series)). Median fev-bench inference 725 s per task (total about 59 h) vs 2.7 s for Chronos-2 **[computed from tabpfn-ts.csv]** |
| **Toto** | None (target columns only) ([fev-bench](https://arxiv.org/pdf/2509.26468); [toto-2.0 wrapper](https://github.com/autogluon/fev/blob/main/models/toto-2.0/model.py)) | `commercial_use: true` | n/a |
| **Timestral (current)** | Past and known, numeric and categorical ([spike-covariates.md](../../spike-covariates.md)) | fev metadata lists all Timestral sizes as `commercial_use: false` ([models.yaml](https://github.com/autogluon/fev/blob/main/benchmarks/fev_bench/models.yaml)) | The covariate path costs 3.1x (1 covariate) to 4.4x (2 covariates) per forecast on CPU. About 7 s rises to 20 to 30 s a day for 6 series ([spike-covariates.md, Costs](../../spike-covariates.md)) |
| **LightGBM / CatBoost via MLForecast** | Static by default. Dynamic needs future values in `X_df`. Lags of exogenous series via `transform_exog` ([mlforecast guide](https://nixtlaverse.nixtla.io/mlforecast/docs/how-to-guides/exogenous_features.html)) | Open source; licence not checked here | fev-bench skill 0.210 (LightGBM) and 0.230 (CatBoost), below every TSFM (0.40 to 0.50). Their wrapper drops past covariates ([fev mlforecast wrapper](https://github.com/autogluon/fev/blob/main/models/mlforecast/model.py)) **[computed]** |
| **AutoARIMA (ARIMAX) in statsforecast** | Exogenous regressors with future values in `X_df`, otherwise "they must be forecasted" ([statsforecast guide](https://nixtlaverse.nixtla.io/statsforecast/docs/how-to-guides/exogenous.html)) | Open source; licence not checked here | fev-bench skill 0.213 for AutoARIMA (univariate run) **[computed]** |

- The aseri spike measured the real operating cost. Each cross-series covariate makes one series' forecast depend on another source being fetched and fresh. Brent from FRED is up to 8 days stale and GPR weekly ([spike-covariates.md, Costs](../../spike-covariates.md)).

### Inferences
- If aseri ever adopts covariates, the cheapest CPU route is a calendar row (Lunar New Year, Ramadan and Eid) passed to the model it already runs (Timestral) or to Chronos-2. No new data source is needed.
- TimesFM-2.5 XReg suits known-future linear effects (a holiday dip) but cannot use past-only drivers by construction.
- TabPFN-TS's CPU cost and licence gating make it a poor fit for a daily CPU job.
- Gradient boosting and ARIMAX need either future covariate values or lagged ones, i.e. the same lead-time problem. On fev-bench they are 20 to 30 skill points behind the TSFMs before any covariate gain.

### Gaps
- No published CPU timings for Chronos-2, TimesFM-2.5 XReg or TabPFN-TS local mode were found. fev-bench timings are GPU (A10G) per task, not per series.
- Licence terms behind TabPFN's local-weights acceptance page were not visible.
- Timestral's own licence is flagged non-commercial only in fev metadata; the primary licence text was not checked here.
