# Public forecast API for aseri: standards and a static design

Researched 2026-10-29. The question: how should aseri publish its daily Timestral forecasts as a public API, following the standard for this kind of model output? The constraints are static files only, a lean setup, bounded repository growth and honest provenance. Builds on [timestral-model.md](timestral-model.md), [data-sources.md](data-sources.md), [spike-timestral-backtest.md](spike-timestral-backtest.md), [forecast-horizons.md](forecast-horizons.md) and [prior-art-and-gaps.md](prior-art-and-gaps.md).

Each claim cites a source ID from [Sources](#sources). "Observed" means one or more read-only HTTP requests I made on 2026-10-29, listed under [OBS]. "Measured" means a local calculation on real Timestral-209M quantiles from `prototypes/timestral-backtest/data/fc_Timestral-209M.npz`. Anything marked **unverified** is my inference or was not checked. The licensing notes are not legal advice.

## TL;DR

**Standard to follow: the Hubverse model-output format.** It is the long table `task IDs + output_type + output_type_id + value` with `output_type = "quantile"` [HV-MO]. Hubverse generalised the CDC COVID-19 Forecast Hub and FluSight file conventions [C19-OLD][FS], and it is the closest thing to a de facto standard for publishing probabilistic forecasts as data:
- **Adoption:** CDC, ECDC, state health departments and academic hubs use it [HV-HOME].
- **Specification:** JSON Schemas for the hub config [HV-CFG].
- **Tooling:** validation, scoring with WIS and interval coverage [HV-EVAL], dashboards [HV-DASH] and public S3 mirrors [HV-CLOUD][S3].

The other candidates fall short for this job:
- Nixtla, GluonTS, fev and GIFT-Eval define in-memory or benchmark conventions, not exchange formats.
- Data Package, DCAT and schema.org describe a dataset's metadata but say nothing about what a forecast means. They are useful as a wrapper, not as the forecast format.

Key design decisions:

1. **Canonical format is Hubverse model-output.** One run writes these columns: `forecast_date, target, reference_date, horizon, target_end_date, output_type, output_type_id, value`.
   - All 21 Timestral quantile levels are kept.
   - The model ID is `aseri-timestral209m`, following the `team_abbr-model_abbr` naming [HV-MO].
   - `target` is the series ID.
2. **The clock is explicit.** These definitions follow [forecast-horizons.md](forecast-horizons.md) and the Hubverse standard task IDs [HV-TASKS]:
   - `reference_date` is the last observed date, which is the data cutoff.
   - `horizon` counts steps from that date, and `target_end_date` is derived from the two.
   - `forecast_date` is the UTC run date and serves as the round ID.
   - A series is re-forecast only when its cutoff moves.
3. **The archive is append-only and outside `main`.**
   - Each run writes one immutable CSV, plus a small change-log of observations with `as_of` dates, to an orphan `archive` branch. This copies the orphan data branches that Hubverse dashboards use [HV-WF].
   - Nothing generated is ever committed to `main`.
   - The site is deployed as a GitHub Pages artifact [GH-WF].
4. **A static JSON API lives under `/api/v1/`:**
   - Catalog: `series.json`.
   - Per series: `latest.json`, a `forecasts.json` index, dated `forecasts/{reference_date}.json`, `actuals.json` and `scores.json`.
   - Bulk: yearly Parquet and CSV.gz in the collected-hub shape, plus a `datapackage.json` [DP].
   - Contract: `openapi.json` and `schemas/`.
5. **Every file carries provenance and licensing.** That means the model ID and HF revision, the inference package commit, the code commit and workflow run [GH-VAR], the data fetch time and an input hash, `generated_at`, and live versus retrospective status. It also means each series' attribution text, built from the terms in section 3.7.
6. **One contract, checked before every deploy.**
   - JSON Schema 2020-12 files are the single source of truth.
   - OpenAPI 3.1.1 references them, since its Schema Object is a superset of 2020-12 [OAS].
   - CI checks every file against its schema, plus forecast-specific rules (arrays line up, quantiles never decrease), archive immutability and size budgets before deploying.
7. **Versioning:**
   - The major version is in the path. Within v1, changes are additive only and tracked with a semver `schema_version`, as endoflife.date does [EOL].
   - A breaking change ships as `/api/v2/` alongside v1 for at least 6 months. Deprecation notices go in the response body, because GitHub Pages cannot send headers.
   - A change of model or inference settings gets a new `model_id`.
   - Dated forecast files never change.
8. **Track record uses the Hubverse metrics.**
   - Score with WIS, absolute error of the median, and coverage at 50, 80, 90 and 98% [SU-Q][WIS], plus a WIS ratio against a probabilistic seasonal-naive baseline.
   - Break scores down by horizon, count live forecasts only, and score against a declared data vintage.
   - This mirrors the scores the Hubverse PredEvals dashboard publishes [FSD].

**Storage (measured):** one run for 9 series, 176 forecast steps and 21 levels comes to 3,696 rows.

| What | Size |
|---|---|
| Hubverse CSV per day | 235 KB raw, 25 KB gzip |
| Archive branch growth (git stores zlib-compressed blobs) | about 9 MB a year (14 MB at the 270-step maximum) |
| Pages site growth | about 30 MB a year, which reaches the 1 GB site limit after roughly 30 years [GH-LIM] |

## 1. Standards for publishing probabilistic time-series forecasts

### 1.1 Hubverse (the de facto standard)

**Model-output files** [HV-MO]:
- **Layout:** files live at `model-output/<model_id>/<round_id>-<model_id>.csv` (or `.parquet`). `model_id` is `team_abbr-model_abbr`.
- **Round IDs:** a round ID is either an ISO date or alphanumerics joined by underscores. Compression infixes such as `.gz.parquet` are allowed.
- **Columns:** each row is one prediction. The columns are:
  - task-ID columns, which say what is predicted;
  - `output_type` and `output_type_id`, which say how it is represented;
  - `value`.
- **Output types:**
  - `mean` and `median`: `output_type_id` is NA.
  - `quantile`: the ID is a probability level in [0, 1].
  - `cdf`: the ID is a possible value of the outcome.
  - `pmf`: the ID is a category, and probabilities must sum to 1.
  - `sample`: the ID is a sample index. Samples can be joint across task IDs, which the hub declares.
- **Dates:** "the hubverse supports dates only, not datetimes". Dates are ISO 8601 `YYYY-MM-DD`.
- **CSV or Parquet:** hubs may accept CSV, Parquet or both. CSV is human-readable but has hit 100 MB file limits. Parquet is smaller and typed but needs libraries.
- **Stable types:** the Arrow schema must stay the same across the hub's life. `output_type_id_datatype` can pin the type of that mixed column.

**Task configuration (`tasks.json`)** [HV-TASKS]:
- Rounds contain `model_tasks`. Each task has:
  - `task_ids`, each with `required` and `optional` values;
  - `output_type` objects, each with an `output_type_id`, a `value` type and range, and `is_required`;
  - `target_metadata`, with `target_id`, `target_name`, `target_units`, `target_type`, `is_step_ahead` and `time_unit`. The time unit is day, week or month.
- **Round ID:** exactly one task ID defines the round. It is set by `round_id_from_variable` and `round_id`, as in the example hub's `"round_id": "reference_date"` [HV-EX].
- **Standard task IDs:**
  - `origin_date` or `reference_date`.
  - `forecast_date`, "usually defines the date a model is run".
  - `target`, `location`.
  - `target_date` or `target_end_date`.
  - `horizon`, where `target_date = origin_date + horizon * time_units_per_horizon`.
- **Derived task IDs:** since schema v4, they can be declared in `derived_task_ids`.
- **Optional output type IDs are disallowed in schema v4.** Every quantile level is required, because WIS computed on different level sets is not comparable.
- **Config files:** a hub has `admin.json`, `tasks.json` and `model-metadata-schema.json`, plus an optional `target-data.json`. All are validated against JSON Schemas in `hubverse-org/schemas` [HV-CFG].
- **Model metadata:** one YAML file per model, in `model-metadata/team-model.yml`. The template requires `license`, chosen from an enum that includes `CC-BY-4.0` and `CC0-1.0`, and `methods` [HV-MM].

**Target (observed) data** [HV-TD]:
- **Time series:** `time-series.csv` or partitioned Parquet. The columns are the task IDs that identify an observation, plus `observation`. The date column "should share the same name across target data and model outputs".
- **Revisions:** an optional `as_of` column records data revisions, so a past vintage can be rebuilt.
- **Oracle output:** a model-output-shaped table with `oracle_value`, used for scoring.
- **The data-vintage rule:** "the data version used to **generate** forecasts and the data version used to **score** them are two different things". Score against a version "defined *in advance* as the prediction target".

**Scoring** [HV-EVAL][SU-Q][SU-WIS][WIS]:
- `hubEvals::score_model_out()` delegates to `scoringutils`. For quantile forecasts the default metrics are `wis`, `overprediction`, `underprediction`, `dispersion`, `bias`, `interval_coverage_50`, `interval_coverage_90` and `ae_median`.
- Relative skill against a named baseline is available for proper scores only.
- WIS is (1/(K + 1/2)) times the sum of (1/2)·|y − median| and Σₖ (αₖ/2)·ISₐₖ. It approximates CRPS and, with the default weights, equals the mean quantile (pinball) score.
- The FluSight dashboard publishes precomputed scores as CSV files. The columns are `model_id, horizon, wis_scaled_relative_skill, wis, ae_median, interval_coverage_50, interval_coverage_95, n`, and there is one file per breakdown (horizon, location, reference date) [FSD].

**Publishing** [HV-STORE][HV-CLOUD][HV-XFORM][S3][HV-WF]:
- **S3 mirror:** GitHub is the primary store. Cloud-enabled hubs mirror `hub-config`, `model-output`, `target-data` and other folders to a public S3 bucket after each merge, through a Hubverse-run workflow.
- **Format conversion:** an AWS Lambda (`hubverse-transform`) rewrites model-output files to Parquet.
- **Verified:** the `covid19-forecast-hub` bucket lists anonymously over HTTPS and holds `model-output/<model>/<date>-<model>.parquet` keys [S3].
- **Dashboards:** the site is built on `gh-pages`. Its data sits in orphan branches (`ptc/data`, `predevals/data`), "an orphan branch ... does not contain any history related to the `main` branch" [HV-WF]. The page fetches that data from `raw.githubusercontent.com` [FSD].

### 1.2 Where Hubverse came from: COVID-19 Forecast Hub and FluSight

- **US COVID-19 Forecast Hub (2020 to 2024)** [C19-OLD]:
  - Files were named `YYYY-MM-DD-team-model.csv`.
  - The columns were `forecast_date, target, target_end_date, location, type, quantile, value`, where `type` was `point` or `quantile`.
  - Targets were text such as `"1 wk ahead inc death"`.
  - 23 quantile levels were required: `0.01, 0.025, 0.05 ... 0.95, 0.975, 0.99`.
- **FluSight 2026-27** [FS], now in Hubverse form:
  - Files are `YYYY-MM-DD-team-model.csv` or `.parquet`.
  - The columns are `reference_date, target, horizon, target_end_date, location, output_type, output_type_id, value`, with "No additional columns".
  - `reference_date` is the Saturday ending the submission week. `horizon` runs from -1 to 3 weeks, and `target_end_date = reference_date + horizon*7`.
  - The same 23 quantile levels are required, plus `pmf` and `sample` output types.
- **The current CDC COVID-19 hub** keeps this shape and mirrors it to the public S3 bucket `covid19-forecast-hub` [C19-NEW].

Timestral's 21 levels are the FluSight 23 minus 0.025 and 0.975 (measured from the `levels` array). So aseri cannot report a 95% interval, and its WIS is not directly comparable with hubs that score on 23 levels.

### 1.3 Library and benchmark conventions

| Convention | Shape | Use for aseri |
|---|---|---|
| Nixtla statsforecast [NX-SF] | Input is a long data frame with `unique_id`, `ds`, `y`. Output columns are `unique_id, ds, AutoARIMA, AutoARIMA-lo-90, AutoARIMA-hi-90` (wide, one column per interval bound) | Not an exchange format. Optional: the actuals CSV can use `unique_id, ds, y` names for Nixtla users |
| Nixtla TimeGPT [NX-Q] | Quantile columns `TimeGPT-q-10 ... TimeGPT-q-90` | Same remark |
| GluonTS [GL][FEV-DS] | Entries `{"start", "freq", "target", ...}`. `QuantileForecast` keeps `forecast_keys` such as `"0.1"`, `"0.9"`, `"mean"`. `SampleForecast` holds samples | Source of the "quantile level as a string key" idea used in the JSON shape below |
| fev [FEV-DS][FEV-M] | One row per series, with `Sequence(timestamp)`, `Sequence(float)` and an ID. Predictions are a dict: `"predictions"` plus `"0.1"`...`"0.9"` arrays. fev rejects the GluonTS format partly because pandas frequency strings "have changed over time" | The same keyed-array idea. Avoid pandas frequency strings: use ISO 8601 durations |
| GIFT-Eval [GIFT] | GluonTS-style datasets on Hugging Face. Results are `all_results.csv` plus a `config.json` with `model_type`, `testdata_leakage` and `code_link` | Worth copying: an explicit leakage and replication flag in provenance |

### 1.4 Generic data-publishing standards

| Standard | What it gives | Fit |
|---|---|---|
| Frictionless Data Package v2 and Table Schema [DP][TS] | `datapackage.json` with `resources` (required) plus `licenses` (name, path, title), `sources`, `contributors`, semver `version`, RFC 3339 `created`, and `$schema` `https://datapackage.org/profiles/2.0/datapackage.json`. Table Schema adds `fields` with types `date`, `number`, `integer` and `duration` (ISO 8601 `PnYnMnDTnHnMnS`), plus `missingValues`, `primaryKey`, `foreignKeys` and `constraints`. It has no standard `unit` property | **Use it** to describe the bulk files and their licences, so the terms travel with the data |
| CSVW (W3C Recommendation, 17 Dec 2015) [CSVW] | JSON metadata for CSV files (`url`, `tableSchema`, `columns`, `datatype`, `notes`) | Redundant with Data Package. Google support is only "experimental" [SO] |
| JSON-stat 2.0 [JSTAT] | "lightweight JSON format for data dissemination" of cubes (`id`, `size`, `dimension`, `value`, `status`, `updated`) | Poor fit: no quantile or horizon meaning |
| SDMX 3.0 (ISO 17369) [SDMX] | Exchange standard for official statistics, backed by BIS, ECB, Eurostat, ILO, IMF, OECD, UNSD and the World Bank | Too heavy for 9 series |
| DCAT 3 (W3C Recommendation, 22 Aug 2024) [DCAT] | Catalog, Dataset, Distribution and DatasetSeries vocabulary | Optional. Google reads DCAT-equivalent structures [SO] |
| schema.org Dataset [SO] | Required: `name`, `description`. Recommended: `license`, `creator`, `temporalCoverage`, `variableMeasured`, `distribution` (`contentUrl`, `encodingFormat`) | **Use it** as JSON-LD on the human API page, for Google Dataset Search |
| ISO 8601 / RFC 3339 [ISO][RFC3339] | Dates `YYYY-MM-DD`, timestamps `2026-10-29T06:14:02Z`, durations `P1D` | Mandatory everywhere |

**Verdict.** For "a model that issues quantile forecasts that get scored later", Hubverse is the only candidate that specifies all of these:
- the forecast semantics (origin, horizon, target date, output type);
- the observed-data contract (time series, `as_of`, oracle output);
- the scoring (WIS, coverage, relative skill against a baseline);
- the publishing patterns (CSV or Parquet files in a repo, S3 mirrors, static dashboards).

It is also used across institutions [HV-HOME]. Follow it for the archive and bulk files. Add a thin JSON layer for browsers, and a Data Package and schema.org layer for licensing and discovery.

## 2. Static API on GitHub Pages: verified behaviour

### 2.1 Headers and behaviour

| Aspect | Finding | Source |
|---|---|---|
| CORS | `Access-Control-Allow-Origin: *` is sent on 200 and 404 responses, on `*.github.io` and on a custom domain (`reichlab.io`). It is not in GitHub's docs: I found no statement either way | [OBS] |
| Preflight | `OPTIONS` returns **405 Method Not Allowed**, so only "simple" requests work: no custom headers. A single range `Range: bytes=N-M` is CORS-safelisted. Suffix ranges (`bytes=-500`) are not, so they trigger a preflight that fails | [OBS][FETCH] |
| Caching | `Cache-Control: max-age=600` plus `Expires`, `ETag` (weak `W/` when gzipped) and `Last-Modified`. `If-None-Match` returns **304**. Responses come through Varnish (`Via: 1.1 varnish`). GitHub documents no way to set custom headers (**unverified** that none exists) | [OBS] |
| Compression | gzip when the client sends `Accept-Encoding`, **including for `.parquet`**. Brotli was not returned when offered | [OBS] |
| Content types | `.json` is served as `application/json; charset=utf-8` and `.csv` as `text/csv; charset=utf-8`. `.parquet` is served as **`application/octet-stream`**, although mime-db now maps it to `application/vnd.apache.parquet`. GitHub's archived docs say Pages types come from mime-db, so Pages' copy lags behind it | [OBS][MIMEDB][GH-MIME] |
| Range | `Accept-Ranges: bytes`, and 206 works. With gzip, `Content-Range` counts **gzipped** bytes (`0-99/1130` against `0-99/2388` uncompressed), which can confuse remote Parquet readers (**unverified** per client) | [OBS] |
| Limits | Published site 1 GB. Source repository 1 GB recommended. Soft limit of 100 GB bandwidth a month. Soft limit of 10 builds an hour, which "does not apply if you build and publish ... with a custom GitHub Actions workflow". Deploys time out at 10 minutes. Rate limits answer with 429. Not to be used as a "free web-hosting service to run your online business" or for "commercial software as a service" | [GH-LIM] |
| Artifact deploy | `upload-pages-artifact` takes a gzip tar under 10 GB. Workflows suit owners who "do not want a dedicated branch to hold your compiled static files" | [GH-WF][GH-SRC] |
| 404 | A custom `404.html` or `404.md` in the publishing source. Observed: status 404, `text/html` body. A JSON 404 body is impossible | [GH-404][OBS] |
| Redirects | No server-side redirect configuration. `jekyll-redirect-from` (v0.16.0 in `versions.json`) writes HTML meta-refresh pages, which API clients do not follow. Observed 301s: `http` to `https`, and a directory path without a trailing slash to the path with one | [GH-JEK][JRF][OBS] |
| Jekyll | When building from a branch, Jekyll skips files that start with `_`, `.` or `#` | [GH-JEK] |

### 2.2 Neighbouring hosts (observed)

- **`raw.githubusercontent.com`** sends `Access-Control-Allow-Origin: *`, `Cache-Control: max-age=300` and a strong `ETag`. It serves JSON and CSV as `text/plain; charset=utf-8` with `nosniff`. That is fine for `fetch().json()`, but it is not documented as an API host [OBS].
- **GitHub Release assets** answer `github.com/.../releases/download/...` with a 302 to `release-assets.githubusercontent.com`. **Neither response carries a CORS header**, so a browser page cannot fetch them; curl and pandas can [OBS]. Limits are under 2 GiB per file and 1,000 assets per release, with "no limit on the total size of a release, nor bandwidth usage" [GH-REL].
- **Git limits:** warning at 50 MiB, hard block at 100 MiB. Repositories should stay "ideally less than 1 GB, and less than 5 GB is strongly recommended" [GH-LF].

### 2.3 Real static APIs and what works

1. **endoflife.date** (static, on Netlify) [EOL]:
   - `/api/v1/...` JSON is generated at build time by a Jekyll plugin (`_plugins/generate-api-v1.rb`), and v0 is still served by its own plugin.
   - The envelope is `{"schema_version":"1.2.1","generated_at":...,"last_modified":...,"result":...}`. A root `/api/v1/` lists the endpoints with links.
   - It publishes an OpenAPI 3.1.1 file (`/docs/api/v1/openapi.yml`), an API changelog, and a written backward-compatibility rule: stay on `/api/v1`, follow 301s, and "allow for new fields" and new enum values.
   - **Copy:** the envelope, path major version, semver in the body, OpenAPI and changelog. **Cannot copy:** the 301s, because Pages has no redirects.
2. **fawazahmed0/exchange-api** (npm on jsDelivr, plus Cloudflare Pages) [FX]:
   - URLs are `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{date}/v1/{endpoint}.json`, with a fallback at `https://{date}.currency-api.pages.dev/v1/...` and `.min.json` variants.
   - Each day is a **package version**, so dated snapshots live outside git.
   - The previous GitHub-hosted repository was removed: "I got email from GitHub to remove [currency-api repository] ... due to large size". The move to npm and Cloudflare broke every client URL.
   - **Lesson:** daily snapshots committed to git do not scale. Put the version and date in the URL from day one.
3. **Hubverse FluSight dashboard** (`reichlab.io/flusight-dashboard`, GitHub Pages) [FSD][HV-PTC]:
   - The page loads `predtimechart.js`, which fetches `https://raw.githubusercontent.com/reichlab/flusight-dashboard/refs/heads/ptc/data/...`. That is one JSON file per (target, location, date): `{"model": {"target_end_date": [...], "q0.025": [...], ...}}`.
   - Scores sit on `predevals/data` as CSV files per evaluation set and breakdown.
   - **Lesson:** orphan data branches keep `main` small, and precomputed per-breakdown score files are enough for a scoreboard. Quantile keys as JSON arrays work well for charts.
4. **pomber/covid19** (GitHub Pages) serves one unversioned 2 MB `timeseries.json` with CORS and gzip [OBS][POM]. It is simple and widely used, but every client downloads everything and nothing can change without breaking clients.

## 3. Recommended design for aseri

### 3.1 Identifiers and the clock

| Name | Meaning | Example |
|---|---|---|
| `series_id` (JSON) = `target` (Hubverse) | Stable snake_case ID, never reused | `suez_transits` |
| `model_id` | `team_abbr-model_abbr` [HV-MO]. New ID if the weights, revision or inference settings change | `aseri-timestral209m` |
| `forecast_date` | UTC calendar date of the run. Round ID. One archive file per run day | `2026-10-29` |
| `reference_date` | Last observed date in the input, the data cutoff. Forecast origin | `2026-10-25` (PortWatch lags about 4 days) |
| `horizon` | Steps after `reference_date`, from 1 to `horizon_max` (7, 14 or 30) | `1` |
| `target_end_date` | `reference_date + horizon` days. For Brent, the horizon-th Monday-to-Friday date (see 4.3) | `2026-10-26` |
| `output_type`, `output_type_id` | Always `quantile`, with the levels `0.01, 0.05, 0.1, 0.15 ... 0.9, 0.95, 0.99` (21). The point forecast is the 0.5 quantile. No separate `median` rows, to avoid duplication | `quantile`, `0.5` |
| `forecast_mode` | `live`, or `retrospective` for backfills. Never mixed in the headline record | `live` |

**Rules:**
- A series gets a new forecast only when its `reference_date` moves forward.
- `(model_id, series_id, reference_date)` identifies a forecast. It is written once and never edited.
- Corrections go into an `errata` list in `series.json`. The original forecast stays published and scored.

### 3.2 URL layout and endpoints

The base is `https://<owner>.github.io/aseri/api/v1/`. Every URL ends in a file name, because Pages serves `index.html` for directories and cannot redirect. The full tree is in [Appendix A](#appendix-a-url-layout).

| Path | Purpose | Changes |
|---|---|---|
| `series.json` | Catalog. Per series: title, unit, `target_type`, horizon, day definition, source, licence and attribution text, cadence (ISO 8601 duration), last observation date, latest reference and forecast dates, the day-to-day tie (`day_to_day_tie`, below), links. Also global model info, quantile levels, `generated_at` and `errata` | Daily |
| `series/{series_id}/latest.json` | Latest forecast. A copy of the newest dated file, with `links.canonical` pointing to that file | Daily |
| `series/{series_id}/forecasts.json` | Index of every issued forecast: `reference_date`, `forecast_date`, mode, URL. Needed because static hosts cannot list directories | Daily, grows about 100 bytes per forecast |
| `series/{series_id}/forecasts/{reference_date}.json` | One forecast | **Never** |
| `series/{series_id}/replay.json` | The forecasts of the 120 days to the latest, for the page's replay slider, as the page writes them (whole numbers from 10 up, one decimal below) and at seven levels: 0.05, 0.1, 0.25, 0.5, 0.75, 0.9 and 0.95, the page's ranges and most likely value and the 5% and 95% a possible path reaches before the chart's frame. About 33 KB gzipped for GPR. The dated files keep all 21 levels to four decimals | Daily |
| `series/{series_id}/actuals.json` | Latest vintage of the observed series (`date[]`, `observation[]`, flags) with `as_of` | Daily |
| `series/{series_id}/scores.json` | Track record for one series, live and retrospective forecasts apart, never combined. Per horizon bucket (1-7, 8-28): 50% and 80% coverage with an exact CI, WIS and its components, the median's absolute error and its ratio to each baseline with a block-bootstrap CI and a verdict, and MASE. Also `n`, `min_n_to_display`, the primary baseline, the weekly forecasts of the record's squares, the method (WIS convention, L, block length, resamples, seed) and the latest-vintage sensitivity check (see 4.4) | Daily |
| `scores.json` | Cross-series summary for the site's record: each series' file without its sensitivity check | Daily |
| `bulk/forecasts-{YYYY}.parquet`, `bulk/forecasts-{YYYY}.csv.gz` | Every forecast of a year in collected-hub shape: `model_id` plus the Hubverse columns. The current year is rebuilt daily; past years are frozen | Current year daily |
| `bulk/time-series.parquet`, `bulk/time-series-{source}.csv` | Hubverse time series with columns `target, target_end_date, observation, as_of`, stored as a change-log (see 3.3). The CSVs are split by upstream source so each carries one licence | Daily |
| `bulk/oracle-output.csv` | `target, target_end_date, oracle_value` used for scoring [HV-TD] | Daily |
| `bulk/scores.parquet` | One row per (model, series, reference date, horizon) with each metric and the `observation_as_of` used | Daily |
| `bulk/datapackage.json` | Frictionless descriptor for all bulk files, with `licenses` and `sources` per resource [DP] | Daily |
| `openapi.json`, `schemas/*.schema.json` | Contract | Per release |
| `licenses/*.txt` | Full texts that must travel with the data: the two MIT notices, CC BY 4.0 and the IMF terms link | Rarely |

The HTML page at `/api/` holds the human docs and a schema.org `Dataset` JSON-LD block [SO].

**The day-to-day tie** (additive to v1, #147). Each catalog entry's `day_to_day_tie` says how the real days moved together within a forecast; the page draws its possible paths with it:
- `rho`: the lag-1 correlation, across consecutive horizons of the same forecast, of the normal scores of where each real day fell. Where a day fell is its PIT, read off the 21 archived quantiles by straight lines and clipped to [0.005, 0.995]; a value on tied quantiles takes the middle of their levels. Over the resolved forecasts of the 120 days to the latest, scored against the first vintage that resolved each day. Rounded to 2 decimals, and 0 below 100 pairs.
- `n`: its number of pairs.

### 3.3 Shapes, the bulk format, and where they deviate from Hubverse

The JSON files use a wide layout:
- the dates as one array;
- an object of arrays keyed by quantile level.

This is the PredTimeChart pattern [HV-PTC], with GluonTS/fev-style string keys `"0.1"` [GL][FEV-M]. Arrays are index-aligned with `horizon[]` and `target_end_date[]`. Every file carries `schema_version`, `generated_at` and `links`, as endoflife.date does [EOL]. Examples are in [Appendix B](#appendix-b-example-files).

**Archive and bulk files are plain Hubverse model-output:**

```csv
forecast_date,target,reference_date,horizon,target_end_date,output_type,output_type_id,value
2026-10-29,suez_transits,2026-10-25,1,2026-10-26,quantile,0.01,30.6158
2026-10-29,suez_transits,2026-10-25,1,2026-10-26,quantile,0.05,34.0127
```

The yearly bulk files add a leading `model_id` column, which is the shape `collect_hub()` produces [HV-MO].

**Deviations from Hubverse, and why:**
1. **Wide JSON for the web layer.** Long rows repeat every ID and date 21 times. The bulk and archive files stay long.
2. **The round is the run date, and each target has its own `reference_date`.** The sources have different lags (PortWatch about 4 days, GPR weekly). A round per reference date would mean rewriting the same file across several runs, which breaks immutability. `forecast_date` is a standard Hubverse task ID [HV-TASKS]. Whether hubverse validators accept daily rounds without a pre-generated `tasks.json` that lists every date is **unverified**. If full hub compatibility is wanted later, generate `tasks.json` once a year with every date of the year as `optional`.
3. **Observation vintages are stored as a change-log.** Each row records the first `as_of` date on which a `(target, date, value)` was seen. The vintage at date D is, for each (target, date), the row with the latest `as_of` ≤ D. Hubverse's partitioned examples hold one partition per `as_of` [HV-TD]. Whether hubverse tools reconstruct vintages from a change-log is **unverified**. Full daily snapshots would grow by GPR's 15,000 rows a day.
4. **Brent's horizon counts trading days.** Hubverse's `time_unit` is only day, week or month [HV-TASKS]. The catalog says `"horizon_unit": "trading_day"`.
5. **21 levels, not FluSight's 23** (see 1.2). No 95% interval is reported or interpolated.
6. **No extra provenance columns in the model-output files.** FluSight allows "No additional columns" [FS]. Provenance lives in the JSON files, the run manifest and model metadata. A model change becomes a new `model_id`, so track records never mix.
7. **Baselines are not archived.** Seasonal-naive and naive forecasts are recomputed when scoring, from the archived vintages. They are deterministic, their code version is recorded in `scores.json`, and the baseline definitions are fixed in the changelog.

### 3.4 Provenance

Each forecast file and the per-run manifest on the archive branch carry this block:

```json
"provenance": {
  "model": {"id": "mistralai/Timestral-209M", "revision": "9874d252ab0aae16f7f7c999f98f98d6ad7d8365",
            "url": "https://huggingface.co/mistralai/Timestral-209M"},
  "inference": {"package": "timestral", "package_commit": "a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff",
                "torch": "2.15.0+cpu", "python": "3.12",
                "settings": {"symmetric_averaging": true, "clip_nonnegative": true, "covariates": []},
                "context_length": 2855},
  "code": {"repository": "https://github.com/<owner>/aseri", "commit": "<GITHUB_SHA>",
           "workflow_run": "https://github.com/<owner>/aseri/actions/runs/<GITHUB_RUN_ID>/attempts/<GITHUB_RUN_ATTEMPT>"},
  "data": {"source_url": "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query",
           "fetched_at": "2026-10-29T06:02:11Z", "last_observation_date": "2026-10-25",
           "input_sha256": "<sha256 of the exact context values as CSV>"},
  "generated_at": "2026-10-29T06:12:31Z",
  "forecast_mode": "live",
  "leakage_note": "Timestral's training-data cutoff is not published; backtests may be optimistic."
}
```

- The `GITHUB_*` values are default Actions variables [GH-VAR]. The model and package values come from [timestral-model.md](timestral-model.md) and the spike.
- `leakage_note` mirrors GIFT-Eval's `testdata_leakage` field [GIFT].
- **Optional, stronger evidence of issue time:** run `actions/attest-build-provenance` on each daily round file. For public repositories, attestations go to the Sigstore public-good instance and a public transparency log. They bind the file to the workflow, commit and trigger [GH-ATT], and `gh attestation verify` checks them. That the log entry also proves *when* the file existed is my inference (**unverified**).

### 3.5 Contract, versioning and validation

**Schemas:**
- Write one JSON Schema (Draft 2020-12) per file type, in `api/schemas/` on `main`: catalog, forecast, forecast-index, actuals, scores, plus a shared `defs` for date, provenance and licence. Each schema's `$id` is its public URL.
- `openapi.json` (OpenAPI 3.1.1, `jsonSchemaDialect` 2020-12) references these schemas by relative `$ref`. The 3.1 Schema Object is a superset of 2020-12, so one set of files serves both [OAS]. A skeleton is in [Appendix C](#appendix-c-openapi-skeleton).
- OpenAPI 3.2.0 exists (19 Sept 2025) [OAS32]. Stay on 3.1.1 as asked, because tool support is wider.
- Published schemas allow additional properties, so additive changes do not break clients that validate. CI also runs a strict check that every emitted key is declared.

**Versioning and deprecation:**
- **Within `/api/v1/`, additive changes only:** new fields, new series, new endpoints, new enum values. Each bumps the minor `schema_version` and gets a `CHANGELOG_API.md` entry, following endoflife.date's published policy [EOL]. Clients must ignore unknown fields.
- **A breaking change is published as `/api/v2/` next to v1.** v1 keeps being generated for at least 6 months. Every v1 body gains `"deprecation": {"deprecated_at": "...", "sunset_at": "...", "successor": ".../api/v2/..."}`, and v1 operations get `deprecated: true` in OpenAPI [OAS].
- Pages cannot send RFC 9745 `Deprecation` or RFC 8594 `Sunset` headers [RFC9745][RFC8594][OBS], so the notice has to live in the body.
- **After sunset, v1 files are frozen, not deleted.**
- **A discontinued series** stays in the catalog with `"status": "discontinued"`.
- **A new model or new inference settings** get a new `model_id`. **A new quantile set or horizon** gets a new `schema_version` major.

**CI before deploy** (Python `jsonschema` [TOOLS] and `openapi-spec-validator` [TOOLS], which supports 3.1, plus plain asserts):
1. Every generated JSON file validates against its schema. `openapi.json` is valid. Every file path matches an OpenAPI path template, and every template has at least one file.
2. Rules the schema cannot express:
   - array lengths match;
   - exactly the 21 levels;
   - finite numbers, `null` for missing values (`NaN` is not valid JSON);
   - values non-decreasing across levels;
   - values ≥ 0 when the catalog says non-negative;
   - `reference_date` ≤ `forecast_date`;
   - `target_end_date` matches the horizon rule;
   - `latest.json` equals the newest dated file.
3. **Immutability:** the archive commit only adds files (`git diff --name-status` shows `A` only), and today's round did not exist before.
4. **Budgets:** round file under 1 MB, site artifact under 500 MB, archive branch pack under 300 MB.
5. **Smoke test after deploy:** check that `latest.json` returns 200 with `application/json`, `Access-Control-Allow-Origin: *`, and a `generated_at` less than 36 hours old.
6. **Optional:** an R job that runs `hubValidations` on the round CSV [HV-MO], and `frictionless validate` on the CSV resources.

### 3.6 Storage growth and keeping the repository small

**Measured on 2026-10-29** with real Timestral-209M quantiles from the backtest arrays:
- 9 series with horizons 30, 14, 14, 30, 14, 30, 30, 7, 7, which is 176 steps.
- 21 levels, giving 3,696 rows per run.
- Values rounded to 6 significant digits. The 4-digit figures are in brackets.

| Artefact | Per run day | Per year |
|---|---|---|
| Hubverse CSV (archive round) | 235 KB raw (228), **25 KB gzip** (19) | 86 MB raw, about 9 MB as git blobs |
| Hubverse Parquet, zstd, one file per day | 29 KB (19) | about 10 MB |
| One year in one Parquet file (zstd) | | **6.9 MB** (2.5 MB at 4 digits) |
| One year as CSV.gz | | **9.7 MB** |
| Wide JSON, all series, 21 levels | 34 KB raw, 13 KB gzip | about 12 MB on the site |
| Wide JSON, all series, 5 levels | 10 KB raw, 3 KB gzip | |

Caveats:
- The one-year rows reuse the same real quantiles with shifted dates, so real compression may differ (**estimate**).
- Git stores zlib-compressed objects and delta-compresses packs. That puts archive growth at about 25 KB a day or less: **about 9 MB a year**, and 14 MB at the 9 × 30 = 270-step maximum.
- Actual volume is lower, because weekly-updated series are re-forecast only when their cutoff moves.
- The observation change-log adds a few KB a day (**estimate**).
- Ten years of archive: about 100 to 140 MB, well under the 1 GB recommendation [GH-LF].

**Site:** about 12 MB a year of dated JSON, plus 7 MB of Parquet, 10 MB of CSV.gz and a few MB of files that are rewritten rather than accumulated. That is **about 30 MB a year**, against the 1 GB site limit [GH-LIM]. If it is ever needed, drop dated JSON for closed years from the site and keep only the yearly bulk files.

**Rules that prevent another 2.2 GB repository:**
1. **`main` holds code, schemas and docs only.** The site is never committed; it is a Pages artifact built each run [GH-WF][GH-SRC].
2. **The `archive` orphan branch is append-only.** Each run adds one round CSV, one observation-delta CSV and one manifest JSON. No file is ever rewritten. CI enforces this (3.5 #3). The build checks it out with `fetch-depth: 1`.
3. **Never commit upstream raw downloads.** For example, the 9.2 MB sirens CSV, rewritten daily, would add gigabytes a year as git history. Re-download them, or use `actions/cache`.
4. **Files that change daily** (`latest`, catalog, scores, current-year bulk) exist only in the Pages artifact.
5. **Optional cold copy:** at year end, attach the frozen `forecasts-{YYYY}` files to a GitHub Release (under 2 GiB per file, no total limit) [GH-REL]. Not for browser clients, since releases have no CORS [OBS].
6. **Size alarm:** CI runs `git count-objects -vH` on the archive branch and fails above the budget.

### 3.7 Licensing and attribution that must travel with the data

Each catalog entry carries a `license` object:
- `name` and `url`;
- `attribution`, a ready-to-paste string;
- `modifications`, saying what aseri changed (CC BY and the IMF terms require this);
- `commercial_use`.

Every per-series file repeats `attribution`, and `bulk/datapackage.json` carries the same information as `licenses` and `sources` per resource [DP]. Splitting the bulk actuals by source lets each resource have exactly one licence.

| Series | Upstream terms | What must travel | Commercial reuse |
|---|---|---|---|
| `gpr_daily` | "open access under the Creative Commons BY license" (version not stated) [GPR] | Credit Caldara and Iacoviello. Citation: Caldara, D. and M. Iacoviello (2022), "Measuring Geopolitical Risk", *AER* 112(4), 1194-1225. Link to the source page and the licence, give the download date (requested by the authors), and say that forecasts are derived and recent values preliminary [GPR][CCBY] | Allowed under CC BY |
| `wiki_ww3_views` | Pageviews data "available under the CC0 1.0 license" [WMF] | Nothing required. Courtesy credit: "Wikimedia Foundation, Analytics API (pageviews)" | Allowed |
| `brent_spot` | EIA: "U.S. government publications are in the public domain". EIA lists Refinitiv (LSEG) as the price source [EIA]. Retrieved through FRED `DCOILBRENTEU` [FRED] | Requested citation: "Source: U.S. Energy Information Administration (Oct 29, 2026)". Name FRED as the retrieval route and flag the Refinitiv origin | Likely fine. Third-party origin noted (**unverified**) |
| `suez_transits`, `hormuz_transits`, `bab_el_mandeb_transits`, `taiwan_strait_transits` | IMF terms: may "download, extract, copy, create derivative works, publish, distribute"; must attribute the IMF; "If material transformation occurs, it must be stated explicitly"; "For any potential commercial reuse of IMF Data, email copyright@imf.org" [IMF] | "Sources: UN Global Platform; IMF PortWatch (portwatch.imf.org)" [data-sources.md], plus an explicit transformation note: "aseri forecasts are model output derived from IMF PortWatch daily transit counts; they are not IMF data" | **Needs IMF permission.** `commercial_use: "permission required (copyright@imf.org)"`. Whether this extends to derived forecasts is **unverified** (conservative reading) |
| `ua_air_raid_hours` | Repository under MIT, "Copyright (c) 2022 Vadym Klymenko" [MIT-S]. The underlying records come from official alert channels and a volunteer channel with no stated licence [data-sources.md] | The copyright line, plus the MIT permission notice (full text in `licenses/`). Whether daily aggregates are a "substantial portion" is unclear, so include it anyway | MIT allows it. Residual upstream risk |
| `ua_drones_downed_claimed` | MIT, "Copyright (c) 2022 Petro Ivaniuk" [MIT-L] | Same MIT notice, plus the label "claims by the General Staff of the Armed Forces of Ukraine, not independently verified" | MIT allows it |
| aseri forecasts and scores | Owner's choice. Suggest **CC BY 4.0** for aseri's own contribution, an option the Hubverse metadata enum includes [HV-MM] | "Forecasts: aseri (model aseri-timestral209m, Timestral-209M by Mistral AI)". State that upstream terms still apply to underlying data, and that PortWatch-derived series carry the IMF condition | As above, per series |

## 4. Pitfalls

### 4.1 Time zones and day boundaries

- All `generated_at` and `fetched_at` values are RFC 3339 UTC with a `Z` suffix [RFC3339]. The cron also runs in UTC, and runs "can be delayed during periods of high loads" [GH-SCHED].
- Hubverse dates carry no time zone [HV-TASKS], so each series must declare what its "day" means in a `day_definition` catalog field:
  - Wikipedia days are presumably UTC (**unverified**).
  - Air-raid alerts should be cut by the Europe/Kyiv calendar day (the time zone of the dataset's timestamps is **unverified**).
  - Drone claims are dated by report day.
  - Brent uses trading days.

### 4.2 Data lag versus run date

- `horizon` counts from `reference_date`, not from the run day. For PortWatch, horizon 1 is already four days in the past when published [spike-timestral-backtest.md].
- Show both dates on the site, and never call a forecast "for tomorrow" unless `target_end_date` really is tomorrow.

### 4.3 Calendars

- Brent has no weekend values, and holidays are not known in advance. Map horizon to target date with a Monday-to-Friday calendar.
- If a target date turns out to be a holiday, score that forecast step against the next observation by step index, and flag it.
- Timestral has no frequency input, so its steps are observation steps [timestral-model.md].

### 4.4 Revised data

- GPR's latest values are preliminary and revised [GPR], and older vintages are available on the GPR page.
- Store the change-log, and score against a vintage declared in advance. **Corrected (#134):** not the latest vintage, which would restate the record whenever a source revises. Each target is scored once, `L` days after its `target_end_date`, against its value as known that day: L is 35 days for GPR, 14 for PortWatch and 7 for the rest (`score_lag` in the series registry, `score_lag_days` in each score file). A target its source had not published by then is scored against the first value seen after. The change-log is append-only, so a score never changes: it is recomputed on every run, identically, and no score file is archived.
- Each score file states the vintages it scored against (`observation_as_of`, the oldest and the newest). The per-row `observation_as_of` comes with `bulk/scores.parquet` (#136).
- The same targets scored against the latest vintage are published as a sensitivity check only (`latest_vintage` in `series/{series_id}/scores.json`). It matters for GPR.
- Do not silently re-forecast when only history is revised. A forecast is one per `(series, reference_date)`, issued once.

### 4.5 Missing days and upstream failures

- PortWatch returns errors inside HTTP 200 bodies [spike-timestral-backtest.md].
- A truncated download must never produce a forecast. Keep the last good forecast, and let `generated_at` show staleness.
- AIS dropouts (Taiwan Strait: 24 transits, then 324 the next day) need a `flags` entry in `actuals.json`, and the forecast should carry a `quality_flags` field.

### 4.6 Quantile crossing and ties

- Timestral's quantile head is non-crossing by design [timestral-model.md]. Measured: 0 crossings across 4 series × 52 origins × 90 steps.
- On Hormuz, `clip_nonnegative` produced **5,356 exact ties at 0**, and rounding adds more. So validate "non-decreasing", not "strictly increasing".
- Intervals such as [q0.1, q0.9] can have zero width at the lower end, which matters for coverage on counts near zero.

### 4.7 Rounding

- Publish 6 significant digits; float32 carries about 7. Never round counts to integers: FluSight requires integers [FS], but at 2 to 5 transits a day that destroys the distribution.
- **Score the published values, not the unrounded ones.**

### 4.8 Cache staleness

- Pages caches for 10 minutes and raw.githubusercontent.com for 5 minutes [OBS]. Right after a deploy, `series.json` and `latest.json` can briefly disagree, so both carry `forecast_date` for clients to compare.
- Dated files never change, but Pages cannot mark them `immutable`. Clients should rely on `ETag` and 304 responses.
- Document that clients should poll at most once an hour.

### 4.9 Browser access limits

- No custom request headers, because a preflight gets 405.
- No suffix ranges.
- Parquet is gzipped in transit, so ranges count compressed bytes.
- Release assets have no CORS.
- The 404 body is HTML, so clients must check the status code before parsing [OBS][FETCH].
- Treat bulk Parquet as download-only. If in-browser range reads (DuckDB-wasm and similar) are ever needed, mirror the bulk files to object storage with correct types (**unverified** per client).

### 4.10 Breaking changes

- Renaming a `series_id`, changing a horizon, changing the quantile set or swapping the model all break the track record.
- Use a new `series_id`, a new `model_id` or a new major version instead. Never mutate archived files.
- The exchange-api migration shows how costly an unplanned URL change is [FX].

### 4.11 Honesty of the track record

- Keep backfilled (retrospective) forecasts out of the live record, as forecast-duel does with its warm-up [forecast-horizons.md].
- Show a score only after enough live forecasts have resolved [prior-art-and-gaps.md].
- Report `n` next to every number.
- Timestral's training cutoff is unknown, so backtests may be inflated [spike-timestral-backtest.md].
- Name the comparison "WIS ratio vs seasonal naive" rather than "relative skill", because scoringutils' relative skill is a different, pairwise quantity [HV-EVAL].
- A point baseline scored with WIS reduces to its absolute error. Use a probabilistic baseline, or label the comparison plainly.

### 4.12 Scheduled workflows and silent stops

- In public repositories, scheduled workflows are disabled after 60 days without repository activity [GH-SCHED]. Whether bot commits to an orphan branch count as activity is **unverified**.
- An external freshness check on `latest.json` catches this.

### 4.13 Article renames

- The pageviews series follows one article title. A rename or merge of "World War III" would split the views across titles. Record the resolved title and redirects in the catalog [data-sources.md].

## Appendix A: URL layout

```text
https://<owner>.github.io/aseri/
├── api/
│   ├── index.html                      human docs + schema.org Dataset JSON-LD
│   └── v1/
│       ├── series.json                 catalog + global model info + errata
│       ├── scores.json                 cross-series scoreboard
│       ├── openapi.json
│       ├── schemas/{catalog,forecast,forecast-index,actuals,scores,defs}.schema.json
│       ├── licenses/{MIT-Klymenko,MIT-Ivaniuk,CC-BY-4.0}.txt
│       ├── series/{series_id}/
│       │   ├── latest.json
│       │   ├── forecasts.json          index of issued forecasts
│       │   ├── forecasts/{reference_date}.json   immutable
│       │   ├── replay.json             the last 120 days at seven levels
│       │   ├── actuals.json
│       │   └── scores.json
│       └── bulk/
│           ├── datapackage.json
│           ├── forecasts-{YYYY}.parquet | forecasts-{YYYY}.csv.gz
│           ├── time-series.parquet | time-series-{source}.csv
│           ├── oracle-output.csv
│           └── scores.parquet
└── 404.html

archive branch (orphan, append-only, never deployed as-is)
├── README.md                           licences + how to read
├── model-output/aseri-timestral209m/{forecast_date}-aseri-timestral209m.csv
├── target-data/deltas/{forecast_date}.csv      target,target_end_date,observation,as_of
├── runs/{forecast_date}.json           manifest: provenance, input hashes, file sha256s
└── model-metadata/aseri-timestral209m.yml      Hubverse model metadata
```

## Appendix B: Example files

Arrays and level sets are abridged. Real files carry all 21 levels and the full horizon.

`series.json`, one entry shown:

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2026-10-29T06:14:02Z",
  "model": {"model_id": "aseri-timestral209m", "hf_id": "mistralai/Timestral-209M",
            "revision": "9874d252ab0aae16f7f7c999f98f98d6ad7d8365"},
  "quantile_levels": [0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5,
                      0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99],
  "point_forecast": "quantile 0.5",
  "series": [
    {
      "series_id": "suez_transits",
      "title": "Daily ship transits through the Suez Canal",
      "unit": "transits per day",
      "target_type": "discrete",
      "non_negative": true,
      "horizon_unit": "day",
      "horizon_max": 30,
      "day_definition": "PortWatch daily rows (one transit per ship per 48 h)",
      "source_cadence": "P1D (upstream about 4 days behind)",
      "last_observation_date": "2026-10-25",
      "latest_reference_date": "2026-10-25",
      "latest_forecast_date": "2026-10-29",
      "day_to_day_tie": {"rho": -0.26, "n": 2862},
      "status": "active",
      "source": {"title": "IMF PortWatch, Daily Chokepoints Data",
                 "url": "https://portwatch.imf.org/",
                 "field": "n_total", "filter": "portname = 'Suez Canal'"},
      "license": {
        "name": "IMF Copyright and Usage",
        "url": "https://www.imf.org/en/About/copyright-and-terms",
        "attribution": "Sources: UN Global Platform; IMF PortWatch (portwatch.imf.org).",
        "modifications": "aseri forecasts are model output derived from IMF PortWatch daily transit counts; they are not IMF data.",
        "commercial_use": "permission required from the IMF (copyright@imf.org)"
      },
      "links": {"latest": "series/suez_transits/latest.json",
                "forecasts": "series/suez_transits/forecasts.json",
                "actuals": "series/suez_transits/actuals.json",
                "scores": "series/suez_transits/scores.json"}
    }
  ],
  "errata": []
}
```

`series/suez_transits/forecasts/2026-10-25.json` (and `latest.json`), with 3 of 30 horizons and 7 of 21 levels:

```json
{
  "schema_version": "1.0.0",
  "series_id": "suez_transits",
  "model_id": "aseri-timestral209m",
  "forecast_date": "2026-10-29",
  "reference_date": "2026-10-25",
  "forecast_mode": "live",
  "unit": "transits per day",
  "horizon_unit": "day",
  "horizon": [1, 2, 3],
  "target_end_date": ["2026-10-26", "2026-10-27", "2026-10-28"],
  "quantiles": {
    "0.01": [30.6158, 29.8841, 29.1027],
    "0.1":  [37.2410, 36.7302, 36.1855],
    "0.25": [41.0396, 40.7718, 40.4120],
    "0.5":  [45.1283, 45.0117, 44.8732],
    "0.75": [49.2652, 49.3920, 49.4401],
    "0.9":  [53.1840, 53.5512, 53.8873],
    "0.99": [60.0021, 60.8934, 61.6650]
  },
  "quality_flags": [],
  "attribution": "Sources: UN Global Platform; IMF PortWatch (portwatch.imf.org). Forecast: aseri (aseri-timestral209m, Timestral-209M by Mistral AI).",
  "provenance": {"...": "see section 3.4"},
  "links": {"canonical": "https://<owner>.github.io/aseri/api/v1/series/suez_transits/forecasts/2026-10-25.json",
            "schema": "https://<owner>.github.io/aseri/api/v1/schemas/forecast.schema.json",
            "catalog": "../../../series.json"},
  "generated_at": "2026-10-29T06:12:31Z"
}
```

`series/suez_transits/forecasts.json`:

```json
{
  "schema_version": "1.0.0",
  "series_id": "suez_transits",
  "generated_at": "2026-10-29T06:14:02Z",
  "forecasts": [
    {"reference_date": "2026-10-25", "forecast_date": "2026-10-29", "model_id": "aseri-timestral209m",
     "forecast_mode": "live", "url": "forecasts/2026-10-25.json"}
  ]
}
```

`series/suez_transits/actuals.json`:

```json
{
  "schema_version": "1.0.0",
  "series_id": "suez_transits",
  "unit": "transits per day",
  "as_of": "2026-10-29",
  "last_observation_date": "2026-10-25",
  "date": ["2026-10-23", "2026-10-24", "2026-10-25"],
  "observation": [44, 47, 46],
  "flags": {},
  "attribution": "Sources: UN Global Platform; IMF PortWatch (portwatch.imf.org).",
  "generated_at": "2026-10-29T06:14:02Z"
}
```

`series/suez_transits/scores.json`, abridged (#134). The numbers are from a local run on the 120-day backfill, scored as of 2026-10-31:

```json
{
  "schema_version": "1.0.0",
  "model_id": "aseri-timestral209m",
  "series_id": "suez_transits",
  "n": 0,
  "min_n_to_display": 30,
  "primary_baseline": "mean28",
  "score_lag_days": 14,
  "live": {"n": 0, "since": null, "observation_as_of": null,
           "buckets": {"1-7": {"n": 0}, "8-28": {"n": 0}}, "weekly": []},
  "retrospective": {
    "n": 106, "since": "2026-06-27", "observation_as_of": ["2026-10-31", "2026-10-31"],
    "buckets": {
      "1-7": {
        "n": 106,
        "coverage_50": {"hits": 374, "targets": 742, "rate": 0.504, "ci": [0.4674, 0.5406]},
        "coverage_80": {"hits": 577, "targets": 742, "rate": 0.7776, "ci": [0.746, 0.8071]},
        "wis": {"wis": 3.5324, "dispersion": 1.4453, "overprediction": 0.9591, "underprediction": 1.128,
                "vs_probabilistic_naive": {"ratio": 0.687, "ci": [0.6494, 0.7279], "verdict": "beats"}},
        "ae_median": {"mean": 5.1475, "vs": {
          "naive": {"ratio": 0.6793, "ci": [0.6404, 0.7231], "verdict": "beats"},
          "snaive7": {"ratio": 0.6926, "ci": [0.6396, 0.762], "verdict": "beats"},
          "mean28": {"ratio": 0.9944, "ci": [0.9851, 1.0031], "verdict": "ties"}}},
        "mase": 0.744
      },
      "8-28": {"n": 85, "...": "the same fields"}
    },
    "weekly": [{"reference_date": "2026-08-16", "inside_80": true}, "... 8 in all, oldest first"]
  },
  "latest_vintage": {"live": {"...": "the same, against the latest vintage"}, "retrospective": {}},
  "method": {"wis": "...", "observation": "...", "bootstrap": {"block_length": {"1-7": 7, "8-28": 28},
             "resamples": 2000, "seed": 0, "interval": 0.95}, "...": "..."},
  "license": {"name": "CC BY-NC 4.0", "...": "..."},
  "generated_at": "2026-10-31T07:00:00Z",
  "links": {"catalog": "../../series.json", "scores": "../../scores.json"}
}
```

`scores.json` at the root lists every series in this shape, without `latest_vintage`.

`bulk/datapackage.json`, abridged:

```json
{
  "$schema": "https://datapackage.org/profiles/2.0/datapackage.json",
  "name": "aseri-forecasts",
  "title": "aseri daily probabilistic forecasts",
  "version": "1.0.0",
  "created": "2026-10-29T06:14:02Z",
  "licenses": [{"name": "CC-BY-4.0", "path": "https://creativecommons.org/licenses/by/4.0/",
                "title": "aseri-authored forecasts and scores; upstream terms apply per series (see series.json)"}],
  "resources": [
    {"name": "forecasts-2026", "path": "forecasts-2026.csv.gz", "format": "csv", "compression": "gz",
     "schema": {"fields": [
        {"name": "model_id", "type": "string"},
        {"name": "forecast_date", "type": "date"},
        {"name": "target", "type": "string"},
        {"name": "reference_date", "type": "date"},
        {"name": "horizon", "type": "integer", "constraints": {"minimum": 1}},
        {"name": "target_end_date", "type": "date"},
        {"name": "output_type", "type": "string", "constraints": {"enum": ["quantile"]}},
        {"name": "output_type_id", "type": "number"},
        {"name": "value", "type": "number"}],
      "primaryKey": ["model_id", "forecast_date", "target", "horizon", "output_type_id"]}},
    {"name": "time-series-portwatch", "path": "time-series-portwatch.csv", "format": "csv",
     "licenses": [{"name": "IMF-terms", "path": "https://www.imf.org/en/About/copyright-and-terms"}],
     "sources": [{"title": "UN Global Platform; IMF PortWatch", "path": "https://portwatch.imf.org/"}]}
  ]
}
```

`compression` is not in the profile, so it would be a custom property. Whether Frictionless tooling reads `.csv.gz` directly is **unverified**.

## Appendix C: OpenAPI skeleton

Write it as JSON (`openapi.json`). It is shown in YAML here for readability.

```yaml
openapi: 3.1.1
jsonSchemaDialect: https://json-schema.org/draft/2020-12/schema
info:
  title: aseri forecasts API
  version: 1.0.0            # equals schema_version in every file
  summary: Static, read-only daily probabilistic forecasts (Hubverse quantile semantics).
  description: |
    Files on GitHub Pages. GET only, no query parameters, no custom request headers
    (CORS preflight is rejected). Cache: max-age 600. Dated forecast files are immutable.
    Breaking changes ship under /api/v2 with at least 6 months of overlap; see CHANGELOG_API.md.
  license: {name: CC BY 4.0 (aseri content; upstream terms per series), identifier: CC-BY-4.0}
servers:
  - url: https://<owner>.github.io/aseri/api/v1
paths:
  /series.json:
    get:
      operationId: getCatalog
      responses:
        '200': {description: Series catalog, content: {application/json: {schema: {$ref: 'schemas/catalog.schema.json'}}}}
  /series/{series_id}/latest.json:
    get:
      operationId: getLatestForecast
      parameters: [{$ref: '#/components/parameters/series_id'}]
      responses:
        '200': {description: Latest forecast, content: {application/json: {schema: {$ref: 'schemas/forecast.schema.json'}}}}
        '404': {$ref: '#/components/responses/NotFound'}
  /series/{series_id}/forecasts.json:
    get:
      operationId: listForecasts
      parameters: [{$ref: '#/components/parameters/series_id'}]
      responses:
        '200': {description: Issued forecasts, content: {application/json: {schema: {$ref: 'schemas/forecast-index.schema.json'}}}}
  /series/{series_id}/forecasts/{reference_date}.json:
    get:
      operationId: getForecast
      parameters:
        - {$ref: '#/components/parameters/series_id'}
        - {name: reference_date, in: path, required: true, schema: {type: string, format: date}}
      responses:
        '200': {description: One immutable forecast, content: {application/json: {schema: {$ref: 'schemas/forecast.schema.json'}}}}
        '404': {$ref: '#/components/responses/NotFound'}
  /series/{series_id}/actuals.json:
    get:
      operationId: getActuals
      parameters: [{$ref: '#/components/parameters/series_id'}]
      responses:
        '200': {description: Observations, latest vintage, content: {application/json: {schema: {$ref: 'schemas/actuals.schema.json'}}}}
  /series/{series_id}/scores.json:
    get:
      operationId: getSeriesScores
      parameters: [{$ref: '#/components/parameters/series_id'}]
      responses:
        '200': {description: Track record, content: {application/json: {schema: {$ref: 'schemas/scores.schema.json'}}}}
  /scores.json:
    get:
      operationId: getScoreboard
      responses:
        '200': {description: Cross-series summary, content: {application/json: {schema: {$ref: 'schemas/scores.schema.json'}}}}
  /bulk/forecasts-{year}.parquet:
    get:
      operationId: getBulkParquet
      parameters: [{$ref: '#/components/parameters/year'}]
      responses:
        '200': {description: 'Hubverse model-output, collected shape. Served as application/octet-stream by Pages.',
                content: {application/octet-stream: {}}}
  /bulk/forecasts-{year}.csv.gz:
    get:
      operationId: getBulkCsv
      parameters: [{$ref: '#/components/parameters/year'}]
      responses:
        '200': {description: Same rows as the Parquet file, gzip-compressed CSV, content: {application/gzip: {}}}
  /bulk/datapackage.json:
    get:
      operationId: getDataPackage
      responses:
        '200': {description: Frictionless Data Package v2 descriptor, content: {application/json: {}}}
components:
  parameters:
    series_id:
      name: series_id
      in: path
      required: true
      schema:
        type: string
        enum: [gpr_daily, wiki_ww3_views, brent_spot, suez_transits, hormuz_transits,
               bab_el_mandeb_transits, taiwan_strait_transits, ua_air_raid_hours, ua_drones_downed_claimed]
    year: {name: year, in: path, required: true, schema: {type: integer, minimum: 2026}}
  responses:
    NotFound: {description: GitHub Pages 404 page (HTML body), content: {text/html: {}}}
```

Forecast schema core (`schemas/forecast.schema.json`), abridged:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://<owner>.github.io/aseri/api/v1/schemas/forecast.schema.json",
  "type": "object",
  "required": ["schema_version", "series_id", "model_id", "forecast_date", "reference_date",
               "forecast_mode", "horizon", "target_end_date", "quantiles", "attribution", "provenance", "generated_at"],
  "properties": {
    "schema_version": {"type": "string", "pattern": "^1\\.\\d+\\.\\d+$"},
    "series_id": {"type": "string", "pattern": "^[a-z0-9_]+$"},
    "model_id": {"type": "string", "pattern": "^[A-Za-z0-9_]+-[A-Za-z0-9_]+$"},
    "forecast_date": {"type": "string", "format": "date"},
    "reference_date": {"type": "string", "format": "date"},
    "forecast_mode": {"enum": ["live", "retrospective"]},
    "horizon": {"type": "array", "items": {"type": "integer", "minimum": 1}, "minItems": 1},
    "target_end_date": {"type": "array", "items": {"type": "string", "format": "date"}},
    "quantiles": {
      "type": "object",
      "propertyNames": {"enum": ["0.01","0.05","0.1","0.15","0.2","0.25","0.3","0.35","0.4","0.45","0.5",
                                  "0.55","0.6","0.65","0.7","0.75","0.8","0.85","0.9","0.95","0.99"]},
      "minProperties": 21,
      "additionalProperties": {"type": "array", "items": {"type": "number"}}
    },
    "generated_at": {"type": "string", "format": "date-time"}
  }
}
```

`format` is an annotation by default in 2020-12, so turn on format checking in the validator. Equal array lengths and monotone quantiles are checked in code (section 3.5).

## Sources

**Hubverse and forecast hubs**
- [HV-MO] Hubverse, Model output: https://docs.hubverse.io/en/latest/user-guide/model-output.html (source: https://github.com/hubverse-org/hubDocs/blob/main/docs/source/user-guide/model-output.md)
- [HV-TASKS] Hubverse, Defining modeling tasks: https://docs.hubverse.io/en/latest/user-guide/tasks.html
- [HV-TD] Hubverse, Target data: https://docs.hubverse.io/en/latest/user-guide/target-data.html
- [HV-CFG] Hubverse, Hub configuration files: https://docs.hubverse.io/en/latest/user-guide/hub-config.html ; schemas: https://github.com/hubverse-org/schemas
- [HV-MM] Hubverse, Model metadata: https://docs.hubverse.io/en/latest/user-guide/model-metadata.html ; template schema: https://github.com/hubverse-org/example-complex-forecast-hub/blob/main/hub-config/model-metadata-schema.json
- [HV-EX] Example complex forecast hub `tasks.json`: https://github.com/hubverse-org/example-complex-forecast-hub/blob/main/hub-config/tasks.json
- [HV-STORE] Hubverse, Data storage: https://docs.hubverse.io/en/latest/user-guide/data-storage.html
- [HV-CLOUD] Hubverse, AWS onboarding: https://docs.hubverse.io/en/latest/developer/cloud-onboarding.html
- [HV-XFORM] hubverse-transform: https://github.com/hubverse-org/hubverse-transform
- [HV-DASH] Hubverse, Dashboards: https://docs.hubverse.io/en/latest/user-guide/dashboards.html
- [HV-PTC] Hubverse, Forecasts dashboard data: https://docs.hubverse.io/en/latest/developer/dashboard-predtimechart.html
- [HV-WF] Hubverse, Dashboard workflows (orphan data branches): https://docs.hubverse.io/en/latest/developer/dashboard-workflows.html
- [HV-EVAL] hubEvals `score_model_out()`: https://hubverse-org.github.io/hubEvals/reference/score_model_out.html (source: https://github.com/hubverse-org/hubEvals/blob/main/R/score_model_out.R)
- [HV-HOME] Hubverse home (adopting organisations): https://hubverse.io/
- [SU-Q] scoringutils, default quantile metrics: https://epiforecasts.io/scoringutils/reference/get_metrics.forecast_quantile.html
- [SU-WIS] scoringutils, WIS: https://epiforecasts.io/scoringutils/reference/wis.html
- [WIS] Bracher et al. (2021), Evaluating epidemic forecasts in an interval format, PLOS Comp Biol: https://doi.org/10.1371/journal.pcbi.1008618
- [FS] CDC FluSight model-output README: https://github.com/cdcepi/FluSight-forecast-hub/blob/main/model-output/README.md
- [C19-OLD] US COVID-19 Forecast Hub (2020-2024) submission format: https://github.com/reichlab/covid19-forecast-hub/blob/master/data-processed/README.md
- [C19-NEW] CDC COVID-19 Forecast Hub README (cloud access): https://github.com/CDCgov/covid19-forecast-hub/blob/main/README.md
- [S3] Anonymous S3 listing, 2026-10-29: https://covid19-forecast-hub.s3.amazonaws.com/?list-type=2&prefix=model-output/
- [FSD] FluSight dashboard: https://reichlab.io/flusight-dashboard/forecast.html ; loader: https://reichlab.io/flusight-dashboard/resources/predtimechart.js ; scores: https://github.com/reichlab/flusight-dashboard/tree/predevals/data

**Library and benchmark conventions**
- [NX-SF] statsforecast quick start: https://nixtlaverse.nixtla.io/statsforecast/docs/getting-started/getting_started_short.html
- [NX-Q] Nixtla TimeGPT quantile forecasts: https://www.nixtla.io/docs/forecasting/probabilistic/quantiles
- [GL] GluonTS forecast API: https://ts.gluon.ai/stable/api/gluonts/gluonts.model.forecast.html
- [FEV-DS] fev dataset format: https://github.com/autogluon/fev/blob/main/docs/tutorials/02-dataset-format.ipynb
- [FEV-M] fev, adding a model (predictions schema): https://github.com/autogluon/fev/blob/main/docs/tutorials/05-add-your-model.ipynb
- [GIFT] GIFT-Eval README: https://github.com/SalesforceAIResearch/gift-eval/blob/main/README.md

**Generic standards**
- [DP] Data Package v2: https://datapackage.org/standard/data-package/
- [TS] Table Schema v2: https://datapackage.org/standard/table-schema/
- [CSVW] W3C Metadata Vocabulary for Tabular Data: https://www.w3.org/TR/tabular-metadata/
- [JSTAT] JSON-stat format: https://json-stat.org/format/
- [SDMX] SDMX: https://sdmx.org/about-sdmx/welcome/
- [DCAT] W3C DCAT 3: https://www.w3.org/TR/vocab-dcat-3/
- [SO] Google Dataset structured data: https://developers.google.com/search/docs/appearance/structured-data/dataset ; https://schema.org/Dataset
- [ISO] ISO 8601: https://www.iso.org/iso-8601-date-and-time-format.html
- [RFC3339] https://www.rfc-editor.org/rfc/rfc3339
- [OAS] OpenAPI 3.1.1: https://spec.openapis.org/oas/v3.1.1.html
- [OAS32] OpenAPI 3.2.0 (published 2025-09-19): https://spec.openapis.org/oas/v3.2.0.html
- [RFC9745] Deprecation header: https://www.rfc-editor.org/rfc/rfc9745.html
- [RFC8594] Sunset header: https://www.rfc-editor.org/rfc/rfc8594.html
- [FETCH] WHATWG Fetch, CORS-safelisted request headers: https://fetch.spec.whatwg.org/#cors-safelisted-request-header
- [TOOLS] https://github.com/python-jsonschema/jsonschema ; https://github.com/python-jsonschema/check-jsonschema ; https://github.com/python-openapi/openapi-spec-validator

**GitHub**
- [GH-LIM] GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- [GH-404] Custom 404: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site
- [GH-WF] Custom workflows for Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- [GH-SRC] Publishing source: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- [GH-JEK] Pages and Jekyll: https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll ; plugin versions: https://pages.github.com/versions.json
- [JRF] jekyll-redirect-from (meta refresh): https://github.com/jekyll/jekyll-redirect-from
- [GH-MIME] MIME types on GitHub Pages (archived Enterprise 2.14 doc): https://docs.github.com/en/enterprise/2.14/user/articles/mime-types-on-github-pages
- [MIMEDB] mime-db: https://github.com/jshttp/mime-db/blob/master/db.json
- [GH-LF] Large files: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
- [GH-REL] Releases: https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- [GH-VAR] Actions default variables: https://docs.github.com/en/actions/reference/workflows-and-actions/variables
- [GH-ATT] Artifact attestations: https://docs.github.com/en/actions/concepts/security/artifact-attestations
- [GH-SCHED] Schedule event: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

**Real static APIs**
- [EOL] endoflife.date: OpenAPI https://endoflife.date/docs/api/v1/openapi.yml ; sample https://endoflife.date/api/v1/products/python/ ; changelog https://github.com/endoflife-date/endoflife.date/blob/master/CHANGELOG_API.md ; generators https://github.com/endoflife-date/endoflife.date/tree/master/_plugins
- [FX] exchange-api: https://github.com/fawazahmed0/exchange-api (README, MIGRATION.md) ; removal reason https://github.com/fawazahmed0/exchange-api/issues/89
- [POM] pomber/covid19: https://github.com/pomber/covid19

**Licences**
- [GPR] https://www.matteoiacoviello.com/gpr.htm
- [WMF] https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html
- [EIA] https://www.eia.gov/about/copyrights_reuse.php ; https://www.eia.gov/dnav/pet/TblDefs/pet_pri_spt_tbldef2.asp
- [FRED] https://fred.stlouisfed.org/series/DCOILBRENTEU
- [IMF] https://www.imf.org/en/About/copyright-and-terms
- [CCBY] https://creativecommons.org/licenses/by/4.0/legalcode.en
- [MIT-S] https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset/blob/main/LICENSE
- [MIT-L] https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset/blob/main/LICENSE

**Observations [OBS]**, read-only `curl` requests on 2026-10-29: `HEAD`, conditional `GET`, `Range`, and `OPTIONS` with an `Origin` header. Targets:
- https://pomber.github.io/covid19/timeseries.json
- https://vincentarelbundock.github.io/Rdatasets/csv/datasets/AirPassengers.csv , `.../parquet/datasets/AirPassengers.parquet` , `.../doesnotexist.json`
- https://reichlab.io/flusight-dashboard/forecast.html
- https://raw.githubusercontent.com/reichlab/flusight-dashboard/refs/heads/ptc/data/predtimechart-options.json
- https://github.com/cli/cli/releases/download/v2.40.0/gh_2.40.0_checksums.txt
- https://endoflife.date/api/v1/products/python/
- https://latest.currency-api.pages.dev/v1/currencies/eur.json
- https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json

**Internal:** [timestral-model.md](timestral-model.md), [data-sources.md](data-sources.md), [spike-timestral-backtest.md](spike-timestral-backtest.md), [forecast-horizons.md](forecast-horizons.md), [prior-art-and-gaps.md](prior-art-and-gaps.md). The size measurements read `prototypes/timestral-backtest/data/fc_Timestral-209M.npz`. They were built with pandas 2.2.3 and pyarrow 24.0.0 (CSV, gzip level 9, Parquet zstd) and were not committed.
