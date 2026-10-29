# Prior art and gaps: open forecasts for geopolitics, conflict and security

Research date: 2026-10-29. Every claim links to a source in the last section. Items marked **(unverified)** could not be confirmed on the primary site (blocked, timed out, or only seen in search snippets or secondary coverage).

## TL;DR

The serious statistical conflict forecasters (VIEWS, ConflictForecast, ACLED CAST, Early Warning Project, JRC GCRI) all work at **monthly or coarser** resolution on **conflict onset or fatalities**. Crowds and markets (Metaculus, Good Judgment Open, Polymarket) forecast **binary events**. There are plenty of **daily, open, security-relevant series**, but nobody publishes a forecast of them, let alone a public scoreboard. That gap is where aseri fits. The three most promising concepts:

1. **Chokepoint pulse (IMF PortWatch transits).** Daily ship transits for 28 maritime chokepoints, open via an ArcGIS API. The IMF publishes the counts and a monthly trade nowcast, but nobody forecasts transits. The Strait of Hormuz fell from 89-121 transits a day (first week of October 2025) to 2 on 2026-10-25, so this series is front-page geopolitics and carries no casualty ethics.
2. **Front-line rate (DeepStateMap occupied area, Ukraine).** A daily GeoJSON of occupied territory is already scraped by a GitHub Action. The area change per week is the most discussed number of the war. Today it is covered only by qualitative assessments (ISW) or binary markets, and nobody publishes a probabilistic forecast of it with a scoreboard.
3. **Air-war tempo (drones and missiles launched, air-raid alert hours, Ukraine).** Two open datasets are updated daily or weekly, have strong weekly structure, draw a lot of public interest and have no forecasts at all. This one is sensitive: keep it national and frame it as tempo, never as "when will city X be hit".

Recommended MVP: **concept 1**. It has the cleanest data and licence, global relevance and the lowest ethical risk. Whatever you pick, trust comes from an **append-only forecast ledger scored against a seasonal-naive baseline**, which is what the live TSFM benchmarks below do.

## 1. Survey of existing services

Legend: "Open" covers whether the forecasts or data can be downloaded freely. "Track record" covers whether past forecasts are published next to outcomes.

| Service | What it shows or forecasts | Horizon | Update | Method | Open | Track record |
|---|---|---|---|---|---|---|
| **VIEWS** (Uppsala/PRIO) [1-4] | State-based conflict: predicted battle-related deaths and P(conflict), country-month and 0.5° grid (Africa, Middle East) | 1-36 months | Monthly | ML pipeline (MLOps) | Yes: CSVs plus REST API, source code public; no licence stated | Evaluation partitions in the FAQ, and the 2023/24 Prediction Challenge scored with CRPS, IGN and MIS; no simple public per-release scoreboard found |
| **ConflictForecast.org** (Mueller, Rauh, Seimon) [5-7] | Risk of any violence or armed conflict, plus violence intensity, for 170+ countries and ~65k grid cells | 3 and 12 months (grid: 12) | Monthly | NLP topic models on news text plus ML | Yes: data on the site, replication data on Dataverse | **Yes**: the download includes all past out-of-sample predictions; the paper reports ROC-AUC, PR curves, and MSE against a no-change benchmark |
| **ACLED CAST** [8-10] | Counts of battles, explosions/remote violence and violence against civilians, at ADMIN1, country and global levels | 6 rolling 4-week periods | Weekly | LightGBM (Tweedie) plus reconciliation; conformal high/low scenarios | Login required (results page "Restricted"); EULA restricts republication | Accuracy metrics published with each weekly update, behind login |
| **ACLED Conflict Index / Watchlist** [11] | Ranking on deadliness, danger to civilians, diffusion and fragmentation; 10-area Watchlist | Annual outlook | Annual; a Weekly Conflict Index every Wednesday | Indicator composite plus analysts | Restricted (EULA) | No |
| **Early Warning Project** (USHMM) [12-14] | Risk of a new onset of mass killing, 160+ countries | 2 years | Annual (Dec 2025 covers 2025-26) | Elastic-net logistic regression; the crowd opinion pool is paused | Rankings public | Yes: accuracy page (~2 of 3 onsets were in the top 30; ~20 false positives per onset at a 4% threshold) **(site timed out, from search snippets)** |
| **JRC Global Conflict Risk Index** [15] | Statistical risk of violent conflict, 140 countries | 1-4 years | Periodic; latest revision found: 2022 | Regression on structural indicators | Reports public | Not found **(current version unverified)** |
| **CFR Global Conflict Tracker** [16, 17] | 27 ongoing conflicts tagged by impact on the US and status (worsening, improving, unchanging, developing) | None (status only) | Not stated | Editorial, anchored on the annual Preventive Priorities Survey of experts (November) | No download | No |
| **Crisis Group CrisisWatch** [18] | Monthly developments in 70+ conflicts; deteriorations, improvements, conflict-risk alerts, resolution opportunities | ~1 month (alerts) | Monthly, archive back to 2003 | Analyst judgment | Web only | No scoring **(site returned 403, from crisisgroup.org search snippets)** |
| **IMF PortWatch** [19-21] | Daily port calls and chokepoint transits, trade-volume estimates, disruption monitor (Hormuz flagged since 28 Feb 2026) | Monitoring only; a separate monthly trade nowcast | Weekly (Tuesdays), daily resolution | AIS satellite data (UN Global Platform), modelled | Yes: public ArcGIS FeatureServer; IMF terms of use | No forecasts to score |
| **Geopolitical Risk index** (Caldara & Iacoviello) [22, 23] | GPR from newspaper article counts; daily and monthly, with country indexes; the new AI-GPR scores articles with an LLM | Monitoring | Daily GPR updated every Monday (last update 2026-10-26); AI-GPR last updated 2026-09-30 | Text counts or LLM scoring | Yes: XLS/DTA/CSV, cite with download date | No forecasts |
| **Kiel Ukraine Support Tracker** [24] | Military, financial and humanitarian aid to Ukraine from 41 donors plus EU institutions | None | Irregular releases (latest 2026-10-08, data through Aug 2026) | Manual compilation | Yes: XLSX "Release 31" | No forecasts |
| **ISW / CTP** [25] | Daily campaign assessments plus a daily interactive control-of-terrain map; monthly time-lapse archive | None (qualitative outlook) | Daily | Analysts, OSINT | Maps viewable; bulk data **(unverified)** | No |
| **DeepStateMap** (via `cyterat/deepstate-map-data`) [26] | Russian-occupied territory as a daily GeoJSON multipolygon | None | Daily, 03:00 UTC (GitHub Action) | Volunteer OSINT mapping | Repo GPL-3.0; DeepState's own terms **(unverified)** | No |
| **Oryx** [27] | Visually confirmed equipment losses (e.g. 24,236 Russian items) | None | Continuous | Photo/video verification | HTML lists only | No |
| **Ukrainian General Staff loss claims** (via `PetroIvaniuk/2022-Ukraine-Russia-War-Dataset`) [28] | Cumulative claimed Russian personnel and equipment losses | None | Daily | Official claims, restructured | JSON, MIT | No |
| **Ukraine air-raid sirens** (`Vadimkin/ukrainian-air-raid-sirens-dataset`) [29] | Every official alert since 2022-03-15 by region; raion level since Dec 2025 | None | Daily | Telegram feeds | CSV, MIT | No |
| **Massive Missile Attacks on Ukraine** (Kaggle, piterfm) [30] | Missiles and drones launched and shot down per attack (Ukrainian Air Force reports) | None | Frequent (v216, last updated 2026-10-24) | Manual compilation | CC BY-NC-SA 4.0 | No |
| **GPSJam** [31] | Daily hex map of GPS interference from ADS-B navigation-accuracy reports | None | Daily, after 00:00 UTC | Aggregation of airplanes.live and ADS-B Exchange data | Download not documented | No |
| **UCDP GED / Candidate** [32] | Geocoded organised-violence events with fatalities | None | Candidate: monthly, at most ~1 month lag | Human coding | CSV plus API, CC BY 4.0 | n/a (it is the ground truth VIEWS uses) |
| **Our World in Data** [33] | Long-run conflict deaths and counts (UCDP, PRIO, COW, MARS, Gibler-Miller) | None | Annual-ish | Curation | CC BY | No forecasts |
| **GDELT** [34] | Global news-coded events (CAMEO), GKG, a conflict dashboard, daily trend PDFs | None | Every 15 min (feed live at 2026-10-29 20:00 UTC) | Automated news coding | Free: raw files plus BigQuery | No forecasts |
| **Metaculus** [35] | Crowd probabilities on binary or numeric questions, including geopolitics | Question-specific | Continuous | Aggregated crowd | Questions public; API needs a token | Yes: public calibration and Brier (0.108 for the community prediction on 2021 questions) **(track-record page 403, from FAQ snippets)** |
| **Good Judgment Open** [36] | Crowd forecasts in challenges (e.g. The Economist World Ahead 2026, 2026 elections) | Question-specific | Continuous | Crowd | No download mentioned | Brier-scored leaderboards (download not stated) |
| **Polymarket** [37, 38] | Real-money markets; the `geopolitics` tag includes "Netanyahu out by...?", "US invade Iran before 2027?", ceasefire markets | Market-specific | Continuous | Market prices | Open JSON API (gamma-api) | Platform-wide Brier 0.0595 and a calibration chart; no geopolitics breakdown |
| **Swift Centre** [39] | Superforecaster team estimates, e.g. Russia-Ukraine ceasefire 22% vs Polymarket ~43% (Jan 2026) | Question-specific | Ad hoc | Expert crowd | Blog posts | Self-reported only **(unverified)** |
| **ForecastBench** [40] | Benchmark of LLMs vs superforecasters on auto-generated questions (markets plus real-world time series) | Question-specific | Daily question generation | LLMs and humans | Public leaderboard | Yes (Brier) |

### What the survey says

- **Resolution gap.** The statistical forecasters work at monthly or coarser steps and on onset or fatalities. CAST is the only weekly one, and it sits behind a login and an EULA. Nobody forecasts the **daily** series that the monitoring services already publish (PortWatch, GPR, sirens, DeepState, missile launches, GDELT, GPSJam).
- **Format gap.** Crowds and markets answer binary questions ("ceasefire by X?"). Nobody publishes a **probabilistic path for a continuous series** (median plus bands) on these topics.
- **Track-record gap.** Only ConflictForecast (archived vintages), CAST (behind login), the Early Warning Project (aggregate accuracy page), Metaculus and Polymarket (calibration) show forecasts against outcomes. Nobody shows a simple "what we said vs what happened" chart for a single series.
- **Licence constraints shape the choice.** The ACLED EULA requires published outputs to be "transformative" and impossible to reverse-engineer, treats the data as confidential, and bars ML outputs that "function as a substitute for ACLED Content" [41]. That rules out any ACLED-based public forecast. UCDP (CC BY 4.0), the IMF terms, GPR (cite with date), the sirens (MIT) and DeepState-repo (GPL-3.0) data are usable. The Kaggle missile data is NC-SA, so the site must stay non-commercial and share-alike.

## 2. Prior art: TSFMs run on a schedule and published as static pages

I found **no open project that runs a time-series foundation model on geopolitical or conflict data on a schedule**. I checked GitHub code search (`chronos-forecasting`, `timesfm` and `tirex-ts` in `.github/workflows`), arXiv and web search. The only TSFM paper on conflict-adjacent data evaluates LLMs, not TSFMs [42], and the VIEWS 2023/24 challenge had no TSFM entry that I could find [43]. The scheduled-pattern prior art is in energy, finance and epidemiology:

| Project | What | Cadence | Uncertainty shown | Accuracy shown |
|---|---|---|---|---|
| **tsfm-live** (`jongwonKim-1997/tsfm-live`, created 2026-10-07) [44] | Closest match to aseri: a "prospective, append-only benchmark" of 7 zero-shot TSFMs (Chronos-2, Chronos-Bolt, TimesFM, Moirai, Toto, TiRex, Sundial) on CPU, published as a static site (tsfm-live.pages.dev) | Hourly locally; public auto-publishing **not yet configured** | Median paths plus per-step 80% intervals | Immutable lock-ins, paired scoring against "honest baselines"; requires 14 clean runs and a 90-day shadow period before claiming a record |
| **TS-Arena** [45, 46] | Live pre-registration platform: models must forecast "before the ground-truth data physically exists"; one year on energy series | Multiple challenges a day | Arena Score with a 95% CI, and rank shown as a range | MASE and scaled quantile loss over a rolling 30 days; MASE < 1 means it beats seasonal naive |
| **Foretec Energy Bench** [47] | Day-ahead price, wind, solar and load forecasts for 6 European zones, frozen before the 12:00 auction gate | Daily | n/a in record | Live leaderboard; code Apache-2.0, forecasts and scores CC BY 4.0 |
| **EnergyBench** [48] | Zero-shot TSFMs vs baselines on "fresh" post-training-cutoff energy data | Not stated | Median plus 80% interval in the explorer | MASE, WQL, geometric-mean ratio to seasonal naive |
| **LiveHouse-TS** [49] | Living benchmark of TSFMs, 17 datasets across 11 domains, prequential on real future data; finds static rankings "reshuffle" | Continuous | n/a | Leaderboard (URL not given) |
| **Hubverse / FluSight dashboard** (not TSFM, but the reference pattern) [50] | A static Quarto site built by GitHub workflows from JSON; many models' quantile forecasts against observed data | Weekly | Selectable 50% and 95% intervals | WIS, MAE, and 50%/95% interval coverage computed at build time |
| **ACLED CAST** (operational conflict forecaster) [9] | See above | Weekly | High/low scenarios from conformal intervals on rolling CV residuals | Weekly accuracy tab |
| **VIEWS Prediction Challenge 2023/24** [43] | Fatality distributions submitted as 15-1000 samples | One-off, prospective window | Full predictive distribution | CRPS (main), IGN, 90% MIS. A no-change model beat most entries in the previous round, and the exactly-zero model is hard to beat at the grid level |

Also on GitHub: many personal repos run TimesFM or Chronos nightly on stock or crypto prices via GitHub Actions or self-hosted runners, with no baseline or scoring (e.g. `bhalekarabhijit/alphabets` `timesfm-nightly.yml`). That is the anti-pattern to avoid [51].

**The model.** Mistral's **Timestral** comes in 5M, 28M, 123M and 209M sizes. It takes up to 32,768 context steps, outputs **21 quantiles** (0.01-0.99), handles past and known-future covariates, and runs on CPU with PyTorch (`pip install git+https://github.com/mistralai/timestral.git`) [52]. Its weights carry a **Modified MIT** licence: no rights if your company's monthly revenue exceeds $20M, and the restriction extends to derivatives [53]. The release date (~2026-10-15) and the benchmark-leadership claims come from secondary coverage only **(unverified)** [54].

**Lessons to copy.**
- Pre-register: write each forecast to an append-only file and commit it before the outcome exists (TS-Arena, tsfm-live).
- Always show a **seasonal-naive** baseline next to the model (TS-Arena, EnergyBench).
- Show the **median plus an 80% band**, then score **coverage** and a quantile loss (WIS/CRPS) over a rolling window (hubverse, EnergyBench).
- Do not claim a track record until enough live forecasts have resolved (tsfm-live's 90-day rule).

## 3. Concepts

Shared trust design for all of them:
- Store every forecast vintage, plus the data vintage it was made from.
- Score against the first-released actuals (several sources revise).
- Publish rolling 30/90-day WIS and 80%-interval coverage against seasonal naive.
- Show "data as of" prominently, because several sources refresh weekly even though the cron is daily.

### C1. Chokepoint pulse (recommended MVP)

- **Pitch:** "How many ships should pass through Hormuz, Bab el-Mandeb, Suez, the Bosporus and the Taiwan Strait next week if nothing changes, and is today abnormal?"
- **Data:** PortWatch `Daily_Chokepoints_Data` FeatureServer (fields `date`, `portname`, `n_total`, `n_tanker`, ..., 28 chokepoints) [19, 21]. Verified live: data through 2026-10-25 at query time on 2026-10-29. Hormuz showed 2 transits on 2026-10-25, against 89-121 a day on 2025-10-01..07. That day: Suez 46, Bab el-Mandeb 36, Taiwan Strait 240, Kerch 0.
- **Why a forecast is meaningful:** The series has strong weekly seasonality and long history, and moves with sanctions, wars and insurance. A forecast works as a **counterfactual baseline**: the value is in the gap between expected and actual, which nobody publishes (PortWatch flags disruptions but forecasts nothing). The audience is broad (energy, shipping, finance, journalists) and the series involves no casualties.
- **Limits:** Data refreshes weekly (Tuesdays), so the daily job mostly re-checks and re-forecasts only when new data lands. A TSFM cannot predict a reopening or closure (a regime change). It will extrapolate the current regime, and the site must say so. Counts are modelled from AIS and can be revised [20].
- **Trust:** Ledger plus scoreboard. Mark known regime breaks (e.g. 2026-02-28) on the chart so that misses there are explained, not hidden.

### C2. Front-line rate (Ukraine)

- **Pitch:** "How many km² will change hands in Ukraine over the next 30 days at the current tempo, with an honest band?"
- **Data:** `cyterat/deepstate-map-data`: daily occupied-territory multipolygons, refreshed 03:00 UTC by a GitHub Action, and a consolidated `.geojson.gz` (the README sample starts 2024-07-08) [26]. Compute the occupied area and its daily or weekly increment, and forecast the increment.
- **Why a forecast is meaningful:** It is the most discussed quantity of the war. ISW covers it qualitatively [25] and markets cover it as binaries [38]. A calibrated extrapolation of the tempo, scored daily, does not exist.
- **Limits:** DeepState is a Ukrainian volunteer OSINT source that updates in batches, which creates artificial jumps. Smooth to weekly. A ceasefire or collapse breaks the series. The licence of the underlying DeepState data is unverified.
- **Ethics:** Medium. The topic is politically charged. Frame the forecast as statistical extrapolation, not military assessment, and stay national (no axis-level detail).

### C3. Air-war tempo (Ukraine)

- **Pitch:** "Expected drones and missiles launched per day, and national air-raid alert hours, over the next 14 days, with bands."
- **Data:** Kaggle `piterfm/massive-missile-attacks-on-ukraine` (CC BY-NC-SA 4.0, v216, updated 2026-10-24) [30], and/or `Vadimkin/ukrainian-air-raid-sirens-dataset` (MIT, updated daily, official alerts since 2022-03-15) [29].
- **Why a forecast is meaningful:** Weekly structure and long trends; high public interest (energy grid, European air-defence debate); no open forecast exists.
- **Limits:** Launch counts are Ukrainian Air Force claims. Big salvos are discrete decisions (heavy tails), so a TSFM gives a base-rate band, not salvo timing. The sirens switched to raion level in Dec 2025, a structural break. The NC-SA licence makes the site non-commercial.
- **Ethics:** Medium-high. These are attacks on civilians. Stay national, never forecast a city or a date, and do not frame it as a "next strike" prediction.

### C4. Geopolitical-risk weather

- **Pitch:** "Is today's geopolitical-risk reading unusual, and where does it usually drift next month?"
- **Data:** Daily GPR `data_gpr_daily_recent.xls` (updated every Monday; latest data preliminary and revisable), or the AI-GPR daily CSV (last updated 2026-09-30) [22, 23].
- **Why a forecast is meaningful:** Only partly. It is a news-attention index, so the forecast is mostly "spikes decay back toward baseline". That is still a useful anomaly frame for finance readers, and the ethical risk is low. Nobody forecasts it.
- **Limits:** Weekly refresh, revisions (score against first vintages), citation requirement. Close to a teaching example. Better as the second chart than the headline.

### C5. Conflict-news intensity from GDELT

- **Pitch:** "Daily share of conflict-coded news (CAMEO roots 18-20) for 5 hotspots, with a forecast band."
- **Data:** GDELT 2.0 event files every 15 minutes, free (feed confirmed live on 2026-10-29) [34].
- **Why a forecast is meaningful:** Weak. It measures media coverage, not violence. Fine-grained GDELT counts are >90% zeros (NSF ATD challenge) [55], and source volume drifts. It is the only truly daily, global, freely licensed conflict-ish series, which makes it a better **covariate** for C1-C3 than a headline.

### C6. Concepts to avoid (honest "no")

- **Fatality or casualty forecasts** (UCDP Candidate, the General Staff "personnel losses" claims [28, 32]). VIEWS already does this with 36-month horizons and CRPS evaluation [1, 43]. The data is monthly, so a daily site adds nothing. The daily casualty figures are wartime claims. A smooth chart of "expected deaths" invites misreading and is ethically awkward.
- **ACLED-based event forecasts.** The EULA forbids public, reconstructable outputs and substitute ML products [41], and CAST already exists [8].
- **Forecasting prediction-market prices** (Polymarket). Prices are already forecasts, so a TSFM on them forecasts noise. At most, show market odds next to C1-C3 as context.
- **Kiel aid tracker.** Irregular releases with policy-driven jumps; not a daily series [24].

## Sources

1. VIEWS home: https://viewsforecasting.org/
2. VIEWS FAQ: https://viewsforecasting.org/faq/
3. VIEWS data and API: https://viewsforecasting.org/data/ ; https://api.viewsforecasting.org/
4. VIEWS Prediction Challenge leaderboard: https://viewsforecasting.org/leaderboard/
5. ConflictForecast: https://conflictforecast.org/
6. Mueller, Rauh, Seimon (2024), "Introducing a global dataset on conflict forecasts and news topics", Data & Policy: https://www.cambridge.org/core/product/AADA08BD5FC80EDD01E5CEBA7434F6E0/core-reader
7. Replication data: https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/UX8GUZ
8. ACLED CAST access page: https://acleddata.com/conflict-alert-system/ ; https://acleddata.com/platform/cast-conflict-alert-system
9. CAST methodology: https://acleddata.com/methodology/cast-methodology
10. CAST monthly report example: https://acleddata.com/wp-content/data-viz/cast-report/june-2025/report_june25.html
11. ACLED Conflict Index and 2026 Watchlist: https://acleddata.com/conflict-index-2026-watchlist ; https://acleddata.com/general-guide/about-conflict-index
12. Early Warning Project 2025-26 SRA: https://earlywarningproject.ushmm.org/reports/countries-at-risk-for-intrastate-mass-killing-2025-26-early-warning-project-statistical-risk-assessment-results
13. EWP statistical model: https://earlywarningproject.ushmm.org/methodology-statistical-model
14. EWP accuracy and crowd forecasting: https://earlywarningproject.ushmm.org/accuracy ; https://earlywarningproject.ushmm.org/crowd-forecasting
15. JRC GCRI: https://science4peace.jrc.ec.europa.eu/Home/About-GCRI ; https://publications.jrc.ec.europa.eu/repository/bitstream/JRC131326/JRC131326_01.pdf
16. CFR Global Conflict Tracker: https://www.cfr.org/global-conflict-tracker
17. CFR Preventive Priorities Survey: https://www.cfr.org/preventive-priorities-survey ; https://www.cfr.org/reports/conflicts-watch-2026
18. CrisisWatch: https://www.crisisgroup.org/crisiswatch (403 on fetch; details from crisisgroup.org search snippets, e.g. https://www.crisisgroup.org/node/21113)
19. PortWatch: https://portwatch.imf.org/ ; dataset page https://portwatch.imf.org/datasets/imf-dataviz::daily-chokepoints-data
20. PortWatch methodology: https://portwatch.imf.org/pages/data-and-methodology ; World Bank notebook on the API: https://worldbank.github.io/alternative-data-for-crisis/notebooks/disruptions-business-trade/chokepoints-monitor.html
21. PortWatch API (queried 2026-10-29): https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0 ; licence pointer: https://www.imf.org/external/terms.htm
22. GPR index: https://www.matteoiacoviello.com/gpr.htm
23. AI-GPR: https://www.matteoiacoviello.com/ai_gpr.html
24. Kiel Ukraine Support Tracker: https://www.kielinstitut.de/topics/war-against-ukraine/ukraine-support-tracker/
25. ISW/CTP daily assessment with interactive map: https://www.criticalthreats.org/analysis/russian-offensive-campaign-assessment-may-28-2026
26. DeepState daily data: https://github.com/cyterat/deepstate-map-data
27. Oryx: https://www.oryxspioenkop.com/2022/02/attack-on-europe-documenting-equipment.html
28. General Staff claims dataset: https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset
29. Air-raid sirens: https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset
30. Missile attacks dataset: https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine (metadata via https://www.kaggle.com/api/v1/datasets/view/piterfm/massive-missile-attacks-on-ukraine)
31. GPSJam FAQ: https://gpsjam.org/faq
32. UCDP downloads (CC BY 4.0, Candidate monthly): https://ucdp.uu.se/downloads/
33. OWID War and Peace: https://ourworldindata.org/war-and-peace
34. GDELT: https://www.gdeltproject.org/ ; https://data.gdeltproject.org/gdeltv2/lastupdate.txt
35. Metaculus FAQ and scores: https://www.metaculus.com/faq/ ; https://www.metaculus.com/help/scores-faq/
36. Good Judgment Open: https://www.gjopen.com/
37. Polymarket accuracy: https://polymarket.com/accuracy
38. Polymarket API, geopolitics and Ukraine tags (queried 2026-10-29): https://gamma-api.polymarket.com/events?tag_slug=geopolitics
39. Swift Centre vs Polymarket (self-published): https://swiftcentre.substack.com/p/polymarket-vs-forecasting-geopolitical
40. ForecastBench: https://arxiv.org/abs/2409.19839 ; https://www.forecastbench.org
41. ACLED EULA: https://acleddata.com/eula
42. LLMs for conflict forecasting: https://arxiv.org/abs/2505.09852
43. VIEWS 2023/24 Prediction Challenge: https://arxiv.org/abs/2407.11045 (HTML: https://arxiv.org/html/2407.11045)
44. tsfm-live: https://github.com/jongwonKim-1997/tsfm-live
45. TS-Arena paper: https://arxiv.org/abs/2512.20761
46. TS-Arena platform: https://ts-arena.live/
47. Foretec Energy Bench: https://zenodo.org/records/23455813 ; https://energybench.foretec.co
48. EnergyBench: https://energybench.github.io/
49. LiveHouse-TS: https://arxiv.org/abs/2608.17299
50. Hubverse dashboards: https://hubverse-org.github.io/hubverse-talk-usrse25 ; https://reichlab.io/flusight-dashboard/eval.html ; https://github.com/hubverse-org/hub-dashboard-template
51. Example nightly TimesFM repo: https://github.com/bhalekarabhijit/alphabets
52. Timestral model card: https://huggingface.co/mistralai/Timestral-209M
53. Timestral licence: https://huggingface.co/mistralai/Timestral-209M/blob/main/LICENSE
54. Timestral secondary coverage (unverified): https://letsdatascience.com/blog/mistral-timestral-tops-leaderboards-cpu-big-firms-license
55. GDELT sparsity (ATD challenge): https://arxiv.org/abs/2506.20935
