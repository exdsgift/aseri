# Coverage-test arithmetic for aseri: exact binomial CI width, power, and the design effect of overlapping daily origins.
import numpy as np
from scipy import stats
rng = np.random.default_rng(0)
print("n | 95% Clopper-Pearson CI if 80% observed | power: detect true 70% vs nominal 80% (exact binomial, two-sided 5%) | power: true 60%")
for n in [30, 60, 90, 120, 250, 365]:
    k = round(0.8 * n)
    ci = stats.binomtest(k, n).proportion_ci(0.95, method="exact")
    def power(p_true):
        ks = np.arange(n + 1)
        reject = np.array([stats.binomtest(int(x), n, 0.8).pvalue < 0.05 for x in ks])
        return stats.binom.pmf(ks, n, p_true)[reject].sum()
    print(f"{n} | [{ci.low:.2f}, {ci.high:.2f}] | {power(0.7):.2f} | {power(0.6):.2f}")

# Design effect: AR(1) series, perfectly calibrated h-step Gaussian forecasts from consecutive daily origins.
def deff(phi, h, n, reps=4000):
    sd_h = np.sqrt(sum(phi ** (2 * j) for j in range(h)))  # true h-step predictive sd for unit innovations
    z = stats.norm.ppf(0.9)
    covs = []
    for _ in range(reps):
        T = n + h + 200
        e = rng.standard_normal(T); y = np.zeros(T)
        for t in range(1, T): y[t] = phi * y[t - 1] + e[t]
        o = np.arange(200, 200 + n)            # origins
        mean = phi ** h * y[o]
        hit = np.abs(y[o + h] - mean) <= z * sd_h
        covs.append(hit.mean())
    v = np.var(covs); vb = 0.8 * 0.2 / n
    return np.mean(covs), v / vb
print("\nphi | h | n origins | mean coverage | variance ratio vs binomial (design effect) | effective n")
for phi in [0.5, 0.9]:
    for h in [1, 7, 28]:
        for n in [30, 120]:
            m, d = deff(phi, h, n)
            print(f"{phi} | {h} | {n} | {m:.3f} | {d:.1f} | {n/d:.0f}")
