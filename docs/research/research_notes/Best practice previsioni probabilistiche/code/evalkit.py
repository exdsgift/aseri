import numpy as np
import pandas as pd
from scipy import stats

# aseri's 21 levels: FluSight's 23 minus 0.025 and 0.975 (public-api.md 1.2)
LEVELS = np.round(np.r_[0.01, 0.05, np.arange(0.10, 0.901, 0.05), 0.95, 0.99], 2)


def pinball(q, y, tau):
    """Quantile score QS_tau(q, y) = (1{y < q} - tau)(q - y). No factor 2 (scoringrules convention)."""
    return ((y < q).astype(float) - tau) * (q - y)


def wis(Q, y, levels=LEVELS):
    """WIS of Bracher et al. 2021 (w0 = 1/2, w_k = alpha_k/2) = mean over the 2K+1 levels of 2*QS."""
    levels = np.asarray(levels)
    assert np.allclose(levels + levels[::-1], 1) and np.isclose(levels, 0.5).any(), (
        "needs symmetric levels incl. median"
    )
    return 2 * pinball(Q, np.asarray(y)[..., None], levels).mean(-1)


def wis_components(Q, y, levels=LEVELS):
    """(dispersion, overprediction, underprediction); they sum to wis()."""
    levels = np.asarray(levels)
    K = (len(levels) - 1) // 2
    lo, hi, m = Q[..., :K], Q[..., ::-1][..., :K], Q[..., K]
    alpha, y = 2 * levels[:K], np.asarray(y)
    y_ = y[..., None]
    disp = (alpha / 2 * (hi - lo)).sum(-1)
    over = np.where(y_ < lo, lo - y_, 0).sum(-1) + 0.5 * np.maximum(m - y, 0)
    under = np.where(y_ > hi, y_ - hi, 0).sum(-1) + 0.5 * np.maximum(y - m, 0)
    return disp / (K + 0.5), over / (K + 0.5), under / (K + 0.5)


def covered(Q, y, central, levels=LEVELS):
    """True if y is inside the central interval (inclusive bounds), e.g. central=0.8 -> [q0.1, q0.9]."""
    lo = Q[..., np.isclose(levels, (1 - central) / 2)][..., 0]
    hi = Q[..., np.isclose(levels, (1 + central) / 2)][..., 0]
    return (y >= lo) & (y <= hi)


def pit_histogram(Q, y, levels=LEVELS):
    """Density per bin between consecutive levels (plus 0 and 1); flat at 1 if calibrated.
    Ties split binomially: 1/2-1/2 for one matching quantile, 1/4-1/2-1/4 for two (Bracher et al. 2021)."""
    edges = np.r_[0, levels, 1]
    counts = np.zeros(len(edges) - 1)
    for q, obs in zip(Q.reshape(-1, Q.shape[-1]), np.ravel(y)):
        below, ties = int((q < obs).sum()), int((q == obs).sum())
        counts[below : below + ties + 1] += stats.binom.pmf(
            np.arange(ties + 1), ties, 0.5
        )
    return counts / counts.sum() / np.diff(edges)


def coverage_tests(inside, nominal):
    """Exact binomial (Kupiec-type) p-value and Christoffersen independence LR p-value.
    Only valid on a sequence whose hits are independent under H0: 1-step-ahead, or origins h apart."""
    inside = np.asarray(inside, bool)
    n, x = len(inside), int(inside.sum())
    p_uc = stats.binomtest(x, n, nominal).pvalue
    a, b = inside[:-1], inside[1:]
    n00, n01 = int((~a & ~b).sum()), int((~a & b).sum())
    n10, n11 = int((a & ~b).sum()), int((a & b).sum())

    def ll(k0, k1):  # max log-likelihood of a Bernoulli with k0 zeros, k1 ones
        p = k1 / (k0 + k1) if k0 + k1 else 0.0
        return sum(k * np.log(pr) for k, pr in ((k0, 1 - p), (k1, p)) if k)

    lr = -2 * (ll(n00 + n10, n01 + n11) - ll(n00, n01) - ll(n10, n11))
    return p_uc, stats.chi2.sf(lr, 1)


def dm_test(d, h):
    """Diebold-Mariano on loss differentials d (model - baseline) from consecutive origins at horizon h.
    Newey-West variance with h-1 lags, HLN (1997) correction, Student t with n-1 df."""
    d = np.asarray(d, float)
    n = len(d)
    e = d - d.mean()
    lrv = e @ e / n + 2 * sum((1 - k / h) * (e[k:] @ e[:-k]) / n for k in range(1, h))
    stat = d.mean() / np.sqrt(lrv / n) * np.sqrt((n + 1 - 2 * h + h * (h - 1) / n) / n)
    return stat, 2 * stats.t.sf(abs(stat), n - 1)


def ratio_ci(model, base, block, reps=2000, seed=0):
    """Stationary block bootstrap 95% CI for mean(model)/mean(base); block >= horizon."""
    from arch.bootstrap import StationaryBootstrap

    bs = StationaryBootstrap(
        block, np.asarray(model, float), np.asarray(base, float), seed=seed
    )
    return bs.conf_int(
        lambda a, b: np.array([a.mean() / b.mean()]), reps=reps, method="percentile"
    ).ravel()


def relative_skill(scores, baseline):
    """Pairwise tournament (Cramer et al. 2022; scoringutils): geometric mean of mean-score ratios
    on common targets, scaled so the baseline = 1. scores: columns model, target_key, score."""
    wide = scores.pivot_table(index="target_key", columns="model", values="score")

    def ratio(i, j):
        if i == j:
            return 1.0
        both = wide[[i, j]].dropna()
        return both[i].mean() / both[j].mean()

    theta = pd.DataFrame(
        {j: {i: ratio(i, j) for i in wide.columns} for j in wide.columns}
    )
    gm = np.exp(np.log(theta).mean(axis=1))
    return gm / gm[baseline]


def mase_scale(history, m=7):
    """Hyndman-Koehler denominator: in-sample mean |y_t - y_{t-m}| over the origin's own context."""
    h = np.asarray(history, float)
    return np.mean(np.abs(h[m:] - h[:-m]))
