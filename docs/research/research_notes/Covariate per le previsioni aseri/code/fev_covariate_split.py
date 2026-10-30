"""Split fev-bench results by covariate type to estimate how much covariates help.

Reads the per-task CSVs published in autogluon/fev (benchmarks/fev_bench/results) and prints:
  1. SQL skill vs seasonal naive per model on no-covariate, known-future and past-only tasks;
  2. paired geometric-mean SQL ratios (covariate-using model / univariate model) per subset,
     with a 90% bootstrap CI over tasks, leaked tasks (trained_on_this_dataset) excluded;
  3. the same ratio by number of dynamic covariates.
This is a cross-model comparison, not an ablation: task mix and model quality are confounded.

Usage: python -I fev_covariate_split.py <cache_dir>   (downloads the CSVs into cache_dir once)
"""

import ast
import csv
import math
import os
import random
import sys
import urllib.request

BASE = (
    "https://raw.githubusercontent.com/autogluon/fev/main/benchmarks/fev_bench/results/"
)
MODELS = [
    "seasonal_naive",
    "chronos-2",
    "timestral-209m",
    "timesfm-2_5",
    "tirex",
    "tabpfn-ts",
    "moirai-2_0",
    "toto-1_0",
]


def load(d, m):
    path = os.path.join(d, m + ".csv")
    if not os.path.exists(path):
        urllib.request.urlretrieve(BASE + m + ".csv", path)
    with open(path, encoding="utf-8") as f:
        return {r["task_name"]: r for r in csv.DictReader(f)}


def cols(r, c):
    return ast.literal_eval(r[c]) if r[c] not in ("", "[]") else []


def kind(r):
    return (
        "known"
        if cols(r, "known_dynamic_columns")
        else ("past" if cols(r, "past_dynamic_columns") else "none")
    )


def leaked(r):
    return r.get("trained_on_this_dataset") in ("True", "true", "1")


def gmean_ratio(A, B, tasks, seed=0, n_boot=4000):
    logs = [
        math.log(float(A[t]["SQL"]) / float(B[t]["SQL"]))
        for t in tasks
        if t in A and t in B and not leaked(A[t]) and not leaked(B[t])
    ]
    rng = random.Random(seed)
    boots = sorted(
        sum(rng.choices(logs, k=len(logs))) / len(logs) for _ in range(n_boot)
    )
    m = sum(logs) / len(logs)
    return (
        math.exp(m) - 1,
        math.exp(boots[int(0.05 * n_boot)]) - 1,
        math.exp(boots[int(0.95 * n_boot)]) - 1,
        len(logs),
    )


def main(d):
    os.makedirs(d, exist_ok=True)
    R = {m: load(d, m) for m in MODELS}
    base = R["seasonal_naive"]
    S = {k: [t for t in base if kind(base[t]) == k] for k in ("none", "known", "past")}
    print({k: len(v) for k, v in S.items()})
    for m in MODELS[1:]:
        sk = {
            k: 1
            - math.exp(
                sum(
                    math.log(
                        min(
                            max(float(R[m].get(t, base[t])["SQL"]) / float(base[t]["SQL"]), 0.01),
                            100,
                        )
                    )
                    for t in v
                )
                / len(v)
            )
            for k, v in S.items()
        }
        print(
            f"{m:16s} skill none {sk['none']:.3f} known {sk['known']:.3f} past-only {sk['past']:.3f}"
        )
    fmt = lambda x: f"{x[0]:+.1%} [{x[1]:+.1%}, {x[2]:+.1%}] n={x[3]}"
    for a, b in [
        ("chronos-2", "tirex"),
        ("chronos-2", "timesfm-2_5"),
        ("timestral-209m", "tirex"),
        ("timestral-209m", "timesfm-2_5"),
        ("tabpfn-ts", "tirex"),
    ]:
        print(
            f"{a}/{b}: "
            + " | ".join(f"{k} {fmt(gmean_ratio(R[a], R[b], v))}" for k, v in S.items())
        )
    ncov = lambda r: (
        len(cols(r, "known_dynamic_columns")) + len(cols(r, "past_dynamic_columns"))
    )
    for lo, hi in [(1, 1), (2, 3), (4, 7), (8, 99)]:
        ts = [t for t in base if kind(base[t]) != "none" and lo <= ncov(base[t]) <= hi]
        print(
            f"{lo}-{hi} covariates ({len(ts)} tasks): chronos-2/tirex {fmt(gmean_ratio(R['chronos-2'], R['tirex'], ts))}"
            f" | timestral-209m/tirex {fmt(gmean_ratio(R['timestral-209m'], R['tirex'], ts))}"
        )


if __name__ == "__main__":
    # self-check: a model whose SQL is 0.9x the other's on every task gives exactly -10% with a zero-width CI
    A = {str(i): {"SQL": str(0.9 * (i + 1))} for i in range(5)}
    B = {str(i): {"SQL": str(i + 1)} for i in range(5)}
    m, lo, hi, n = gmean_ratio(A, B, list(A))
    assert abs(m + 0.1) < 1e-9 and abs(lo - m) < 1e-9 and abs(hi - m) < 1e-9 and n == 5
    main(sys.argv[1] if len(sys.argv) > 1 else "fev_cache")
