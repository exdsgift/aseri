import numpy as np
import pandas as pd
import scoringrules as sr
from scipy import stats
from evalkit import (
    LEVELS,
    wis,
    wis_components,
    covered,
    pit_histogram,
    coverage_tests,
    dm_test,
    ratio_ci,
    relative_skill,
    mase_scale,
)

rng = np.random.default_rng(1)
y = rng.normal(size=500) * 3
Q = np.sort(rng.normal(size=(500, 21)) * 3 + rng.normal(size=(500, 1)), axis=1)
K = 10
# 1. WIS equals scoringrules' interval-based WIS
ref = sr.weighted_interval_score(
    y, Q[:, K], Q[:, :K], Q[:, ::-1][:, :K], 2 * LEVELS[:K], backend="numba"
)  # numba only: the array backends of scoringrules 0.11.0 add w_median*median (issue #140)
assert np.allclose(wis(Q, y), ref), (wis(Q, y)[:3], ref[:3])
# 2. components sum to WIS
assert np.allclose(sum(wis_components(Q, y)), wis(Q, y))
# 3. point forecast: WIS = |y - m| (CRPS of a point mass = absolute error)
P = np.repeat(y[:, None] + 1.5, 21, axis=1)
assert np.allclose(wis(P, y), 1.5)
# 4. WIS approximates CRPS of a normal
mu, sd = 0.3, 2.0
Qn = np.repeat((mu + sd * stats.norm.ppf(LEVELS))[None, :], 500, 0)
print(
    "mean WIS / mean CRPS (normal, 21 levels):",
    wis(Qn, y).mean() / sr.crps_normal(y, mu, sd).mean(),
)
# 5. calibrated forecasts: coverage ~ nominal, flat PIT
yy = rng.normal(size=20000)
Qc = np.repeat(stats.norm.ppf(LEVELS)[None, :], 20000, 0)
print("cov80, cov50:", covered(Qc, yy, 0.8).mean(), covered(Qc, yy, 0.5).mean())
ph = pit_histogram(Qc, yy)
print("PIT density range:", ph.min().round(2), ph.max().round(2))
# 6. ties: y equal to one quantile splits 1/2-1/2; two equal quantiles 1/4-1/2-1/4
widths = np.diff(np.r_[0, LEVELS, 1])
q1 = np.arange(21.0)[None, :]
assert np.allclose((pit_histogram(q1, np.array([5.0])) * widths)[5:7], 0.5)
q2 = q1.copy()
q2[0, 6] = 5.0
assert np.allclose(
    (pit_histogram(q2, np.array([5.0])) * widths)[5:8], [0.25, 0.5, 0.25]
)
# 7. coverage tests on iid hits
print("coverage tests iid 80%:", coverage_tests(rng.random(200) < 0.8, 0.8))
# 8. DM vs statsmodels if available
d = rng.normal(0.1, 1, 120)
print("dm_test h=7:", dm_test(d, 7))
try:
    from statsmodels.tsa.stattools import diebold_mariano_test as dmt

    r = dmt(
        np.zeros(120),
        d,
        np.zeros(120),
        criterion=lambda yy, f: f,
        lags=6,
        harvey_adj=True,
        horizon=7,
    )
    print("statsmodels:", r.statistic, r.pvalue)
except ImportError as e:
    print("statsmodels has no diebold_mariano_test:", e)
# 9. bootstrap CI
print("ratio CI:", ratio_ci(rng.gamma(2, 1, 120), rng.gamma(2, 1.2, 120), block=7))
# 10. relative skill: with two models equals the plain ratio on common targets
df = pd.DataFrame(
    {
        "model": ["a"] * 4 + ["b"] * 3,
        "target_key": [1, 2, 3, 4, 1, 2, 3],
        "score": [1, 2, 3, 9, 2, 2, 2],
    }
)
rs = relative_skill(df, "b")
assert np.isclose(rs["a"], (1 + 2 + 3) / 6), rs
print("MASE scale:", mase_scale(np.arange(30) % 7 + rng.normal(size=30)))
print("ALL OK")
