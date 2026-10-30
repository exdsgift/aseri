# aseri: design

Status: draft for review, 2026-10-29. Owner: exdsgift. Repository: `exdsgift/aseri` (reset to an empty `master` on 2026-10-29).

Every decision below was either made by the owner during brainstorming or is marked **(my call)**: a sensible default the owner has not confirmed. Section 7 lists the calls. Evidence lives in `docs/research/`, and the visual reference is the working prototype in `prototypes/forecast-chart/` (published as https://claude.ai/artifact/TkkbS85exVYBRZ1fDALZKb).

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
| `gpr_daily` | Geopolitical risk | Caldara & Iacoviello GPR daily, `data_gpr_daily_recent.dta` (or `.xls`), column `GPRD` | none; baseline 100 = 1985-2019 average (verified: mean 100.0) | index | 28 | 7, 14, 28 | CC BY; cite Caldara and Iacoviello (2022, AER) |
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
- **PortWatch reports errors inside HTTP 200 responses,** so a status-code check misses them. Validate the body, retry with backoff (the service had about 15-minute outages during research), and never overwrite good data with a failed fetch.
- **The baseline in the "vs" figures:**
  - for GPR, its 1985-2019 average (100);
  - for every other series, the mean of its last 365 days **(my call)**.

### 6.2 Forecasting

- **The model:** Timestral-209M, univariate, CPU, 4 torch threads, full history as context. The 28M model is as good on calm series but 10 to 20% worse on Hormuz's regime shift (spike).
- **The target is the raw daily value,** validated in both spikes. The 7-day average is display context only, never forecast separately.
- **Archive all 21 quantile levels** so WIS can be computed properly. The page shows 0.1, 0.25, 0.5, 0.75 and 0.9 as "8 in 10" and "5 in 10" ranges, and 0.5 as "most likely". The panel's chart opens on the most likely value of each day and, asked, draws the possible paths instead.
- **The possible paths (#147).** The panel opens on the most likely value of each day, the most useful view (owner's choice, 2026-10-30). "Show possible paths" then draws them one at a time, in order, from the last daily value, so the days ahead read like the past:
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
6. **Publish:** build the API files and the page data, validate every JSON file against its schema, build the web app, and deploy one Pages artifact.

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
  - **The forecast panel's replay** shows any forecast from the last 120 days, with the real daily values in white, whether the target day fell inside the range, and how many days so far landed inside.
  - **The record section shows the dots:** the last 8 weekly forecasts, 7 days ahead, green if inside the 8-in-10 range and red if not. Tapping one opens it in the replay.
  - **A small leaderboard-style table (my call):** per series, 8-in-10 coverage and error vs naive, live only.
- **Wording rules:**
  - "most likely", never "will";
  - "8 in 10 chance between", not "80% confidence interval";
  - say plainly when the model ties or loses to the naive method (Brent does).

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
  - `series.json`: catalog, with unit, horizon, cadence, last observation, source, licence, attribution text and day-to-day tie per series, model info, quantile levels, errata;
  - `series/{id}/latest.json`;
  - `series/{id}/forecasts.json`: the index;
  - `series/{id}/forecasts/{reference_date}.json`: immutable;
  - `series/{id}/replay.json`: the forecasts of the last 120 days, for the replay slider, at seven levels: the page's five and the 5% and 95% a possible path reaches before the chart's frame, written as the page writes values;
  - `series/{id}/actuals.json`;
  - `series/{id}/scores.json`;
  - `scores.json`;
  - `bulk/forecasts-{YYYY}.parquet` and `.csv.gz`, `bulk/time-series.parquet`, `bulk/oracle-output.csv`, `bulk/scores.parquet`, `bulk/datapackage.json`;
  - `openapi.json`, `schemas/*.schema.json`, `licenses/*.txt`.

  A human docs page at `/api/` carries a schema.org `Dataset` block.
- **Provenance in every forecast file:**
  - model ID, weights revision and package commit;
  - `reference_date`, `forecast_date`, `generated_at`;
  - code version (git SHA);
  - `forecast_mode`;
  - input `as_of` per source.
- **The contract:**
  - OpenAPI 3.1 plus JSON Schemas, kept in the repo as the source of truth;
  - CI validates every published file against them;
  - `v1` only changes in additive ways, and anything breaking goes to `v2`;
  - corrections go to `errata`, the original forecast stays published.
- **Licences:** each resource carries its own licence and attribution. The bulk CSVs are split by source so that each file has one licence.
- **aseri's own licences (owner's choice):**
  - forecasts, scores and the API: **CC BY-NC 4.0**, attributed as "Forecasts: aseri (model aseri-timestral209m, Timestral-209M by Mistral AI)", with a note that upstream terms still apply to the underlying data;
  - code: **MIT**, in `LICENSE` at the root.

  If the Hubverse model-metadata licence list has no CC BY-NC 4.0 value, use its `other` option and state the licence in the text.

### 6.7 Storage and repository rules

1. **`master` holds code, schemas and docs only.** The site and API are never committed: they are a Pages artifact built on each run.
2. **An `archive` orphan branch is append-only.** Each run adds one Hubverse round CSV, one observation-delta CSV and one manifest. No file is ever rewritten, and CI enforces this.
   - About 25 KB a day, about 9 MB a year (14 MB at the maximum), measured on real quantiles.
   - The build checks it out shallow.
3. **Never commit upstream raw downloads.** The alerts CSV alone is 9 MB and rewritten daily.
4. **A size alarm:** CI checks `git count-objects` on `archive` against a budget **(my call: 50 MB)**.
5. **The site** grows about 30 MB a year, against the 1 GB limit. If it is ever needed, drop the dated JSON files for closed years and keep the yearly bulk files.
6. **The throwaway prototypes** (`prototypes/`) move to a `prototypes` branch once the real code covers them **(my call)**, so that `master` stays clean.

### 6.8 Website: structure and behaviour

The reference is the prototype `prototypes/forecast-chart/index.html`, in the "statement" style of about.dos-age.com: one idea per screen, gold on deep navy. Rewrite it properly; do not port it.

1. **Hero:**
   - an animated pixel sun;
   - the wordmark 焦り, with "あせり · aseri" under it;
   - the kicker "Geopolitical risk · today";
   - the GPR 7-day average as a giant number;
   - the pitch: "{x}% above its 1985-2019 average", then the 4-week forecast for the same weekday as the last data, compared with that weekday (owner's choice): "{Weekday Mon DD}, 4 weeks from the last data: 8 in 10 between {lo} and {hi}, 2 in 10 outside. Most likely {m}. (Last {weekday}: {v})", the range first (6.9, copy). GPR has a strong weekday cycle, so a single day must never be compared with a day on a different weekday or with the 7-day average.

   The sun's size encodes today's GPR against the baseline.
2. **The forecast panel,** a game-sheet frame with the title row `[F] {series} · forecast made today | {unit} · data to {date}`:
   - a readout line;
   - the pixel chart (6.9), opening on the most likely value of each day;
   - under it, "Show possible paths". Once pressed: Pause or Play, "Next path", "Most likely" (back to the opening view) and "Possible path N of 20", then the line "The line ahead is one possible path, not the forecast: no one knows which days turn out high." One path at a time, in order, never several: overlapping paths read as nothing;
   - a legend;
   - the replay slider, in the look of Timestral's: a dotted track with one dot a week, a square handle with a vertical bar, and the day beside the handle ("Forecast" on today), on the side with room. 120 days, ←/→ for one day, T for today, "Back to today";
   - the intervals block: a row for "today, that day", then one row per interval step with the 5-in-10 and 8-in-10 ranges, then the most likely value and, in replay, the real value with inside or outside, all on one value scale with the 1-year range and the GPR baseline;
   - the source line, with attribution and the backtest/live note.
3. **Signals:** nine cards in three groups: "Risk, attention and oil", "Sea lanes", "War in Ukraine". Each card shows:
   - an icon, a name and a key hint `[n]`;
   - the 7-day average and its unit;
   - the change vs the baseline;
   - a mini pixel chart with its forecast band;
   - "In {h} days: {lo}-{hi}";
   - "To {date}".

   Selecting a card (or pressing 1 to 9) opens that series in the panel with a dither transition. The hero stays on GPR.
4. **The record:** the dots and the table from 6.4.
5. **Side navigation** on wide screens: icon plus two-line label, inactive at 30% opacity, scroll-spy.

**Behaviour:**
- **The first frame is readable at rest.** Then the load sequence runs: the wordmark dithers in, the number counts up, the chart scans in from left to right.
- **Ambient motion:**
  - the sun's glow cycles through 6 density steps (about 2.6 s);
  - the dashed halo ring turns;
  - pixel stars twinkle;
  - the vignette breathes (6 s);
  - the sun pulses (3.2 s, scale 1 to 1.04);
  - once asked, the panel draws the next possible path every 1.2 s.

  The sun and the paths stop while the tab is hidden or they are off screen.
- **UI transitions** take 160 ms. Panel changes use the 8-step Bayer dither (30 ms per step).
- **`prefers-reduced-motion`** turns all of it off: a static sun, no count-up, no scan, no dither transitions, one path that turns only on "Another path".
- **Data loading (my call):** first load fetches `series.json`, every `latest.json` and GPR's replay data. Other series' replay data loads on selection. Budget: under 150 KB gzipped of JS and CSS, under 100 KB gzipped of initial data.
- **Accessibility:**
  - every control is a real button or input, with a visible focus (2 px gold outline);
  - the canvas charts have text equivalents (the readout and the intervals are real text);
  - the keyboard shortcuts never fire while an input is focused.

### 6.9 Design system

- **Tokens:** from `docs/research/design-dos-age.md` section 10 and the prototype, dark only.
  - background `#071324`, frame `#253a56`, row `#222034`, picked `#3d3524`;
  - text `#cbdbfc`, label `#9badb7`;
  - gold `#ffd23f`, pale gold `#fff0b3`, muted gold `#917d3c`, key-hint gold `#d9a066`;
  - focus `#7181e5`, inside `#78c283`, outside `#e3858d`.

  Map them to shadcn variables (`--background`, `--primary`, and so on) with `--radius: 0`. Focus and outside are the prototype's `#5b6ee1` and `#d95763` lightened at the same hue and saturation, so that they read as text (#143).
- **Contrast,** checked by `web/src/contrast.test.ts` from the tokens in `index.css`:
  - text at 4.5:1 on every surface it sits on: the page, an interval row, a picked card;
  - chart and lane marks at 3:1 on the page, a picked card and a row. The frame's hatch and grid lines are exempt: the forecast zone's name and the value ticks say the same in text;
  - no check between marks that meet: they differ by colour, with no shape cues (owner's choice, 2026-10-30).
- **Fonts, all OFL and self-hosted:**
  - DotGothic16 for the wordmark;
  - Jacquard 24 for the giant numbers and section titles;
  - Press Start 2P for all UI text, at whole-pixel sizes (8, 12, 16, 24).

  Use ASCII "-" for negative numbers, because Press Start 2P has no U+2212. The original dos-age fonts have no licence and must not be used.
- **Charts are custom canvas components,** not Recharts.
  - Draw at 2 CSS px per art pixel with `image-rendering: pixelated`, and Bresenham lines.
  - Daily values: a gold line, the history's main mark, with a 3x3 square on the last one, where the forecast starts.
  - The 7-day average: a label-grey line that stops at the origin.
  - The forecast side: the most likely value of each day, a pale gold line from the last daily value with its end labelled, on the panel and on the cards' mini charts alike. Once asked, the panel draws a possible path in its place, with no label at its end; the bands keep theirs.
  - What happened after a replayed forecast was made: white dots 2 art pixels wide, or single pixels when the days are under 3 art pixels apart.
  - Bands: 4x4 Bayer dither (50% inner for 5 in 10, 25% outer for 8 in 10) in muted gold with solid edges.
  - The forecast zone: diagonal hatch. The origin: dotted blue line.
  - Labels are real text over the canvas.
  - The scale fits every daily value shown, so the main line is never clipped. The panel's also fits the published levels nearest 5% and 95%, and holds still as the paths turn. A path past them, about a day in ten, runs along the frame: fitting q0.01 to q0.99 squashed Hormuz's 0 to 8 ships into a fifth of the chart.
- **Copy** that prevents the known misreadings (a range read as a high and a low, a median read as a promise), checked by a text lint in `web/src/App.test.tsx`:
  - a range always comes before "most likely", with a fixed denominator of 10: "8 in 10 between {lo} and {hi}, 2 in 10 outside". No median stands alone anywhere, a social preview included;
  - beside the chart, what the line ahead is: "The line ahead is one possible path, not the forecast: no one knows which days turn out high". #147 asked for "which days will be high"; "turn out" keeps the rule below;
  - beside the chart, what the band is and is not: "where the daily value should land 8 days in 10, outside it about 2 in 10. Not a high and a low, nor volatility: it widens because later days are harder to call"; for GPR alone, that daily values can follow the week, so a day compares with the same weekday ("compare Monday with Monday" in the hero). The sea lanes have no weekly cycle;
  - "data as of {date}", from each `actuals.json`'s `as_of`; for GPR, "preliminary for about 4 weeks";
  - never "will" and never "% confidence";
  - when the catalog's `generated_at` is more than 2 days old, the hero says "Site last updated {date}: the daily update may have stopped", computed in the browser.
- **Other primitives:**
  - the sun is a canvas (Bayer glow, dashed ring);
  - the icons are 8x12 pictograms knocked out of a solid block;
  - frames are 2 px with chipped corners;
  - buttons are flat blocks with two-line labels that turn white on hover.
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
  aseri/publish.py        API files + page data, schema validation
  aseri/scout.py          covariate scout (6.5)
  tests/
web/                      Vite + React + TypeScript + Tailwind + shadcn (static build)
  src/components/ui/      shadcn components
  src/components/         Sun, Wordmark, ForecastPanel, PixelForecastChart, ReplaySlider, Intervals, SignalCard, Record
  src/lib/                api client, formatting, dither and scale helpers
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
- **Prototypes:**
  - `prototypes/forecast-chart/`: the reference page, with `build/forecasts.py` showing how to run Timestral over replay origins;
  - `prototypes/style-variants/`: the style exploration;
  - `prototypes/timestral-backtest/` and `prototypes/timestral-covariates/`: the spikes.
