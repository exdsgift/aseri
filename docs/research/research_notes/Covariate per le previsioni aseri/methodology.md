# Covariate scout methodology: screening dozens of candidate covariates for aseri's probabilistic forecasts without false discoveries

Scope: how to measure, test and adopt covariates for aseri's 28-day quantile forecasts (WIS, coverage, ratio to the univariate baseline), sized for one maintainer, CPU only, monthly offline runs. Context read, not redone: [spike-covariates.md](../../spike-covariates.md), [spec 6.5](../../../superpowers/specs/2026-10-29-aseri-design.md#65-covariate-scout), and the evaluation sections of [Best practice previsioni probabilistiche.md](../../reports/Best%20practice%20previsioni%20probabilistiche.md). Simulation code for every number marked "simulated": [code/scout_power_sim.py](code/scout_power_sim.py), run on 2026-10-30 with numpy 2.5.4, scipy 1.18.1, arch 8.0.0, statsmodels 0.15.0.

## 1. Out-of-sample vs in-sample: why significance is not forecast gain, and which test fits which comparison

### Takeaway
In-sample significance (a non-zero coefficient, Granger causality) answers a population question. The scout's question is a finite-sample one: does this forecasting method, with this covariate and its real publication lag, score better out of sample? That question is Giacomini-White's unconditional predictive ability, tested with a Diebold-Mariano-type t-statistic on per-origin WIS differences and a long-run variance that handles overlap. Clark-West and Clark-McCracken corrections are for MSPE of estimated nested regressions, so they do not transfer to a frozen foundation model scored on WIS.

### Cited Findings
- Inoue and Kilian argue that the in-sample vs out-of-sample gap comes mainly from power, not from data mining or instability. Under the null both have similar size, in-sample tests usually have more power, and they conclude in-sample results are "typically more credible" about population predictability ([CEPR DP3671](https://cepr.org/publications/dp3671); published in Econometric Reviews 23(4), 2005, [EconPapers](https://econpapers.repec.org/RePEc:taf:emetrv:v:23:y:2005:i:4:p:371-402)).
- Hansen and Timmermann show that common out-of-sample test statistics are asymptotically equivalent to Wald statistics. For nested models the limit has a chi-squared representation, and they characterize power under local alternatives ([Econometrica 83(6), 2015](https://econometricsociety.org/publications/econometrica/2015/11/01/equivalence-between-out-sample-forecast-comparisons-and-wald)). A working-paper draft states the out-of-sample test equals the difference between two Wald statistics, one on the full sample and one on the initial estimation sample ([FRBSF draft](https://www.frbsf.org/Fri_1615_Hansen.pdf), as summarized in search results; the exact published conditions may differ).
- Diebold, 20 years on, says the DM test "is a test for comparing forecasts, not models". For comparing models in pseudo-out-of-sample settings, full-sample procedures are simpler and more compelling, and the belief that holdouts protect against overfitting is "largely unfounded" ([NBER w18391](https://www.nber.org/papers/w18391); JBES 33(1), 2015, [IDEAS](https://ideas.repec.org/a/taf/jnlbes/v33y2015i1p1-1.html)).
- Giacomini and White target the finite-sample loss differential E(L(û1) − L(û2)) = 0 (unconditional) or E(· | F_t) = 0 (conditional), not the population-parameter loss. Their framework applies "to any well-behaved loss function" and is "not exclusive to point forecasts" ([McCracken 2020, St. Louis Fed WP 2020-050, p. 1 and fn. 1](https://s3.amazonaws.com/real.stlouisfed.org/wp/2020/2020-050.pdf)). It requires a finite estimation window (rolling or fixed), which "prevents the parameter estimates, and subsequent forecast errors, from converging to their population counterparts" ([same, p. 3](https://s3.amazonaws.com/real.stlouisfed.org/wp/2020/2020-050.pdf)). The tests handle "both nested and nonnested models" and capture estimation uncertainty ([Econometrica 74(6), 2006](https://econometricsociety.org/publications/econometrica/2006/11/01/tests-conditional-predictive-ability)).
- The conditional GW null is "extremely narrow and imposes very strong restrictions on the DGP". For quadratic loss it requires E(y_{t+h} | F_t) to equal the average of the two forecasts ([McCracken 2020, p. 2](https://s3.amazonaws.com/real.stlouisfed.org/wp/2020/2020-050.pdf)).
- Clark-West, nested models: under the null that the small model is true, the large model "adds noise" by estimating zero coefficients, so its MSPE is expected to be higher. They test the adjusted differential f_t = (y − ŷ1)² − [(y − ŷ2)² − (ŷ1 − ŷ2)²], one-sided, rejecting above 1.282 (10%) or 1.645 (5%), with HAC standard errors for multi-step errors ([NBER t0326, sec. 2, eq. 2.1](https://www.nber.org/system/files/working_papers/t0326/t0326.pdf)). In 48 simulation designs, the unadjusted MSPE-normal test "performed abysmally": median size below 0.01 at nominal 0.10. Rolling regressions gave better-sized tests than recursive ones ([same, pp. 2 to 3](https://www.nber.org/system/files/working_papers/t0326/t0326.pdf)). Published version: J. Econometrics 138(1), 2007 ([EconPapers](https://econpapers.repec.org/RePEc:eee:econom:v:138:y:2007:i:1:p:291-311)).
- Clark and McCracken's Handbook chapter surveys point-forecast evaluation, including population-level vs finite-sample evaluation and conditional vs unconditional tests ([Handbook of Economic Forecasting vol. 2, ch. 20](https://econpapers.repec.org/RePEc:eee:ecofch:2-1107); [Cleveland Fed WP 11-20](https://www.clevelandfed.org/publications/working-paper/2011/wp-1120-advances-in-forecast-evaluation)).
- Density and quantile versions:
  - Amisano and Giacomini give an out-of-sample weighted likelihood-ratio test for density forecasts under the log score, with user weights that focus on regions of the distribution ([JBES 25, 2007](https://econpapers.repec.org/RePEc:bes:jnlbes:v:25:y:2007:p:177-190)).
  - Gneiting and Ranjan propose threshold- and quantile-weighted CRPS, which stays proper while focusing on tails or centre, and note that the weighted likelihood-ratio approach "can be hedged" ([JBES 29(3), 2011](https://econpapers.repec.org/RePEc:taf:jnlbes:v:29:y:2011:i:3:p:411-422)).
  - Giacomini and Komunjer give a GMM encompassing test for conditional quantile forecasts under tick (pinball) loss. It is valid for nested or non-nested models and any number of forecasts ([JBES 23, 2005](https://ideas.repec.org/a/bes/jnlbes/v23y2005p416-431.html)).
- statsmodels 0.15.0 ships `diebold_mariano_test(y, forecast_a, forecast_b, *, lags=None, criterion='mse', power=2, harvey_adj=False, horizon=1)`. `criterion` may be a callable, the default lags are max(horizon − 1, ceil(n^(1/3))), and `harvey_adj=True` uses t(n−1) critical values (docstring verified locally; [statsmodels docs](https://www.statsmodels.org/dev/generated/statsmodels.tsa.stattools.diebold_mariano_test.html)). The returned p-value is two-sided: 1.53e-17 for a statistic of 12.05 with 59 df, exactly 2 × the t tail (checked locally).
- Coroneo and Iacone show that fixed-smoothing (fixed-b, fixed-m) asymptotics give correctly sized DM tests with few out-of-sample observations. In the working paper, fixed-m beats the Harvey-Leybourne-Newbold correction ([J. Applied Econometrics 35(4), 2020](https://econpapers.repec.org/RePEc:wly:japmet:v:35:y:2020:i:4:p:391-409); [York DP 15/15](https://www.york.ac.uk/media/economics/documents/discussionpapers/2015/1515.pdf)).
- Lazarus, Lewis, Stock and Watson recommend, for one restriction, the equal-weighted cosine (EWC) long-run variance with ν = 0.4·T^(2/3) cosine terms and t_ν critical values. If Newey-West is used instead, they recommend a truncation of 1.3·T^(1/2) with fixed-b critical values ([JBES 2018, accepted manuscript](https://scholar.harvard.edu/sites/scholar.harvard.edu/files/stock/files/lazarus_lewis_stock_watson_har_inference_recommendations_for_practice_jbes_2018.pdf)).
- Local evidence that in-sample links do not become forecast gains:
  - Bab el-Mandeb leads Suez physically, with a detrended correlation of 0.18 at a 5 to 6 day lag, yet ΔWQL was −0.1% to −0.4%, not significant.
  - "World War III" pageviews made GPR 1.5% worse on 8-30, and drones made alert-hours 0.8% worse.
  - In the synthetic positive control the model does use a real lead: a 5-day lead cut MAE by 89% for 209M.
  - Source: [spike-covariates.md](../../spike-covariates.md).

### Inferences
- For aseri the comparison is between two forecast methods: Timestral univariate, and Timestral with the covariate, the same context and the real lag mask. No parameter is estimated on aseri data, so the Clark-McCracken problem of nested regressions converging to the same forecast does not arise. The covariate path changes the attention route even for a useless covariate (spike: "any covariate switches the model to a different attention path"), so the loss differential has non-degenerate variance. The DM or GW unconditional t-test on WIS differences is therefore the right primary test, one-sided (H1: the covariate improves WIS).
- To stay inside GW's assumptions literally, fix the context length: a rolling window, for example the model's block size or a fixed 1,024 to 2,048 days, rather than "all history", which grows with the origin.
- Use in-sample tools (Granger tests, lagged cross-correlations on detrended, lag-masked data) only to rank candidates and pick which lags to try, on discovery data. Never count them as evidence. Inoue-Kilian's point stands: in-sample tests are powerful about population predictability. But population predictability at daily resolution, after a 1 to 8 day publication mask, is not the scout's question.
- Clark-West is relevant only if the scout adds a classical estimated model, such as a quantile regression on lagged covariates, and then only for its point MSPE. For quantile-level diagnostics (does the covariate help the tails?), use per-quantile pinball differentials in the same DM framework, or the Giacomini-Komunjer encompassing test. For the headline, stick to WIS.
- statsmodels' DM can be fed precomputed WIS by passing `criterion=lambda y, f: np.asarray(f)` with `forecast_a = wis_base` and `forecast_b = wis_cand`. Verified: the statistic matched a hand-coded NW + HLN to 1e-14. Halve the p-value, or recompute it from t(n−1), for the one-sided test.

### Gaps
- The full texts of Giacomini-White 2006 and Hansen-Timmermann 2015 are paywalled. GW's rolling-window requirement is taken from McCracken's 2020 summary, and the Hansen-Timmermann draft wording comes from a search summary.
- I found no paper that derives DM or GW asymptotics for frozen pretrained (in-context) forecasters. Treating them as "methods with no estimated parameters" is my inference.

## 2. Multiple testing over 20 to 100 candidates

### Takeaway
Use a two-stage design. Stage 1 screens all candidates on discovery data with Benjamini-Hochberg FDR (q = 0.10) on one-sided HAR p-values, cross-checked with Romano-Wolf StepM (`arch.bootstrap.StepM`), with Hansen's SPA as a global "does anything beat the baseline?" gate. Stage 2 confirms the few survivors on a sealed holdout with Holm at a 5% familywise level. White's Reality Check is superseded by SPA. The Model Confidence Set answers a different question, "which models are best", not "which candidates beat the baseline", so report it only as a secondary view.

### Cited Findings
- White's Reality Check tests whether the best model from a specification search beats a benchmark. It addresses the fact that reusing one time-series history makes good results possibly "due to chance" ([Econometrica 68(5), 2000](https://www.econometricsociety.org/publications/econometrica/2000/09/01/reality-check-data-snooping)).
- Hansen's SPA test is "more powerful and less sensitive to poor and irrelevant alternatives" than the Reality Check. It uses a studentized statistic and a sample-dependent null distribution ([JBES 23(4), 2005, abstract as reproduced](https://typeset.io/pdf/a-test-for-superior-predictive-ability-1fbgz05jht.pdf); [DOI](https://doi.org/10.1198/073500105000000063)).
- Romano and Wolf's stepwise procedure controls the familywise error rate asymptotically. It rejects more false hypotheses than single-step methods, captures the joint dependence of the statistics, recommends studentization, and is built for comparing many strategies with one benchmark ([Econometrica 73(4), 2005](https://www.econometricsociety.org/publications/econometrica/browse/2005/07/01/stepwise-multiple-testing-formalized-data-snooping)).
- The Model Confidence Set is "a set of models constructed to contain the best model at a given confidence level", analogous to a confidence interval, without assuming any model is true ([Econometrica 79(2), 2011](https://www.econometricsociety.org/publications/econometrica/2011/03/01/model-confidence-set); [CREATES WP 2010-76](https://repec.econ.au.dk/repec/creates/rp/10/rp10_76.pdf)).
- Benjamini-Yekutieli prove that BH controls FDR under positive regression dependence (PRDS). Covered cases include "comparisons of many treatments with a single control" and positively correlated multivariate normal statistics. Under arbitrary dependence, BH at α/L_m (L_m ≈ ln m) controls FDR ([Annals of Statistics 29(4), 2001](https://projecteuclid.org/euclid.aos/1013699998)).
- An intersection-union test (reject only if every component test rejects at α) has overall type I error at most α with no adjustment, and is generally conservative (Berger 1982, as summarized in [arXiv 2202.12540](https://arxiv.org/pdf/2202.12540)).
- `arch` 8.0.0 API, from the docs, verified by a local run:
  - `SPA(benchmark, models, block_size=None, reps=1000, bootstrap='stationary', studentize=True, nested=False, *, seed=None)`. `.pvalues` gives the lower, consistent and upper p-values, and `.better_models(pvalue, pvalue_type)` lists the candidates that beat the benchmark ([SPA docs](https://arch.readthedocs.io/en/latest/multiple-comparison/generated/arch.bootstrap.SPA.html)).
  - `StepM(benchmark, models, size=0.05, block_size=None, reps=1000, bootstrap='stationary', studentize=True, nested=False, *, seed=None)` with `.superior_models`. "The size controls the Family Wise Error Rate" ([StepM docs](https://arch.readthedocs.io/en/latest/multiple-comparison/generated/arch.bootstrap.StepM.html)).
  - `MCS(losses, size, reps=1000, block_size=None, method='R', bootstrap='stationary', *, seed=None)` with `.included`, `.excluded` and `.pvalues` ([MCS docs](https://arch.readthedocs.io/en/latest/multiple-comparison/generated/arch.bootstrap.MCS.html)).
  - Inputs are losses (lower is better). The default `block_size` is sqrt(T), and the docs advise setting it explicitly.
- statsmodels 0.15.0 `multipletests` supports `bonferroni`, `holm`, `fdr_bh` and `fdr_by`. On a 10-p-value test vector at α = 0.05, Holm rejected 1, BH 2 and BY 1 (local run).
- Simulated, end to end: 104 weekly origins, 40 candidates, 3 with a true 5% WIS gain and overlapping noise. `StepM(size=0.05, block_size=8, bootstrap='stationary')` returned exactly the 3 true candidates ([code/scout_power_sim.py](code/scout_power_sim.py), `stepm_demo`). An earlier scratch run of the same setup, with MA(3) noise, gave the same StepM result: SPA's p-values were all 0, and an MCS at 10% including the baseline kept only the 3 true candidates (one draw each, not a size study).
- The existing aseri report already flags that 9 series × 2 buckets × 3 baselines make 54 comparisons, about 3 of which "win" by chance at p < 0.05, and recommends one pre-registered primary comparison per series or Holm ([Best practice report, evaluation section](../../reports/Best%20practice%20previsioni%20probabilistiche.md)).

### Inferences
- Which tool answers which question:

  | Question | Tool | Error controlled | Use in scout |
  |---|---|---|---|
  | Does any candidate beat the univariate baseline for series s? | SPA (consistent p-value) | size of the global null | gate: if p > 0.10, stop for that series and report "none" |
  | Which candidates beat the baseline? | StepM (Romano-Wolf), or BH on HAR p-values | FWER (StepM), FDR (BH) | Stage 1 screen |
  | Is the best candidate's gain real? | Reality Check | size | superseded by SPA; skip |
  | Which models tie for best? | MCS | coverage of the best set | secondary report only. "Baseline excluded from the 90% MCS" is a useful extra signal |
  | Final yes or no on a few survivors | one-sided HAR test per survivor + Holm | FWER | Stage 2 on the holdout |

- Why FDR for screening and FWER for confirmation. With 20 to 100 candidates, FWER control at the screen kills power (Section 4: at α = 0.001, the per-test level of Bonferroni for 50 tests, power on 52 weekly origins drops from 0.73 to 0.25 for a 5% gain with a 10% sd). False positives at the screen are cheap, because the holdout catches them. False positives at adoption are expensive: each adds a daily failure point and restarts the live record (spec 6.5). So use a liberal screen (BH q = 0.10) and a strict confirmation (Holm, α = 0.05, over at most about 10 survivors in total).
- Every candidate within a series is compared with the same univariate baseline, which is the "many treatments vs a single control" PRDS case. BH is valid there, and BY is the safe fallback if candidates from different series are pooled in one family.
- Encode the spec's "both the 1-7 and 8-28 buckets" rule as an intersection-union test: the candidate's p-value is the larger of its two bucket p-values. That needs no correction across buckets. The correction then counts only candidates (× series if pooled).
- Lagged versions, transforms and sets are separate hypotheses. A run with 5 covariates × 4 lags × 9 series is 180 tests, not 5. Each multi-covariate set is one more candidate.
- Do not pad the candidate list with implausible series. The Reality Check loses power with "poor and irrelevant alternatives". SPA and StepM are robust to that, but BH's power also falls as m grows. Require a written mechanism and an expected lead per candidate, as the spike's table did.

### Gaps
- I did not retrieve the arch docs' description of MCS `method='R'` vs `'max'`, or the SPA p-value definitions beyond "lower, consistent, upper".
- I found no study of the finite-sample size of StepM or SPA with as few as 50 to 150 heavily overlapping observations. The demo above is one draw, not a size study.

## 3. Selecting and evaluating on the same data

### Takeaway
Any choice made by looking at scores (which lag, which transform, which set, which window, which buckets) is a search, and the winner's in-sample p-value is biased. Split the origins in time: a discovery window for screening and any tuning, a 28-day embargo, then a sealed holdout of the most recent origins, used once per candidate. A shadow live period is the cleanest final check. K-fold cross-validation does not apply to 28-step forecasts from a frozen model, so rolling-origin evaluation is the design.

### Cited Findings
- Cawley and Talbot: over-fitting the model-selection criterion causes selection bias in performance estimates. Its size is "often of comparable magnitude to differences in performance between learning algorithms", and it applies to any selection that optimizes a criterion computed on a finite sample ([JMLR 11, 2010](https://www.jmlr.org/papers/v11/cawley10a.html)).
- Hansen and Timmermann: when the sample split is a choice variable, size distortions can be very large, "more than tripling the rejection rates of conventional tests". Power is highest with an early split, which gives a long evaluation period, and they propose a split-robust statistic ([CREATES RP 2012-43](https://repec.econ.au.dk/repec/creates/rp/12/rp12_43.pdf)).
- Rossi and Inoue: out-of-sample tests "might be subject to data snooping across different window sizes if used repeatedly". They give tests robust to the window choice, for rolling, fixed or recursive schemes ([JBES 30(3), 2012](https://econpapers.repec.org/RePEc:taf:jnlbes:v:30:y:2012:i:3:p:432-453); [UPF WP 1404](https://econ-papers.upf.edu/papers/1404.pdf)).
- Bergmeir, Hyndman and Koo: standard K-fold cross-validation is valid for purely autoregressive models whose errors are uncorrelated ([CSDA 120, 2018](https://econpapers.repec.org/RePEc:eee:csdana:v:120:y:2018:i:c:p:70-83)).
- Johari, Pekelis and Walsh: p-values are "wholly unreliable" when decisions are made while monitoring continuously. Always-valid p-values, built from mixture SPRTs, keep the type I error bound at any data-dependent stopping time ([arXiv 1512.04922](https://arxiv.org/abs/1512.04922); Operations Research 70(3), 2022, [EconPapers](https://econpapers.repec.org/RePEc:inm:oropre:v:70:y:2022:i:3:p:1806-1821)).
- The spike fixed its keep rule before seeing results, and the spec requires that "changing the rule is a code change with a reason in the commit" ([spike](../../spike-covariates.md); [spec 6.5](../../../superpowers/specs/2026-10-29-aseri-design.md#65-covariate-scout)).

### Inferences
- Rolling-origin design for the scout:
  - **Origins:** weekly, on a fixed weekday, with the context window fixed in length (Section 1).
  - **Discovery window:** all origins from the start date to the holdout start minus 28 days.
  - **Embargo:** 28 days, so no discovery target date falls inside the holdout's target windows.
  - **Holdout:** the most recent 52 weekly origins, sealed. The scout code reads them only in Stage 2, and only for candidates that passed Stage 1. Log every Stage 2 read in the report.
- Nested time-series CV is needed only if the scout tunes something, such as choosing the best of several lags. Do it inside the discovery window with an inner rolling split, carry only the chosen configuration to the holdout, and count the tuned family in the Stage 1 multiplicity. If nothing is tuned and every variant is a pre-registered candidate, plain rolling origin plus multiplicity correction is enough.
- K-fold CV (Bergmeir et al.) needs uncorrelated errors from a model refit per fold. Neither holds here: 28-step errors are serially correlated by construction, and Timestral is not refit. Use rolling origin only.
- The monthly cadence is a sequential-testing problem. Re-testing the same candidate on mostly the same origins every month until it passes is optional stopping (Johari et al.). Rules:
  1. A candidate that fails Stage 2 is not re-tested until at least 26 new weekly origins exist.
  2. Its re-test uses only those new origins as the holdout.
  3. Cache forecasts so monthly runs only add new origins (Section 8).
  If the owner wants monitoring every month, the principled alternative is an always-valid (mSPRT or e-value) test on the accumulating holdout. That is more machinery than a one-maintainer project needs.
- Hansen-Timmermann's power result argues for the longest evaluation period the data allow. For Timestral, though, older origins are more likely inside the unknown training data. Report the gain separately for "possibly seen in training" origins and recent ones, and treat the live shadow period as the only clean test ([spike, Leakage caveat](../../spike-covariates.md)).

### Gaps
- I found no paper that sets an embargo or purge length for overlapping multi-step targets in forecast-comparison tests. The 28-day embargo is my inference from the horizon.
- I did not retrieve how Rossi-Inoue's window-robust statistics are computed, or their critical values.

## 4. Power and sample size with overlapping 28-day horizons

### Takeaway
With weekly origins, the 8-28 bucket carries about one third of the nominal origins as independent information (simulated n_eff ≈ 17 for 52 origins). Daily origins over the same span add almost nothing (n_eff ≈ 17 for 365). A 5 or 10% WIS gain is detectable within 1 to 2 years of weekly origins if the per-origin sd of the relative WIS differential is at most about the size of the effect. The spike's 2% floor is not detectable after a 50-candidate correction with less than about 5 years. Treating origins as independent, as a plain bootstrap over origins does, rejects a true null 17 to 42% of the time at a nominal 5%.

### Cited Findings
- The Best practice report's rule: detecting an improvement μ at 80% power needs about 7.8 × (σ_LR/μ)² effectively independent origins, two-sided at 5%, with n_eff = n / (1 + 2 Σ ρ_k) over the first h − 1 autocorrelations. It found 30 daily origins at h = 7 carry about 9 independent forecasts, and 120 at h = 28 about 18 ([Best practice report](../../reports/Best%20practice%20previsioni%20probabilistiche.md)).
- The spike's CIs were "optimistic": its bootstrap over origins ignored the overlap of neighbouring windows ([spike, Limits](../../spike-covariates.md)).
- Simulated design (local, 4,000 replications per cell; [code/scout_power_sim.py](code/scout_power_sim.py)):
  - **Data:** the loss differential d(t, h) = μ + a·u_{t+h} + b·ε, where u is a daily AR(1) with persistence φ, shared by all origins that score the same target day. The score is the mean over h = 8 to 28.
  - **σ:** the sd of the per-origin bucket mean, in units of the baseline's mean WIS.
  - **Tests, one-sided:** naive iid t; DM with Newey-West, k − 1 lags (k = ceil(28/spacing)) and HLN, t(n−1); EWC with ν = 0.4·n^(2/3) and t_ν.
- Size at nominal 5%, and effective sample size:

  | φ | Origins | n_eff | Naive | DM-HLN | EWC |
  |---|---|---|---|---|---|
  | 0 | 52 weekly | 19.4 | 0.17 | 0.09 | 0.06 |
  | 0 | 104 weekly | 39.3 | 0.16 | 0.08 | 0.06 |
  | 0 | 365 daily | 20.5 | 0.35 | 0.09 | 0.09 |
  | 0.7 | 52 weekly | 16.9 | 0.18 | 0.08 | 0.05 |
  | 0.7 | 104 weekly | 33.5 | 0.18 | 0.08 | 0.06 |
  | 0.7 | 365 daily | 17.4 | 0.37 | 0.09 | 0.10 |
  | 0.95 | 52 weekly | 8.1 | 0.28 | 0.15 | 0.08 |
  | 0.95 | 104 weekly | 15.8 | 0.27 | 0.14 | 0.07 |
  | 0.95 | 365 daily | 8.2 | 0.42 | 0.16 | 0.19 |

- Power, weekly origins, φ = 0.7. Each cell is DM-HLN / EWC at one-sided α = 0.05, then at α = 0.001 (Bonferroni for 50 candidates):

  | n weekly origins (span) | σ 5%, gain 5% | σ 10%, gain 5% | σ 10%, gain 10% | σ 5%, gain 2% |
  |---|---|---|---|---|
  | 26 (0.5 y) | 0.91/0.81, 0.48/0.08 | 0.51/0.39, 0.12/0.02 | 0.92/0.82, 0.50/0.08 | 0.38/0.29, 0.07/0.01 |
  | 52 (1 y) | 0.99/0.98, 0.88/0.37 | 0.73/0.60, 0.25/0.05 | 0.99/0.98, 0.88/0.36 | 0.57/0.43, 0.15/0.02 |
  | 104 (2 y) | 1.00/1.00, 1.00/0.89 | 0.93/0.86, 0.58/0.20 | 1.00/1.00, 1.00/0.90 | 0.80/0.71, 0.34/0.10 |
  | 156 (3 y) | 1.00/1.00, 1.00/0.99 | 0.98/0.95, 0.78/0.44 | 1.00/1.00, 1.00/1.00 | 0.92/0.85, 0.55/0.23 |

  DM-HLN's power is flattered by its 8% size. EWC holds about 5% but its t_ν tails are heavy, so it loses most power at α = 0.001.
- LLSW's EWC and Coroneo-Iacone's fixed-m approach are the published remedies for small-sample HAR size distortion ([LLSW 2018](https://scholar.harvard.edu/sites/scholar.harvard.edu/files/stock/files/lazarus_lewis_stock_watson_har_inference_recommendations_for_practice_jbes_2018.pdf); [Coroneo and Iacone 2020](https://econpapers.repec.org/RePEc:wly:japmet:v:35:y:2020:i:4:p:391-409)).

### Inferences
- **Sizing formula** (one-sided, 80% power): n_eff ≈ (z_{1−α} + 0.84)² · (σ/μ)². That is 6.2·(σ/μ)² at α = 0.05 and 15.4·(σ/μ)² at α = 0.001. Convert with n_weekly ≈ 3 × n_eff when regimes are moderate (φ ≤ 0.7) and ≈ 6.5 × n_eff when they are very persistent (φ = 0.95). The simulation agrees within its oversize: μ = 5%, σ = 10%, n = 52 predicts Φ(√17 · 0.5 − 1.645) = 0.66, and the simulation gave 0.60 to 0.73.
- **What σ to expect.** Back-solving the spike's 90% CIs (half-width / 1.645 × √N) gives a per-origin sd of the relative WQL differential of about 5% for the candidates that moved forecasts:
  - Taiwan dow+lny 8-30: 5.0%;
  - Hormuz brent 8-30: 5.7%;
  - GPR ww3 8-30: 5.9%;
  - alerts drones 8-30: 3.2%;
  - Suez bem 8-30: 1.7%.
  A covariate with a 5 to 10% effect probably moves forecasts more, so plan for σ of 5 to 10%.
- **Origins needed** for 80% power, weekly origins, φ about 0.7:

  | Gain μ | σ | Unadjusted α = 0.05 | Bonferroni m = 50 |
  |---|---|---|---|
  | 10% | 5 to 10% | 10 to 20 origins | 25 to 50 origins |
  | 5% | 5% | about 20 | about 50 |
  | 5% | 10% | about 75 | about 185 (3.5 y) |
  | 2% | 5% | about 115 (2.2 y) | about 290 (5.6 y) |

  Double these for very persistent regimes. Alert-hours and drones start in 2022, about 240 weekly origins in all, and PortWatch in 2019, about 400. So the 2% floor is testable at the screen only with all history, which runs straight into training-contamination risk. Practical options: raise the minimum effect of interest to 5% for the multiplicity-corrected screen and keep 2% as the point-estimate floor, or cut m.
- **Weekly origins, not daily.** Daily origins multiply compute 7× for the same n_eff, and they make every HAR test worse: EWC 10 to 19% and DM 9 to 16% oversized. Weekly spacing gives k = 4 overlapping steps for 8-28 and none for 1-7.
- **The spike's verdicts survive.** Its CIs were too narrow by about √(n/n_eff) ≈ 1.7 on the 8-30 bucket. Taiwan's dow+lny 8-30 CI [−3.0, −0.6] would widen to roughly [−3.8, +0.4]. That is approximate (it assumes the spike's bootstrap SE equals the iid SE), but it strengthens the spike's null verdicts rather than overturning them.

### Gaps
- The DGP (AR(1) target-day shocks plus 30% origin noise) is a stylized choice. I found no published power study for overlapping 28-day probabilistic forecast comparisons. The real n_eff should be estimated per series from the discovery data's loss-differential autocorrelations.
- I did not simulate the stationary block bootstrap or StepM's size at these n. StepM's bootstrap may handle α = 0.001-level multiplicity better than EWC's heavy t_ν tails, but that is untested.

## 5. Covariate leakage: revisions, publication lags, event-data look-ahead, known-future vs past-only

### Takeaway
Every covariate value must carry the time it became available, and the backtest at origin t may read only values available by t, in the vintage then current. Where no vintages exist, apply worst-case publication-lag masks (as the spike did) and label the result pseudo-real-time. Event datasets need the "date added" clock, not the "event date" clock. Only deterministic calendar functions may be known-future.

### Cited Findings
- Croushore and Stark built real-time vintages for forecast evaluation. In the companion paper, RMSE and MAE "can appear deceptively lower" with latest-available data than with real-time vintages, and accuracy over short spans is sensitive to the vintage used ([J. Econometrics 105(1), 2001](https://econpapers.repec.org/RePEc:eee:econom:v:105:y:2001:i:1:p:111-130); [Philadelphia Fed WP 01-10](https://www.philadelphiafed.org/-/media/FRBP/Assets/working-papers/2001/wp01-10.pdf?sc_lang=en)).
- GDELT 2.0:
  - `Day` is the "Date the event took place". `DATEADDED` "stores the date the event was added to the master database", in UTC, at 15-minute resolution.
  - The Mentions table records mentions "irrespective of the date of the original event", so "a mention today of an event from a year ago will still be recorded".
  - Source: [GDELT Event Codebook V2.0, pp. 2 and 10](http://data.gdeltproject.org/documentation/GDELT-Event_Codebook-V2.0.pdf).
- UCDP Candidate (codebook v1.5):
  - It "relaxes some of UCDP's criteria for inclusion in order to release the data early". "Not all events in UCDP Candidate will make it into the final UCDP GED and new events will be added".
  - Monthly files include every event with a start or end date in the month, so one event can appear in two releases.
  - "Check Deaths" flags events where death counts are "likely to be revised".
  - Source: [UCDP Candidate codebook v1.5](https://ucdp.uu.se/downloads/candidateged/ucdp-candidate-codebook1.5.pdf).
- aseri's own sources:
  - GPR rewrites its last month, with median revisions of 7.6 to 9.2% over the last 30 days ([Best practice report, corrections table](../../reports/Best%20practice%20previsioni%20probabilistiche.md)).
  - Worst-case publication lags used in the spike: PortWatch 4 days, GPR 7 as a covariate, Brent (FRED) 8, Wikipedia 1, alerts 1, drones 0. The masks are max(0, covariate lag − target's freshest lag), and Brent's non-trading days are kept as NaN, not forward-filled.
  - The spike used today's data vintage, not the as-of values ("GPR and Brent get revised").
  - Timestral scales known-future rows "with non-causal whole-row statistics" (`model.py` line 135).
  - Source: [spike-covariates.md](../../spike-covariates.md).

### Inferences
- **The leakage doors for the scout**, in order of likely damage:
  1. **Event data keyed by event date.** Aggregating GDELT by `Day`, or UCDP by `date_start`, lets reports published later fill in earlier days. A backtest then "knows" about events that were only reported after the origin. Aggregate GDELT by `DATEADDED` (UTC, truncated to the origin's clock). For UCDP, use the Candidate release available at the origin, never the final GED.
  2. **Revised values.** For GPR, Brent and any revised source, store each fetch as a vintage (`value_date`, `fetched_at`, `value`) and read as of the origin. Until enough vintages accumulate, emulate them with the lag masks and flag the run "pseudo-real-time".
  3. **Pseudo known-future rows.** A non-calendar covariate passed as known-future (for example realized Brent over the horizon) is an oracle. Because Timestral normalizes known-future rows with whole-row statistics, even its scaling sees the future. Allow only deterministic calendars (day of week, fixed holiday lists such as Lunar New Year) as known-future. Anything else is past-only, or needs its own forecast vintage as of the origin.
  4. **Derived features.** Lags, rolling means, z-scores and detrending must be computed after masking, from as-of data only. A z-score using the full-sample mean leaks the future level.
  5. **Clock alignment.** Mixed time zones (UTC alert days vs local-time sources) and "today's report" files (drones, lag 0) need an explicit availability timestamp, not a date.
- The scout should keep the spike's mask table as config, re-measured each run (observed lag = fetch date − last value date), and use the worst case seen over the past N fetches, not today's value.
- Training contamination of Timestral is a separate leak that masks cannot fix (spike). Report gains on older origins and on the newest ones separately.

### Gaps
- I did not find documentation on whether Wikimedia pageview counts, PortWatch daily transits or FRED's Brent series (DCOILBRENTEU) are revised after first publication. That needs checking per source, for example by storing vintages for a few months and diffing them.
- I did not quantify how far GDELT's `Day` lags `DATEADDED` in practice, or how much of a UCDP Candidate month changes by the final GED.

## 6. Feature importance for foundation models with covariates: ablations, permutation, leave-one-covariate-out, interactions

### Takeaway
For a frozen model with a handful of covariates per series, the honest importance measure is the out-of-sample ablation itself: re-forecast with and without the covariate and score the difference. Add-one-to-baseline is the primary test, and leave-one-covariate-out from a pre-registered set measures redundancy. Avoid permutation importance: it forces the model to extrapolate on dependent features and breaks temporal structure. Interactions mean a set can help when no member does alone, or the reverse, so sets must be pre-registered as their own candidates.

### Cited Findings
- Hooker, Mentch and Zhou: permute-and-predict importance "can be highly misleading" when features are dependent. Breaking dependencies forces the model to extrapolate into regions with little or no data. They recommend measuring the change in performance after removing the feature, which needs "at least one more model" ([arXiv 1905.03151](https://arxiv.org/abs/1905.03151); Statistics and Computing 31, 2021).
- Lei et al. introduced leave-one-covariate-out (LOCO) inference, a model-free importance measure that compares predictive accuracy with and without each covariate ([arXiv 1604.04173](https://arxiv.org/abs/1604.04173); JASA 113(523), 2018).
- Chronos-2 is a foundation model that handles past-only and known-future, real and categorical covariates through group attention. Its largest gains are reported on covariate-informed tasks in fev-bench ([arXiv 2510.15821](https://arxiv.org/html/2510.15821v1); [Amazon Science blog](https://www.amazon.science/blog/introducing-chronos-2-from-univariate-to-universal-forecasting)).
- In aseri's spike, sets were not additive:
  - Hormuz: Brent alone was 1.7% worse on 31-90, and Brent + GPR Threats + Bab el-Mandeb 2.4% worse.
  - Bab el-Mandeb: Suez alone did nothing, while Suez + Brent + Threats was −1.4% on 31-90 only.
  - Timestral-28M and 209M agreed on the pattern and on every verdict.
  - Source: [spike-covariates.md](../../spike-covariates.md).

### Inferences
- **Primary measure: add-one ablation.** For each candidate c, Δ_c = WIS(baseline) − WIS(baseline + c), per origin and bucket. This is exactly the quantity the tests in Sections 1 and 2 use, so importance and significance are the same computation.
- **LOCO, only for adopted or proposed sets.** For a set S that passed, compute WIS(S) − WIS(S minus c) for each member. Drop members whose LOCO gain is not positive. A member that adds nothing given the others is a pure failure-point cost (spec 6.5 coupling cost).
- **Permutation importance does not fit here:**
  - shuffling a covariate's time series destroys its autocorrelation and its lead structure;
  - with Timestral's target-encoded categoricals and whole-row scaling, shuffled inputs are off-distribution;
  - it measures sensitivity, not forecast gain.
  If a cheap sensitivity screen is wanted, use a block-permuted or time-shifted covariate as a placebo (Section 8), not as an importance score.
- **Interactions.** Greedy forward selection (add the best covariate, then the next best) is a data-dependent search. Its final p-value is invalid unless confirmed on the holdout. Keep sets small (at most 3, as in the spike), pre-register them with a mechanism, and count each as one candidate.
- **Screening model choice.** The spike found 28M and 209M agree on the pattern. Screening with 28M (0.12 to 0.53 s per forecast uncontended) and confirming with 209M on the holdout is a defensible way to cut CPU. It is a proxy assumption that must be stated in each report.

### Gaps
- I found no published significance-testing protocol for covariate importance in time-series foundation models (Chronos-2, TimesFM, Timestral). I did not retrieve Chronos-2's per-covariate ablation numbers.

## 7. Stability across time windows and regimes

### Takeaway
Yes, require stability, in proportion to the cost of adoption. A pooled average gain can come from one episode, like the single 2026 Lunar New Year or the Hormuz collapse. Minimum requirement: the gain's sign is positive in each of at least 3 disjoint sub-periods, and a Giacomini-Rossi fluctuation path of the rolling relative WIS never goes significantly negative. A reversal is a veto, even if the pooled test passes.

### Cited Findings
- Giacomini and Rossi propose a measure of local relative forecasting performance and test its stability:
  - the Fluctuation test asks whether local relative performance is zero at every point;
  - the One-time Reversal test checks for a single break in relative performance.
  Source: [J. Applied Econometrics 25(4), 2010](https://econpapers.repec.org/RePEc:jae:japmet:v:25:y:2010:i:4:p:595-620).
- R's `murphydiagram::fluctuation_test(loss1, loss2, mu = 0.5, dmv_fullsample = TRUE, lag_truncate = 0, conf_level = 0.05)` implements it with a rolling window that is a fraction mu (0.1 to 0.9) of the evaluation sample. Critical values come from Giacomini-Rossi Table 1, and the variance option follows Rossi's Handbook chapter ([rdrr.io](https://rdrr.io/cran/murphydiagram/man/fluctuation.html)).
- Martins and Perron (2016) argue that the long-run-variance-based Fluctuation test has non-monotonic power, and propose structural-change tests as alternatives (as summarized in [this record](https://oasisbr.ibict.br/vufind/Record/RCAP_dbe20a9d579300f41e97e7d2414b263b)).
- Rossi's Handbook chapter reviews forecasting under instability ([Handbook vol. 2, ch. 21](https://econpapers.repec.org/RePEc:eee:ecofch:2-1203)). Her later paper argues that parameter breaks are "neither necessary nor sufficient" for time variation in forecast performance, and that local performance measures are more useful than averages ([UPF repository](https://repositori.upf.edu/items/affab182-a603-4853-b835-d5378fb9013a/full)).
- VIEWS weights test-period and true-future performance about equally, because scores "will vary considerably over time" (cited in the [Best practice report](../../reports/Best%20practice%20previsioni%20probabilistiche.md)).
- The spike's Taiwan gain rests on 14 origins around one holiday (median MAE −27% inside the holiday week, −1.7% WQL diluted over the year). The spec defers it until after the 2027 holiday ([spike](../../spike-covariates.md); [spec 6.5](../../../superpowers/specs/2026-10-29-aseri-design.md#65-covariate-scout)).

### Inferences
- **Stability gate**, applied after Stage 2 to the discovery and holdout origins together:
  1. Split into at least 3 disjoint periods (for example calendar years). The point gain must be positive in each, with no period significantly negative at one-sided 10%.
  2. Run the fluctuation test with mu = 0.3 to 0.5, and veto if the path crosses the lower critical value.
  3. For event-driven covariates (holidays, chokepoint shocks), count events, not origins. Do not adopt on fewer than 2 independent events.
- No Python implementation of the fluctuation test turned up. Porting it is small: a rolling mean of d_t over m = mu·P origins, scaled by the full-sample HAC sd, compared with Table 1. Cross-check against R's `murphydiagram` on one fixture.
- Expect regime dependence. A covariate that helps only during shocks (Brent for Hormuz) can be worth a regime-conditional rule. That is a new model, and it must be pre-registered and tested like any other candidate, not fitted after the fact. GW's conditional test (regress d_t on a regime indicator) is the formal version, but McCracken shows its null is very narrow. Use it as a diagnostic, not a gate.

### Gaps
- I did not retrieve Giacomini-Rossi's Table 1 critical values. Take them from the paper or from the R package source before implementing.
- I found no guidance on the minimum number of sub-periods or events for a stability requirement. "3 periods, 2 events" is a judgement call.

## 8. The protocol: steps, Python implementation notes, and tests that validate it

### Takeaway
One config-driven, cached, monthly pipeline. The steps:
1. Pre-register the candidates and the rule.
2. Make all data access as-of.
3. Use weekly rolling origins with a sealed holdout.
4. Score paired WIS per origin and bucket.
5. Screen with HAR one-sided tests, the IUT across buckets, BH at q = 0.10 and StepM.
6. Gate each series with SPA.
7. Confirm survivors on the holdout with Holm, the 2% point floor and coverage guards sized to n_eff.
8. Check stability.
9. Optionally shadow live, then hand over to a human.
Placebo candidates, a positive control, a leak canary and a size simulation validate the machinery itself.

### Cited Findings
- arch 8.0.0's SPA, StepM and MCS signatures and defaults, and statsmodels 0.15.0's `diebold_mariano_test` and `multipletests`, are as listed in Sections 1 and 2 (docs linked there, verified by local runs). `arch.bootstrap.optimal_block_length` exists in 8.0.0 and returned 4.8 (stationary) and 5.5 (circular) on a simulated weekly differential (local run; [arch bootstrap docs](https://arch.readthedocs.io/en/latest/bootstrap/timeseries-bootstraps.html)).
- The spike measured inference costs:
  - Timestral-28M, uncontended: 0.12 s per forecast without covariates, 0.37 s with one, 0.53 s with two.
  - 209M under contention: up to 22 s for GPR.
  - The no-covariate runs reproduced the baseline bit for bit, and its positive control recovered an 89% MAE cut from a 5-day lead.
  - Source: [spike-covariates.md](../../spike-covariates.md).
- The Best practice report recommends a 10-line in-house WIS on 21 levels, tested against scoringutils' example, because scoringrules 0.11.0's `weighted_interval_score` is wrong except on numba. It also notes that n = 30 gives a coverage CI of 0.61 to 0.92 when 80% is observed, so acceptance windows must be sized to n ([report](../../reports/Best%20practice%20previsioni%20probabilistiche.md)).
- EWC long-run variance: ν = 0.4·T^(2/3) Type II cosine projections, t_ν critical values ([LLSW 2018](https://scholar.harvard.edu/sites/scholar.harvard.edu/files/stock/files/lazarus_lewis_stock_watson_har_inference_recommendations_for_practice_jbes_2018.pdf)).

### Inferences

**Step-by-step protocol (per monthly run)**

0. **Pre-register** in `scout` config, committed before the run:
   - per series, at most about 15 candidates, each with a mechanism, an expected lead, a kind (known-future calendar or past-only) and a lag mask. Lags and sets are listed as separate candidates;
   - the primary metric: relative WIS on 21 levels, ratio of means over identical (origin, h), for buckets 1-7 and 8-28;
   - α_screen = q 0.10 (BH), α_confirm = 0.05 (Holm), the minimum effect of interest (5% for detection, 2% point floor), and the stability rule;
   - the windows: discovery start, a 28-day embargo, a holdout of the last 52 weekly origins;
   - the origin weekday and the context length.
1. **As-of data layer.** Every stored value carries `available_at`. `get_covariate(name, origin)` returns only rows with `available_at <= origin` from the vintage current at the origin. It falls back to the worst-case lag mask, flagging `pseudo_real_time = true`. It raises an error if a non-calendar covariate is requested as known-future. Events: GDELT by `DATEADDED`, UCDP from the Candidate release as of the origin.
2. **Forecast cache.** Key: (series, candidate, origin, model id, context length, data-vintage hash). Each month adds about 4 new weekly origins per (series, candidate). A one-time backfill of 9 series × 15 candidates × 150 origins on 28M at about 0.4 s is about 2.3 CPU hours. Monthly increments are minutes. Confirm only survivors with 209M.
3. **Score.** In-house WIS, tested on scoringutils' example. Per origin and bucket: d_t = WIS_base − WIS_cand. The report shows the relative gain Σd/ΣWIS_base with a block-bootstrap CI (stationary bootstrap, `block_size` of at least 8 weekly origins, or `optimal_block_length`), never an iid bootstrap.
4. **Stage 1 screen** (discovery origins only):
   - per candidate and bucket, a one-sided EWC t-test (DM-HLN with k − 1 lags as a cross-check);
   - the candidate's p-value is max(p_1-7, p_8-28), the intersection-union test;
   - BH (`multipletests(method='fdr_bh')`) at q = 0.10 over all candidates in the run;
   - in parallel, run `StepM(base, cands, size=0.10, block_size=8, bootstrap='stationary', studentize=True)` per series on the bucket-averaged loss, and `SPA(...).pvalues['consistent']` as the series gate;
   - survivors are BH discoveries that StepM also flags, at most 3 per series.
5. **Stage 2 confirm** (sealed holdout, read once per candidate per 26 new origins). For each survivor:
   - a one-sided EWC test on each bucket, IUT;
   - Holm over all survivors in the run, at 0.05;
   - the point gain at least 2% on both buckets;
   - no bucket, including 29-90 if published, significantly worse (one-sided at 10%);
   - cov80 inside the binomial band for the bucket's n_eff, not a fixed 0.70 to 0.90.
6. **Stability gate** (Section 7): sign-positive in at least 3 sub-periods, no fluctuation-test reversal, at least 2 independent events for event-type covariates.
7. **Shadow (recommended):** run the passing configuration in parallel with the live job for at least 12 weeks. It is the only data free of training contamination. Then a human approves, and the model ID suffix changes (spec 6.5).
8. **Report** under `docs/research/scout/{date}.md`, for every candidate: Δ, CI, p (raw and adjusted), the stage reached, and the reason it stopped. Failures are as informative as passes.

**Python implementation notes**
- Per-candidate test, about 15 lines with numpy and scipy, as in [code/scout_power_sim.py](code/scout_power_sim.py) (`ewc`, `dm_hln`). One-sided p = `stats.t.sf(stat, df)`.
- Cross-check DM against statsmodels 0.15:
  ```python
  diebold_mariano_test(
      np.zeros(n), wis_base, wis_cand,
      criterion=lambda y, f: np.asarray(f),
      lags=k - 1, harvey_adj=True, horizon=k,
  )
  ```
  The p-value is two-sided, so halve it when the statistic has the expected sign.
- arch: pass losses (lower is better) as a T-vector for the benchmark and a T × m frame for the models. Always set `block_size` and `seed`. Read `StepM.superior_models` and `SPA.pvalues` (use 'consistent'). `MCS(np.column_stack([base, cands]), size=0.10)`; `.included` is a secondary output.
- Multiplicity: `statsmodels.stats.multitest.multipletests(pvals, alpha, method='fdr_bh' | 'holm' | 'fdr_by')`.
- Fluctuation test: no Python package found. Port it from R `murphydiagram` and cross-check on a fixture.
- Keep the arch and statsmodels versions pinned. arch's `block_size` default (sqrt(T)) and statsmodels' DM default lags (max(h − 1, n^(1/3))) are both wrong for this design if left implicit.

**Tests that validate the protocol itself** (run in CI on fixtures, plus the end-to-end ones once per release)
1. **Test size under overlap** (unit test, seconds): on simulated overlapping differentials with μ = 0, the scout's test rejects at most 8% at nominal 5% (φ = 0.7, 52 weekly origins), and the naive test is shown to over-reject (about 18%). The script's `selfcheck` asserts that all tests hold size with no overlap.
2. **Planted-effect power** (unit test): with μ = 5% and σ = 5% on 104 weekly origins, the pipeline's Stage 1 flags the planted candidates. StepM recovered exactly 3 of 3 among 40 in the demo.
3. **Placebo candidates** (end to end, each run): add 3 placebos per series:
   - iid noise;
   - the real covariate shifted by plus or minus 1 year, which keeps its autocorrelation but breaks the alignment;
   - a block-permuted copy.
   No placebo may pass Stage 2. Track the share of placebos passing Stage 1 across runs: it should stay near or below q. A passing placebo means a leak or an oversized test.
4. **Positive control** (end to end): the spike's synthetic 5-day lead (`control.py`) must pass every stage. That shows the harness can detect real signal through the model.
5. **Leak canary** (unit test): requesting the target shifted forward as a covariate must raise in the as-of layer. With the guard bypassed in a test, it must show a huge gain, which proves the detector works.
6. **As-of property test:** for random origins, assert that `max(available_at)` over every value fed to the model is at most the origin. Assert that every known-future row is a pure function of the date. Assert that GDELT and UCDP aggregates change only when `DATEADDED` or the release date allows.
7. **Reproducibility:** the no-covariate run equals the cached baseline bit for bit (as in the spike), and rerunning a month with the same cache and config yields identical decisions.
8. **Scoring:** WIS equals scoringutils' documented example. The DM implementation equals statsmodels 0.15 with `harvey_adj=True` (verified to 1e-14).

### Gaps
- The CPU estimates assume the spike's uncontended 28M timings and about 0.4 s per covariate forecast. 209M confirmation costs were not measured uncontended.
- Whether 28M screening misses covariates that only 209M would exploit is untested beyond the spike's agreement on 16 sets.
- The thresholds in the validation tests (8% size, 12-week shadow, 3 sub-periods) are proposed defaults, not taken from a source.
