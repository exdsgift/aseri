# aseri

Daily probabilistic forecasts of nine public geopolitical-risk signals, as static JSON in the Hubverse quantile format. Dated, append-only, and scored against what happened.

**Base URL** `https://exdsgift.github.io/aseri/api/v1/` · [Docs](https://exdsgift.github.io/aseri/api/) · [OpenAPI 3.1](https://exdsgift.github.io/aseri/api/v1/openapi.json) · [The page](https://exdsgift.github.io/aseri/) · CC BY-NC 4.0

```sh
curl -s https://exdsgift.github.io/aseri/api/v1/series.json | jq -r '.series[].series_id'
curl -s https://exdsgift.github.io/aseri/api/v1/series/gpr_daily/latest.json | jq '{model_id, reference_date, target_end_date}'
curl -s https://exdsgift.github.io/aseri/api/v1/series/gpr_daily/forecasts.json | jq -r '.forecasts[] | "\(.reference_date) \(.forecast_mode)"'
```

```python
import json
from urllib.request import urlopen

BASE = "https://exdsgift.github.io/aseri/api/v1"
f = json.load(urlopen(f"{BASE}/series/hormuz_transits/latest.json"))
q = f["quantiles"]
for day, lo, mid, hi in zip(f["target_end_date"], q["0.1"], q["0.5"], q["0.9"]):
    print(f"{day}: likely {lo:.0f}-{hi:.0f} ships (8 in 10), middle estimate {mid:.0f}")
```

## Why use it

- **Nothing is rewritten.** A dated forecast file is written once. Corrections go to the catalog's `errata`, and the original stays published.
- **Hubverse semantics.** The format of the public-health forecast hubs, so their validation and scoring tools work on it unchanged.
- **Provenance in every file:** the model and its weights revision, the inference package commit, the code commit and run, each input's `as_of` and SHA-256.
- **A track record that counts honestly.** Live forecasts and backtests are scored apart, against a data vintage fixed in advance.

## Files

| Path | What it holds |
|---|---|
| `series.json` | The catalog: each series' unit, horizon, source, licence and attribution; the model; the errata |
| `scores.json` | Every series' track record, as the page shows it |
| `series/{id}/latest.json` | The newest forecast, a copy of its dated file |
| `series/{id}/forecasts.json` | Every forecast issued, oldest first |
| `series/{id}/forecasts/{reference_date}.json` | One forecast, written once, never changed |
| `series/{id}/replay.json` | The last 120 days of forecasts at seven levels |
| `series/{id}/actuals.json` | The observed values of the last 400 days, as known on `as_of` |
| `series/{id}/scores.json` | Live and backtest records apart, with a latest-vintage check |
| `schemas/`, `licenses/`, `model-metadata/` | JSON Schemas (2020-12), licence texts, Hubverse model metadata |

The full archive, every Hubverse round CSV, observation delta and run manifest, lives on the [`archive`](https://github.com/exdsgift/aseri/tree/archive) branch: `model-output/{model_id}/`, `target-data/deltas/`, `runs/`.

## Series

| `id` | Unit | Horizon | Source and terms |
|---|---|---|---|
| `gpr_daily` | index, 1985-2019 average = 100 | 28 days | [Caldara and Iacoviello](https://www.matteoiacoviello.com/gpr.htm), CC BY 4.0 |
| `wiki_ww3_views` | Wikipedia views a day | 14 days | [Wikimedia pageviews](https://pageviews.wmcloud.org/?project=en.wikipedia.org&platform=all-access&agent=user&pages=World_War_III), CC0 |
| `brent_spot` | $ a barrel | 14 trading days | [EIA through FRED](https://fred.stlouisfed.org/series/DCOILBRENTEU), public domain |
| `suez_transits` | ships a day | 28 days | [IMF PortWatch](https://portwatch.imf.org/), IMF terms |
| `hormuz_transits` | ships a day | 14 days | IMF PortWatch, IMF terms |
| `bab_el_mandeb_transits` | ships a day | 14 days | IMF PortWatch, IMF terms |
| `taiwan_strait_transits` | ships a day | 28 days | IMF PortWatch, IMF terms |
| `ua_air_raid_hours` | alert hours a day, all regions | 7 days | [Air raid sirens dataset](https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset), MIT |
| `ua_drones_downed_claimed` | drones a day, claimed by Ukraine's General Staff | 7 days | [Ukraine Russia War Dataset](https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset), MIT |

## Reading a forecast

- `reference_date` is the last observed day. `horizon` counts steps from it, trading days for Brent, and `target_end_date` is the day each step lands on. `forecast_date` is the UTC run date.
- 21 quantile levels, 0.01 to 0.99. Levels 0.1 and 0.9 bound the 8 in 10 range, 0.25 and 0.75 the middle half.
- `forecast_mode` is `live` or `retrospective`. Only live forecasts count in the record.
- `model_id` names the model and its inference settings, now `aseri-timestral209m_c1`. Any change to the published quantiles gets a new ID; older forecasts stay as they were.
- Within v1, fields and files are only added: ignore what you do not know. A missing file is a 404 with an HTML body, so check the status before parsing. The files update once a day, around 07:00 UTC.

## Caveats

- **The live record is new.** A series shows live scores after 30 resolved forecasts; until then, `scores.json` holds backtests, marked `retrospective`.
- **Calibrated ranges.** The 8 in 10 range is calibrated per series on a two-year backtest ([ADR 0001](docs/adr/0001-baselines-and-calibration-before-the-live-record.md)).
- **Backtests may flatter the model.** Timestral's training cutoff is unpublished, and only GPR has real-time vintages.

## The page

![Screenshot: page at 1440 px, 1440x900](branding/screenshots/page-1440.png)

[exdsgift.github.io/aseri](https://exdsgift.github.io/aseri/) draws the same files: the GPR headline, nine signal cards, a replay of 120 days and the record.

## Licence and citation

Forecasts, scores and the API are [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Credit them as "Forecasts: aseri (model aseri-timestral209m_c1, Timestral-209M by Mistral AI)". Upstream terms still apply to the data: each series' `license` in `series.json` gives its attribution, kept verbatim in every dated file. Code: [MIT](LICENSE). © 2026 Gabriele Durante.

Contributing: [CONTRIBUTING.md](CONTRIBUTING.md) · Support: [buy me a coffee](https://buymeacoffee.com/exdsgift) · [GitHub](https://github.com/exdsgift) · [LinkedIn](https://www.linkedin.com/in/gabrieledurante/)
