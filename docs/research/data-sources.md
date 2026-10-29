# Data sources for aseri

Research date: 2026-10-29. Question: which free, legally reusable, regularly updated time series on geopolitics, military activity and conflict fit a once-a-day GitHub Actions job that forecasts them and publishes a static chart.

"Verified" below means checked against the provider's own docs or terms, or by a small live request on 2026-10-29. Anything else is marked **unverified**.

## TL;DR

Shortlist, in order of fit:

1. **IMF PortWatch daily chokepoint transits** (Hormuz, Suez, Bab el-Mandeb, Taiwan Strait, 24 more). Daily ship counts since 2019-01-01, keyless ArcGIS REST, a few KB per day. IMF terms allow publishing and derivative works with attribution. Counts with weekly seasonality and regime shifts: the most forecastable and most "geopolitical" series here (Hormuz showed 2 to 5 transits/day in late Oct 2026).
2. **Caldara-Iacoviello daily Geopolitical Risk index (GPRD)**. Daily since 1985, CC BY. Updated weekly (Mondays), so the daily job is mostly a no-op. Noisy but stationary-ish news-share index, a natural headline series.
3. **Wikipedia pageviews for a basket of conflict articles**. Daily since 2015-07-01, CC0, keyless, ~1 day lag. Weekly seasonality plus attention spikes: good for a foundation model, cleanest license of all.
4. **Ukraine air-raid alerts** (volunteer dataset on GitHub, oblast level, since 2022-02-25, MIT-licensed repo, updated daily). Aggregate to alert count or alert-hours per day. Bursty but persistent, a daily forecast is meaningful.
5. **Russian losses as reported by Ukraine's General Staff** (GitHub JSON, MIT-licensed repo, daily since 2022-02-25). Daily increments (personnel, drones) are smooth counts with trend. Must be labelled "as claimed by one belligerent".

Runner-up: **Brent spot price** (EIA, US public domain statement, daily values released weekly). Very geopolitical in 2026 (USD 117 to 128 in late Oct), but a price is close to a random walk, so the forecast adds little. Use it if you want one market series.

Main traps found:

- **ACLED** is non-commercial only, forbids republishing or derivative works unless "transformative" and not reverse-engineerable, and says a dashboard does not qualify. The free "Open" tier has no API. Rejected.
- **GDELT DOC API** answered HTTP 429 ("one request every 5 seconds") on 4 of 5 first-attempt calls and timed out once. Shared GitHub runner IPs will make this worse. The GDELT license is fine; use the raw daily files instead.
- **Cloudflare Radar** API data is CC BY-NC 4.0. **OpenSanctions** is CC BY-NC 4.0. **Kaggle Ukraine missile/drone attacks** is CC BY-NC-SA 4.0. Fine only while aseri stays non-commercial.
- **IODA** API responses carry "All Rights Reserved". **gpsjam.org** publishes no license. **Polymarket** ToS forbids redistributing its data.
- **Israel Home Front Command** endpoints returned 403 from a non-Israeli IP; a cloud runner will be blocked.
- **IMF PortWatch** commercial reuse needs written permission; its chokepoint service also returned errors for ~15 minutes during testing, so the job needs a retry.

## Comparison table

| Source | Measure | Granularity / update / lag | History | Auth | License verdict | Fit |
|---|---|---|---|---|---|---|
| IMF PortWatch chokepoints | Ship transits and est. tonnage per chokepoint, by vessel type | Daily rows, item updated daily, ~4 day lag | 2019-01-01 | None | OK with attribution; commercial reuse needs IMF permission | High: seasonal counts, regime shifts |
| GPR daily (Caldara-Iacoviello) | Share of newspaper articles on geopolitical tension, threats and acts | Daily rows, updated Mondays | 1985 | None | CC BY | High: noisy, mean-reverting |
| Wikipedia pageviews | Daily views per article | Daily, ~1 day lag | 2015-07-01 | None (User-Agent required) | CC0 | High: weekly cycle plus spikes |
| Ukraine air-raid sirens (Vadimkin repo) | Alert start/end per oblast (volunteer) and raion (official) | Event rows, repo updated daily | 2022-02-25 (volunteer), 2022-03-15 (official) | None | Repo MIT; underlying data from official channel and eTryvoga, caution | Medium-high: bursty but persistent |
| Russian losses (PetroIvaniuk repo) | Cumulative personnel and equipment losses claimed by Ukraine's General Staff | Daily, same day | 2022-02-25 | None | Repo MIT; Kaggle copy is CC BY-NC-SA | Medium-high: smooth increments; partisan source |
| Brent spot (EIA, via EIA or FRED) | USD/barrel | Daily values, released weekly | 1987-05-20 | None (CSV); free key for APIs | EIA: public domain; origin Refinitiv/LSEG | Medium: random walk |
| GDELT 1.0 daily events / 2.0 15-min files | Machine-coded events (CAMEO), can count conflict events | Daily file 07:00 UTC; 15-min files | 1979 (v1), 2015 (v2), unverified | None | Free, redistribution OK, cite and link GDELT | Medium: noisy, source-volume driven |
| GDELT DOC 2.0 API | Article volume/tone matching a query | 15 min to daily | Rolling 3 months per docs | None | Same as above | Low: rate-limited, short window |
| NASA FIRMS | Satellite thermal anomalies (fires, flares, explosions not labelled) | Daily file / API, <3 h latency | 2000 (MODIS), 2012 (VIIRS), unverified | Free MAP_KEY for API; regional 24h CSV keyless | Open, cite NASA FIRMS | Low-medium: fires and clouds dominate |
| UCDP Candidate Events | Georeferenced organised-violence events with fatalities | Event-day, released monthly, ~1 month lag | 2018 candidate, 1989 GED | None for CSV; token for API | CC BY 4.0 | Monthly only, not daily |
| Cloudflare Radar | Internet traffic, outages per country | Hourly/daily | ~2020 (unverified) | Free API token | CC BY-NC 4.0 | Good series, NC license |
| ACLED | Conflict events | Weekly (unverified) | 1997 (unverified) | myACLED account, OAuth; no API on Open tier | Non-commercial, no redistribution | Rejected |

## Per-source notes

### IMF PortWatch daily chokepoint transits

- Measures daily transit calls and estimated trade volume (metric tons) for 28 chokepoints, by container, dry bulk, general cargo, ro-ro and tanker. A transit is counted once per ship per 48 h. Built from UN Global Platform satellite AIS (Spire). [item metadata]
- Endpoint (keyless ArcGIS FeatureServer table): `https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query`. Filter with `where=portname='Strait of Hormuz'`, fields `date,n_total,n_tanker,capacity`. `maxRecordCount` is 1000, so backfill needs `resultOffset` paging.
- Verified live: 79,940 rows, dates 2019-01-01 to 2026-10-25 (4 day lag on 2026-10-29). Latest `n_total`: Hormuz 2, Suez 46, Bab el-Mandeb 36, Taiwan Strait 240. Chokepoint names include Bosporus, Kerch, Malacca, Panama, Gibraltar, Dover.
- Size: ~84 KB per 1000 rows JSON, so a full chokepoint backfill is ~250 KB and a daily incremental pull for 4 chokepoints is a few KB.
- Reliability: on 2026-10-29 around 19:40 UTC the service returned `400 Layer ... does not exist or is inaccessible` for ~15 minutes, then recovered. Retry with backoff, and do not overwrite good data on failure.
- License: item license points to IMF terms. IMF terms for statistical data: users may "download, extract, copy, create derivative works, publish, distribute, and use Data", must attribute the IMF, must state material transformations, and "for any potential commercial reuse of IMF Data" must ask copyright@imf.org. Recommended citation: "Sources: UN Global Platform; IMF PortWatch (portwatch.imf.org)."
- Fit: daily counts with weekly seasonality, trend and regime breaks (Red Sea, Hormuz). A 7 to 30 day forecast is meaningful. Hormuz at single-digit counts is a near-zero series; Suez, Bab el-Mandeb and Taiwan Strait are better behaved.

### Caldara-Iacoviello Geopolitical Risk index (daily)

- Measures the share of articles in 10 newspapers about adverse geopolitical events, with Threats and Acts subindexes. Recent index starts 1985.
- Files: `https://www.matteoiacoviello.com/gpr_files/data_gpr_daily_recent.xls` (3.27 MB) or `.dta` (1.6 MB, readable with `pandas.read_stata`, no extra dependency). Mirrored in GitHub repo `iacoviel/iacoviel.github.io` under `gpr_files/`. Verified HEAD 200, Last-Modified 2026-10-26.
- Update: "The daily data are updated every Monday" (last update October 26, 2026). Latest data are preliminary and revised. Daily column names not verified (needs xls/dta parse).
- License: page states the material is "completely open access under the Creative Commons BY license". Cite Caldara and Iacoviello (2022, AER) plus the download date.
- Fit: noisy daily index with weekday effects and spikes, mean-reverting. Forecast meaningful at weekly horizon. Download only when Last-Modified changes.

### Wikipedia pageviews

- Endpoint: `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/{Article}/daily/{YYYYMMDD}/{YYYYMMDD}`. Verified: `Strait_of_Hormuz` returned 4,138 daily rows from 2015-07-01 to 2026-10-28 on 2026-10-29.
- Auth: none, but every request must send a User-Agent with contact info; abusive clients may be blocked.
- License: Analytics API data "available under the CC0 1.0 license".
- Size: ~350 KB for 11 years of one article, ~1 KB per article per day incremental.
- Fit: smooth weekly seasonality plus attention spikes. Sum a fixed basket (for example the main articles on current wars and chokepoints) to dampen article renames. Measures attention, not events; say so on the chart.

### Ukraine air-raid alerts (GitHub open dataset)

- Repo `Vadimkin/ukrainian-air-raid-sirens-dataset`, MIT license, commits "Add new data" daily (latest 2026-10-29 04:57 UTC).
- `volunteer_data_en.csv` (9.2 MB, oblast level, from 2022-02-25, from the eTryvoga channel; missing ends marked `naive=True` with 30 min duration). Tail verified current to 2026-10-29.
- `official_data_en.csv` (31 MB, from 2022-03-15, raion level since Dec 2025). Observation: its tail ended at 2026-09-07 when checked, so it may have stalled; not investigated.
- Two permanent alerts (Luhansk since 2022-04-04, Crimea since 2022-12-10) are excluded from the files.
- Size trick: `raw.githubusercontent.com` honoured HTTP Range requests, so a daily job can fetch only the last few KB after a one-time backfill.
- License caveat: MIT covers the repo; the underlying records come from official alert channels and a volunteer Telegram channel with no stated license. Low risk for an attributed chart, not zero.
- Alternative alerts.in.ua API: token by request form, history endpoint only `month_ago`, 2 requests/min, 403 for blocked IPs or countries, terms on commercial reuse not stated. Not needed.
- Fit: aggregate to daily alert count or summed alert-hours across oblasts. Bursty (mass drone nights) with weekly-ish persistence; a 7 day forecast is meaningful as a level estimate.

### Russian losses reported by Ukraine's General Staff

- Repo `PetroIvaniuk/2022-Ukraine-Russia-War-Dataset`, MIT license, pushed 2026-10-29. Files `data/russia_losses_personnel.json` (210 KB) and `data/russia_losses_equipment.json` (746 KB). Verified 1,708 daily rows, 2022-02-25 to 2026-10-29 (day 1709).
- Source is the General Staff of the Armed Forces of Ukraine and MoD (official claims, not independently verified).
- Same data on Kaggle is CC BY-NC-SA 4.0; use the GitHub copy.
- Alternative: `https://russianwarship.rip/api/v2/statistics/latest` (keyless JSON with daily increases); its OpenAPI spec has a `/terms/{lang}` path but no license statement found.
- Fit: difference the cumulative series to daily increments. Personnel (~1,500/day) and drones (~1,600/day) are smooth with trend; rare equipment classes are sparse. Daily forecast meaningful. Label as one side's claims.

### Brent crude spot (EIA)

- EIA daily Brent spot, file `https://www.eia.gov/dnav/pet/hist_xls/RBRTEd.xls` (450 KB, keyless) or FRED `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU` (170 KB full history, keyless; the documented FRED API needs a free key).
- Verified: latest 2026-10-27 = 123.10, FRED "Updated Oct 28, 2026, Next Release Date Nov 4, 2026", so values arrive in weekly batches.
- License: EIA says "U.S. government publications are in the public domain"; asks for "Source: U.S. Energy Information Administration (date)". EIA's table notes give the source as "Refinitiv, an LSEG business". FRED's API terms say series may be owned by third parties and copyrighted series contain "Copyright" in their notes; the Brent page notes do not. Low risk, flag the Refinitiv origin.
- Fit: price, near random walk with volatility clusters. Forecast is essentially a widening cone.

### GDELT

- Terms: "unlimited and unrestricted use for any academic, commercial, or governmental use"; redistribution allowed with a citation and link to gdeltproject.org.
- Raw files (reliable, keyless): `http://data.gdeltproject.org/events/YYYYMMDD.export.CSV.zip` (7.8 MB for 2026-10-28, posted 07:00 UTC) or 15-minute v2 files listed in `gdeltv2/lastupdate.txt` (~93 KB export each, so ~9 MB/day). A daily count of `QuadClass=4` (material conflict) or CAMEO roots 18 to 20, normalised by total events, is feasible.
- DOC 2.0 API: rolling 3 month window per the launch post; `timelinevolraw` gives counts plus a `norm` total. Verified behaviour: HTTP 429 on 4 of 5 attempts and one timeout; the one success had missing hours and ended ~2.5 days before the request time.
- TV API: not checked (unverified).
- Fit: noisy, driven by news volume and source mix changes. Medium. The 7.8 MB/day download is the biggest on this list.

### NASA FIRMS

- Thermal anomalies from MODIS and VIIRS; FIRMS FAQ says detections are "fires or other thermal anomalies", types not labelled, NRT within 3 hours.
- Keyless regional 24h CSVs, for example `https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Europe_24h.csv` (64 KB; Russia_Asia 1.5 MB). Backfill through the area API with a free MAP_KEY (GitHub secret), 1 to 5 days per request, 5,000 transactions per 10 min.
- License: NASA "promotes full and open sharing"; cite "NASA FIRMS".
- Fit: counts in a front-line bounding box are dominated by agricultural burning seasons and cloud cover. Weak signal for a daily forecast; good as a map, not as a forecast target.

### UCDP Candidate Events

- CC BY 4.0. Monthly releases with "not more than a month's lag"; current 26.0.9 (Sept 2026). CSV `https://ucdp.uu.se/downloads/candidateged/GEDEvent_v26_0_9.csv` (1.6 MB, keyless). The API needs a token requested by email, 5,000 requests/day.
- Fit: event dates are daily but data lands monthly, so only a monthly fatalities series makes sense. Good for a monthly companion chart, not for the daily job.

### Cloudflare Radar

- API is free on all plans with an API token (Account > Radar > Read), which can live in a GitHub secret. Data is CC BY-NC 4.0.
- Fit: country-level traffic (for example Iran, Russia) is smooth with daily and weekly cycles, and shutdowns are visible. Good candidate only if aseri stays strictly non-commercial.

## Rejected and why

- **ACLED**: EULA (updated 8 July 2025) limits use to non-commercial, forbids reproducing, republishing or derivative works, requires published material to be transformative and not reverse-engineerable, and states own-dashboard display does not qualify. Open tier has no API; API is OAuth with a 24 h token.
- **GDELT DOC/TV API as primary**: rate limits (429) and a 3 month window. Keep GDELT raw files as an option.
- **Israel Home Front Command**: `oref.org.il` history endpoints returned 403 from outside Israel. The Apache-2.0 mirror `dleshem/israel-alerts-data` is a single 65 MB CSV updated only when alerts happen (last commits 2026-09-29, 10-10, 10-19); too sparse to forecast daily.
- **Ukraine missile/drone attack dataset (Kaggle)**: CC BY-NC-SA 4.0, Kaggle credentials needed, and the description says the Air Force stopped reporting some missile types on 2026-08-10.
- **gpsjam.org**: daily H3 files exist, but no license or terms; built from ADS-B Exchange and airplanes.live data.
- **adsb.lol**: ODbL (fine, share-alike on derived databases), but history ships as ~3.6 GB per day on GitHub releases; the live `/v2/mil` snapshot (164 KB) gives one instant, not a daily total, and the API says keys will be required "in the future".
- **IODA**: API JSON includes "This data is Copyright (c) 2021-2025 Georgia Tech Research Corporation. All Rights Reserved."
- **Polymarket**: ToS forbids to "redistribute, or otherwise commercially exploit the Data" and scraping; license is personal. Market prices are also bounded probabilities on expiring questions, a poor fit.
- **Metaculus**: ToS page blocked automated fetch (403); a third-party write-up says the API needs a token and restricts commercial use (unverified). Same expiring-question problem.
- **Manifold**: read API is keyless (500 requests/min/IP), but it is play money, markets resolve, and no data license for redistribution is stated.
- **OpenSanctions**: CC BY-NC 4.0, and entity counts are step functions.
- **UNHCR refugee statistics API**: annual data.
- **ReliefWeb API**: requires a pre-approved `appname` since 1 Nov 2025; report counts measure editorial output, not conflict.
- **Gold, wheat, defence equities**: not verified. LBMA gold and exchange or index-vendor prices are typically licensed (unverified); World Bank Pink Sheet commodities are monthly (unverified). Skip unless a specific open source is confirmed.

## Sources

- IMF PortWatch item metadata (description, license link, update time): https://www.arcgis.com/sharing/rest/content/items/3da2b9ca97684916b75c4013f95d18ab?f=json
- IMF PortWatch chokepoint service: https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer
- IMF copyright and terms (data section): https://www.imf.org/en/About/copyright-and-terms
- GPR index page (update schedule, CC BY statement): https://www.matteoiacoviello.com/gpr.htm
- GPR files mirror: https://github.com/iacoviel/iacoviel.github.io/tree/master/gpr_files
- Wikimedia Analytics API access policy (CC0, User-Agent): https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html
- Wikimedia pageviews endpoint: https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Strait_of_Hormuz/daily/20150101/20261028
- Ukraine sirens dataset: https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset and https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset/blob/main/datasets/README.md
- alerts.in.ua API docs: https://devs.alerts.in.ua/
- Russian losses dataset: https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset
- russianwarship.rip API spec: https://russianwarship.rip/api-documentation/document/v2
- Kaggle dataset metadata (licenses, reporting note): https://www.kaggle.com/api/v1/datasets/view/piterfm/massive-missile-attacks-on-ukraine
- EIA Brent daily file: https://www.eia.gov/dnav/pet/hist_xls/RBRTEd.xls
- EIA spot price sources (Refinitiv): https://www.eia.gov/dnav/pet/TblDefs/pet_pri_spt_tbldef2.asp
- EIA copyright and reuse: https://www.eia.gov/about/copyrights_reuse.php
- FRED Brent series: https://fred.stlouisfed.org/series/DCOILBRENTEU
- FRED API terms of use: https://fred.stlouisfed.org/docs/api/terms_of_use.html
- GDELT terms of use: https://www.gdeltproject.org/about.html
- GDELT DOC 2.0 API launch post: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
- GDELT raw files: http://data.gdeltproject.org/gdeltv2/lastupdate.txt and http://data.gdeltproject.org/events/
- NASA FIRMS area API: https://firms.modaps.eosdis.nasa.gov/api/area/
- NASA FIRMS FAQ: https://www.earthdata.nasa.gov/data/tools/firms/faq
- UCDP downloads and license: https://ucdp.uu.se/downloads/
- UCDP API docs: https://ucdp.uu.se/apidocs/
- Cloudflare Radar docs (free API, CC BY-NC 4.0): https://developers.cloudflare.com/radar/ and https://developers.cloudflare.com/radar/get-started/first-request/
- ACLED EULA: https://acleddata.com/eula
- ACLED myACLED FAQ (tiers): https://acleddata.com/myacled-faqs
- ACLED API guide: https://acleddata.com/api-documentation/getting-started
- Israel alerts mirror: https://github.com/dleshem/israel-alerts-data
- gpsjam FAQ: https://gpsjam.org/faq
- adsb.lol historical data: https://www.adsb.lol/docs/open-data/historical/
- adsb.lol API spec (ODbL, future keys): https://api.adsb.lol/api/openapi.json
- adsb.lol daily releases: https://github.com/adsblol/globe_history_2026/releases
- IODA API: https://api.ioda.inetintel.cc.gatech.edu/v2/
- Polymarket terms: https://polymarket.com/tos
- Metaculus terms (not readable by fetch): https://www.metaculus.com/terms-of-use/
- Manifold API docs: https://docs.manifold.markets/api
- OpenSanctions licensing: https://www.opensanctions.org/licensing/
- ReliefWeb API docs: https://apidoc.reliefweb.int/
- UNHCR refugee statistics API: https://api.unhcr.org/docs/refugee-statistics.html
