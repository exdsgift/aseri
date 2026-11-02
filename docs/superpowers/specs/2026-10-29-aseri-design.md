# aseri: design

Status: draft for review, 2026-10-29. Owner: exdsgift. Repository: `exdsgift/aseri` (reset to an empty `master` on 2026-10-29).

Every decision below was either made by the owner during brainstorming or is marked **(my call)**: a sensible default the owner has not confirmed. Section 7 lists the calls. Evidence lives in `docs/research/`, and the visual reference is the working prototype in [`forecast-chart/`](https://github.com/exdsgift/aseri/tree/prototypes/forecast-chart) on the `prototypes` branch (published as https://claude.ai/artifact/TkkbS85exVYBRZ1fDALZKb).

## 1. What it is and why

焦り (*aseri*, "impatience, restlessness") is a small, self-maintaining website that answers one question in the first ten seconds: **how unstable is the world right now, and where is it heading?**

- **The headline:** one geopolitical-risk number, the Caldara-Iacoviello GPR index, with its trend and a forecast for the next 4 weeks, written in plain words.
- **Nine public signals around it**, each with its own forecast: risk, public attention, oil, four sea lanes, and the air war in Ukraine.
- **The forecasts come from Mistral's Timestral**, a small time-series foundation model. A GitHub Action runs it on CPU once a day. Showing this model at work is part of the point.
- **Honesty is the product.** Every forecast shows its uncertainty, and the site publishes its own track record: past forecasts next to what actually happened.
- **The reader** opens it for personal awareness, as a risk and instability indicator. It is not decision support and must not read as alarmist.

**Why it is shaped this way:** the previous version of this repository failed on scope. It scraped news headlines at scale, grew to 2.2 GB of history, and tried to do too much. This version does one thing: a few clean public series, forecast daily, shown clearly, with bounded storage.

**Core design values (owner's words):** "semplicità, chiarezza, puntualità delle informazioni e accuratezza dei fatti", with forecasts that are rigorous scientifically and mathematically.

## 2. Goals

1. **A static site on GitHub Pages, updated by itself once a day.** No server, no database, no manual steps.
2. **A daily pipeline in GitHub Actions** that:
   - fetches the nine series;
   - forecasts each with Timestral-209M;
   - archives every forecast;
   - scores past forecasts against what happened;
   - publishes the site and a public API.
3. **The page, as in the prototype (sections 6.8 and 6.9):**
   - a hero with the wordmark, the GPR 7-day average and a one-sentence forecast;
   - one forecast panel with a replay slider and an intervals block;
   - nine signal cards that open in the panel;
   - a track-record section.
4. **A public track record** per series:
   - interval coverage (5 in 10, 8 in 10);
   - a probabilistic score (WIS);
   - point error against naive baselines;
   - live forecasts kept apart from backfilled ones.
5. **A public static API in the Hubverse format**, the de facto standard for probabilistic forecasts (section 6.6).
6. **A periodic covariate scout:** scripts that look for covariates that would really improve the forecasts, and propose them for a human decision (section 6.5).
7. **Lean, clean code.** Small single-purpose components and modules, the shadcn component system on the frontend, tests where there is logic (section 6.10).

## 3. Non-goals

- **No news scraping** and no text analysis.
- **No server, no accounts, no database.** Static files only.
- **No intraday updates.** Once a day is enough; several sources lag by days anyway.
- **No covariates in the daily forecasts for now.** They were tested and none helped (`docs/research/spike-covariates.md`). The scout (6.5) is how they could come back.
- **No 95% interval.** Timestral's 21 quantile levels have no 0.025 or 0.975.
- **No light theme.** The reference is dark only.
- **No ACLED data.** Its terms forbid this use.
- **No casualty forecasts in v1.** UCDP monthly fatalities are deferred (section 9).
- **No LLM-written commentary or "analysis".** Numbers, sources and plain sentences only.
- **No commercial use.** The IMF PortWatch terms require permission for it.

## 4. Anti-goals

Even if everything works, the project fails if:

- **The look drifts away from the dos-age.com reference.** The owner was explicit that this is the first thing that would make them wince.
- **The page gets cluttered or unclear.** One idea per screen, the most important thing the most visible ("simplicity, not minimalism").
- **A forecast is shown without its band, or accuracy is overclaimed.** For example: hiding misses, mixing backtests into the live record, or writing "will" instead of "most likely".
- **The repository grows without bound** like the previous version.
- **The pipeline publishes stale or broken data silently.** Stale data is fine if it is labelled as stale.
- **Prototype code gets promoted to production.** The prototypes are throwaway references.
- **It reads as alarmist or partisan.** Sober tone, every claim sourced, one-sided data labelled as such.

## 5. Constraints

- **Hosting is GitHub Pages:**
  - static files only;
  - CORS open (`Access-Control-Allow-Origin: *`, verified);
  - fixed 10-minute cache, no custom headers or redirects;
  - preflight requests rejected (405);
  - 1 GB site limit.

  Details are in `docs/research/public-api.md` section 2.
- **Compute is a public-repo `ubuntu-latest` runner:** 4 vCPU, 16 GB RAM, CPU only.
  - Timestral-209M takes 0.7 to 3.4 s per forecast on a laptop. One daily run is about 20 s of inference across nine series. The whole job is estimated at 2 to 3 minutes, mostly setup.
  - **This has not been measured on a runner yet.**
  - The weights are 837 MB and should be cached (`docs/research/spike-timestral-backtest.md`).
- **The model is pinned:**
  - weights `mistralai/Timestral-209M` at revision `9874d252ab0aae16f7f7c999f98f98d6ad7d8365`;
  - the `timestral` package from git commit `a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff`;
  - CPU-only torch from the PyTorch CPU index (the default Linux wheel pulls about 2 GB of CUDA);
  - a new model ID if any of these change.
- **The training cutoff is unknown.** Mistral has not said what data Timestral saw (mistralai/timestral#3 is open). Backtests may flatter the model, so only live forecasts count as the real record, and the site says so.
- **The sources lag and get revised:**
  - PortWatch lags about 4 days;
  - GPR updates on Mondays and revises recent days;
  - Brent is released weekly and has only trading days;
  - Wikipedia lags about 1 day.

  Horizons are counted from the last observed date (`reference_date`), not the run date.
- **Licences and attribution must travel with the data** on the page and in the API (6.1, 6.6).
- **The UI copy is in English (my call).** It matches the reference and the public repository.
- **Storage is bounded.** The `master` branch holds code and docs only (6.7).

## 6. Decisions

### 6.1 The nine series

Each series is a daily value. The page shows the daily values, their 7-day average as context, and Timestral's forecast of the daily values.

| id | Name on page | Source and access | Transform | Unit | Horizon | Interval steps | Attribution / licence |
|---|---|---|---|---|---|---|---|
| `gpr_daily` | Geopolitical risk | Caldara & Iacoviello GPR daily, `data_gpr_daily_recent.dta` (or `.xls`), column `GPRD` | none; baseline 100 = 1985-2019 average (verified: mean 100.0) | index | 28 | 7, 14, 28 | CC BY 4.0; cite Caldara and Iacoviello (2022, AER) |
| `wiki_ww3_views` | "World War III" | Wikimedia pageviews REST API, en.wikipedia, `user` agent type, User-Agent header required | none | Wikipedia views a day | 14 | 3, 7, 14 | CC0 |
| `brent_spot` | Brent oil | FRED `DCOILBRENTEU` (EIA) | trading days only; see note | $ a barrel | 14 | 3, 7, 14 | EIA public domain, source FRED/EIA |
| `suez_transits` | Suez Canal | IMF PortWatch ArcGIS `Daily_Chokepoints_Data`, `n_total` | none | ships a day | 28 | 7, 14, 28 | "Sources: UN Global Platform; IMF PortWatch (portwatch.imf.org)"; commercial reuse needs IMF permission |
| `hormuz_transits` | Strait of Hormuz | same, `portname='Strait of Hormuz'` | none | ships a day | 14 | 3, 7, 14 | same |
| `bab_el_mandeb_transits` | Bab el-Mandeb | same, `portname='Bab el-Mandeb Strait'` | none | ships a day | 14 | 3, 7, 14 | same |
| `taiwan_strait_transits` | Taiwan Strait | same, `portname='Taiwan Strait'` | none; known AIS tracking dropouts, label them | ships a day | 28 | 7, 14, 28 | same |
| `ua_air_raid_hours` | Air-raid alerts | `Vadimkin/ukrainian-air-raid-sirens-dataset`, `volunteer_data_en.csv` | hours of alert per UTC day, summed over regions, alerts split at UTC midnight, today dropped (partial) | alert hours a day, all regions | 7 | 1, 3, 7 | MIT (repo); volunteer data |
| `ua_drones_downed_claimed` | Drones downed | `PetroIvaniuk/2022-Ukraine-Russia-War-Dataset`, `russia_losses_equipment.json`, field `drone` | daily difference of the cumulative count; a negative difference is the source correcting itself, flagged as a revision, not clipped | a day, as claimed by Ukraine | 7 | 1, 3, 7 | MIT (repo); **always labelled "claimed by Ukraine's General Staff, one side's figures"** |

Notes:
- **The `id` column holds the public IDs (my call).** They are the API path segment and the Hubverse `target` value, so they can never be renamed. They are taken from `docs/research/public-api.md`. Short names are only display labels.
- **Horizons:** GPR, Suez, Taiwan and Hormuz come from the backtest spike, which validated 30, 30, 30 and 7 to 14 days. The 30-day horizons are set to 28 so that every horizon is a whole number of weeks (owner's choice, see 6.8). The others are conservative until the live record says otherwise.
- **Brent's calendar.** The prototype carried Friday's close over the weekend. The API research recommends forecasting trading days and counting the horizon in trading days (`public-api.md` 4.3).
  - **(my call)** Forecast on the trading-day series, and show calendar dates on the page.
- **Revisions past a series' window hold it only when they exceed a normal update** (`revision_window`, `deep_revision_tolerance`, `deep_revision_days` and `deep_revision_ratio` in the registry). A held series keeps its last good files until a human reviews the change; what passes is archived as any revision is, and the run summary names it.
  - **GPR** holds when an update moves more than 150 values older than 90 days by more than 1%, or any one of them past 3-fold, up or down. Calibrated on the authors' 277 weekly updates of 2022 to 2026: a normal one moved at most 77, and at most 95 when four updates arrive together after missed weeks; the February 2024 fix of missing articles since 2021 moved 298 to 749, and holds by design. A normal single old day stayed within 0.636 to 1.571 times its value (`docs/research/gpr-realtime-backtest.md`, "The deep-revision rule").
  - **Known limit:** each update is weighed against the archive alone, so a rewrite split over several weeks, each under the count, passes.
  - **Every other series** holds on any change older than its window until its revisions are measured.
  - A file that drops archived days always holds, and a file that breaks its source's contract fails its series before any of this.
- **PortWatch reports errors inside HTTP 200 responses,** so a status-code check misses them. Validate the body, retry with backoff (the service had about 15-minute outages during research), and never overwrite good data with a failed fetch.
- **The baseline in the "vs" figures:**
  - for GPR, its 1985-2019 average (100);
  - for every other series, the mean of its last 365 days **(my call)**.

### 6.2 Forecasting

- **The model:** Timestral-209M, univariate, CPU, 4 torch threads, full history as context. The 28M model is as good on calm series but 10 to 20% worse on Hormuz's regime shift (spike).
- **The target is the raw daily value,** validated in both spikes. The 7-day average is display context only, never forecast separately.
- **Calibrated bands (#151).** The bands are calibrated per series on a two-year backtest ([ADR 0001](../../adr/0001-baselines-and-calibration-before-the-live-record.md)): per series, bucket of steps and side of the median, an offset `d` scales each quantile's distance to the median by `1 + d`, so the 80% band holds about 8 days in 10. The model is `aseri-timestral209m_c1`; its record started again, and it forecast the 120-day replay window again for the replay, while each day's dated file keeps the first forecast issued for it.
- **Archive all 21 quantile levels** so WIS can be computed properly. The page shows 0.1, 0.25, 0.5, 0.75 and 0.9 as "8 in 10" and "5 in 10" ranges, and 0.5 as "most likely" in text. The charts draw only the model's paths, never the median line.
- **The model's paths (#147).** The charts draw only paths drawn from the model's forecast, never an average or a median line (owner's choice, 2026-10-30). The 20 paths are ranked by how likely each of their days is, the sum of the days' log-densities in normal scores, so the most likely stays near the middle of each day's forecast while it moves like the real days. Ranking by the whole AR(1) likelihood favoured smooth paths, which under a strong tie (Wikipedia's views, 0.85) drifted out of the band. The panel and the cards open on the most likely one, and Play shows the others in that order, one at a time, from the last daily value, so the days ahead read like the past:
  - day h is that day's quantile function at u = Phi(z_h), read off the published levels by straight lines and held at the end levels, with z a Gaussian AR(1);
  - its rho, the series' day-to-day tie, is the lag-1 correlation, across consecutive horizons of the same forecast, of the normal scores of the real days' PITs. The PITs come from the 21 archived quantiles, clipped to [0.005, 0.995], over the resolved forecasts of the last 120 days, against the first vintage that resolved each day. Below 100 pairs it is 0. The catalog publishes it with its pair count;
  - 20 paths, seeded by series, reference date and index, so a path always looks the same.

  On the backtest of 2026-10-30 rho was 0.45 for GPR, -0.26 for Suez, 0.30 for Bab el-Mandeb, 0.14 for Taiwan and 0.08 for Hormuz.
- **One forecast per series per new `reference_date`.** If a source has not moved forward (GPR during the week, for example), no new forecast is issued for that series that day. `(model_id, series_id, reference_date)` identifies a forecast; it is written once and never edited.
- **Batches and missed runs (my call).** When a source jumps several days at once (GPR and Brent weekly, or any source after a missed run), the job issues one forecast for every new date.
  - Each one uses only the data up to its own date.
  - Only the forecast from the newest date is `live`. The earlier ones are `retrospective`, because they were issued after the fact.
  - This keeps the replay slider daily for every series.
- **Backfill at launch.** Generate retrospective forecasts for the last 120 days of each series, each one using only the data up to its day, as the prototype did. They feed the replay slider from day one.
  - They are flagged `forecast_mode: retrospective` and never counted in the live record.
  - The page labels them as backtests.
- **Checked results so far.** On 121 daily origins over the last 4 months, all horizons pooled:
  - the 8-in-10 band held 72 to 87% of real values;
  - median error was 17 to 36% below "tomorrow like today" on 8 of 9 series;
  - Brent ties the naive method.

  These are indicative only (overlapping origins, unknown training cutoff).

### 6.3 Daily pipeline

One workflow, `daily.yml`, on a cron.
- **Schedule (my call):** 07:00 UTC, plus manual dispatch.
- **Stages:** each is a separate module with a clear input and output.

1. **Fetch:** one adapter per source.
   - Retry with exponential backoff, validate the content, record `as_of`.
   - Raw downloads are never committed: re-download, or use `actions/cache`.
2. **Validate:** one contract per source, which fails closed:
   - every series is a continuous daily index, apart from Brent's trading days, with no day after the fetch day;
   - known fills are applied:
     - Brent carries values forward only for display;
     - the alert hours treat a missing day as zero only up to the source's freshness cutoff, its latest event or commit, so a stale file never becomes trailing zeros that read as a ceasefire;
   - freshness against each series' expected lag: a warning at the lag plus 2 days, a stale series at plus 7;
   - plausible ranges and finite values.

   A failing or stale series is skipped for the day. It keeps its last good forecast and data, labelled "stale since {date}" in the catalog. The rest still publish.
3. **Forecast:** run Timestral on each series whose `reference_date` moved.
   - Clamp count quantiles at 0 and the alert hours at 600 (25 regions times 24 hours). Sort the quantiles after any offset (none crossed in testing), and stop on a non-finite value.
   - Write the Hubverse round file.
4. **Archive:** append the round file, the observation deltas and a run manifest to the `archive` branch (6.7).
   - The manifest holds provenance, input hashes and output checksums.
5. **Score:** compare every past forecast whose target dates are now observed:
   - coverage at 50% and 80%;
   - WIS;
   - absolute error of the median vs naive (last value), seasonal naive (7 days) and the 28-day mean, plus MASE.

   Score against a stated observation vintage, because GPR revises its recent values.
6. **Publish:** build the API files and the page data, build the web app, check every API file against the contract (the gate, 6.6), and deploy one Pages artifact.

**Page-only deploys.** A push to master that changes only `web/` runs the `page` job instead: it tests and builds the page, takes `api/v1` from the newest Pages artifact of master (kept 7 days), the bulk files included, and deploys, with no fetch, no model and no archive, in about two minutes. The same runs by hand with `page_only`. A push that also changes anything outside `web/` deploys nothing and waits for the daily run, which deploys the whole site.

**Weights cache.** Use `actions/cache` keyed by the model revision. Cold start downloads the 837 MB weights once.

**Failure policy.** The job fails loudly when nothing could be published, or when the schemas fail. A failing or stale source fails only its own series: the run summary lists each source's status, and the page shows "data to {date}" in the caution colour.

### 6.4 Track record

- **Two kinds of forecasts:**
  - **Live:** issued by the daily job and archived the same day.
  - **Retrospective:** the launch backfill.

  The headline record uses live forecasts only, and the page states how many there are ("based on N live forecasts since {date}").
- **Minimum sample (my call):** a series shows live scores once 30 of its live forecasts have resolved at the scored horizon (`min_n_to_display: 30` in `scores.json`, next to `n`).
  - Before that, the record shows "Collecting live record: N of 30".
  - Under it, visually separate and labelled "Backtest, not the live record", the retrospective scores.
  - Backtest and live numbers are never combined in one figure.
- **Per series metrics,** by horizon bucket (1-7, 8-28):
  - coverage of the 5-in-10 and 8-in-10 ranges;
  - WIS;
  - median absolute error and its ratio to each naive baseline.
- **On the page:**
  - **The forecast panel's replay** shows any forecast from the last 120 days, with the real daily values in white, and in "Show the numbers" whether each step's day landed in range.
  - **The record section shows the squares:** the last 8 weekly forecasts, 7 days ahead, filled if what happened landed in the 8-in-10 range and hollow if not (#148), under a title that counts them all (6.8). Tapping one opens it in the replay.
  - **Per series, one tap away ("How we score", #152):** coverage and the misses against the series' own simple rule, in plain words, with the 95% ranges in brackets.
- **Wording rules:**
  - "likely 33-51", never "will";
  - a frequency, "8 in 10 days land here", not "80% confidence interval";
  - say plainly when the model ties or loses to its simple rule (Brent does): "About as good as just repeating the last value".

### 6.5 Covariate scout

The owner wants scripts that look for covariates that are actually accurate. The daily job stays univariate. Covariates only come in through this gate.

- **When it runs:** a separate workflow, `scout.yml`, monthly **(my call)** and on manual dispatch. It never touches the daily forecasts.
- **What it does:** re-runs the spike's ablation on rolling origins with the current data.
  - **The baseline:** the univariate model, with the same metrics and paired bootstrap CIs over origins as `docs/research/spike-covariates.md`.
  - **Candidates:**
    - calendar features as known-future covariates: day of week, the holidays that matter per series (Lunar New Year for Taiwan, for example);
    - the other aseri series as past-only covariates, held back by their real publication lag;
    - lagged versions of the above;
    - new public series only after they pass the data-source checks in 6.1.
- **The keep rule, fixed in config before any run.** Use the rule from the covariates spike:
  - WQL at least 2% better, with the 90% CI below zero, on both the 1-7 and 8-28 buckets;
  - no worse MASE;
  - 8-in-10 coverage within 0.70 to 0.90.

  Changing the rule is a code change with a reason in the commit.
- **What it produces:**
  - a Markdown report under `docs/research/scout/{date}.md`;
  - when a set passes, an issue or draft PR that proposes enabling it for that series.

  **A human approves.** Enabling a covariate changes the model ID suffix, because the inference settings changed, so the live record restarts honestly for that series.
- **The first known lead:** Lunar New Year for Taiwan. It cut the error 27% in the 2026 holiday week but rests on one holiday, so retest after the 2027 one.
- **Cost:** covariates cost 3 to 4.5 times more inference. Monthly runs are minutes, not a constraint.

### 6.6 Public API

Follow `docs/research/public-api.md`. The essentials:

- **The format is Hubverse model output:** `reference_date`, `target`, `horizon`, `target_end_date`, `output_type = quantile`, `output_type_id`, `value`. The model ID is `aseri-timestral209m`.
- **Base URL:** `https://<owner>.github.io/aseri/api/v1/`, every path ending in a file name:
  - `series.json`: catalog, with unit, horizon, last observation, source, licence, attribution text and day-to-day tie per series, model info, quantile levels, aseri's licence, errata;
  - `series/{id}/latest.json`;
  - `series/{id}/forecasts.json`: the index;
  - `series/{id}/forecasts/{reference_date}.json`: immutable;
  - `series/{id}/replay.json`: the forecasts of the last 120 days, for the replay slider, at seven levels: the page's five and the 5% and 95% a possible path reaches before the chart's frame, written as the page writes values;
  - `series/{id}/actuals.json`;
  - `series/{id}/scores.json`;
  - `scores.json`;
  - `bulk/forecasts-{YYYY}.parquet` and `.csv.gz`, `bulk/time-series.parquet` and `bulk/time-series-{source}.csv`, `bulk/oracle-output.csv`, `bulk/scores.parquet`, `bulk/datapackage.json` (#136), written by `pipeline/aseri/bulk.py`:
    - the forecasts of each year's runs in the collected-hub shape, `model_id` then the round's columns, every model's told apart; the current year is rebuilt daily, and a closed year's rounds never change, so its files come out byte for byte the same, as the dated files do;
    - the archive's observation deltas as a Hubverse time series, in one Parquet file and one CSV per source, so that each CSV has one licence;
    - the oracle output, each observed day's value as the record scores against it, from the vintages, and every model's scores, one row per step on the round's `target_end_date`, with the day observed (`observation_date`, Brent's next price after an unforeseen holiday) and its `observation_as_of`;
    - a Frictionless data package (v2) giving each file's columns, licences with their attribution (for the forecasts and scores, one per model of their rows, so a closed year's never changes), and sources, which the catalog links as `links.bulk`;
    - a failure of the bulk step costs only them: the run summary says so, the catalog leaves out its link, and the day is still archived and published;
  - `openapi.json`, `schemas/*.schema.json`, `licenses/*.txt` and `model-metadata/aseri-timestral209m.yml`, the Hubverse model metadata (#135).

  A human docs page at `/api/` carries a schema.org `Dataset` block: `web/api/index.html`, a second page of the Vite build on the site's tokens and fonts, with no script, and under the copy lint (#135). The page's footer links to it.
- **Provenance in every forecast file:**
  - model ID, weights revision and package commit;
  - `reference_date`, `forecast_date`, `generated_at`;
  - code version (git SHA);
  - `forecast_mode`;
  - input `as_of` per source.
- **The contract (#135):**
  - OpenAPI 3.1.1 plus JSON Schemas (Draft 2020-12), kept in `api/` at the repo root as the source of truth (`api/openapi.json`, `api/schemas/`), with the licence texts and the model metadata; the daily run copies them into the site's `api/v1/`;
  - a gate, `python -m aseri.gate` (`pipeline/aseri/gate.py`), runs in `daily.yml` after the run writes the site and before the archive and the deploy. It fails the run when a file is off its schema (closed to undeclared keys, with dates and URIs checked), when the files disagree with each other or with the catalog, or when a step's `target_end_date` is not the reference date plus its horizon (calendar days, or trading days for Brent). Of the dated files it reads only the day's: the others never change. The bulk files are checked against their data package: each file it lists is published, each one published is listed, with the columns it lists, and the Parquet files with its types;
  - the bounds are one series' problem, not the API's: the daily run checks each new forecast against its series' last 365 days before archiving it, and a median or an 8 in 10 band far off holds that series alone, as a failed download does. Its last good files stay up with a note, its data is archived, `bounds-alert` opens an issue, and the other series publish. A large change from the forecast before only warns. The bounds are calibrated on the 120-day backfill (`public-api.md` 3.5);
  - dated forecast files stay byte-identical across reruns, which a test checks;
  - `v1` only changes in additive ways, and anything breaking goes to `v2`. `schema_version` stays `1.0.0` within v1, since the dated files carry it and never change;
  - corrections go to `errata` in `series.json` (date, series, reference date, description), empty so far; the original forecast stays published.
- **Licences:** each resource carries its own licence and attribution: the catalog per series, with `text`, the path of the full licence under `/api/v1/licenses/`. The bulk time-series CSVs are split by source so that each file has one licence; the files that hold every source (`time-series.parquet`, `oracle-output.csv`) list every source's terms, and the forecasts and scores carry aseri's. An `attribution` string is never edited, since the dated files carry it.
- **aseri's own licences (owner's choice):**
  - forecasts, scores and the API: **CC BY-NC 4.0**, attributed as "Forecasts: aseri (model aseri-timestral209m, Timestral-209M by Mistral AI)", with a note that upstream terms still apply to the underlying data;
  - code: **MIT**, in `LICENSE` at the root.

  The Hubverse model-metadata licence lists (the example hubs, FluSight, the CDC COVID-19 hub, checked 2026-10-31) have no CC BY-NC 4.0 value, nor an `other` one: the model metadata says `other` as asked and states the licence in `methods_long`.

### 6.7 Storage and repository rules

1. **`master` holds code, schemas and docs only.** The site and API are never committed: they are a Pages artifact built on each run.
2. **An `archive` orphan branch is append-only.** Each run adds one Hubverse round CSV, one observation-delta CSV and one manifest. No file is ever rewritten, and CI enforces this.
   - About 25 KB a day, about 9 MB a year (14 MB at the maximum), measured on real quantiles.
   - The build checks it out shallow.
3. **Never commit upstream raw downloads.** The alerts CSV alone is 9 MB and rewritten daily.
4. **A size alarm:** CI checks `git count-objects` on `archive` against a budget **(my call: 50 MB)**.
5. **The site** grows about 35 MB a year, against the 1 GB limit: about 28 years. Measured on the archive of 2026-11-02 (#136), scaled to a year of daily runs, 54,600 steps of 21 levels:
   - the dated JSON files, 5.6 KB each with their provenance and about 3,170 a year: about 18 MB, more than the 12 MB first estimated;
   - the year's bulk forecasts, 4.5 bytes a row in Parquet (zstd, level 9) and 7 in CSV.gz, 1.15 million rows: about 5 and 8 MB, under the 7 and 10 estimated;
   - the files rewritten whole: the scores, about 3.4 MB more a year, and the time series, the oracle output and the indexes, under 1 MB;
   - a new model ID adds its replay window once, about 4.4 MB of bulk forecasts.

   **If it is ever needed, drop the dated JSON files of closed years and keep the yearly bulk files,** which hold every forecast at every level, of every model:
   - when: the Pages artifact passes 500 MB, half the limit;
   - how: removing files is not additive, so it ships as `/api/v2/`, beside v1 for 6 months (6.6). v2 publishes the dated files of the current year and the replay window only; its `forecasts.json` still lists every forecast, and gives a closed year's the bulk file that holds it. The page moves to v2, then v1 goes;
   - what it saves: about 18 MB a year, so the site then grows about 17 MB a year.
6. **The throwaway prototypes** moved to the [`prototypes`](https://github.com/exdsgift/aseri/tree/prototypes) branch once the real code covered them (#141) **(my call)**, so that `master` stays clean.

### 6.8 Website: structure and behaviour

The reference is the prototype [`forecast-chart/index.html`](https://github.com/exdsgift/aseri/blob/prototypes/forecast-chart/index.html) on the `prototypes` branch, in the "statement" style of about.dos-age.com: one idea per screen. Rewrite it properly; do not port it. Since #150 the whole site is white on electric blue (6.9).

Since #152 the page says each thing once, on the mark it is about, after the prototype the owner chose on 2026-11-02: [`prototypes/less-text/index.html`](https://github.com/exdsgift/aseri/blob/prototype-less-text/prototypes/less-text/index.html) on the `prototype-less-text` branch, with its README, combination `#A-none-still-none` (stats wording A, no label on the path, the panel opening still on path 1, no replay verdict squares). The evidence is [Comunicare le previsioni con meno testo](../../research/reports/Comunicare%20le%20previsioni%20con%20meno%20testo.md), changes 1, 3, 4, 5, 8, 9, 11 and 12. Every block leads with a takeaway computed from the data (`web/src/lib/takeaways.ts`), never written by hand.

Since #154 every word casts a 1 px drop shadow and op-art stripes fill the margins (6.9), after the prototype the owner chose on 2026-11-02: [`prototypes/text-and-margins/index.html`](https://github.com/exdsgift/aseri/blob/prototype-text-and-margins/prototypes/text-and-margins/index.html) on the `prototype-text-and-margins` branch, with its README, combination `#drop-opart`. The footer's link marks follow [`prototypes/link-icons/index.html`](https://github.com/exdsgift/aseri/blob/prototype-link-icons/prototypes/link-icons/index.html) on the `prototype-link-icons` branch, combination footer, bare, 32 px.

**Two layers.** The default view holds the hero, the panel's title, chart, Play and replay, the cards and the record's verdict. Method, numbers and sources are one labelled tap away each: "About this data", "How to read this", "Show the numbers", "How we score" and "Sources", never "More". Each is a button that says whether it is open (`aria-expanded`) and the part it shows or hides (`Disclosure`). A number that qualifies a word stays inline. A test counts the default view's words (`web/src/words.test.tsx`): under 300 with the prototype's four series from the fixtures (GPR, Suez, Hormuz, Bab el-Mandeb), and at most 30 more for each further series, so all nine stay under 450 (275 and 411 at #152, from 1,271 before).

1. **Hero:** three studies of the `prototype-hero-studies` branch take turns behind the text (#150, owner's choice), its layout and padding unchanged. Each stands beside the text when its margin has room (from about 1,050 px), else small in the 224 px band above the wordmark; never under the text, never past the hero's width, and on the left, clear of the side navigation:
   - **Messenger** (study A, #148): Hendrick Goltzius's engraved *Mercury* in his niche, a disc of radial ticks behind him, and a fan of fine rays from each of his winged hat, caduceus, hand, elbow and winged ankle;
   - **Signal** (study B): Goltzius's *Farnese Hercules* from behind on a failing screen (phosphor smear, every third line dark, noise, a band slipping now and then), light leaking in from above, and two labelled selection frames on his back (`selection` in `web/src/lib/signal.ts`): the small dotted one the baseline, the large dashed one the 7-day average, as many times as wide as the value is the baseline, up to 4 times, moved only as far as keeps it and its label inside the hero (`placed`). On a phone only his torso shows. The study's cloud and spectators are left out: the side navigation holds the right margin;
   - **Vortex** (study C): the head of the *Apollo Belvedere* at the eye of an op-art vortex of stripes and checker squares, a ring at 2.2 times the head with a tick every 10 points, longer on the quarters and longest, labelled, at the baseline 100, and a solid arm turning one degree per point of the 7-day average from the top of the head out to the ring (`armDegrees`, `armPoints` in `web/src/lib/vortex.ts`), labelled at its end, up to 400. The stripes inside the ring twist with it;
   - **the turns** (`web/src/lib/heroes.ts`): each page load shows the next hero in that order, its index kept in `localStorage`; where storage is refused, a random one. A small control at the foot of the page picks Messenger, Signal, Vortex or Rotate (the default), remembered per reader; a picked hero arrives afresh. Only the shown hero's engraving loads;
   - the wordmark 焦り, with "あせり · aseri" under it;
   - the kicker "Geopolitical risk";
   - the GPR 7-day average as a giant number;
   - like with like (#152): "{x}% above normal · 7-day average to {Mon DD}", then the 4-week forecast for the same weekday as the last data, compared with that weekday (owner's choice): "{Mon DD}: likely {lo}-{hi} (8 in 10), {direction}", "Nov 23: likely 110-260 (8 in 10), about where it is now". The direction reads off the forecast's levels the chances that the target day lands strictly above and strictly below the like-for-like value, the last daily value (for GPR the same weekday), a tie with it counting in neither (`chances`): 0.65 or more above, "likely higher than now"; 0.65 or more below, "likely lower than now"; else "about where it is now", so a count forecast half on today's value and half higher leans no way (`direction`, a design choice of the study, not a sourced rule). GPR has a strong weekday cycle, so a single day must never be compared with a day on a different weekday or with the 7-day average;
   - a range bar under it, on one value scale: the target day's range in the bands' dither, its middle half denser, a solid tick at normal with "normal 100", and a pixel marker on the like-for-like day, "last Monday 165", the range's ends under it as the sentence above rounds them ("110" and "260" under the model's 111-251), or one centred "150-160" where the range is too narrow for two;
   - "About this data", one tap away: the weekly cycle, what the big number averages and what the outlook compares, normal, and the data's "as of", preliminary for about 4 weeks.

   Messenger's rays encode GPR's 7-day average against its baseline, on a scale that starts full (`fan` in `web/src/lib/messenger.ts`): at the baseline and under it, 19 rays over 40 degrees, fuller than the study's fans at 181 (owner: a richer scale); each further baseline opens a fan 13 degrees, up to a cap at 4 times the baseline. The rays keep fixed slots 40/18 degrees apart, each with its own length, so an opening fan gains rays only at its edges and none ever jumps while the number counts up: 181 holds 23 rays over 48.9 degrees, 300 holds 29 over 62.2, denser than the study's 27 over 66, the cap 35 over 75.6. Two dashed rays in each fan mark the baseline, at the full fan's edges. With every hero the text sits on a calm area: the ground at 91% over the text column and a margin, dissolving in a 48 px dither, so the words read over the art everywhere. The art's labels stay clear of that edge.
2. **The forecast panel,** a game-sheet frame:
   - its takeaway as the title: "Likely 110-260 by Nov 23, about where it is now" for today's forecast, its direction the hero's; in a replay "Backtest made Aug 27: likely 90-230 by Sep 24", or "Forecast made" for a live one. Under it "{series} · {unit}", and in a replay "· what happened as of {date}". The panel's landmark is named by the series, then the title. A stale series adds "data to {date}, stale since {date}" as a caution, and the catalog's note shows as "Note: …";
   - the pixel chart (6.9), labelled on its marks, opening still on the most likely of the model's 20 paths;
   - under it, Play or Pause, "Next path" and "Path N of 20" ("the most likely" on the first). One path at a time, in order, never several: overlapping paths read as nothing. No legend and no paragraph: the chart's direct labels say it;
   - the replay slider, in the look of Timestral's: a solid track with a solid tick a week, a square handle with a vertical bar, and the day beside the handle ("Today" on today's), on the side with room. 120 days, ←/→ for one day, T for today, "Back to today". The keys show only while the slider is hovered or has the focus;
   - "How to read this": the band ("The shaded range is where 8 in 10 days should land; 2 in 10 land outside. It is not a high and a low."), its middle half ("The darker core: half the days land there."), the paths, the weekly cycle where the catalog says the series follows the week, normal, and what happened in a replay;
   - "Show the numbers": that day's value, then a row per interval step, "Nov 02 (7 days): likely 119-243 · middle half 143-207 · middle estimate 173", with "· what happened 36, outside" once known, then the 1-year range of the daily value. The intervals block's lanes are folded into the chart (study change 11);
   - "Sources": the attribution, "Data as of {date}" (for GPR "preliminary for about 4 weeks") and, for a backtest, how it was made.
3. **Signals:** nine cards in three groups: "Risk, attention and oil", "Sea lanes", "War in Ukraine". Over them the takeaway, the signal furthest from normal against the others of its kind ("Strait of Hormuz 88% below normal; other lanes within 20%"; "All signals within 15% of normal" when none is 25% off), and "Tap a card to open its forecast." Each card shows:
   - an icon and a name, and its key hint `[n]` only while hovered or focused;
   - the 7-day average and its unit, "41 ships a day · 7-day avg" (a parenthesis in the unit is left to the panel);
   - a chip, a pixel arrow and the change from normal: "▼ 88% below normal", or "at normal" with no arrow where it rounds to 0%;
   - a mini pixel chart with its forecast band and a solid normal line, or, for a normal far off its scale, a marker at the edge with its value ("▲ normal 27" on Hormuz);
   - one day's range: "Nov 22: likely 33-51 a day", "Nov 16: likely 102-146 a barrel" for Brent.

   Selecting a card (or pressing 1 to 9) opens that series in the panel with a dither transition. The hero stays on GPR. A frame after the new panel has rendered, the page brings its top to the top of the screen, smoothly or at once under reduced motion, its scroll margin counting the safe-area inset, and the focus moves to its heading with no second jump; the replay arriving later scrolls nothing, and puts the focus back on the heading it draws anew only if the focus was in the panel. Scroll anchoring is off from the pick until the page settles (at `scrollend`, or 300 ms after the last scroll), and only then: keeping a tapped card still while the panel above it changed height, it cut that scroll short on a phone, and on again it keeps the cards still when a replay arrives while the reader is down among them (#154).
4. **The record:** its verdict as the title, "Backtest: 56 of 72 forecasts landed in range, close to the 8 in 10 promised" ("close to" while the share stays within two standard errors of 8 in 10). Backtest and live never add up: the title counts the live series once any has its 30, the backtests while none has, and a backtest beside live records says so. One banner while any series collects: "Live record starts after 30 forecasts (0 so far). Until then, backtests made after the fact.", its count the fewest live forecasts any collecting series has resolved 7 days ahead (`n` in `scores.json`). The key once: "■ landed in range □ missed · About 2 in 10 squares should be hollow if the range is honest." Then the squares of 6.4 for each series, with "6 of 8 in range"; while it collects, the live squares already resolved follow the backtest's after the one word "live", openable, with no count of their own. "How we score", one tap away, holds per series and bucket "79% landed in range · aim 80%" on a ten-block bar with a tick after the 8th, and the misses in plain words against the series' own simple rule, named from its `primary_baseline`: "23% smaller misses than a simple 4-week average", "About as good as just repeating the last value", "5% bigger misses than the same weekday a week back", the 95% ranges in brackets.
5. **Side navigation** on wide screens: icon plus two-line label, scroll-spy (`SideNav`). Inactive at 82% opacity, the lowest at which its label still reads at 4.5:1 on the blue ground (`contrast.test.ts`; the first spec's 30% fell far under); the lit one whole, with a 2 px bar on its outer edge, so it never rests on a shade alone. Down the right edge on the ground, from 1344 px, where the gutter beside the 1040 px sections holds it: the hero's art stands on the left. R jumps to the record on any screen, as its link does: the address says `#record`, and the focus moves to the record, so the next Tab goes on from there.
6. **The foot of the page:** a thin rule, then "aseri", "© 2026 Gabriele Durante", a centred row of three link marks (6.9) opening the owner's profiles in a new tab, "GitHub" (https://github.com/exdsgift), "LinkedIn" (https://www.linkedin.com/in/gabrieledurante/) and "Buy me a coffee" (https://buymeacoffee.com/exdsgift), "Code: MIT" (the repository's `LICENSE`) and "Forecasts and data: CC BY-NC 4.0", the source repository, the choice of hero, and each engraving's credit with its source and CC0, from the prototype's README: "Messenger: Hendrick Goltzius after Polidoro da Caravaggio, Mercury, probably 1592, National Gallery of Art", "Signal: Hendrick Goltzius, The Farnese Hercules, c. 1592, published 1617, The Metropolitan Museum of Art", "Vortex: Apollo Belvedere (Apollo Pythius), engraving, Rijksmuseum", each linked to its Wikimedia Commons page.

**Behaviour:**
- **The first frame is readable at rest.** Then the load sequence runs: the wordmark dithers in, the number counts up, the chart scans in from left to right. With the count-up, over 1.1 s, the hero's art follows the number step for step (`counted` and `easeOut` in `web/src/lib/motion.ts`): Messenger's disc draws in and his fans grow and open; Signal's screen comes on, a line opening into the picture that warms up through three noisier ones, 600 ms each, and the value's frame grows with its label; Vortex's ticks sweep round as its arm and stripes wind up to the value. The charts, the panel's and the cards' alike, scan in on the count-up's steps the first time each comes into view, if only in part, so the cards under the fold scan as they arrive: their marks appear from the left in 16 steps of 40 ms, fast and then a pixel column at a time into the right end, whole after 640 ms. The frame, the hatch, the origin and the labels are there from the first frame. The chart is painted once, whole and as its frame alone, and each step only reveals more of the whole. A series scans in once a page load in each view: a path turning, a replay step, a resize, or the panel mounted again for the same series (its replay arriving, a square of the record) draws it whole.
- **Rhythm:** every section leaves 80 px under it on a phone and 128 px from 768 px, the hero included, so the panel stands clear of the hero's last button while the hero still fills the first screen (#154).
- **Ambient motion,** slow, as in the studies:
  - the op-art margins' bends travel down the current, a wave in about 30 s;
  - Messenger's disc turns, about once in 10 minutes, and each ray sways by 0.3 degrees, out of step with the others (about 14 s a cycle);
  - Signal's screen flickers among three settled pictures, a new one every 600 ms, and now and then a band of a picture slips sideways for as long as it shows (`screenAt`): the screen changes under twice a second, inside the 3 flashes a second of WCAG 2.3.1. Its value frame's dashes march, and the light sweeps by a degree or so about once a minute;
  - Vortex's stripes outside the ring turn about once in 15 minutes and their grain shifts;
  - once asked, the panel draws the next possible path every 1.2 s.

  Every hero's art (`HeroArt`, one canvas the size of the hero) draws about 30 frames a second while it arrives (1.1 s), then a frame every 200 ms: the slow motion after it is a fraction of a pixel a frame. It and the paths stop while the tab is hidden or they are off screen (`tickWhileShown`). The margins (`Margins`) lie in the page and scroll with it, so a scroll draws nothing; every 200 ms they move the drift on, a whole row at a time (under 1 ms at 1440 px), and they too stop while the tab is hidden or they are off screen.
- **UI transitions** take 160 ms. Panel changes use the 8-step Bayer dither (30 ms per step).
- **`prefers-reduced-motion`** turns all of it off: the op-art margins still and whole, the hero's art still and whole (Messenger's disc, figure and fans at their full width; Signal's settled screen and both frames; Vortex's arm at the value), no count-up, no scan, no dither transitions, and the paths step only on "Next path".
- **Data loading (my call):** first load fetches `series.json`, `scores.json`, every `latest.json` and `actuals.json` and GPR's replay data. Other series' replay data loads on selection. Budget: under 150 KB gzipped of JS and CSS, under 100 KB gzipped of initial data, checked by `web/scripts/budget.js`: in CI on the fixtures, failing the build; in the daily run on the day's real data, as a warning only, since a heavier day must not take the site down.
- **Accessibility:**
  - every control is a real button or input, with a visible focus (2 px white outline);
  - the canvas charts have text equivalents (the panel's chart its own label, with the range, what it counts and the path shown; a card's chart the card's words; "Show the numbers" in real text);
  - the disclosures are buttons with `aria-expanded` and `aria-controls`, in the tab order;
  - the keyboard shortcuts never fire while an input is focused;
  - Play, Next path, the disclosures, the hero picker, the link marks and the replay's handle are 44 x 44 px touch targets at least, drawn as before (#154): the buttons grow their hit area round the same drawing (`hit`), the link marks are 32 px with 6 px round them, and the handle is drawn as the same 20 px square in a 44 px target; a sideways drag moves it, a swipe up or down still scrolls the page. The footer's links in the text are 24 px targets (WCAG 2.5.8), by padding that moves no line. No two hit areas overlap: wrapped rows of buttons and the lines of links are set apart for it. The record's 24 px squares stay as they are;
  - on an iPhone: `viewport-fit=cover`, with the safe-area insets kept clear, so nothing sits under the notch or the home indicator: the side insets as the page's padding, the top one inside the hero's first screen, the bottom one under the footer; the hero fills exactly the first screen by `svh`; no horizontal scroll down to 320 px; no text inflation and no grey tap highlight (Tailwind's preflight). Checked in Playwright's WebKit on an iPhone 15 and an iPhone SE.

### 6.9 Design system

- **Tokens:** white on electric blue, dark only, option 1 of the colour study `docs/research/reports/Bianchi su blu elettrico.md` (#150, owner's choice). Every tint but one sits on the line from the ground to white, red equal to green; the one accent is the blue's complement, gold.
  - ground `#1b1bf2` (`--background`), frame `#5454f5` (`--border`, decoration only), row `#1818d6` (`--muted`) and picked `#1616c3` (`--accent`), both darker than the ground;
  - white `#ffffff` for titles, body text and every number (`--primary`, `--foreground`), the daily values, the focus ring, the hero's art, what happened and a hovered control (`--white`), and caution (`--destructive`), always with its marker;
  - the second and last text tint `#dbdbfd` (`--secondary`, `--muted-foreground`: the wordmark's reading, labels and key hints, the origin and the baseline, the controls' blocks);
  - the chart's dim marks `#adadfa` (`--dim`: the 7-day average, the bands, the hero bar's range and the slider's weeks ahead);
  - the one accent, gold `#ffc94a` (`--forecast`): the model's path. A mark colour, never text;
  - the text's shadow, `--drop`: `1px 1px 0 #000000`, a retro game's, black, 1 px down and right, never blurred and with no stroke round the letters, for a touch more contrast on the blue (#154). One rule in `index.css` sets it on every element, as browsers clear it on buttons, so every word casts it: the chart's labels, the buttons and the dark words on the pale controls too; the count-up's hidden number casts none, only the count. It adds to the contrast checks below and replaces none of them; the palette check leaves it out, a shadow and not a tint.

  Map them to shadcn variables with `--radius: 0`. Beyond the two text tints, levels are carried by size, case, mark shape and dither density.
- **States read without colour,** by shape and words (#148):
  - in range and missed: the record's squares are filled or hollow, and the words say it ("landed in range", "missed", "6 of 8 in range", "23% smaller misses"). A hover only outlines a square, so a hollow one never fills;
  - above and below normal: a pixel arrow beside the words ("▼ 88% below normal");
  - picked: the card's darker surface, and an inner frame 2 px inside its border; a hover only lightens the border;
  - caution and stale: the `caution` utility, a "!" before the words in white, the marker kept out of the spoken text: a site not updated for 2 days, a stale series, a failed load.
- **Contrast,** checked by `web/src/contrast.test.ts` from the tokens in `index.css`, as the study's test section asks:
  - text at 4.5:1 on every surface it sits on: the page, an interval row, a picked card;
  - chart and lane marks at 3:1 on the page, a picked card and a row. The frame's hatch and grid lines are exempt: the forecast zone's name and the value ticks say the same in text;
  - APCA beside WCAG, on all three surfaces: Lc 90 for white, 70 for the second tint, 60 for the gold, 45 for the dim;
  - the text levels apart: white and the second tint by Lc 15 and 5 just-noticeable differences (OKLab 0.10), the second tint and the dim by Lc 15;
  - the palette: every token on the line from the ground to white, or the one gold accent;
  - the gold path and the white real values under simulated protanopia, deuteranopia and tritanopia (Machado 2009): at least 0.15 apart in OKLab, both at 3:1 on the ground;
  - white at 3:1 over the 5-in-10 band's dither, averaged in linear light;
  - no check between marks that meet: they differ by shade, and no state rests on a shade alone.
- **Fonts, all OFL and self-hosted:**
  - DotGothic16 for the wordmark;
  - Jacquard 24 for the giant numbers and section titles;
  - Press Start 2P for all UI text, at whole-pixel sizes (8, 12, 16, 24).

  Use ASCII "-" for negative numbers, because Press Start 2P has no U+2212. The original dos-age fonts have no licence and must not be used.
- **Charts are custom canvas components,** not Recharts.
  - Draw at 2 CSS px per art pixel with `image-rendering: pixelated`, and Bresenham lines.
  - Daily values: a white line 2 art pixels heavy, the history's main mark, with a 3x3 square on the last one, where the forecast starts.
  - The 7-day average: a dim line that stops at the origin.
  - The forecast side: the most likely of the model's paths, a gold line 1 art pixel wide from the last daily value, apart from the real values' white by tint and weight, with no label at its end, on the panel and on the cards' mini charts alike; the bands keep theirs. Played, the panel draws the others in its place.
  - What happened after a replayed forecast was made: the daily values' line carried on from the origin through every known day, white and 2 art pixels heavy, so the replay compares line with line, the real one against the gold path (owner's choice: the replay is there to see how closely the forecast sticks to what happened, and dots did not show it). A day with no value breaks it, and a known day alone between two gaps is a dot, 2 art pixels wide when the days are 3 art pixels apart or more. Its last known day is a hollow 3x3 ring in white, whose middle no mark lights, apart by shape from the path's unmarked end and from the daily values' filled square at the origin. No ring where it would touch that square, as on a phone with one day known: the two would read as one blot over the line between them. The legend's swatch is the line ending on the ring.
  - Bands: 4x4 Bayer dither (50% inner for 5 in 10, 25% outer for 8 in 10) in the dim with solid edges, cleared 1 art pixel round every line and mark, so each keeps an edge of the ground: over the 50% band the gold path would average 2.2:1 (`chart.test.ts` checks the painted pixels).
  - No dashed or dotted line anywhere (owner's rule, #152). The forecast zone: diagonal hatch. The origin: a solid line in the second tint. The value ticks: short solid ticks left of the plot, with no grid across it. The normal: a solid line in the second tint, end to end. The hatch and the origin keep an art pixel of the ground round every mark, as the bands do.
  - Labels are real text over the canvas, each on its mark instead of a legend: "daily" and "7-day avg" at the lines' ends, "normal 100" on its line, "data to Oct 26" over the origin, the first and last dates, the range's end values at the right, and in a replay "what happened" on the spot of the forecast side nearest its ring that keeps clear of the white line, which weighs ten times the other lines. The band says once, on itself, what it counts: "8 in 10 days land here" inside it and "↕ 2 in 10 outside" at its edge, in the first wording that fits the forecast side, on one line or broken over two or three. Each direct label takes the first of its spots that stays in its side of the chart and clear of the labels before it, covering as few points of the lines as it can (`placeLabels`); the forecast side's are placed against the most likely path, so they hold still while the others play.
  - The scale fits every daily value shown, so the main line is never clipped. The panel's also fits the published levels nearest 5% and 95%, and holds still as the paths turn. A path past them, about a day in ten, runs along the frame: fitting q0.01 to q0.99 squashed Hormuz's 0 to 8 ships into a fifth of the chart. The normal joins the scale when it widens the data's span by half at most (Brent's 90 under prices of 97 to 153); further off, the chart leaves it out and marks it at the edge it lies past with its value, "▲ normal 27" on Hormuz's (`fitsNormal`).
  - The history keeps its length: 4 weeks on a phone, 8 on a desktop.
- **Copy** that prevents the known misreadings (a range read as a high and a low, a median read as a promise), checked by a text lint in `web/src/App.test.tsx`:
  - the band is defined once, on the band, with its complement: "8 in 10 days land here", "2 in 10 outside". Headlines say "likely 110-260 (8 in 10)", rounded outward so the shown range always holds the model's and never collapses, to the largest step of 1, 2 or 5 times a power of ten within a tenth of the range's width, never under whole units (`outward`: GPR's 110.8-251.0 is 110-260, Brent's 102.3-145.1 is 102-146); everywhere else "likely 33-51", with exact values. No "5 in 10" and no median in the default view: "middle half" and "middle estimate" live in the tap readout and "Show the numbers", each after its range. No median stands alone anywhere, a social preview included;
  - five terms, the same everywhere: range, middle estimate, what happened, normal, today. "Today" only for today; one date anchor ("data to Oct 26" on the chart, "Nov 23 (28 days)" in the rows); one "as of" per block;
  - in "How to read this", what the line ahead is ("one of 20 possible paths drawn from the forecast … No one knows which days turn out high") and what the band is not ("It is not a high and a low"); for the series that follow the week, that a day compares with the same weekday;
  - "data as of {date}", from each `actuals.json`'s `as_of`, in "Sources" and "About this data"; for GPR, "preliminary for about 4 weeks";
  - never "will", never "% confidence" and never an em dash;
  - when the catalog's `generated_at` is more than 2 days old, the hero says "Site last updated {date}: the daily update may have stopped", computed in the browser.
- **Other primitives:**
  - the hero's art is one canvas the size of the hero (`HeroArt`, with `Messenger`, `Signal` and `Vortex` laying out and drawing each), in the tokens' white, dim and ground. Each engraving ships as its own file, loaded only for the hero shown, and is never drawn past its own size:
    - `web/src/assets/mercury.png`: the study's crop box-averaged to 360 x 760, 4x4 Bayer dithered between 28% and 82% luminance and cut to its niche (38 KB, three colours), dithered again at any smaller size;
    - `web/src/assets/hercules.png`: the study's figure crop box-averaged to 360 x 641 in 8 greys (69 KB), which the failing screen smears and dithers;
    - `web/src/assets/apollo.png`: the study's head crop box-averaged to a 208 px disc, dithered between 30% and 85% (6 KB, three colours), dithered again at any smaller size;
  - the op-art margins (#154, `Margins`, with `stripes` in `web/src/lib/margins.ts`): a canvas down each side of the page, in the page, at 2 CSS px an art pixel whatever the screen's density, from the hero's foot to the page's end, so the stripes scroll with the page as smoothly as it does. The layout is read only when it changes. Vortex's stripes as a current, 10 art pixels apart, in the frame ink alone, never gold, bending by up to 8 art pixels the nearer the page edge and thinning out to nothing at a 24 px calm gap beside the widest column, the signals' and the record's 1008 px, all down the page, so the current never steps in or out beside the 720 px panel. The drift moves them up a whole row for each 36th of a radian, so a step moves the picture and works out again only the rows that are not their neighbour's. They start below the hero, whose own art keeps its margins, thinning in from its foot over the margin's width, 192 px at most. A fixed halo of the ground keeps them 24 px clear of the side navigation, over the stripes and under the page's content; the layer is never the scroll anchor. On a phone (under 600 px) they are finer, 4 art pixels apart, fill the 16 px gutters and swell into the gaps between the sections, an arc a quarter of the screen in at most and 16 px clear of them; from 600 px until the margins outgrow the gap there are none;
  - the icons are 8x12 pictograms knocked out of a solid block; the footer's link marks are the prototype's 16x16 pixel maps (`Mark`), white at 2 px a pixel with the text's shadow, gold on hover and focus;
  - frames are 2 px with chipped corners;
  - buttons are flat blocks with two-line labels that turn white on hover; a disclosure's button stays white while open, with "+" or "-" after its label, kept out of its name.
- **shadcn components** for the rest: Button, Card, Slider, Tabs or ToggleGroup where useful, Tooltip.
  - Add them with the shadcn CLI.
  - Restyle them through tokens, and turn off its fade and slide animations in favour of the dither.

### 6.10 Code and repository layout

- **Rules:**
  - lean and clean;
  - small single-purpose modules and components;
  - no dead code, no speculative options;
  - names from the domain (series, forecast, reference date, interval);
  - comments only for the "why".
- **Tests:** pytest for every transform, the scoring maths (WIS, coverage, MASE, against hand-computed cases), the Hubverse writers and the archive append-only rule. Unit tests on the frontend for the formatting and scale maths.
- **Tooling:**
  - Python 3.12 with `uv`, `ruff`, `pytest`;
  - TypeScript strict, ESLint, Prettier.
- **Proposed layout (my call):**

```
pipeline/                 Python project (uv)
  aseri/sources/          one adapter per source (fetch + validate)
  aseri/series.py         the registry of the nine series (6.1 table as data)
  aseri/forecast.py       Timestral wrapper (pinned model, quantile selection, clamping)
  aseri/archive.py        Hubverse round files, manifests, append-only writes
  aseri/score.py          coverage, WIS, MASE, baselines
  aseri/publish.py        API files + page data
  aseri/gate.py           the pre-publish gate: schemas, agreement, bounds
  aseri/scout.py          covariate scout (6.5)
  tests/
web/                      Vite + React + TypeScript + Tailwind + shadcn (static build)
  src/components/ui/      shadcn components
  src/components/         HeroArt, Messenger, Signal, Vortex, Wordmark, ForecastPanel, PixelForecastChart, ReplaySlider, Intervals, SignalCard, Record, Footer
  src/lib/                api client, formatting, dither and scale helpers, each hero's encoding, the turns
api/                      openapi.json + schemas (source of truth)
.github/workflows/        daily.yml, ci.yml, scout.yml
docs/                     research, specs
```

## 7. Calls I made that the owner has not confirmed

1. **The UI copy is in English.**
2. **Brent is forecast on trading days,** with calendar dates on the page.
3. **The "vs" baseline** for non-GPR series is the mean of the last 365 days.
4. **The cron runs at 07:00 UTC.**
5. **There is a leaderboard-style accuracy table** in the record section.
6. **The covariate scout runs monthly** and opens a proposal for human approval.
7. **The frontend is Vite + React + TypeScript** with shadcn, not Next.js. A static app needs no server framework.
8. **The page-weight budgets:** under 150 KB of JS and CSS, under 100 KB of initial data, both gzipped.
9. **The archive size alarm** is set at 50 MB.
10. **The prototypes move to a `prototypes` branch** after the build.
11. **The repository layout** in 6.10.
12. **The public series IDs** come from `public-api.md` (`gpr_daily`, `suez_transits` and so on).
13. **Batched data:** one forecast for each new date, with only the newest one live.
14. **The live record** appears after 30 resolved forecasts per series. Until then the page shows a labelled, separate backtest.
15. **Horizons of 30 days become 28,** so that every horizon is a whole number of weeks. This extends the owner's same-weekday choice for the hero sentence to the whole page.

## 8. Left to the builder

- **Exact component and module boundaries** inside the layout above.
- **How to implement WIS:** reuse Hubverse tooling or write it with tests.
- **The format of the observation-delta files** for revisions, and the errata format.
- **The CI details:** caching, concurrency, retries.
- **The 60-day pause.** GitHub pauses scheduled workflows in public repositories after 60 days without activity, which it does not define; pushes to the non-default `archive` branch likely do not count. No keepalive: the best-known keepalive action was disabled by GitHub for a terms violation (checked 2026-10-30). Instead the page itself says when the site has not been updated for more than 2 days (#143), so a paused schedule can never pass for current data.
- **Rounding of published values:** keep enough digits for scoring.
- **The texts** of the API docs page and README.

## 9. Later, not in v1

- **UCDP monthly fatalities,** with a 6-month horizon. The owner wants casualty data eventually, never from ACLED.
- **Retest Lunar New Year** for Taiwan after the 2027 holiday (through the scout).
- **Testing Brent, drones and "World War III" as forecast targets** in the backtest, which only the replay window has covered so far.
- **A custom domain.**

## 10. References

- **Research:**
  - `docs/research/timestral-model.md`
  - `docs/research/data-sources.md`
  - `docs/research/prior-art-and-gaps.md`
  - `docs/research/forecast-horizons.md`
  - `docs/research/spike-timestral-backtest.md`
  - `docs/research/spike-covariates.md`
  - `docs/research/public-api.md`
  - `docs/research/design-dos-age.md`
- **Prototypes**, on the [`prototypes`](https://github.com/exdsgift/aseri/tree/prototypes) branch:
  - [`forecast-chart/`](https://github.com/exdsgift/aseri/tree/prototypes/forecast-chart): the reference page, with `build/forecasts.py` showing how to run Timestral over replay origins;
  - [`style-variants/`](https://github.com/exdsgift/aseri/tree/prototypes/style-variants): the style exploration;
  - [`timestral-backtest/`](https://github.com/exdsgift/aseri/tree/prototypes/timestral-backtest) and [`timestral-covariates/`](https://github.com/exdsgift/aseri/tree/prototypes/timestral-covariates): the spikes.
