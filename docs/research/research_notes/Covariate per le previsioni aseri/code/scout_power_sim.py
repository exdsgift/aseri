"""Size and power of a covariate-scout test when 28-day forecast windows overlap.

Run: python -I scout_power_sim.py   (numpy + scipy; the StepM demo also needs arch>=8)

DGP. Loss differential (baseline WIS minus candidate WIS) for origin t and horizon h:
    d(t, h) = mu + a * u[t + h] + b * eps(t, h)
u is a daily AR(1) with persistence PHI shared by every origin that scores the same target
day, which is what makes overlapping windows correlated. The per-origin score is the mean
over the 8-28 bucket. Units: baseline mean WIS = 1, so mu = 0.05 is a 5% WIS gain, and
sigma is the sd of the per-origin bucket-mean differential in the same units.

Tests (all one-sided, H1: candidate better):
  naive : t-test treating origins as independent (what a plain bootstrap over origins does)
  DM    : Newey-West with k-1 lags (k = 28 days in origin steps) + Harvey-Leybourne-Newbold
          factor + t(n-1) critical values
  EWC   : equal-weighted cosine long-run variance, nu = 0.4 n^(2/3) terms, t(nu) critical
          values (Lazarus, Lewis, Stock and Watson, JBES 2018)
"""

import numpy as np
from scipy import stats

H0, H1 = 8, 28
B_SHARE = 0.3  # share of origin-specific noise in the differential
REPS = 4000
rng = np.random.default_rng(20261030)


def sim_D(n, step, sigma, mu, phi, reps=REPS):
    T = n * step + H1 + 200
    e = rng.standard_normal((reps, T))
    u = np.empty_like(e)
    u[:, 0] = e[:, 0] / np.sqrt(1 - phi**2)
    for s in range(1, T):
        u[:, s] = phi * u[:, s - 1] + e[:, s]
    cs = np.concatenate([np.zeros((reps, 1)), np.cumsum(u, axis=1)], axis=1)
    t = 200 + np.arange(n) * step
    um = (cs[:, t + H1 + 1] - cs[:, t + H0]) / (H1 - H0 + 1)
    em = rng.standard_normal((reps, n))
    raw = (1 - B_SHARE) * um / um.std() + B_SHARE * em / em.std()
    return mu + sigma * raw / raw.std()


def dm_hln(D, k):
    n = D.shape[1]
    x = D - D.mean(axis=1, keepdims=True)
    v = (x * x).sum(axis=1) / n
    for lag in range(1, k):
        v += 2 * (1 - lag / k) * (x[:, lag:] * x[:, :-lag]).sum(axis=1) / n
    stat = D.mean(axis=1) / np.sqrt(np.maximum(v, 1e-12) / n)
    return stat * np.sqrt((n + 1 - 2 * k + k * (k - 1) / n) / n), n - 1


def ewc(D):
    n = D.shape[1]
    nu = max(2, int(round(0.4 * n ** (2 / 3))))
    t = np.arange(1, n + 1)
    Z = np.sqrt(2 / n) * np.cos(np.pi * np.outer(np.arange(1, nu + 1), t - 0.5) / n)
    x = D - D.mean(axis=1, keepdims=True)
    lrv = ((x @ Z.T) ** 2).mean(axis=1)
    return D.mean(axis=1) / np.sqrt(lrv / n), nu


def reject(D, step, alpha):
    n = D.shape[1]
    k = int(np.ceil(H1 / step))
    naive = D.mean(axis=1) / (D.std(axis=1, ddof=1) / np.sqrt(n))
    dm, df_dm = dm_hln(D, k)
    ew, df_ew = ewc(D)
    return (
        (naive > stats.norm.ppf(1 - alpha)).mean(),
        (dm > stats.t.ppf(1 - alpha, df_dm)).mean(),
        (ew > stats.t.ppf(1 - alpha, df_ew)).mean(),
    )


def selfcheck():
    # with no overlap (step >= 28 days, phi = 0, iid differentials) every test must hold size
    D = rng.standard_normal((REPS, 60)) * 0.05
    sizes = reject(D, 28, 0.05)
    assert all(abs(s - 0.05) < 0.02 for s in sizes), sizes


def main():
    selfcheck()
    print(
        "Size at nominal 5% (mu = 0) and effective sample size n_eff = 1 / var(mean D)"
    )
    for phi in (0.0, 0.7, 0.95):
        for step, n in [(7, 52), (7, 104), (1, 365)]:
            D = sim_D(n, step, 1.0, 0.0, phi)
            naive, dm, ew = reject(D, step, 0.05)
            neff = 1 / D.mean(axis=1).var()
            print(
                f"  phi={phi:<4} step={step} n={n:<4} n_eff={neff:5.1f} | naive {naive:.2f}  DM-HLN {dm:.2f}  EWC {ew:.2f}"
            )
    print(
        "\nPower, weekly origins, phi = 0.7: DM-HLN and EWC at alpha 0.05 / 0.001 (Bonferroni for 50 candidates)"
    )
    for n in (26, 52, 104, 156):
        cells = []
        for sigma, mu in [(0.05, 0.05), (0.10, 0.05), (0.10, 0.10), (0.05, 0.02)]:
            D = sim_D(n, 7, sigma, mu, 0.7)
            _, dm5, ew5 = reject(D, 7, 0.05)
            _, dm1, ew1 = reject(D, 7, 0.001)
            cells.append(
                f"s={sigma:.2f},mu={mu:.2f}: DM {dm5:.2f}/{dm1:.2f} EWC {ew5:.2f}/{ew1:.2f}"
            )
        print(f"  n={n:<4} " + " | ".join(cells))
    try:
        stepm_demo()
    except ImportError:
        print("\n(arch not installed: StepM demo skipped)")


def stepm_demo():
    from arch.bootstrap import StepM

    n, m = 104, 40
    d0 = sim_D(n, 7, 0.05, 0.0, 0.7, reps=1)[0]
    base = 1.0 + d0
    gain = np.zeros(m)
    gain[:3] = 0.05
    noise = np.column_stack([sim_D(n, 7, 0.05, 0.0, 0.7, reps=1)[0] for _ in range(m)])
    cand = base[:, None] * (1 - gain) + noise
    s = StepM(
        base, cand, size=0.05, block_size=8, reps=2000, bootstrap="stationary", seed=1
    )
    s.compute()
    print(
        f"\nStepM demo (104 weekly origins, 40 candidates, true gains in 0-2): superior = {s.superior_models}"
    )


if __name__ == "__main__":
    main()
