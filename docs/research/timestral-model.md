# Timestral (Mistral time-series model): what it is, and can it run daily in GitHub Actions on CPU

Researched 2026-10-29. "TimeStral" is **Timestral**, a real Mistral release. Every claim below links to its source; estimates and unverified points are marked.

## TL;DR

1. **Yes, technically.** Timestral is a family of 4 zero-shot forecasting models (5M to 209M params, 21 MB to 837 MB fp32), and its official inference package runs on CPU with no GPU needed [R1][B1].
2. It fits a public-repo `ubuntu-latest` runner with plenty of room: 4 vCPU, 16 GB RAM, 14 GB SSD, 6 h job limit [G1][G2]. Mistral reports 17 ms (5M) to 113 ms (209M) per forecast on an 8-thread CPU [B1].
3. **How:** install CPU-only torch from the PyTorch CPU index (210 MB, against about 2 GB for the default Linux build), then `pip install git+https://github.com/mistralai/timestral.git@<sha>`. Pin the HF `revision` and optionally cache `~/.cache/huggingface`.
4. **License.** Code is Apache-2.0; the weights use a Modified MIT license with a revenue threshold ($20M per month) [L1]. Apache-2.0 alternatives: Chronos-2, TimesFM-2.5.
5. **Smaller risks:** there is no PyPI release (git only, one commit), no frequency input, and all accuracy numbers are vendor-reported. Also, scheduled workflows in public repos are disabled after 60 days without repo activity [G4].

## 1. Identity

| Fact | Value | Source |
|---|---|---|
| Official name | Timestral (docs page: "Timestral 1.0"), models `Timestral-5M`, `-28M`, `-123M`, `-209M` | [B1], [D1] |
| Release date | 2026-10-15 (blog date). HF repos were created 2026-10-14 and the GitHub repo on 2026-10-15 | [B1], [H5], [R3] |
| Announcement | https://mistral.ai/news/timestral/ | [B1] |
| Weights | HF collection https://huggingface.co/collections/mistralai/timestral (ungated, `gated: false`) | [H1], [H5] |
| Code | https://github.com/mistralai/timestral (one commit `a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff`, "Timestral release", no tags or releases) | [R1], [R3] |
| Paper | None yet. "A technical report with the full results will follow." The model card says "Tech report: coming soon!" | [B1], [H2] |
| Status | "Public Preview" on Mistral docs | [D1] |

## 2. Size and architecture

| Model | Params (safetensors, F32) | `model.safetensors` bytes | Layers / d_model |
|---|---|---|---|
| Timestral-5M | 5,208,960 | 20,843,960 (21 MB) | 8 / 192 |
| Timestral-28M | 27,821,184 | 111,296,464 (111 MB) | 12 / 384 |
| Timestral-123M | 122,606,720 | 490,445,904 (490 MB) | 20 / 640 |
| Timestral-209M | 209,312,256 | 837,271,648 (837 MB) | 24 / 768 |

Sources: HF API file listings [H5], each repo's `config.json` (`block_schedule` length, `d_model`) [H6], and the README weights table [R1].

**Architecture:** a causal, patch-based transformer (32 steps per patch) with time attention and variate attention. It is trained with "Decoupled Horizon Forecasting", where separate prediction tokens read the encoded context, and a quantile head outputs 21 non-crossing quantiles [R1][H2]. Training is mostly synthetic: pre-training at context 8192, then post-training on real plus synthetic data at 4x the context, with pinball loss over 21 quantiles [B1].

## 3. License

- **Code** (the `timestral` package): Apache-2.0 [R1][R3].
- **Weights:** "Modified MIT License", identical text in each model repo [L1]. It grants the right to "use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Model". The two conditions are:
  1. Include the attribution notice ("2026 - Mistral AI") and the permission notice "in all copies or substantial portions of the Model". This applies to redistributing the weights, not to forecasts.
  2. "You are not authorized to exercise any rights under this license if the global consolidated monthly revenue of your company (or that of your employer) exceeds $20 million (or its equivalent in another currency) for the preceding month." This also covers "derivatives, modifications, or combined works". The remedy is a commercial license from sales@mistral.ai "at its sole discretion", or Mistral's hosted services. The text refers to a "restriction in (b)" that does not exist in the document, which is a drafting slip.
- **Outputs/forecasts:** the license text says nothing about model outputs, so it puts no explicit limit on publishing forecasts [L1]. The README and card add: "you must not use them in a manner that infringes ... any third party's rights" [R1][H2].
- **Public project:** allowed for anyone under the revenue threshold.
- **The hosted route the license points to does not seem to exist yet:** on 2026-10-29 the Mistral docs page for Timestral 1.0 209M lists it as "Public Preview" with weights only (Modified MIT), and shows no API endpoint or pricing [M1]. Checked by reading the page, not by calling the API.
- **Fallbacks with permissive licenses**, per the HF model metadata: `amazon/chronos-2` is Apache-2.0 with about 119M params [H7], and `google/timesfm-2.5-200m-pytorch` is Apache-2.0 with about 231M params [H8]. Two others are not usable here: `Salesforce/moirai-2.0-R-small` is CC-BY-NC-4.0 (non-commercial) [H9], and `NX-AI/TiRex` uses the custom "nx-ai-community-license" [H10], which I did not read.

## 4. Inputs and outputs

| Topic | Answer | Source |
|---|---|---|
| Univariate / multivariate | Both. Context shape is `(B, V, T)`, `(B, T)` or `(T,)`, and the variates of a series are forecast jointly | [R1], [H2] |
| Covariates | Past-only `(B, C_past, T)`, known-future `(B, C_known, T + h)`, and categorical (target-encoded for univariate targets). Covariates are not forecast themselves. All 4 checkpoints have `covariate_enabled: true` | [R1], [H6] |
| Max context | 32,768 steps (1,024 patches). Longer input is truncated to the most recent steps | [R1], [H2], [H6] |
| Max horizon | 1,024 steps (32 patches) per forward pass. Longer horizons run block by block, feeding back each block's median | [R1], [H2] |
| Output | Probabilistic: 21 quantiles (0.01, 0.05, 0.1 ... 0.9, 0.95, 0.99), shape `(B, V, h, 21)`, plus `.median` and `.quantile(q)`. No samples | [R1], [H2] |
| Frequency | **No frequency or timestamp input.** `forecast()` takes only arrays plus `prediction_length`, the mask, covariates and two flags. Calendar effects can be passed as known-future (categorical) covariates, for example day of week | [C1], [B1] |
| Missing values | NaN marks missing values, and an optional `observation_mask` (False = missing) marks more | [R1], [C1] |
| Short series | Context is left-padded with unobserved values to a multiple of 32 (`pad_to_patch`), so short yearly or monthly series are accepted mechanically. Accuracy on very short series is **unverified** | [C1] |
| Defaults to know | `symmetric_averaging=True` also forecasts `-context` and averages the two, so there are 2 passes. `clip_nonnegative=True` clamps forecasts at 0 when the observed history is non-negative | [C1] |

## 5. How to run

- **Package:** `timestral`, its own standalone package. It does not use transformers. It is **not on PyPI**: `https://pypi.org/pypi/timestral/json` returned 404 on 2026-10-29, so install from git and do not `pip install timestral`, since the name is unclaimed [R1][P3].
- **Python:** `requires-python = ">=3.10"` [R2]. The latest torch (2.15.0) requires Python >= 3.11 [P1], so use 3.12.
- **Dependencies:** `torch>=2.4`, `numpy>=1.24`, `safetensors>=0.4`, `huggingface_hub>=0.23` [R2]. `uv.lock` pins torch 2.14.1 from pypi.org [R4], which is the CUDA build on Linux, so `uv sync --frozen` on a runner would pull the big CUDA wheels.
- **CPU/GPU:** "runs on CPU or GPU", and "CPU-friendly: no GPU needed for inference" [R1]. `from_pretrained` defaults to `device="cpu"` and loads fp32 [C1][C2].

Official install and snippet, copied from the README [R1]:

```bash
pip install git+https://github.com/mistralai/timestral.git   # Python >= 3.10, torch >= 2.4
```

```python
import numpy as np
from timestral import TimestralForecaster

forecaster = TimestralForecaster.from_pretrained("mistralai/Timestral-209M")  # device="cuda" for a GPU

context = np.random.randn(2, 1, 2000).cumsum(-1)        # (series, variates, time); NaN = missing
forecast = forecaster.forecast(context, prediction_length=96)

forecast.quantiles.shape   # (2, 1, 96, 21): series, variates, horizon, quantile levels
forecast.quantile_levels   # (0.01, 0.05, 0.1, ..., 0.9, 0.95, 0.99)
forecast.median            # (2, 1, 96)
forecast.quantile(0.9)     # (2, 1, 96)
```

`from_pretrained` also takes `revision`, `cache_dir`, `token` and `local_files_only=True` (or `HF_HUB_OFFLINE=1`) [R1].

**Published CPU numbers:** "On a standard server CPU with 8 threads, forecasting one day ahead from three weeks of 15-minute history takes 17 ms with the 5M model and 113 ms with the 209M model." The 28M is "3.6 times faster than the 209M", and the 123M runs at "three quarters of its latency" [B1]. Some press reports quote 10 ms and 140 ms instead, which does not match the primary source. **No memory numbers are published.** It is not stated whether the timing includes the default second (mirrored) pass.

## 6. Benchmarks (vendor-reported)

Timestral-209M against the models Mistral chose to compare with, from the model card [H2]:

| Benchmark | Metric | Timestral-209M | t0-gamma | TimesFM-3 | Toto-2.0-2.5B | Chronos-2 |
|---|---|---|---|---|---|---|
| GIFT-Eval | MASE (lower is better) | **0.658** | 0.661 | 0.667 | 0.696 | 0.698 |
| GIFT-Eval | CRPS (lower is better) | **0.446** | 0.452 | 0.456 | 0.476 | 0.485 |
| TIME | MASE (lower is better) | **0.626** | 0.637 | 0.640 | 0.642 | 0.662 |
| TIME | CRPS (lower is better) | **0.522** | 0.534 | 0.536 | 0.539 | 0.556 |
| fev-bench | SQL skill (higher is better) | **50.39** | 49.42 | 48.99 | 44.42 | 47.28 |
| fev-bench | MASE skill (higher is better) | **39.49** | 37.99 | 37.82 | 32.54 | 35.50 |

The family across sizes [H2]: GIFT-Eval MASE is 0.705 / 0.678 / 0.659 / 0.658 and fev-bench SQL is 46.19 / 48.42 / 50.18 / 50.39 (5M / 28M / 123M / 209M).

TiRex appears only in the blog charts [B1]:
- GIFT-Eval: TiRex-2-Pretrained scores GMean WQL 0.4669 and GMean MASE 0.6777. The blog's "GMean WQL" values equal the card's "CRPS" values, for example 0.4460 for 209M.
- fev-bench: TiRex-2 scores an SQL skill of 45.50%.

The blog also says: "Our 28M model beats Chronos-2, about four times larger, on GIFT-Eval and TIME" [B1].

- **TimesFM 2.5 and Moirai 2** are not in any Mistral comparison. Their raw results exist in the GIFT-Eval results repo (`results/TimesFM-2.5`, `results/Moirai2`) [E1], but I did not compute aggregate scores from them.
- **Independent trace:** Timestral's results were merged into the official GIFT-Eval repo on 2026-10-16 ("Add Timestral results ... and replication notebook (#234)"). The submission config says `"model_type": "zero-shot"` and `"testdata_leakage": "No"` [E1]. fev-bench's repo also holds `timestral-*.csv` result files [E2]. I did not verify the leaderboard ranks themselves.

## 7. GitHub-hosted runner fit

| Limit | Value | Source |
|---|---|---|
| `ubuntu-latest`, public repo | 4 CPU, 16 GB RAM, 14 GB SSD, x64, Ubuntu 24.04 (private repos get 2 CPU, 8 GB) | [G1] |
| Job time limit | "Each job in a workflow can run for up to 6 hours of execution time" | [G2] |
| actions/cache | 10 GB per repo by default. Entries not accessed in 7 days are evicted. `schedule` runs can write caches in the default-branch scope | [G2], [G3] |
| Schedule caveats | Runs only on the default branch, "can be delayed during periods of high loads", and "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days" | [G4] |

**Does it fit? Yes, by a wide margin.**
- **Disk:** the CPU torch wheel is 209.5 MB (`torch-2.15.0+cpu`, cp312, from the official CPU index, measured by HTTP HEAD) [P2]. The largest weights file is 837 MB [H5]. Both fit easily in 14 GB.
- **RAM:** fp32 weights are at most about 0.84 GB, against 16 GB available. *Estimate:* activations for a handful of series are small.

**Install trap:** a plain `pip install torch` on Linux pulls the CUDA build. That is the 539 MB `torch-2.15.0` manylinux wheel plus Linux-only `nvidia-cudnn-cu13`, `nvidia-cusparselt-cu13`, `nvidia-nccl-cu13`, `nvidia-nvshmem-cu13` and `triton`. At current PyPI sizes those add about 1.5 GB more [P1]. Install CPU torch first with `pip install torch --index-url https://download.pytorch.org/whl/cpu`, which is the index pattern PyTorch's own install pages use [P4], and then install the git package, which then finds torch already satisfied.

**Cold-start estimate (unmeasured):**
- Downloads: about 0.25 GB of Python dependencies (CPU torch plus numpy, safetensors, huggingface_hub), plus 21 MB to 837 MB of weights depending on the model.
- At typical datacenter bandwidth, I estimate that at under 1 to 2 minutes of setup.
- Inference for a handful of series: a few seconds even for 209M. The vendor figure is 113 ms on 8 threads, and the runner has 4.
- Not measured. Do one timed run to confirm.

**Does caching help?** Only a little for speed:
- Restoring an 837 MB cache also means a download from GitHub's cache storage, so the time saved over pulling from HF is modest (unmeasured).
- Its real value is resilience: no daily dependency on the HF Hub. A daily run keeps the entry warm, so the 7-day eviction never fires [G3].
- If you cache, key on the pinned HF `revision`, and use the 28M (111 MB) or 5M (21 MB) model if cold start matters more than the last bit of accuracy.

**Keep-alive:** if the job deploys to Pages without committing, the repo may see no "activity" and the schedule will turn off after 60 days [G4]. The docs do not say whether a workflow's own bot commits count as activity, so this is **unverified**.

## Unverified or open

- Real cold-start time and inference time on a 4-vCPU runner: not measured, because no runs were allowed.
- Accuracy on short, low-frequency series (yearly or monthly geopolitical data): not assessed. No frequency input exists.
- Whether the 17 / 113 ms figures include the default mirrored second pass.
- Leaderboard ranks were not independently recomputed. Only the presence of the submissions in the GIFT-Eval and fev repos was confirmed.

## Sources

- [B1] Mistral blog, "Timestral" (2026-10-15): https://mistral.ai/news/timestral/
- [D1] Mistral docs, Timestral 1.0: https://docs.mistral.ai/models/timestral-1-0
- [R1] GitHub README: https://github.com/mistralai/timestral/blob/main/README.md
- [R2] pyproject.toml: https://github.com/mistralai/timestral/blob/main/pyproject.toml
- [R3] GitHub API, repo metadata and commits: https://api.github.com/repos/mistralai/timestral and https://api.github.com/repos/mistralai/timestral/commits
- [R4] uv.lock: https://github.com/mistralai/timestral/blob/main/uv.lock
- [C1] Source code, forecaster: https://github.com/mistralai/timestral/blob/main/src/timestral/forecaster.py
- [C2] Source code, loader: https://github.com/mistralai/timestral/blob/main/src/timestral/loading.py
- [H1] HF collection: https://huggingface.co/collections/mistralai/timestral
- [H2] HF model card, Timestral-209M: https://huggingface.co/mistralai/Timestral-209M
- [H5] HF API, file sizes, params, created dates: https://huggingface.co/api/models/mistralai/Timestral-209M?blobs=true (same for -5M, -28M, -123M)
- [H6] Model configs: https://huggingface.co/mistralai/Timestral-209M/blob/main/config.json (same for the other sizes)
- [H7] https://huggingface.co/amazon/chronos-2
- [H8] https://huggingface.co/google/timesfm-2.5-200m-pytorch
- [H9] https://huggingface.co/Salesforce/moirai-2.0-R-small
- [H10] https://huggingface.co/NX-AI/TiRex
- [L1] Weights license (Modified MIT): https://huggingface.co/mistralai/Timestral-209M/blob/main/LICENSE
- [E1] GIFT-Eval results repo: https://github.com/SalesforceAIResearch/gift-eval/tree/main/results/Timestral-209M (commit 425049468e, 2026-10-16)
- [E2] fev-bench results: https://github.com/autogluon/fev/tree/main/benchmarks/fev_bench/results
- [M1] Mistral docs, Timestral 1.0 209M model page: https://docs.mistral.ai/models/timestral-1-0-209m
- [G1] GitHub-hosted runners: https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- [G2] Actions limits: https://docs.github.com/en/actions/reference/limits
- [G3] Dependency caching: https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
- [G4] Schedule event: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
- [P1] PyPI torch metadata: https://pypi.org/pypi/torch/json (and the nvidia-* / triton package pages)
- [P2] PyTorch CPU wheel index: https://download.pytorch.org/whl/cpu/torch/
- [P3] PyPI lookup for `timestral` (404 on 2026-10-29): https://pypi.org/pypi/timestral/json
- [P4] PyTorch install commands (CPU index pattern): https://docs.pytorch.org/get-started/previous-versions/
