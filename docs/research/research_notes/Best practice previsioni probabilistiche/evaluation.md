# Evaluating quantile forecasts honestly in a daily pipeline that publishes a track record

Research notes for aseri, as of 2026-10-30. Context read first, not redone: `docs/research/public-api.md` (Hubverse format), `docs/research/spike-timestral-backtest.md` (WQL, MASE, coverage backtest), spec section 6.4 in `docs/superpowers/specs/2026-10-29-aseri-design.md`.

aseri facts these notes depend on: 21 quantile levels (FluSight's 23 minus 0.025 and 0.975, so 0.01, 0.05, 0.10, 0.15 ... 0.90, 0.95, 0.99), giving K = 10 central intervals (98, 90, 80, 70 ... 10%) plus the median. Nine daily series in different units. Live forecasts only in the headline record, `min_n_to_display: 30`, horizon buckets 1-7 and 8-28.

Code: every Python snippet below was run and checked on 2026-10-30 with Python 3.12, numpy, scipy, pandas, scoringrules 0.11.0 (+ numba), arch 8.0.0 and statsmodels 0.15.0. The scratch copies are `evalkit.py` and `test_evalkit.py` in the session scratchpad. The full module is in the "Reference implementation" sub-section of Key Question 1, and its tests in Key Question 2.

## 1. Proper scoring rules for quantile forecasts: WIS, CRPS, pinball loss, interval score, and scale-free versions

### Takeaway
Score every forecast with WIS computed on all 21 levels: it is a proper score, equals the mean pinball loss (times 2) over the levels, and approximates the CRPS (about 4% below the true CRPS for a Gaussian with aseri's levels). Never average raw WIS across the nine series, because their units differ by orders of magnitude. Compare against baselines with ratios of mean scores on identical targets (relative WIS), and use scaled versions (WIS divided by an in-sample seasonal-naive MAE, as in MASE, MSIS and fev-bench's SQL) only for cross-series summaries.

### Cited Findings

**Propriety and why it matters**
- Gneiting and Raftery argue the goal of probabilistic forecasting is "to maximize the sharpness of the predictive distributions subject to calibration". [Gneiting and Raftery 2007, JASA](https://sites.stat.washington.edu/raftery/Research/PDF/Gneiting2007jasa.pdf)
- Scores for competing forecasters "are directly comparable if they refer to exactly the same set of forecast situations". Comparing scores over different sets confounds intrinsic predictability with forecast quality. [Gneiting and Raftery 2007](https://sites.stat.washington.edu/raftery/Research/PDF/Gneiting2007jasa.pdf)
- The CRPS "generalizes the absolute error, to which it reduces if F is a deterministic forecast". So a point baseline's CRPS is its absolute error. [Gneiting and Raftery 2007](https://sites.stat.washington.edu/raftery/Research/PDF/Gneiting2007jasa.pdf)
- Skill scores of the form (S_fcst − S_ref)/(S_opt − S_ref) "are generally improper, even if the underlying scoring rule S is proper". Murphy (1973) showed the Brier skill score is only asymptotically proper. [Gneiting and Raftery 2007, section 2.3](https://sites.stat.washington.edu/raftery/Research/PDF/Gneiting2007jasa.pdf)

**Exact formulas**
- Quantile (pinball) score, scoringrules convention, no factor 2: S_τ(q, y) = (1 − τ)(q − y) if y ≤ q, and τ(y − q) if y > q. Example: `sr.quantile_score(0.3, 0.5, 0.2)` returns 0.16. [scoringrules quantile API](https://frazane.github.io/scoringrules/api/quantile/)
- FPP3 uses the factor-2 convention: Q_{p,t} = 2(1 − p)(f − y) if y < f, and 2p(y − f) if y ≥ f. It says averaging quantile scores "over all values of p" gives the CRPS. [Hyndman and Athanasopoulos, FPP3 5.9](https://otexts.com/fpp3/distaccuracy.html)
- Interval score (Gneiting and Raftery eq. 43) for the central (1 − α) interval [l, u]: S_int = (u − l) + (2/α)(l − x)·1{x < l} + (2/α)(x − u)·1{x > u}. It is proper and traces back to Dunsmore (1968) and Winkler (1972). [Gneiting and Raftery 2007, section 6.2](https://sites.stat.washington.edu/raftery/Research/PDF/Gneiting2007jasa.pdf)
- FPP3 calls this the Winkler score and shows W_α = (Q_{α/2} + Q_{1−α/2})/α when the bounds are quantiles (factor-2 pinball). [FPP3 5.9](https://otexts.com/fpp3/distaccuracy.html)
- WIS: WIS_{α{0:K}}(F, y) = 1/(K + 1/2) × (w0·|y − m| + Σ_{k=1..K} w_k·IS_{α_k}(F, y)), with default weights w_k = α_k/2 (and w0 = 1/2). [scoringutils `wis()` docs](https://epiforecasts.io/scoringutils/reference/wis.html); [Bracher et al. 2021, PLOS Comp Biol](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618)
- Bracher et al. call w0 = 1/2 the "natural choice". For large K and equally spaced α levels, WIS approximates the CRPS. WIS can be written as an average of quantile scores at the median and the 2K interval bounds. [Bracher et al. 2021](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618)
- scoringutils: "the equivalence between the WIS and the mean of the quantile scores only holds for this default weighting (`weigh = TRUE`)". `count_median_twice` defaults to FALSE. [scoringutils `wis()`](https://epiforecasts.io/scoringutils/reference/wis.html)
- WIS decomposes into dispersion, overprediction and underprediction ("The interval score (IS) is the sum of three components"). The intervals must be symmetric around the median; asymmetric sets must be scored with `quantile_score()`. [scoringutils `wis()`](https://epiforecasts.io/scoringutils/reference/wis.html)

**Aggregation pitfalls**
- Bracher et al.: aggregating proper scores by sum or average keeps them proper. They recommend horizon-specific averages, because longer horizons "tend to show larger variability and can dominate average scores". Absolute error, CRPS and WIS averaged across locations are "dominated by forecasts from larger states and weeks with high activity". They argue against MAPE-type relative errors. [Bracher et al. 2021](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618)
- Bosse et al. 2023: on the natural scale, "Large observations will dominate average CRPS values". Scoring log(x + 1)-transformed forecasts and data gives "a probabilistic version of a relative error". Under a quadratic mean-variance relation the expected log-scale CRPS is roughly independent of the order of magnitude. [Bosse et al. 2023, PLOS Comp Biol](https://pmc.ncbi.nlm.nih.gov/articles/PMC10495027/)
- Transforming forecasts and observations with a strictly monotone function before scoring keeps the score proper. Taking the log of the CRPS values after scoring "results in an improper score". [Bosse et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10495027/)
- Offset rule of thumb: log(x + a) is close to log(x) when x > 5a and nearly identical when x > 50a. They used a = 1 and suggest a = 10 when forecasts put substantial mass near zero. They recommend log-scale scoring as a complement to the natural scale, not a replacement. [Bosse et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10495027/)
- `hubEvals::score_model_out()` has a `transform` argument and warns: "Avoid using `log` directly if data may contain zeros." [hubEvals reference](https://hubverse-org.github.io/hubEvals/reference/score_model_out.html)

**Scale-free versions**
- MASE (Hyndman and Koehler 2006): scaled error q_j = e_j / ((1/(T − m)) Σ_{t=m+1..T} |y_t − y_{t−m}|), the in-sample (seasonal) naive MAE, and MASE = mean(|q_j|). Percentage errors are undefined at y = 0, extreme near 0, and need a meaningful zero. [FPP3 5.8](https://otexts.com/fpp3/accuracy.html)
- FPP3 skill score: (CRPS_baseline − CRPS_method)/CRPS_baseline, using seasonal naive when the data are seasonal. [FPP3 5.9](https://otexts.com/fpp3/distaccuracy.html)
- M4's MSIS is the interval score of the 95% interval (2/α = 40) divided by the in-sample seasonal-naive MAE, averaged over the 100,000 series. [mlr3forecast `fcst.msis`](https://mlr3forecast.mlr-org.com/reference/mlr_measures_fcst.msis.html)
- M5's scaled pinball loss divides the pinball loss over the horizon by the in-sample one-step naive MAE (from the first non-zero sale). WSPL is the weighted average over series of the SPL averaged over quantiles. A constant non-zero tail makes the denominator zero and the score invalid. [Secondary description, arXiv 2311.00993](https://arxiv.org/pdf/2311.00993). The primary paper, [Makridakis et al. 2022, IJF](https://doi.org/10.1016/j.ijforecast.2021.10.009), could not be fetched (HTTP 403).
- fev-bench's primary probabilistic metric is Scaled Quantile Loss over levels {0.1, ..., 0.9}, divided by a_{n,d} = (1/(T − m)) Σ|y_t − y_{t−m}| over the training history. MASE uses the same scale. [fev-bench, arXiv 2509.26468v2](https://arxiv.org/html/2509.26468v2)
- GIFT-Eval approximates the CRPS by the mean weighted quantile loss over K levels (e.g. 0.1 ... 0.9), with wQL[α] = 2·Σ_t Λ_α(q̂_t(α), y_t) / Σ_t |y_t|. Both metrics are normalized against Seasonal Naive. [GIFT-Eval, arXiv 2410.10393](https://arxiv.org/html/2410.10393)
- `utilsforecast.losses` provides `quantile_loss`, `mqloss` (mean of quantile losses, a left Riemann sum approximation of the CRPS integral), `scaled_quantile_loss` and `scaled_mqloss` (divided by the seasonal-naive MAE, needs `train_df` and `seasonality`), `scaled_crps` (normalized by Σ|y|, with a 2/N factor), `mase`, `coverage(level=...)`, `winkler_score`, and `calibration` (fraction of y below the prediction). [utilsforecast losses docs](https://nixtlaverse.nixtla.io/utilsforecast/losses.html)

**Python libraries: verified behaviour**
- scoringrules offers numpy (numba-accelerated), jax, pytorch and tensorflow backends, and the API functions `quantile_score`, `interval_score` and `weighted_interval_score`. It has no `crps_quantile` on the quantile page. [scoringrules docs](https://frazane.github.io/scoringrules/); [interval API](https://frazane.github.io/scoringrules/api/interval/)
- **Bug, verified on 2026-10-30.** In scoringrules 0.11.0, `weighted_interval_score` is correct only on the numba backend. The array backends (numpy, jax, torch, tensorflow; numpy is the default when numba is not installed) compute `WIS += w_median * median`, the predicted median, instead of `w_median * |obs − median|`. The bug is still on `main` ([source line 39](https://github.com/frazane/scoringrules/blob/main/scoringrules/core/interval/_score.py)), reported in [issue #140](https://github.com/frazane/scoringrules/issues/140), with fix PR #141 open. I reproduced it: numba output matched my implementation to 4 decimals, and the numpy output equalled mine − 0.5|y − m|/(K + 0.5) + 0.5·m/(K + 0.5) exactly.
- The scoringrules docstring says `w_alpha` "Defaults to `2/alpha`", but the code sets `w_alpha = alpha / 2`. The code matches Bracher; the docstring is wrong. [scoringrules `_interval.py`](https://github.com/frazane/scoringrules/blob/main/scoringrules/_interval.py)

### Inferences
- **WIS on aseri's 21 levels is exactly** WIS = (2/21)·Σ_{j=1..21} QS_{τ_j}(q_j, y), with QS without the factor 2. The algebra: (α/2)·IS_α = QS_{α/2}(l) + QS_{1−α/2}(u), and (1/2)|y − m| = QS_{0.5}(m). Divide by K + 1/2 = 10.5. My `wis()` below is checked against scoringrules (numba) to floating-point precision.
- **WIS slightly understates the CRPS with aseri's levels.** For a Gaussian forecast and data, mean WIS / mean CRPS was 0.96 over 500 draws (my run). The cause is the missing tails beyond 0.01 and 0.99, and the equal weighting of unevenly spaced levels (gaps of 0.04 at the ends, 0.05 elsewhere). This does not matter for model-vs-baseline ratios on the same levels. It does mean aseri's WIS is not comparable with 23-level hub WIS or with sample-based CRPS (VIEWS), as public-api.md 1.2 already notes.
- **The factor-2 trap.** scoringrules and utilsforecast's `quantile_loss` use the plain pinball loss; FPP3, GIFT-Eval's wQL and WIS use 2× it. State the convention in `scores.json`, or published numbers will be off by a factor of 2 against other sources.
- **Point baselines are legitimate in a WIS ratio:** WIS(model)/AE(naive) is a CRPS skill score against a deterministic baseline, since the CRPS of a point forecast is its absolute error (Gneiting and Raftery). Hubs use a probabilistic baseline instead (COVIDhub-baseline, the FluSight quantile baseline, VIEWS' Poisson last value; see Key Question 6). A probabilistic naive baseline lets you report its coverage too, and stops the comparison rewarding the model just for having a spread. Recommendation: keep the point baselines for "median error vs naive" (spec 6.4), and add one probabilistic naive baseline, built from empirical quantiles of past h-step changes added to the last value, for relative WIS.
- **Aggregation rules for aseri:**
  1. Report WIS per series and per horizon bucket, never a raw WIS averaged over series.
  2. For any cross-series headline, use the geometric mean over series of each series' WIS ratio to a baseline (fev-bench style). This is an aggregate of summary ratios, not a per-forecast transform, so Bosse's impropriety warning about logging scores does not apply.
  3. Ratios must be ratios of mean scores over the identical set of (origin, horizon) targets, never means of per-forecast ratios.
- **MASE pitfall already seen in the spike:** Hormuz's MASE scale came from a long pre-collapse regime, so recent MASE looked tiny (0.1 to 0.2). For a live record, prefer the baseline ratio on the same targets (scale-free, no scale-window choice). If MASE is kept, fix the scale window (for example the last 365 days of each origin's context) and publish it.
- **Count series near zero** (`ua_drones_downed_claimed`, low Hormuz counts): log-scale WIS with a ≥ 1 offset is a sensible secondary view, per Bosse et al. Natural-scale WIS stays primary.

### Reference implementation (verified)
```python
import numpy as np, pandas as pd
from scipy import stats

LEVELS = np.round(np.r_[0.01, 0.05, np.arange(0.10, 0.901, 0.05), 0.95, 0.99], 2)  # aseri's 21

def pinball(q, y, tau):                      # QS_tau, no factor 2
    return ((y < q).astype(float) - tau) * (q - y)

def wis(Q, y, levels=LEVELS):                # Q: (..., 21) sorted by level; y: (...)
    levels = np.asarray(levels)
    assert np.allclose(levels + levels[::-1], 1) and np.isclose(levels, 0.5).any()
    return 2 * pinball(Q, np.asarray(y)[..., None], levels).mean(-1)

def wis_components(Q, y, levels=LEVELS):     # (dispersion, overprediction, underprediction), sum == wis
    levels = np.asarray(levels); K = (len(levels) - 1) // 2
    lo, hi, m = Q[..., :K], Q[..., ::-1][..., :K], Q[..., K]
    alpha, y = 2 * levels[:K], np.asarray(y); y_ = y[..., None]
    disp = (alpha / 2 * (hi - lo)).sum(-1)
    over = np.where(y_ < lo, lo - y_, 0).sum(-1) + 0.5 * np.maximum(m - y, 0)
    under = np.where(y_ > hi, y_ - hi, 0).sum(-1) + 0.5 * np.maximum(y - m, 0)
    return disp / (K + 0.5), over / (K + 0.5), under / (K + 0.5)

def mase_scale(history, m=7):                # Hyndman-Koehler denominator over the origin's context
    h = np.asarray(history, float)
    return np.mean(np.abs(h[m:] - h[:-m]))
```
- Use scoringrules only with `backend="numba"` until issue #140 is fixed, or use the 10-line `wis()` above. Pin the scoringrules version in tests either way.

### Gaps
- I did not verify a maintained official Python port of scoringutils. The scoringutils docs fetched are the R package. Python options verified here: scoringrules, utilsforecast, statsmodels, arch, plus hand-written WIS.
- I could not fetch the M5 uncertainty paper itself (403), so the SPL and WSPL details come from a secondary paper. The nine M5 levels (0.005, 0.025, 0.165, 0.25, 0.5, 0.75, 0.835, 0.975, 0.995) and the dollar-sales weighting come from search summaries, not the primary text.
- `properscoring` was not checked in this session beyond its use by VIEWS (`crps_ensemble`, Key Question 6).

## 2. Calibration: interval coverage, PIT histograms for quantile forecasts, reliability, coverage tests and their power in small samples

### Takeaway
Report empirical coverage of the 50% and 80% ranges (90% and 98% too) with an exact binomial confidence interval and the count n, plus a quantile-reliability plot (share of observations below each of the 21 quantiles against the level). Formal coverage tests (Kupiec-type binomial, Christoffersen independence) assume independent hits. That holds only for 1-step forecasts, or for origins at least h days apart. At n = 30 they cannot tell a true 70% band from a nominal 80% one (power 0.27).

### Cited Findings
- Bracher et al. assess calibration with PIT histograms: uniform means calibrated, L or J shapes mean bias, U or inverse-U mean under- or overdispersion. For quantile-format forecasts exact PIT values cannot be computed; one records which interquantile bin the observation falls in. When an observation equals a reported quantile, the count is split across neighbouring bins (1/2 each for one matching quantile, 1/4-1/2-1/4 for two). [Bracher et al. 2021](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618)
- scoringutils' `get_pit_histogram()` for quantile forecasts defaults to "one bin for each available quantile" and prefers explicit `breaks` ("0 and 1 will always be added as left and right bounds"). [scoringutils `get_pit_histogram`](https://epiforecasts.io/scoringutils/reference/get_pit_histogram.html)
- The COVID-19 Forecast Hub evaluation assessed calibration through central interval coverage (50% and 95%) "across locations and forecast dates", not through PIT. Only the ensemble reached near-nominal coverage at both levels (0.53 for the 50% PI, 0.90 for the 95% PI). Coverage was "typically below nominal". [Cramer et al. 2022, PNAS](https://pmc.ncbi.nlm.nih.gov/articles/PMC9169655/)
- FluSight 2021-23: the ensemble's 95% coverage fell with horizon, from 89.3% to 83.3% (2021-22) and from 85.8% to 77.9% (2022-23). 50% coverage was 48% and 56%. The paper's Discussion reports slightly different numbers, so it is internally inconsistent. [Mathis et al. 2024, Nat Commun](https://pmc.ncbi.nlm.nih.gov/articles/PMC11282251/)
- hubEvals' default quantile metrics include `interval_coverage_XX` at a chosen level, plus `wis`, `overprediction`, `underprediction`, `dispersion`, `bias` and `ae_median`. [hubEvals `score_model_out`](https://hubverse-org.github.io/hubEvals/reference/score_model_out.html)
- `utilsforecast.losses.calibration` returns the fraction of y below the prediction, and `coverage(level=...)` the fraction inside the interval. [utilsforecast losses](https://nixtlaverse.nixtla.io/utilsforecast/losses.html)
- VaR-backtest tests: Kupiec (1995) unconditional coverage and Christoffersen (1998) independence and conditional coverage. The usual asymptotic χ² approximation "suffers in small samples and under extreme coverage rates". The ExactVaRTest R package computes exact finite-sample p-values (e.g. n = 300, α = 0.05). [ExactVaRTest README](https://cran.r-project.org/web/packages/ExactVaRTest/readme/README.html)
- A study of small-sample VaR backtests found that Kupiec POF and Christoffersen conditional coverage tests show "significant discretisation" and deviate from their nominal size. [Statistics in Transition / ps.stat.gov.pl, 2020](https://ps.stat.gov.pl/Article/2020/2/114-151). This is a search-summary finding; I did not read the paper.
- VIEWS used a 90% interval for its interval score because simulations suggested quantiles estimated from 1,000 samples become unreliable quickly outside the 90% interval for overdispersed distributions. [VIEWS 2023/24 challenge, arXiv 2407.11045](https://arxiv.org/html/2407.11045)

### Inferences

**How much a coverage number means: my computations (code in the session scratchpad, `covsim.py`)**

Exact Clopper-Pearson 95% CI when 80% of n forecasts landed inside, and the power of an exact two-sided 5% binomial test against nominal 80%. Hits are assumed independent.

| n resolved | 95% CI if 80% observed | power vs true 70% | power vs true 60% |
|---|---|---|---|
| 30 | 0.61 to 0.92 | 0.27 | 0.71 |
| 60 | 0.68 to 0.89 | 0.44 | 0.93 |
| 90 | 0.70 to 0.88 | 0.63 | 0.99 |
| 120 | 0.72 to 0.87 | 0.69 | 1.00 |
| 250 | 0.74 to 0.85 | 0.96 | 1.00 |
| 365 | 0.76 to 0.84 | 0.99 | 1.00 |

**Overlap shrinks the effective sample.** I simulated an AR(1) series with perfectly calibrated Gaussian h-step forecasts issued every day, and measured the variance of the 80% coverage estimate relative to the binomial variance (the design effect):

| persistence φ | h | n daily origins | design effect | effective n |
|---|---|---|---|---|
| 0.5 | 1 | 120 | 1.0 | 122 |
| 0.5 | 7 | 120 | 1.4 | 83 |
| 0.5 | 28 | 120 | 1.5 | 82 |
| 0.9 | 7 | 30 | 3.2 | 9 |
| 0.9 | 7 | 120 | 3.4 | 35 |
| 0.9 | 28 | 30 | 5.7 | 5 |
| 0.9 | 28 | 120 | 6.6 | 18 |

- So for a persistent series like GPR or the transit counts, "30 resolved forecasts at h = 7" carries roughly the information of about 9 independent ones. Spec 6.4's `min_n_to_display: 30` is a fine display gate, but it is not evidence of calibration. Publish the interval next to the number. Better still, compute the CI with a block bootstrap (Key Question 4) or the effective-n adjustment, not with the plain binomial.
- **Christoffersen's independence test is invalid on overlapping forecasts.** Under correct calibration, hits at horizon h > 1 from consecutive daily origins are serially dependent by construction (shared future path), so the test rejects perfect forecasts. Run it only on h = 1 hits, or on a subsample of origins spaced h days apart (for example weekly origins at h = 7, which the record dots already use).
- **Inclusive bounds and integer counts.** Transit, drone and alert series take integer values and the quantiles may sit on integers. Whether y = q0.9 counts as "inside" materially changes coverage. Fix and document the rule. My `covered()` uses inclusive bounds. FluSight rounded so teams were "not penalized for missing an interval by less than one admission" ([Mathis et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11282251/)). Use the tie-splitting rule for PIT bins.
- **Quantile reliability beats a 21-bin PIT histogram at aseri's n.** The two outermost bins are 0.01 wide: with 120 forecasts the expected count is 1.2, so tail bins are pure noise. In my check on 20,000 calibrated draws the binned PIT densities still ranged 0.85 to 1.06. Plot, per series, the share of y ≤ q_τ against τ for all 21 levels, with binomial bands, and pool series only for the PIT shape.

### Python: calibration helpers and the test suite (verified)
```python
def covered(Q, y, central, levels=LEVELS):           # inclusive bounds; central=0.8 -> [q0.1, q0.9]
    lo = Q[..., np.isclose(levels, (1 - central) / 2)][..., 0]
    hi = Q[..., np.isclose(levels, (1 + central) / 2)][..., 0]
    return (y >= lo) & (y <= hi)

def pit_histogram(Q, y, levels=LEVELS):              # density per inter-quantile bin, 1 = calibrated
    edges = np.r_[0, levels, 1]; counts = np.zeros(len(edges) - 1)
    for q, obs in zip(Q.reshape(-1, Q.shape[-1]), np.ravel(y)):
        below, ties = int((q < obs).sum()), int((q == obs).sum())
        counts[below: below + ties + 1] += stats.binom.pmf(np.arange(ties + 1), ties, 0.5)  # Bracher tie split
    return counts / counts.sum() / np.diff(edges)

def coverage_tests(inside, nominal):                 # ONLY on independent hits (h=1, or origins >= h apart)
    inside = np.asarray(inside, bool); n, x = len(inside), int(inside.sum())
    p_uc = stats.binomtest(x, n, nominal).pvalue     # exact Kupiec-type test
    a, b = inside[:-1], inside[1:]
    n00, n01, n10, n11 = [int(v.sum()) for v in (~a & ~b, ~a & b, a & ~b, a & b)]
    def ll(k0, k1):
        p = k1 / (k0 + k1) if k0 + k1 else 0.0
        return sum(k * np.log(pr) for k, pr in ((k0, 1 - p), (k1, p)) if k)
    lr = -2 * (ll(n00 + n10, n01 + n11) - ll(n00, n01) - ll(n10, n11))   # Christoffersen LR_ind
    return p_uc, stats.chi2.sf(lr, 1)
```
Tests that passed (`test_evalkit.py`):
1. `wis()` equals `scoringrules.weighted_interval_score(..., backend="numba")` on 500 random forecasts.
2. The WIS components sum to WIS.
3. A point forecast's WIS equals |y − m|.
4. WIS/CRPS(normal) = 0.96.
5. Calibrated N(0,1) quantiles give cov80 0.808 and cov50 0.509 on 20,000 draws.
6. PIT tie splitting gives 1/2-1/2 and 1/4-1/2-1/4.
7. `dm_test` equals statsmodels (Key Question 3).
8. `relative_skill` with two models equals the plain ratio on common targets.

For the pipeline, add golden-file tests: hand-computed WIS for a 3-level toy forecast, `covered` at exact bound ties, and a property test that WIS is minimized in expectation by the true quantiles.

### Gaps
- I did not read Kupiec (1995) or Christoffersen (1998) directly. The LR_ind form in the code is the standard Markov-chain likelihood ratio, not quoted from the paper.
- I found no source giving the power of coverage tests for overlapping multi-step interval forecasts. The design-effect table is my own simulation under an AR(1) assumption, not a published result.
- Reliability diagrams for quantile forecasts ("quantile coverage plots") exist in scoringutils, but I did not fetch their reference page this session.

## 3. Skill against baselines: relative skill, pairwise tournaments, and Diebold-Mariano tests adjusted for overlapping forecasts

### Takeaway
Use the ratio of mean WIS (and of mean absolute error of the median) between model and baseline over identical targets. That is what the Hubverse's relative WIS reduces to with a single model. Attach either a block-bootstrap CI or a Diebold-Mariano test with h − 1 HAC lags and the Harvey-Leybourne-Newbold correction. The major hubs publish relative WIS without any significance test, which is a gap aseri should not copy.

### Cited Findings
- Pairwise tournament (scoringutils): the mean score ratio is "the mean score of the first model divided by the mean score of the second", using only targets both models forecast. "The relative score of a model is the geometric mean of all mean score ratios which involve that model". Scaled relative skill divides by the baseline's relative skill. Optional tests: a paired Wilcoxon signed-rank test or a permutation test on the mean score difference, with `p.adjust()` for multiplicity. [scoringutils `get_pairwise_comparisons`](https://epiforecasts.io/scoringutils/reference/get_pairwise_comparisons.html)
- The COVID-19 Forecast Hub's relative WIS "also takes into account the performance of all other available models", because "not all of them provide forecasts for the same set of locations and time points". The baseline scores 1. The baseline median is the most recent week's reported deaths, with uncertainty from past weekly changes. No significance tests, CIs or permutation tests were reported for the rankings. [Cramer et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9169655/)
- The European COVID-19 Hub used relative WIS through a "pairwise comparison tournament", scaled to a baseline that holds the last value constant with expanding uncertainty. It states it has "not used any formal statistical test for comparing forecast scores, such as the Diebold-Mariano test", and shows variability only as IQRs (ensemble median relative WIS 0.71, IQR 0.61 to 0.88). [Sherratt et al. 2023, eLife](https://pmc.ncbi.nlm.nih.gov/articles/PMC10238088/)
- FluSight 2021-23 reports relative WIS, absolute WIS, MAE and coverage, with no CIs or significance tests on rankings. [Mathis et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11282251/)
- hubEvals computes `relative_metrics` with a `baseline` within comparison groups. Groups without the baseline get NA. [hubEvals](https://hubverse-org.github.io/hubEvals/reference/score_model_out.html)
- Diebold-Mariano (statsmodels 0.15.0, `statsmodels.tsa.stattools.diebold_mariano_test`):
  - d_t = g(y_t, f_a,t) − g(y_t, f_b,t), and DM = d̄ / sqrt(avar(d̄)) with a Newey-West HAC variance.
  - HLN adjustment: DM_HLN = sqrt((T + 1 − 2h + h(h − 1)/T)/T)·DM, compared with Student t on T − 1 degrees of freedom (`harvey_adj=True`).
  - The default `lags` is max(horizon − 1, ceil(nobs^(1/3))), not h − 1; pass `lags=horizon-1` to get the classic parameterization.
  - `criterion` accepts a callable, so it can test WIS differences.
  [statsmodels docs](https://www.statsmodels.org/dev/generated/statsmodels.tsa.stattools.diebold_mariano_test.html)
- R's `forecast::dm.test()` "implements the modified test proposed by Harvey, Leybourne and Newbold (1997)", with an `h` argument and `varestimator` "acf" or "bartlett". References: Diebold and Mariano (1995) JBES 13:253-263, and HLN (1997) IJF 13(2):281-291. [forecast `dm.test`](https://pkg.robjhyndman.com/forecast/reference/dm.test.html)
- fev-bench computes pairwise win rates and skill scores with a paired bootstrap over tasks (B = 1,000, percentile 95% intervals). It tests H0: W_jk = 0.5 and H0: S_jk = 0. A model "outperforms ... with high confidence" if the lower bound of its pairwise win-rate interval exceeds 50%. It gives no multiple-comparison correction. [fev-bench](https://arxiv.org/html/2509.26468v2)
- Recent extension: Harvey, Leybourne and Zu propose a DM-type test robust to a time-varying mean of the loss differential. [JBES 2025, via IDEAS](https://ideas.repec.org/a/taf/jnlbes/v43y2025i3p643-656.html) (abstract-level only).

### Inferences
- **With one model, the pairwise tournament collapses.** For two models, the geometric-mean construction gives exactly mean(WIS_model)/mean(WIS_baseline) on common targets; my `relative_skill()` test confirms it. aseri needs the tournament only if it ever publishes several models or baselines with different missing patterns. Brent's trading-day calendar is one such case: score baselines on Brent's own trading-day targets.
- **Which DM inputs.** Use d_t = WIS_model(t) − WIS_baseline(t) at one fixed horizon h, over consecutive daily origins. Under optimal forecasts, h-step errors from daily origins are MA(h − 1), so use `lags=h-1`, `harvey_adj=True`, `horizon=h`. For a bucket (for example the per-origin mean over h = 8 to 28), use lags = 27, the largest horizon minus 1. With n = 30 to 60 origins and 27 lags the HAC variance is unstable. Prefer the block bootstrap for buckets.
- **Rough origin counts before claiming skill.** To detect a mean improvement μ with a long-run SD σ_LR of d at 5% two-sided, 80% power: n_eff ≈ ((1.96 + 0.84)·σ_LR/μ)² = 7.8·(σ_LR/μ)². If the loss differential is as variable as its mean (σ_LR/μ = 1), that is about 8 effectively independent origins. At σ_LR/μ = 3, it is about 70. This is standard power arithmetic, not from a source.
- **Local evidence.** The spike's bootstrap CI on the GPR 1-7 MASE ratio was [0.69, 0.83] on 52 weekly origins, but [0.65, 1.11] on 7 recent origins. The spike also notes its bootstrap ignored overlap, so the CIs are optimistic. Expect a 30-forecast live record to give ratios whose CI straddles 1 for most series.
- **Multiplicity.** 9 series × 2 buckets × 3 baselines = 54 comparisons. At p < 0.05 about 3 will "win" by chance. Either pre-register one primary comparison per series (for example 1-7 bucket vs the best of the three baselines, chosen in the backtest), or adjust (Holm, as `p.adjust` does in scoringutils).
- **Compare against the strongest baseline.** The spike showed seasonal naive flatters the model on Suez and Taiwan, while mean28 or naive tie it. The page's headline ratio should use the per-series best baseline, chosen on backtest data before the live window opens, so the choice is not made after seeing live results.

### Python
```python
def dm_test(d, h):   # matches statsmodels diebold_mariano_test(..., lags=h-1, harvey_adj=True, horizon=h)
    d = np.asarray(d, float); n = len(d); e = d - d.mean()
    lrv = e @ e / n + 2 * sum((1 - k / h) * (e[k:] @ e[:-k]) / n for k in range(1, h))   # Bartlett
    stat = d.mean() / np.sqrt(lrv / n) * np.sqrt((n + 1 - 2 * h + h * (h - 1) / n) / n)
    return stat, 2 * stats.t.sf(abs(stat), n - 1)

def relative_skill(scores, baseline):   # scores: model, target_key, score (long)
    wide = scores.pivot_table(index="target_key", columns="model", values="score")
    def ratio(i, j):
        if i == j: return 1.0
        both = wide[[i, j]].dropna(); return both[i].mean() / both[j].mean()
    theta = pd.DataFrame({j: {i: ratio(i, j) for i in wide.columns} for j in wide.columns})
    gm = np.exp(np.log(theta).mean(axis=1))
    return gm / gm[baseline]
```
Verified: on 120 synthetic differentials with h = 7, `dm_test` gave statistic 1.3551447 and p 0.1779382, identical to statsmodels 0.15.0's `diebold_mariano_test(np.zeros(n), d, np.zeros(n), criterion=lambda y, f: f, lags=6, harvey_adj=True, horizon=7)`. Or just call statsmodels with that `criterion` trick.

### Gaps
- I did not fetch Diebold and Mariano (1995) or HLN (1997) directly. The HLN formula is quoted from the statsmodels docs, and my code reproduces statsmodels numerically.
- I found no hub that publishes significance tests on relative WIS. Whether Hubverse dashboards plan to add CIs is unknown.
- Giacomini-White conditional tests (relevant if the model were re-estimated) were not researched. With a frozen pretrained model and fixed baselines, the unconditional DM framing is adequate.

## 4. Rolling-origin backtesting without leakage: overlapping origins, effective sample size, CIs on scores, minimum origins

### Takeaway
Treat the origin (reference_date) as the unit of resampling. Average each origin's scores within a horizon bucket first, then put a stationary block bootstrap (block ≥ the bucket's maximum horizon) on the per-origin series, giving a CI for every published ratio. Daily origins at h = 28 overlap so heavily that 120 of them can be worth fewer than 20 independent ones. Backfilled forecasts are not leakage-free when the foundation model's training cutoff is unknown, and they are built on today's data vintage, not the real-time one.

### Cited Findings
- GIFT-Eval uses "A non-overlapping rolling evaluation method ... setting a predetermined number of windows in the test split, each equal to the dataset's prediction length". The test split is the last 10% of each series. It flags that the pretraining corpora of TimesFM, Chronos and Moirai "exhibit partial data leakage issues for GIFT-Eval". Its results tables report no CIs. [GIFT-Eval](https://arxiv.org/html/2410.10393)
- fev-bench uses up to 20 windows for datasets with fewer than 10 series, needs at least 2H + 1 past observations before the first window, and averages windows arithmetically. Contributors declare leakage per model-task pair. If overlap is reported, results are discarded and replaced by Chronos-Bolt (Base) scores. [fev-bench](https://arxiv.org/html/2509.26468v2)
- VIEWS used yearly test windows 2018-2023 (each using data through October of the previous year) plus a true-future window, July 2024 to June 2025. The scoring committee gives "approximately equal weight" to test-period and true-future performance. Scores "will vary considerably over time", which is why multiple windows are used. [VIEWS challenge](https://arxiv.org/html/2407.11045)
- The Hubverse warns that "retrospective performance can look better than real-time performance if forecasts are generated and scored using finalized data". It advises restricting each retrospective forecast's inputs to "the data as it was available as of that forecast's reference date". [Hubverse target data guide](https://docs.hubverse.io/en/latest/user-guide/target-data.html)
- Time-series bootstraps in `arch`: `StationaryBootstrap` (Politis-Romano, exponential block lengths), `CircularBlockBootstrap`, `MovingBlockBootstrap` (documented as "not recommended" because it undersamples the ends), and `optimal_block_length(x)`. [arch docs](https://arch.readthedocs.io/en/latest/bootstrap/timeseries-bootstraps.html)
- statsmodels' DM default lags of max(h − 1, ceil(n^(1/3))) reflect the MA(h − 1) structure of h-step losses. [statsmodels](https://www.statsmodels.org/dev/generated/statsmodels.tsa.stattools.diebold_mariano_test.html)
- From aseri's own spike: the bootstrap "resamples whole origins but ignores the overlap between neighbouring origins' 90-day target windows, so the CIs are somewhat optimistic". Timestral's training cutoff is unknown (issue mistralai/timestral#3 still unanswered on 2026-10-29). [spike-timestral-backtest.md, local](../../spike-timestral-backtest.md)

### Inferences
- **Unit of analysis.** For each (series, origin) compute the bucket mean WIS (or AE) for the model and each baseline. That is one row per origin. All CIs come from resampling these rows in blocks. Never bootstrap the (origin, horizon) cells independently: the 28 cells of one origin share one future path.
- **Block length.** At least the bucket's maximum horizon (7 for 1-7, 28 for 8-28), or `optimal_block_length` of the loss differential if that is larger. With n = 30 origins and block 28, the bootstrap is barely meaningful. Say so on the page ("too few forecasts to tell"), or show only the 1-7 bucket until n is large.
- **Effective sample size.** In the Key Question 2 simulation, at φ = 0.9, 120 daily origins at h = 28 were worth about 18 independent ones, and about 35 at h = 7. A quick estimator for published numbers: n_eff = n / (1 + 2Σ_{k=1}^{h−1} ρ_k), with ρ_k the sample autocorrelation of the per-origin loss differential.
- **Minimum origins: a defensible rule for aseri** (my synthesis, not a published standard):
  1. Display a live number at n ≥ 30 resolved forecasts per series and bucket (as specced), always with its 95% block-bootstrap CI and n.
  2. Only use the words "beats" or "loses to" naive when the CI on the WIS (or AE) ratio excludes 1. Otherwise write "ties".
  3. Only call a band "well calibrated" when the coverage CI lies within about ±10 points of nominal. The table in Key Question 2 implies that takes around 250 effectively independent forecasts.
- **Two sources of leakage in the backfill, both to label.**
  1. Model leakage: the 120-day backfill and the spike window may lie inside Timestral's training data. GIFT-Eval and fev-bench treat this as disqualifying or impute. aseri's rule of never counting retrospective forecasts in the live record is the right response. Also record a `testdata_leakage: unknown` flag in provenance.
  2. Vintage leakage: the backfill for GPR uses today's revised history as input, which a real-time forecaster would not have had. Label backfill scores "pseudo-real-time". Hubverse suggests rebuilding from as-of data where archives exist (GPR publishes older vintages; see Key Question 5).
- **Origins after the model release** (2026-10-15) are the only clean out-of-sample ones. The live record starts clean by construction.

### Python
```python
from arch.bootstrap import StationaryBootstrap, optimal_block_length

def ratio_ci(model, base, block, reps=2000, seed=0):   # per-origin bucket means, in origin order
    bs = StationaryBootstrap(block, np.asarray(model, float), np.asarray(base, float), seed=seed)
    return bs.conf_int(lambda a, b: np.array([a.mean() / b.mean()]), reps=reps, method="percentile").ravel()

# block = max(h_max_of_bucket, int(np.ceil(optimal_block_length(model - base)["stationary"].iloc[0])))
```
Verified: runs on arch 8.0.0 and returned [0.82, 1.14] for 120 synthetic origins. The `optimal_block_length` column name `"stationary"` is from arch's documented output; I did not test that line.

### Gaps
- No published standard on the "minimum number of live origins before claiming skill" for daily overlapping forecasts was found. The rule above is a synthesis.
- I did not verify whether PortWatch, Wikimedia or the Ukraine datasets revise past values. Only GPR's revisions are documented in aseri's research.

## 5. Scoring against vintages: first release vs latest data, and what the hubs do

### Takeaway
The hubs score against a single fixed snapshot taken after a stabilization period, decided in advance, and drop or flag observations that were later heavily revised. The Hubverse formalizes this: version the target data with `as_of` and score against "the version that was defined in advance as the prediction target". aseri should define, per series, a fixed stabilization lag L. Score each target against the value as of `target_end_date + L`, store `observation_as_of` on every score row, and publish a latest-vintage sensitivity check for GPR.

### Cited Findings
- **Hubverse.** Time-series target data can be versioned with an `as_of` column, and oracle output may carry an optional `as_of`. For scoring, use "the version that was defined in advance as the prediction target", e.g. end-of-season data or a fixed stabilization period. Past versions come from versioned target data, git history, or archives such as Delphi's Epidata API. [Hubverse target data guide](https://docs.hubverse.io/en/latest/user-guide/target-data.html)
- The v6.0.0 target-data schema has a `versioned` setting. When true, time-series and oracle-output data must carry an `as_of` date column. [hubverse schema](https://raw.githubusercontent.com/hubverse-org/schemas/main/v6.0.0/target-data-schema.json)
- hubPredEvalsData v1.1.1 drops an `as_of` column from oracle output before calling `hubEvals::score_model_out()`, because oracle output holds one value per unit and the scorer rejects extra columns. [hubPredEvalsData release](https://github.com/hubverse-org/hubPredEvalsData/releases/tag/v1.1.1)
- **US COVID-19 Forecast Hub.** Ground truth was CSSE data "available as of November 16, 2021", excluding data first published in the 2 weeks before that date. Backlogs were sometimes redistributed. "We did not score observations when ground-truth data showed negative values" (11 cases). Robustness checks for outlying or revised observations are in SI. [Cramer et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9169655/)
- **European COVID-19 Hub.** Forecasts were removed for the week of, and the week after, a strongly anomalous data point, defined as one where "any subsequent data release revised that data point by over 5%". Scoring used data as reported at evaluation time. [Sherratt et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10238088/)
- **FluSight 2021-23.** Scored "using data as of September 12, 2022, for 2021–22 and June 13, 2023, for 2022–23". Most revisions were small: 94% (2021-22) and 83% (2022-23) of updates changed subnational values by under 10 hospitalizations. [Mathis et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11282251/)
- **VIEWS.** Test windows are evaluated against final UCDP-GED. The true-future 2024 window is evaluated against UCDP-Candidate data, "all that is available at the time", with full evaluation planned later. [VIEWS](https://arxiv.org/html/2407.11045)
- **aseri's own research.** GPR's latest values are preliminary and revised, and older vintages are available on the GPR page. Recommendation so far: store the change-log, score against a declared vintage, record `observation_as_of`. [public-api.md 4.4, local](../../public-api.md)

### Inferences
- **Choose the target definition before the record starts** (it cannot be changed later without restating the record). Options:
  - (a) First release: the value at the first fetch after `target_end_date`. Fast and never restated, but scores against noisy preliminary values.
  - (b) Fixed stabilization lag: the value as of `target_end_date + L`. This is the hub practice (2 weeks for COVID, a season-end snapshot for FluSight).
  - (c) Latest: always restated, so the record changes retroactively, which is confusing on a public page.
  - Recommendation: (b) as primary, with L per series: for GPR, enough weekly releases for preliminary values to settle, to be measured from the archived change-log; for sources with no observed revisions, L = 0, which equals (a). Publish (c) as a sensitivity number for GPR only.
- **Measure L from aseri's own archive.** The append-only observation deltas give revision size by age. Pick L as the age after which 95% of revisions are below, say, 1% of the value. This mirrors the European hub's "revised by over 5%" anomaly rule.
- **A score row is final only once its vintage date has passed.** Until then show it as provisional or not at all. This avoids the published record changing week to week.
- **Anomalies** (Taiwan AIS dropouts, PortWatch outages): follow the COVID and European hub practice. Do not delete the forecast. Flag the observation, exclude flagged targets from the headline, and report the count excluded. Decide the flagging rule in advance (for example a validated data-quality flag from the pipeline's validation stage, not a post-hoc judgement).

### Gaps
- No source found on how the GPR index's revisions behave quantitatively (size and age profile). It must be measured from aseri's archive.
- I did not check hubverse's dashboard (PredEvals) code for which `as_of` it uses by default. The release note only says it drops the column.

## 6. What the leading hubs and competitions use, and why

### Takeaway
Epidemic hubs (COVID-19, European, FluSight; Hubverse tooling) standardize on WIS, relative WIS against a naive probabilistic baseline, 50% and 95% coverage, and absolute error of the median, with no significance testing. Benchmarks for foundation models (GIFT-Eval, fev-bench) use scaled quantile losses normalized by seasonal naive, aggregated with geometric means or ranks. fev-bench adds bootstrap CIs and leakage handling. Competitions (M4, M5, M6, VIEWS) pick one scaled or proper score, publish benchmarks, and show how few entrants beat simple baselines consistently.

### Cited Findings

| Venue | Probabilistic metric(s) | Baseline / scaling | Aggregation and uncertainty | Source |
|---|---|---|---|---|
| US COVID-19 Forecast Hub | WIS on 23 quantiles; 50% and 95% PI coverage | COVIDhub-baseline: last week's value, uncertainty from past changes | Relative WIS; national level excluded from aggregates because "large magnitudes dominate averages"; standardized ranks; no tests | [Cramer et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9169655/) |
| European COVID-19 Hub | WIS, relative WIS (pairwise); coverage | Last value with expanding uncertainty | IQRs only; no DM test | [Sherratt et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10238088/) |
| FluSight 2021-23 | WIS, relative WIS, MAE, 50%/95% coverage; log-scale WIS as sensitivity | simplets "quantile baseline": median = last value, noise from 1-week differences, truncated at 0 | No CIs; ≥ 75% of targets required for inclusion | [Mathis et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11282251/) |
| Hubverse hubEvals | wis, over/underprediction, dispersion, bias, ae_median, interval_coverage_XX | `baseline` argument for relative metrics | `by` grouping, `transform` option | [hubEvals](https://hubverse-org.github.io/hubEvals/reference/score_model_out.html) |
| M4 (2018) | MSIS on the 95% PI | In-sample seasonal-naive MAE | Mean over 100k series | [mlr3forecast msis](https://mlr3forecast.mlr-org.com/reference/mlr_measures_fcst.msis.html) |
| M5 Uncertainty (2020) | WSPL over 9 quantiles | In-sample one-step naive MAE | Weighted across series and aggregation levels | [secondary, arXiv 2311.00993](https://arxiv.org/pdf/2311.00993); [Ziel 2021, arXiv 2107.06675](https://arxiv.org/abs/2107.06675) |
| M6 (2022-23) | RPS on probabilities of each asset's quintile rank | Equal 0.2 probabilities, RPS = 0.16 | 12 monthly submission points | [Makridakis et al., arXiv 2310.13357](https://arxiv.org/abs/2310.13357) |
| VIEWS 2023/24 | CRPS (from 15-1,000 samples, `properscoring.crps_ensemble`), IGN on 11 count bins, MIS at 90% | Exactly-zero; last historical as Poisson mean; bootstrap from 240 past months | Averages over units and months; no tests | [VIEWS, arXiv 2407.11045](https://arxiv.org/html/2407.11045) |
| GIFT-Eval | CRPS ≈ mean wQL over 9 levels; MAPE | Normalized by Seasonal Naive | Average rank; no CIs | [GIFT-Eval](https://arxiv.org/html/2410.10393) |
| fev-bench | SQL (scaled quantile loss) on 0.1-0.9; MASE | Seasonal-naive MAE scale; skill vs Seasonal Naive | Skill = 1 − geometric mean of clipped ratios; win rate; paired bootstrap over tasks | [fev-bench](https://arxiv.org/html/2509.26468v2) |

Details and the "why":
- **COVID Hub inclusion rules:** a team's primary model, ≥ 25 of 51 locations, all 1-4 week targets, the full quantile set, and eligible forecasts in ≥ 60% (47) of 79 weeks. That yielded 28 models. Relative WIS at 4 weeks was about 76% higher than at 1 week. [Cramer et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9169655/)
- **M6:** of 163 teams, 38 (23.3%) beat the benchmark's RPS and 47 (28.8%) its portfolio; only 11 (6.7%) beat both. "Only 3 teams outperformed the benchmark's forecasts in all 12 months". The authors conclude beating the benchmark consistently "was particularly difficult in practice, despite the simplistic forecasting and investing approaches the benchmark employed". [M6 paper, arXiv 2310.13357 (PDF text)](https://arxiv.org/pdf/2310.13357)
- **VIEWS:**
  - Mean-based metrics such as MSE are discouraged, citing Gneiting (2011).
  - About 87% of country-month and 99% of grid-month observations are zero.
  - Scoring is on the raw count scale, because the "+1" in ln(y + 1) is arbitrary when most values are zero.
  - The IGN binning makes the score "no longer strictly proper".
  - Metrics are mapped to qualities: CRPS covers calibration, sharpness and nearness; IGN covers focus; MIS covers calibration.
  [VIEWS](https://arxiv.org/html/2407.11045); peer-reviewed version in the Journal of Peace Research 62(6), 2025, [PRIO record](https://www.prio.org/publications/14414)
- **fev-bench's rationale:**
  - "Geometric mean aggregation is less sensitive to outliers than the arithmetic mean".
  - It keeps rankings invariant to the choice of baseline and treats ratios multiplicatively (½ and 2 cancel).
  - Ratios are clipped to [0.01, 100].
  - Ties count as half-wins.
  - Failed forecasts are replaced by Seasonal Naive scores.
  [fev-bench](https://arxiv.org/html/2509.26468v2)
- **GIFT-Eval's rationale for ranks:** "To avoid skew from any single dataset, we employ a 'Rank' metric". [GIFT-Eval](https://arxiv.org/html/2410.10393)

### Inferences
- **What aseri should copy:**
  - Hubverse metric names and decomposition, so the archive is hubEvals-compatible.
  - Hub-style probabilistic naive baselines (last value plus empirical spread of past h-step changes), next to the point baselines.
  - fev-bench's bootstrap CIs and geometric-mean aggregation for any cross-series summary.
  - VIEWS' practice of publishing benchmark scores (including a trivially simple one) alongside the model's.
  - M6's lesson: report how often the model beat the baseline period by period (for example per week), not just the average. "Beat naive in 6 of the last 8 weeks" is both honest and intuitive.
- **What not to copy:**
  - Hub rankings without uncertainty.
  - GIFT-Eval's normalisation by Σ|y| (wQL) for series that can be near zero (drones, Hormuz): it explodes as Σ|y| → 0, the same failure as MAPE.

### Gaps
- M4 and M5 primary papers were not readable here (ScienceDirect 403). Their definitions are from secondary sources and software docs.
- I did not fetch the current FluSight 2025-26 or COVID-19 Hub 2024+ evaluation pages, so whether they changed to 50/80/90/95 coverage or log-scale headline scores is unverified. The hubEvals docs list `interval_coverage_XX` for arbitrary XX.

## 7. Communicating scores to non-experts honestly

### Takeaway
Use frequency statements with the denominator and the uncertainty ("24 of the last 30 days landed inside the 8-in-10 range"). Show numeric ranges rather than vague caveats, since research finds numeric uncertainty does not hurt trust while unquantified hedging can. Put interval explanations in text, because interval graphics get misread.

### Cited Findings
- Savelli and Joslyn (2013, Applied Cognitive Psychology) ran three experiments comparing predictive-interval with deterministic forecasts. Interval users identified unreliable forecasts better, expected a narrower range of outcomes, and were more decisive. Some participants misread visualized intervals as diurnal fluctuation, while "almost no misinterpretations occurred when the predictive interval was expressed in text alone". [DOI 10.1002/acp.2932](https://doi.org/10.1002/acp.2932) (from search summary, not read in full)
- Grounds, Joslyn and Otsuka (2017) found predictive-interval users better identified situations needing precautionary action, with the same diurnal misreading recurring. A Joslyn-led project reported that numeric uncertainty improves protective decisions and that participants "had greater trust in the forecast when uncertainty was acknowledged". [UW psychology publication list](https://psych.uw.edu/directory/2652) (search summary)
- van der Bles et al. (2019, Royal Society Open Science) review communicating uncertainty about facts, numbers and science. They find some evidence that communicating epistemic uncertainty "does not necessarily affect audiences negatively", with effects varying across individuals and formats. [PMC6549952](https://pmc.ncbi.nlm.nih.gov/articles/PMC6549952)
- A 2020 follow-up (van der Bles et al., PNAS) reportedly found that numeric ranges had minimal effect on perceived trustworthiness, while uncertainty stated without quantification reduced trust in the numbers and their source. [DOI 10.1073/pnas.1913678117](https://doi.org/10.1073/pnas.1913678117). Not fetched; the result is from a search summary, so verify before quoting.
- FluSight phrased coverage as the share of observations falling inside the intervals, and summarized the ensemble's relative rank as being in the top half "more than three-fourths of the time". [Mathis et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11282251/)

### Inferences
- **Templates that stay honest** (consistent with spec 6.4's wording rules):
  - Coverage: "In the last 30 live forecasts, 24 actual values landed inside the 8-in-10 range. With so few forecasts, the true rate could be anywhere from about 6 in 10 to 9 in 10." The bounds are the exact CI for 24/30 = [0.61, 0.92], computed above.
  - Skill: "The most likely value was 18% closer to the real one than 'same as yesterday' (likely between 5% and 30%)." Or, when the CI includes 1: "No clear difference from 'same as yesterday' yet."
  - Losing: "On Brent, the model does no better than repeating yesterday's price." State this plainly, as spec 6.4 requires.
  - Calibration direction: "The 8-in-10 range has been too narrow: real values fell outside it 3 times as often as promised." Use the decomposition: underprediction vs overprediction tells you which side.
- **Always show n and the period** ("based on 37 live forecasts since 2026-11-01"), never mix backtest and live numbers in one figure (spec 6.4 already), and timestamp the vintage ("scored against data as of ...").
- **Don't publish WIS as a raw number to lay users.** It has the units of the series and no intuitive scale. Publish it in the API and methods page. On the main page, use its ratio to naive as "x% better or worse than naive".
- **Avoid percent-confidence language,** consistent with the spec: "8 in 10 chance", not "80% CI". For the record dots, add a one-line legend with the expected rate ("about 2 in 10 dots should be red if the range is honest"). A user then knows that 0 red dots out of 8 is not a triumph and 3 out of 8 is not a failure.

### Gaps
- I did not read Joslyn and Nichols (2009), "Probability or frequency? Expressing forecast uncertainty in public weather forecasts", which is the most directly relevant study on frequency vs probability phrasing.
- No study was found that tests how lay users read forecast track-record statistics (coverage, skill ratios), as opposed to the forecasts themselves.
