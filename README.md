<div align="center">

<img src="branding/avatar/avatar-hat-400.png" alt="aseri" width="96">

# aseri

**Daily forecasts of geopolitical risk, with a public track record.**

[![daily](https://github.com/exdsgift/aseri/actions/workflows/daily.yml/badge.svg)](https://github.com/exdsgift/aseri/actions/workflows/daily.yml)
[![code: MIT](https://img.shields.io/badge/code-MIT-1b1bf2)](LICENSE)
[![data: CC BY-NC 4.0](https://img.shields.io/badge/data-CC%20BY--NC%204.0-1b1bf2)](https://creativecommons.org/licenses/by-nc/4.0/)
[![API: v1 JSON](https://img.shields.io/badge/API-v1%20JSON-ffc94a)](https://exdsgift.github.io/aseri/api/)

[**Live site**](https://exdsgift.github.io/aseri/) · [API](https://exdsgift.github.io/aseri/api/) · [Methods](docs/superpowers/specs/2026-10-29-aseri-design.md) · [Contributing](CONTRIBUTING.md)

</div>

<br>

aseri (焦り, "impatience") forecasts nine public signals every day, from the Caldara and Iacoviello
geopolitical risk index to four sea lanes and the air war in Ukraine, with
[Mistral's Timestral-209M](https://huggingface.co/mistralai/Timestral-209M) on a free GitHub runner.
Every forecast is archived once, never edited, and scored against what happened.
No server, no database, no key.

- **Ranges, not points.** 21 quantiles for every day ahead; the page shows where 8 in 10 days should land.
- **Calibrated.** On a two-year backtest the 8 in 10 range holds about 8 days in 10.
- **Append-only.** CI refuses any edit to an archived forecast file.
- **Fails safe.** A source that fails, runs late or rewrites its history holds only its own series.
- **Open.** Static JSON with CORS open, an OpenAPI 3.1 contract, Hubverse quantile semantics.

## Try it

```sh
API=https://exdsgift.github.io/aseri/api/v1
curl -s $API/series.json | jq -r '.series[].series_id'
curl -s $API/series/hormuz_transits/latest.json | jq '.quantiles["0.5"]'
```

Updated once a day, so poll at most once an hour. For research there are
[bulk Parquet and CSV files](https://exdsgift.github.io/aseri/api/v1/bulk/datapackage.json) with a
Frictionless data package.

## Signals

| Series | Source | Horizon |
|---|---|---|
| Geopolitical risk | Caldara and Iacoviello GPR | 28 days |
| "World War III" on Wikipedia | Wikimedia pageviews | 14 days |
| Brent oil | EIA through FRED | 14 trading days |
| Suez, Hormuz, Bab el-Mandeb, Taiwan Strait | IMF PortWatch | 14 to 28 days |
| Air-raid alerts, drones downed | Ukrainian open datasets | 7 days |

Every series' lag, revision window and licence is in [`pipeline/aseri/series.py`](pipeline/aseri/series.py)
and the [catalog](https://exdsgift.github.io/aseri/api/v1/series.json).

## Run it yourself

Python 3.12 with [uv](https://docs.astral.sh/uv/), Node 22. The first run downloads 837 MB of weights.

```sh
git clone https://github.com/exdsgift/aseri && cd aseri/pipeline
uv sync && uv run pytest
uv run python -m aseri ../site/api/v1 ../archive   # a full daily run
```

## More

[Track record](https://exdsgift.github.io/aseri/#record) · [Model and calibration](docs/adr/0001-baselines-and-calibration-before-the-live-record.md) · [Licences](api/licenses) · [Archive branch](https://github.com/exdsgift/aseri/tree/archive)

Code is MIT. Forecasts, scores and the API are CC BY-NC 4.0; each data source keeps its own terms
(PortWatch needs the IMF's permission for commercial use). Cite it with [`CITATION.cff`](CITATION.cff).

<sub>aseri is for awareness, not decision support. © 2026 Gabriele Durante</sub>
