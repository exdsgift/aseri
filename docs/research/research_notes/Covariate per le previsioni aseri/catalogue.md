# Candidate covariates for aseri's nine daily series

Research date 2026-10-30. This catalogue feeds a covariate screening. It does not repeat what [spike-covariates.md](../../spike-covariates.md) already tested: day of week on the 6 spike targets, Lunar New Year for Taiwan, Bab-el-Mandeb and Suez for each other, Brent and GPR Threats/Acts for the chokepoints, "World War III" views for GPR, and drones for alerts. It also skips what [data-sources.md](../../data-sources.md) already documents, and it refers back to that file for source details. ACLED is excluded.

Conventions:
- **★** marks the 3 to 5 most promising candidates per series.
- **"Verified"** means checked live on 2026-10-30.
- **Register codes** (S1 to S23) point to the source register in section 1, which gives cadence, publication lag, history, vintages, licence and fetch difficulty once per source.
- **"Hypothesis"** marks a mechanism for which I found no published evidence. Those mechanisms are reasoning, not cited facts.

---

## 1. Which free sources can supply covariates, and on what terms (source register)

### Takeaway
Most usable free covariates come from 6 sources:
- the GPR file itself, which also carries the daily article count `N10D`;
- FRED, for the daily news-based EPU index and the CBOE volatility indices;
- Wikimedia pageviews;
- GDELT raw files;
- IMF PortWatch, for port calls and the other chokepoints;
- Open-Meteo, whose Previous Runs API archives real forecasts, which makes honest known-future weather backtests possible (but only since January 2024, and only up to 7 days ahead).

There is now no free, licensed daily oil futures curve: EIA stopped publishing NYMEX futures after 2024-04-05. Freight indices, war-risk premia and prediction-market data are either paid or restricted by their terms.

### Cited Findings

**Register**

| Code | Source and endpoint | Cadence and publication lag | History | Vintages (revisions) | Licence | Fetch from a GitHub Action (CPU) |
|---|---|---|---|---|---|---|
| S1 | GPR daily file `https://www.matteoiacoviello.com/gpr_files/data_gpr_daily_recent.dta`. Columns: `DAY, N10D, GPRD, GPRD_ACT, GPRD_THREAT, GPRD_MA7, GPRD_MA30, event`. Columns verified in the 2026-10-26 vintage cached in the repo; `N10D` is the daily article count (484 on 2026-10-24, 406 on 2026-10-25) ([GPR page](https://www.matteoiacoviello.com/gpr.htm)) | Updated every Monday, or the next business day after a federal holiday ([GPR page](https://www.matteoiacoviello.com/gpr.htm)) | 1985 ([GPR page](https://www.matteoiacoviello.com/gpr.htm)) | **Yes.** Daily vintages are named `data_gpr_daily_recent_YYYYMMDD` and kept in [gpr_archive_files](https://github.com/iacoviel/iacoviel.github.io/tree/master/gpr_archive_files). The latest data are "preliminary and subject to revisions" ([GPR page](https://www.matteoiacoviello.com/gpr.htm)) | CC BY ([GPR page](https://www.matteoiacoviello.com/gpr.htm)) | Easy (1.6 MB) |
| S1b | Country-specific GPR | **Monthly only**: "The monthly data include the country-specific GPR indexes" ([GPR page](https://www.matteoiacoviello.com/gpr.htm)) | 1985 or 1900 | Monthly vintages `data_gpr_export_YYYYMM` ([GPR page](https://www.matteoiacoviello.com/gpr.htm)) | CC BY | Easy, but too slow for a daily model |
| S2 | Daily news-based US EPU `USEPUINDXD` and Equity Market Uncertainty `WLEMUINDXD`, via `https://fred.stlouisfed.org/graph/fredgraph.csv?id=USEPUINDXD` ([FRED](https://fred.stlouisfed.org/series/USEPUINDXD)) | Daily, 7 days a week. The 2026-10-27 value was posted on 2026-10-28, so the lag is about 1 day ([FRED](https://fred.stlouisfed.org/series/USEPUINDXD)) | Verified: both series run 1985-01-01 to 2026-10-27 ([FRED CSV](https://fred.stlouisfed.org/graph/fredgraph.csv?id=USEPUINDXD)) | FRED's archive of past vintages (ALFRED) exists, but I did not check that it covers this series | **Conflicting signals.** The FRED page says "Data in this graph are copyrighted" but also tags the series "Public Domain: Citation Requested" ([FRED](https://fred.stlouisfed.org/series/USEPUINDXD)) | Easy (keyless CSV) |
| S3 | FRED market series. Verified spans: `OVXCLS` (crude-oil implied volatility) 2007-05-10 to 2026-10-28; `VIXCLS` 1990-01-02 to 2026-10-28; `GVZCLS` (gold volatility) 2008-06-03 to 2026-10-28; `DCOILWTICO` 1986-01-02 to 2026-10-27; `DTWEXBGS` (broad dollar index) 2006-01-02 to 2026-10-23; `DEXTAUS` (TWD/USD) 1983-10-03 to 2026-10-23; `DHHNGSP` (Henry Hub gas) 1997-01-07 to 2026-10-27; `T10Y2Y` (10-year minus 2-year yield) 1976-06-01 to 2026-10-29 ([FRED CSV](https://fred.stlouisfed.org/graph/fredgraph.csv?id=OVXCLS)) | CBOE indices: about 1 day (OVX for 2026-10-28 was updated on 2026-10-29) ([FRED OVX](https://fred.stlouisfed.org/series/OVXCLS)). WTI and Henry Hub arrive in EIA weekly batches like Brent. The H.10 series (`DTWEXBGS`, `DEXTAUS`) were 7 days stale on 2026-10-30 | See the previous column | Market closes are rarely revised (not checked) | CBOE series: "Copyright, 2016, Chicago Board Options Exchange, Inc. Reprinted with permission", tagged "Copyrighted: Citation Required" ([FRED OVX](https://fred.stlouisfed.org/series/OVXCLS)) | Easy |
| S4 | EIA NYMEX futures, contracts 1 to 4 (crude, RBOB, heating oil) ([EIA](https://www.eia.gov/dnav/pet/pet_pri_fut_s1_d.htm)) | **Discontinued**: "futures prices after April 5, 2024 are not available" ([EIA](https://www.eia.gov/dnav/pet/pet_pri_fut_s1_d.htm)) | Crude contract 1 from 1983 ([EIA](https://www.eia.gov/dnav/pet/pet_pri_fut_s1_d.htm)) | n/a | EIA (public) | Dead source |
| S5 | Wikimedia pageviews per article, any language, split by agent (`user`, `automated`). Verified 2024-01-01 to 2026-10-28: en "World_War_III" user views median 2,992/day, max 171,260; automated views median 176, max 17,413; ru "Третья мировая война" median 608, max 60,784; de "Dritter_Weltkrieg" median 344, max 7,977; en "Nuclear_warfare" median 655, max 5,686 ([API example](https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/user/World_War_III/daily/20240101/20261028)) | About 1 day; complete to 2026-10-28 when checked on 2026-10-30 ([API example](https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/user/World_War_III/daily/20240101/20261028)) | 2015-07-01 ([data-sources.md](../../data-sources.md)) | No revision policy found | CC0 ([Wikimedia access policy](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html)) | Easy (requires a User-Agent header) |
| S6 | Google Trends | `pytrends` repo archived April 2025, last PyPI release April 2023, frequent HTTP 429 ([DEV](https://dev.to/rimulabs/pytrends-is-archived-how-to-migrate-your-google-trends-code-no-more-429s-4e63)). Official Trends API alpha announced 2025-07-24: access gated to approved testers, with a 1,800-day data limit ([PPC Land](https://ppc.land/google-opens-alpha-testing-for-new-trends-api-targeting-developers-and-journalists/)) | Alpha: 1,800 days | Values change between downloads (see the noise bullet below) | Google ToS; no open data licence found | **Hard** from shared runner IPs |
| S7 | GDELT 2.0 Events and GKG raw files (`data.gdeltproject.org/gdeltv2/lastupdate.txt`) ([data-sources.md](../../data-sources.md)) | 15-minute files ([data-sources.md](../../data-sources.md)) | 2015 (v2), unverified | Each 15-minute file is written once, so an as-of view can be rebuilt (inference) | Unrestricted use with citation ([GDELT about](https://www.gdeltproject.org/about.html)) | Medium. The events files alone are about 9 MB/day; GKG is larger (size unverified). The DOC API returned 429 on 4 of 5 calls ([data-sources.md](../../data-sources.md)) |
| S8 | IMF PortWatch: chokepoints (same service as the targets) and port-level `Daily_Trade_Data`, queried by `portid` ([World Bank notebook](https://worldbank.github.io/alternative-data-for-crisis/notebooks/disruptions-business-trade/port-calls-trends-monitor.html), [PortWatch FAQ](https://portwatch.imf.org/pages/faqs)). Daily port calls split by cargo and tanker, plus trade estimates, for about 1,648 ports ([World Bank](https://worldbank.github.io/alternative-data-for-crisis/notebooks/disruptions-business-trade/maritime-port-activity.html)) | Multi-day lag, about 4 days for chokepoints ([data-sources.md](../../data-sources.md)) | 2019-01-01 | Not documented | IMF terms: attribution required; commercial reuse needs permission ([data-sources.md](../../data-sources.md)) | Easy to medium (ArcGIS paging, errors returned inside HTTP 200) |
| S9 | Open-Meteo. **Previous Runs API**: `_previous_dayN` variables give the value forecast N×24 h earlier, for N = 1 to 7. "Most models are archived from January 2024"; GFS 2 m temperature from March 2021; JMA from 2018. Variables include total cloud cover, wind at 10 to 200 m, precipitation, rain, snowfall and weather code ([Previous Runs](https://open-meteo.com/en/docs/previous-runs-api)). **Historical Forecast API**: "Coverage starts around 2022", but "each run's first few hours are stitched into a continuous hourly timeseries", so it is close to observed weather, not a multi-day forecast ([Historical Forecast](https://open-meteo.com/en/docs/historical-forecast-api)). ERA5 reanalysis from 1940 ([Historical Forecast](https://open-meteo.com/en/docs/historical-forecast-api)) | Forecasts real-time; reanalysis lag not checked | See the first column | **Previous Runs is a forecast vintage by construction** | Data CC BY 4.0 with a link next to the data ([licence](https://open-meteo.com/en/licence)). The free API "is for non-commercial use": 600 calls/min, 5,000/h, 10,000/day, 300,000/month. Commercial use needs a subscription ([pricing](https://open-meteo.com/en/pricing)) | Easy (keyless JSON) |
| S10 | Moon illumination and night length, computed locally with an astronomy library (e.g. skyfield) | Known years ahead | Unlimited | n/a | Library licences (unverified, see Gaps) | Trivial |
| S11 | Holiday calendars for UA, RU, CN, TW, US, EG, IR, YE, SA via the `holidays` Python package | Known years ahead | n/a | n/a | Unverified (see Gaps) | Trivial |
| S12 | Taiwan MND daily PLA activity. **PLA Activity Tracker** CSV `https://pla-tracker.skyfaring.net/data/records.csv`: data from 2026-01-01 (300 daily records), fetched after the MND bulletin at about 12:00 to 14:00 Taiwan time. Records are append-only; days without a bulletin stay blank ([PLA Tracker](https://pla-tracker.skyfaring.net/en/about.html)). **PLATracker sheet** (Brown and Lewis): from September 2020, updated 2026-10-26; download on request "to prevent theft or abuse"; no licence stated ([sheet](https://docs.google.com/spreadsheets/d/1qbfYF0VgDBJoFZN5elpZwNTiKZ4nvCUcs5a7oYwm52g/)) | Same day | Tracker: 10 months. Sheet: about 6 years | Tracker is append-only ([PLA Tracker](https://pla-tracker.skyfaring.net/en/about.html)) | Tracker compilation CC BY 4.0; credit MND and the tracker ([PLA Tracker](https://pla-tracker.skyfaring.net/en/about.html)). Sheet: none stated | Tracker easy; sheet needs a manual request |
| S13 | ASPI tracker of China's large-scale exercises around Taiwan since 2022 ([ASPI](https://www.pressurepoints.aspi.org.au/taiwan-and-the-taiwan-strait/chinas-military-coercion/chinas-large-scale-exercises-since-2022)) | Event list | 2022 | n/a | Not checked | Manual |
| S14 | OFAC Recent Actions: 3,182 entries; categories include designations, removals, general licences and enforcement. The page lists no RSS or machine-readable feed, only GovDelivery email ([OFAC](https://ofac.treasury.gov/recent-actions)) | Several actions a week ([OFAC](https://ofac.treasury.gov/recent-actions)) | Earliest date not shown | n/a | US federal work (licence not checked) | Medium (HTML scraping) |
| S15 | JMIC (UKMTO and partners): weekly dashboards with a "Complete List of Merchant Vessels Incidents Since 19th November 2023" ([JMIC week 23, 2025](https://www.steamshipmutual.com/sites/default/files/medialibrary/files/JMIC%20Week%2023%20Dashboard%202%20JUNE%20-%208%20JUNE%202025%201.pdf)); monthly statistics PDFs ([JMIC Feb 2026](https://mscio.eu/media/documents/JMIC_Monthly_Statistics_-_Feb_2026.pdf)); also hosted on [UKMTO](https://www.ukmto.org/-/media/ukmto/products/jmic-week-07-dashboard-10---16-feb-2025.pdf) | Weekly and monthly PDFs | 2023-11-19 | n/a | No licence found | **Hard** (PDF table parsing; no CSV found) |
| S16 | Ukrainian Air Force daily launched and destroyed counts. Original on Telegram ([Al Jazeera](https://www.aljazeera.com/news/2025/9/9/charting-the-past-year-of-russian-drone-and-missile-attacks-on-ukraine)). Compiled copies: Kaggle "Massive Missile Attacks on Ukraine", from October 2022 ([PetroIvaniuk README](https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset)); ua-energy dataset by day and weapon subtype ([ua-energy](https://map.ua-energy.org/en/resources/12f3148d-841a-478d-b9ed-72bf0764b286)); MDAA tracker, updated weekly ([MDAA](https://missiledefenseadvocacy.org/?p=39307)) | Kaggle: not checked. MDAA: weekly | October 2022 (Kaggle) | Kaggle keeps dataset versions (not checked) | Kaggle CC BY-NC-SA 4.0. The Air Force stopped reporting some missile types on 2026-08-10 ([Kaggle metadata](https://www.kaggle.com/api/v1/datasets/view/piterfm/massive-missile-attacks-on-ukraine)) | Medium to hard (Kaggle credentials, or Telegram scraping) |
| S17 | Russian MoD claims of Ukrainian drones downed. No dataset found: cumulative totals appear only in news (260,703 by 13 October) ([Ahram](https://english.ahram.org.eg/News/580618.aspx)); daily posts in news, e.g. 1,158 in one day ([Ukrainska Pravda](https://www.pravda.com.ua/eng/news/2026/08/02/8046907/)) | Daily (Telegram) | 2022 onward (unverified) | n/a | Unclear | Hard (scraping) |
| S18 | DeepStateMap | "near-daily" updates ([search summary of Wikipedia](https://www.wikiwand.com/en/articles/DeepStateMap)) | 2022 | n/a | **Restrictive.** DEEPSTATEUATECH LLC owns the content and API; commercial API use needs prior approval ([licence](https://deepstatemap.live/license-en.html)) | Blocked unless permission is granted |
| S19 | ISW daily assessments (text) | Daily | 2022 | n/a | **Terms not found** | Medium (HTML), licence unknown |
| S20 | Prediction markets. **Kalshi**: `GET /historical/markets/{ticker}/candlesticks`, `/historical/trades`, with cutoffs from `/historical/cutoff` ([Kalshi docs](https://docs.kalshi.com/getting_started/historical_data)). **Polymarket**: price history with `startTs`, `endTs`, `fidelity`, `interval` ([Polymarket docs](https://docs.polymarket.com/trading/clients/public)) | Real-time | Per market (markets expire) | n/a | **Polymarket ToS forbids redistributing or commercially exploiting its data** ([data-sources.md](../../data-sources.md)). Kalshi terms not checked. Metaculus ToS unreadable ([data-sources.md](../../data-sources.md)) | Medium (APIs), but licence-blocked for Polymarket |
| S21 | Freight and insurance: FBX is "available to subscribers" ([Marine Log](https://www.marinelog.com/news/baltic-exchange-and-freightos-launch-container-shipping-index/)) and is a regulated Baltic benchmark ([Baltic Exchange](https://www.balticexchange.com/en/data-services/market-information0/container-services.html)). War-risk premia appear only as news, e.g. "+50%" for the Red Sea in February 2024 ([PISM](https://pism.pl/webroot/upload/files/Biuletyn/PISM%20Bulletin%20no%2027%20(2335)%2019%20February%202024.pdf)) | Weekly (FBX) | 2016+ (unverified) | n/a | Subscription | Blocked |
| S22 | UCDP Candidate Events | Monthly, under one month's lag ([data-sources.md](../../data-sources.md)) | 2018 | Monthly releases | CC BY 4.0 | Easy, but monthly |
| S23 | Hand-built event calendars: summits, UN Security Council programme, OPEC+ meetings, IAEA Board meetings, announced talks and deadlines | Known once announced | n/a | Must record the announcement date | Facts, no licence issue | Manual curation |

**Reliability notes on attention and news sources**
- **GDELT:**
  - Duplicate events were "under 20% of recorded events", and GDELT was not designed to de-duplicate ([PeaceRep](https://peacerep.org/wp-content/uploads/2022/07/GDELT-Report-Digital.pdf)).
  - For India 2016 it reported 59,422 protest events, against 9,600 (ACLED) and 8,500 (ICEWS) ([UNL lecture](https://cse.unl.edu/~lksoh/Classes/CSCE100_Fall21/speakers/LectureSocialUnrest.pdf)).
  - Its correlation with hand-coded data is "mediocre", with geographic bias at local level ([Konstanz](https://kops.uni-konstanz.de/entities/publication/cd1512fc-1853-4302-9829-cb83f47cbbcb)).
  - Its documentation is unclear on whether it counts reports or events ([Political Violence at a Glance](https://politicalviolenceataglance.org/2014/02/20/raining-on-the-parade-some-cautions-regarding-the-global-database-of-events-language-and-tone-dataset/)).
- **Google Trends sampling noise:**
  - Repeated pulls of the same query and dates return contradictory values, and Google acknowledged it ([Behnen et al., EDML 2020](https://imada.sdu.dk/Research/EDML/2020/EDML20_paper_5.pdf)).
  - Sampling error is serious for unpopular terms, and Google does not disclose its sampling parameters ([Cebrián and Domenech](https://riunet.upv.es/bitstream/10251/189564/1/CebrianDomenech%20-%20Simulating%20the%20inconsistencies%20of%20Google%20Trends%20data.pdf)).
  - Values also vary by download location ([MZES](https://www.mzes.uni-mannheim.de/en/publications/details/default-1b90339871013c563d9e0770aa21fed2-44)).
  - Averaging many samples is the usual fix ([EPSA 2025](https://coms.events/epsa2025/data/abstracts/en/abstract_0396_1677_0947.html)).
- **News text predicts conflict:**
  - Newspaper topic shares forecast conflict outbreaks 1 to 2 years ahead ([Mueller and Rauh, CWPE](https://www.econ.cam.ac.uk/research/cwpe-abstracts?cwpe=1630)).
  - Text adds value over past violence for rare outbreaks ([International Interactions 2022](https://econpapers.repec.org/RePEc:cam:camdae:2220)).
  - These are annual or monthly country-level results, not daily ones ([Cambridge 2024](https://www.cambridge.org/core/product/AADA08BD5FC80EDD01E5CEBA7434F6E0/core-reader)).
- **Prediction-market calibration:**
  - Across 353 million trades on Kalshi and Polymarket, political market prices are "compressed toward 50%", i.e. they underreact at the extremes ([arXiv 2602.19520](https://arxiv.org/pdf/2602.19520)).
  - A large study of about 1 million resolved questions found broad calibration ([Marginal Revolution](https://marginalrevolution.com/marginalrevolution/2026/10/prediction-markets-are-accurate.html)).
  - No rigorous comparison specific to geopolitical questions was found.

### Inferences

**Screening design**

- **Use fresher covariates to fill the target's publication gap.** The spike found that past-only covariates carry no lead once their lag is masked. But several targets are published later than their covariates:
  - GPR up to 6 days stale between Mondays;
  - PortWatch about 4 days;
  - Brent up to 8 days (FRED weekly batches).

  On the forecast day, the first horizon steps of these targets are days that have already happened. EPU (S2), CBOE volatility (S3), Wikipedia (S5) and GDELT (S7) already cover them. Timestral only accepts past covariates over the target's context (spike, line 352). So the way to test this is to pass the fresher covariate as a **known-future row: its observed values for the gap days, then NaN for the rest of the horizon** (the spike says NaN is masked). This exact use is untested. It is the most promising new design idea for the 1-7 bucket.
- **Weekday-dependent staleness.** For GPR, the gap depends on the weekday of the forecast. The screening should simulate the daily job's real as-of state per weekday, not a single worst-case lag.
- **Weather as known-future is honestly testable only from January 2024, and only to lead 7.**
  - Previous Runs (S9) gives real forecasts up to lead 7 days, archived from January 2024 for most models.
  - The Historical Forecast API is stitched from each run's first hours, so it leaks near-observed weather. It must not stand in for a 7-day forecast.
  - Beyond lead 7, the row is NaN or climatology.
  - So weather can only move the 1-7 bucket, and the backtest window is about 2.8 years.
- **Event calendars (S23) are at risk of look-ahead bias.** Each event needs the date it was announced. A row may only switch on at origins after that date.
- **Revisions.** GPR vintages are archived (S1), so the screening can backtest on the vintages that existed at each origin. For PortWatch and Wikipedia, no vintage policy was found, so the current data must stand in for past vintages.
- **Licences.**
  - Open-Meteo's free tier is non-commercial (S9).
  - CBOE indices are copyrighted (S3).
  - Polymarket forbids redistribution (S20).
  - Kaggle Air Force data is NC-SA (S16).

  Each is a blocker if aseri ever goes commercial.

### Gaps
- **Not opened this session**, so licence and cadence are unverified:
  - the `holidays` package (https://github.com/vacanza/holidays) and skyfield (https://rhodesmill.org/skyfield/);
  - the UN Security Council programme of work, OPEC+ and IAEA Board calendars;
  - the EIA Weekly Petroleum Status Report schedule and CFTC Commitments of Traders;
  - the Open-Meteo Marine API;
  - Reddit API terms;
  - Wikipedia clickstream dumps;
  - JMA and JTWC typhoon best tracks;
  - the Drewry WCI and SCFI terms.
- **Not checked:**
  - whether ALFRED keeps EPU vintages;
  - whether PortWatch revises past rows;
  - GDELT GKG daily size;
  - Kalshi's terms of use and authentication for historical endpoints.
- No source found for ISW's terms of use.
- No free, licensed source of daily Brent or WTI futures settlements found after the EIA discontinuation. CME and ICE settlement pages exist, but their redistribution terms were not checked.

---

## 2. GPR daily (GPRD): candidate covariates

### Takeaway
The best bets are fresher news-volume proxies that nowcast the up-to-6 stale days between Monday updates:
- ★ daily EPU;
- ★ GDELT material-conflict share and GKG theme counts;
- ★ CBOE volatility;
- ★ the article count `N10D` from the GPR file itself;
- ★ a hand-built calendar of scheduled summits and anniversaries, as the only known-future candidate with a mechanism.

### Cited Findings

Known-future:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| G-K1 ★ | Scheduled summits and high-salience dates: NATO and G7 summits, UNGA high-level week, war anniversaries (24 Feb, 7 Oct), US elections and inauguration | Hypothesis: coverage of war-threat, buildup and nuclear-threat words rises around them. The index counts exactly those categories ([GPR page](https://www.matteoiacoviello.com/gpr.htm)) | S23 |
| G-K2 | US federal holidays and the Christmas to New Year week | The index is a share of articles in 10 US/UK/Canadian papers ([GPR page](https://www.matteoiacoviello.com/gpr.htm)). Daily article volume varies: `N10D` was 484 on 2026-10-24 and 406 on 2026-10-25 (S1). Low-volume days make the share noisier. These holidays are too rare for the model to learn from day of week alone. Effect on GPRD not measured | S11 |
| G-K3 | Announced deadlines: ultimatums, ceasefire expiries, sanctions snapbacks, rounds of talks | Hypothesis: threat coverage builds up before a deadline. Must be dated at announcement | S23, S14 |
| G-K4 | Day of week (already tested) | Spike: no gain on GPR | n/a |

Past-only:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| G-P1 ★ | Daily news-based US EPU (`USEPUINDXD`) | Same family of newspaper-share indices, from Access World News: over 2,000 US newspapers, chosen because the daily index needs a higher density of sources ([BBD slides](https://abfer.org/media/abfer-events-2013/annual-conference/corporate-finance/track2-presentation-measuring-economic-policy-uncertainty.pdf)). It is 1 day stale, against GPR's weekly update ([FRED](https://fred.stlouisfed.org/series/USEPUINDXD)). Correlation with GPRD not measured | S2 |
| G-P2 ★ | GDELT 2.0: daily material-conflict share (QuadClass 4 or CAMEO roots 18 to 20, over all events), GKG theme counts (armed conflict, military, terror) and average tone | Fresh near-real-time news volume about conflict. Known problems: duplicates, inflated counts, mediocre agreement with hand-coded data (section 1) | S7 |
| G-P3 ★ | `N10D`, the daily article count in the GPR file | It is the denominator of the share: low counts mean noisier GPRD (S1). Free, same file | S1 |
| G-P4 ★ | OVX, VIX, GVZ | Market fear moves with geopolitical shocks (hypothesis for the daily lead). 1-day lag (S3). Copyrighted CBOE | S3 |
| G-P5 | Equity Market Uncertainty (`WLEMUINDXD`) | Newspaper-based, daily since 1985 (S2) | S2 |
| G-P6 | Wikipedia attention basket (active wars, chokepoints, "Nuclear warfare"), several languages, excluding "World War III" | 1-day lag nowcast. The spike found "World War III" same-day and harmful as a plain past covariate, so test only through the gap-filling design | S5 |
| G-P7 | Google Trends ("war", "missile strike") | Same-day attention. Sampling noise and access problems (section 1) | S6 |
| G-P8 | Event counts from the other targets' domains: PLA sorties, Air Force launched counts, JMIC incidents | Acts generate articles. Hypothesis | S12, S16, S15 |
| G-P9 | Prediction-market probabilities on geopolitical questions | Forward-looking. Political prices are compressed toward 50% ([arXiv 2602.19520](https://arxiv.org/pdf/2602.19520)). Polymarket licence blocks it | S20 |
| G-P10 | Count of OFAC designations per day | Sanctions news. Hypothesis | S14 |
| G-P11 | UCDP Candidate fatalities | Monthly, so too slow for daily lead | S22 |
| G-P12 | Country GPR | Monthly only ([GPR page](https://www.matteoiacoviello.com/gpr.htm)) | S1b |

### Inferences
- GPRD is updated weekly (S1), so a covariate that is fresh daily can only help through the gap-filling design (section 1). It cannot help by leading GPR, because the spike found same-day co-movement and no lead.
- Tests should use GPR vintages (S1). Otherwise the preliminary, later-revised values of the last days make backtests optimistic.

### Gaps
- No published study found of EPU, GDELT or VIX leading or nowcasting daily GPR.
- No "Twitter-based" or other daily GPR variant found on the GPR page.

---

## 3. Brent spot: candidate covariates

### Takeaway
The no-change forecast is hard to beat for oil: futures are less accurate than no-change in mean squared error ([Alquist, Kilian and Vigfusson](https://www.federalreserve.gov/pubs/ifdp/2011/1022/ifdp1022.htm)). The free futures curve is gone (S4).

The most promising candidates:
- ★ OVX, as a fresh nowcast of the stale FRED days;
- ★ tanker transits at Hormuz and Bab-el-Mandeb (the reverse of the link the spike tested);
- ★ GPR Acts or GDELT Middle-East conflict;
- ★ the OPEC+ meeting calendar.

### Cited Findings

Known-future:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| B-K1 | Brent and WTI futures curve, months 1 to 6 | Futures are "less accurate in the MSPE sense than no-change forecasts", with some accuracy gains at short horizons ([Alquist, Kilian and Vigfusson](https://www.federalreserve.gov/pubs/ifdp/2011/1022/ifdp1022.htm), [ZBW abstract](https://journaldata.zbw.eu/dataset/2a6a1cb4-b4ef-4a2f-b337-1b2ed6298f2c/resource/aa7bdce0-1cde-47f0-af53-b0fca4f35386)). No free source since 2024-04-05 ([EIA](https://www.eia.gov/dnav/pet/pet_pri_fut_s1_d.htm)) | S4 (blocked) |
| B-K2 ★ | OPEC+ meeting dates (ministerial, monitoring committee, monthly calls of the 8 countries) | Supply decisions. Hypothesis: volatility clusters around the dates | S23 (unverified) |
| B-K3 | EIA weekly inventory report (Wednesdays) and CFTC positioning report (Fridays) release days | Hypothesis: news days for oil | S23 (unverified) |
| B-K4 | ICE and UK/US trading holidays, contract expiry and roll dates | Missing observations and roll effects. The spike masks weekends and holidays | S11 (unverified) |
| B-K5 | Announced geopolitical deadlines (US–Iran talks, sanctions dates) | Hypothesis | S23 |
| B-K6 | Day of week | Untested on Brent; trading days only | none |

Past-only:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| B-P1 ★ | OVX (crude-oil implied volatility) | Updated about 1 day after the close, while Brent on FRED arrives in weekly batches up to 8 days stale (S3; spike). So it is a nowcast of the gap. Copyrighted CBOE | S3 |
| B-P2 ★ | Hormuz and Bab-el-Mandeb tanker transits (`n_tanker`) and capacity | Physical supply. Spike: Brent rose 71 to 104 USD/bbl (Feb to Mar 2026 monthly means) as Hormuz fell from 78 to 3 transits a day. The spike tested Brent → Hormuz only, not Hormuz → Brent | S8 |
| B-P3 ★ | GPRD_ACT, or GDELT material conflict in the Gulf and Red Sea | Realised attacks raise the supply risk premium. Hypothesis at daily lead | S1, S7 |
| B-P4 | WTI spot and the Brent–WTI spread | The spread prices seaborne risk (hypothesis). Same EIA batch lag, so no freshness gain (S3) | S3 |
| B-P5 | Broad dollar index (`DTWEXBGS`) | Dollar and oil linkage (hypothesis). H.10 weekly lag (S3) | S3 |
| B-P6 | VIX and the 10-year minus 2-year yield spread | Risk appetite and growth expectations (hypothesis) | S3 |
| B-P7 | Henry Hub gas (`DHHNGSP`) | Energy-complex co-movement (hypothesis) | S3 |
| B-P8 | EIA weekly crude inventories and CFTC managed-money positions | Fundamentals and positioning (hypothesis) | unverified |
| B-P9 | Prediction markets on oil-price thresholds or Hormuz reopening | Forward-looking, but licence (S20) | S20 |
| B-P10 | Wikipedia and GDELT attention to "Strait of Hormuz" and "oil price" | 1-day fresh | S5, S7 |
| B-P11 | Tanker rates, war-risk premia | No free daily series (S21) | S21 (blocked) |

### Inferences
- Only covariates fresher than FRED's weekly Brent batch can plausibly help at h 1-7. OVX qualifies; WTI does not, because it shares the EIA batch.
- At h 8-30, no-change plus volatility is the bar. Covariates should be judged mainly on calibration (cov80), not point error.

### Gaps
- OPEC+ calendar source and history not verified.
- ICE Brent expiry rule not verified.
- No free daily Dubai or Oman price found to build a Brent–Dubai spread.

---

## 4. Wikipedia "World War III" pageviews: candidate covariates

### Takeaway
Wikimedia offers same-API proxies that are free, CC0 and keyless:
- ★ the same article in other languages;
- ★ the article's automated-agent views, as a bot-contamination flag;
- ★ a related-article basket.

Two more top candidates:
- ★ GDELT mentions of "World War III", which are fresher than the 1-day pageview lag;
- ★ a calendar of scheduled confrontational events.

### Cited Findings

Known-future:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| W-K1 ★ | Calendar of scheduled high-salience events: NATO summits, US elections and inauguration, UNGA, announced deadlines | Hypothesis: attention spikes around scheduled confrontations | S23 |
| W-K2 | Day of week, US/UK school terms and holidays | Untested on this target (the spike used it only as a covariate). Hypothesis: student browsing | S11 |
| W-K3 | Releases of films or games with a "World War 3" theme | Hypothesis. No evidence found | none |

Past-only:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| W-P1 ★ | The same article in ru, de, uk, es, fr, ja and zh | Verified: ru median 608/day (max 60,784); de median 344 (max 7,977) (S5). Time-zone offsets may give a few hours of lead (hypothesis) | S5 |
| W-P2 ★ | Automated-agent views of the same article | Verified: median 176 against 2,992 for users (S5). Flags bot bursts that leak into the `user` count (hypothesis) | S5 |
| W-P3 ★ | Related-article basket: "Nuclear warfare" (median 655, verified), "Doomsday Clock", "Conscription", "Selective Service System", current war articles | Attention cascades (hypothesis) | S5 |
| W-P4 ★ | GDELT GKG or DOC counts of "World War III" / "WW3" mentions | 15-minute freshness against a 1-day lag. DOC API rate limits (S7) | S7 |
| W-P5 | Google Trends "world war 3" | Closest proxy for search interest. Sampling noise and access (S6) | S6 |
| W-P6 | Reddit post counts (e.g. r/worldnews) | Hypothesis. API terms unverified | unverified |
| W-P7 | Edit counts on the article (MediaWiki API) | Hypothesis. Unverified | unverified |
| W-P8 | VIX, GVZ | Same-day fear (hypothesis) | S3 |
| W-P9 | Prediction-market prices on "WW3 by date" questions | Licence (S20) | S20 |
| W-P10 | GPRD (the reverse of the spike's link) | Weekly lag, so it can only enter lagged | S1 |

### Inferences
- The spike found "World War III" views move with GPR on the same day. So the useful covariates for this target are those observable within the same day: GDELT, and other-language pageviews where they are timezone-shifted. With a 1-day publication lag, only the gap-filling design can use them.

### Gaps
- No study found linking Wikipedia attention to geopolitical events at a daily lead. Wikipedia-based nowcasting papers exist for disease and markets but were not retrieved this session.

---

## 5. Suez Canal transits: candidate covariates

### Takeaway
The top candidates:
- ★ Cape of Good Hope transits, the substitution route;
- ★ JMIC merchant-vessel incident counts;
- ★ GDELT events located in Yemen and the Red Sea;
- ★ a Lunar New Year / Golden Week indicator shifted by the Asia–Europe sailing time;
- ★ a Gaza/Houthi ceasefire state indicator.

### Cited Findings

Known-future:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| SZ-K1 ★ | Lunar New Year and Golden Week indicators shifted by about 3 to 5 weeks | Hypothesis: Asian factory shutdowns thin Asia–Europe sailings that reach Suez weeks later. The spike tested Lunar New Year only on Taiwan, with no shift | S11 |
| SZ-K2 ★ | Gaza and Red Sea ceasefire state, and announced deadlines | The Houthi campaign is tracked by JMIC since 19 Nov 2023. JMIC reported no Houthi attacks on merchant vessels in February 2026 ([JMIC Feb 2026](https://mscio.eu/media/documents/JMIC_Monthly_Statistics_-_Feb_2026.pdf)). Must be dated at announcement | S15, S23 |
| SZ-K3 | Wind and sandstorm forecasts at Suez (lead 1 to 7) | Hypothesis: high winds slow or suspend convoys | S9 |
| SZ-K4 | Announced carrier network changes (return to the Red Sea) and Suez Canal Authority toll rebates | Hypothesis. Announcement-dated | S23 |

Past-only:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| SZ-P1 ★ | Cape of Good Hope transits (PortWatch chokepoint) | Substitution: in early 2024 Suez transit volume was down about 50% year on year while the Cape was up about 74% ([IMF Chart of the Week](https://content.govdelivery.com/accounts/USIMF/bulletins/38f4726)). Same source and lag as the target | S8 |
| SZ-P2 ★ | JMIC incident counts (attacks, approaches) | Direct driver. Incident list since 2023-11-19 ([JMIC dashboard](https://www.steamshipmutual.com/sites/default/files/medialibrary/files/JMIC%20Week%2023%20Dashboard%202%20JUNE%20-%208%20JUNE%202025%201.pdf)). PDFs only | S15 |
| SZ-P3 ★ | GDELT material-conflict events located in Yemen and the Red Sea | Fresh. Geographic bias caveat (section 1) | S7 |
| SZ-P4 | Vessel-type split of the target and of Bab-el-Mandeb (`n_container`, `n_tanker`, dry bulk) | Containers reacted strongly: Red Sea container shipping fell almost 30% ([IMF via Asharq Al-Awsat](https://english.aawsat.com/business/4826376-red-sea-container-shipping-down-30-over-attacks-says-imf)) | S8 |
| SZ-P5 | Port calls at Port Said, Jeddah, Djibouti, Piraeus | Hypothesis: regional activity. Port-level daily data exist (S8) | S8 |
| SZ-P6 | Container freight indices (FBX, WCI, SCFI) | Red Sea risk premium. FBX by subscription (S21) | S21 |
| SZ-P7 | War-risk premia | +50% in February 2024 ([PISM](https://pism.pl/webroot/upload/files/Biuletyn/PISM%20Bulletin%20no%2027%20(2335)%2019%20February%202024.pdf)). No free series | S21 (blocked) |
| SZ-P8 | Wikipedia views of "Houthis" and "Red Sea crisis" | 1-day fresh attention | S5 |
| SZ-P9 | Prediction markets on Houthi attacks or a ceasefire | Licence | S20 |
| SZ-P10 | OFAC Yemen- and Iran-related designations | Hypothesis | S14 |

### Inferences
- PortWatch is about 4 days stale. GDELT and Wikipedia can fill those days through the gap-filling design.
- Cape transits share the target's lag, so they can only act as a regime indicator.

### Gaps
- No structured (CSV) Houthi incident list found. JMIC is PDF only.
- No quantitative evidence found for the shifted Lunar New Year effect at Suez, or for wind closures.

---

## 6. Strait of Hormuz transits: candidate covariates

### Takeaway
In the 2026 near-closure regime (2 to 5 transits a day in late October, [data-sources.md](../../data-sources.md)), the drivers are political. The top candidates:
- ★ a dated diplomacy and deadline calendar;
- ★ port calls at Gulf and bypass ports;
- ★ prediction-market reopening probabilities (licence permitting);
- ★ UKMTO/JMIC Gulf incidents;
- ★ GDELT events located in Iran and the Gulf.

### Cited Findings

Known-future:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| H-K1 ★ | Calendar of US–Iran talks, IAEA Board meetings, ceasefire and sanctions deadlines | Hypothesis: reopening or escalation clusters around them. Announcement-dated | S23 (unverified) |
| H-K2 | OPEC+ meeting dates | Hypothesis: export volumes | S23 |
| H-K3 | Shamal wind and dust-storm forecasts | Hypothesis, weak | S9 |

Past-only:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| H-P1 ★ | Port calls at Jebel Ali, Ras Tanura, Dammam (inside the strait), and Fujairah, Sohar, Yanbu (bypass routes) | Hypothesis: queues and bypass flows anticipate or replace transits. Port-level daily data exist (S8) | S8 |
| H-P2 ★ | Prediction-market probability of Hormuz reopening or a US–Iran deal | Directly forward-looking. Political prices are compressed toward 50% ([arXiv 2602.19520](https://arxiv.org/pdf/2602.19520)). Polymarket licence blocks it; Kalshi terms unverified | S20 |
| H-P3 ★ | JMIC/UKMTO Gulf incidents and changes in threat level | Direct driver | S15 |
| H-P4 ★ | GDELT material conflict and tone located in Iran and the Gulf | Fresh | S7 |
| H-P5 | OVX | Oil-market fear, 1 day fresh | S3 |
| H-P6 | Vessel-type split (`n_tanker` against the rest), capacity | Composition shift | S8 |
| H-P7 | Wikipedia "Strait of Hormuz" views | 1-day fresh (series verified in [data-sources.md](../../data-sources.md)) | S5 |
| H-P8 | OFAC Iran-related designations and general licences | Iran-related designations and general licences appear in October 2026 ([OFAC](https://ofac.treasury.gov/recent-actions)) | S14 |
| H-P9 | Joint War Committee listed areas, war-risk premia | No free series found | unverified |

### Inferences
- The baseline spike found Hormuz is where the model has most room to gain. GPR, Brent and Bab-el-Mandeb are already excluded by the spike, so the untested families are port calls, incidents, prediction markets and dated diplomacy.

### Gaps
- No evidence retrieved on whether port calls lead Hormuz transits.
- No free data found on Joint War Committee listed areas or premia.

---

## 7. Bab-el-Mandeb transits: candidate covariates

### Takeaway
The top candidates are the same as for Suez:
- ★ JMIC incidents;
- ★ Cape transits;
- ★ GDELT Yemen events, including strikes on Yemen;
- ★ a Gaza/Houthi ceasefire state indicator;
- ★ the shifted Lunar New Year / Golden Week indicator.

### Cited Findings

Known-future:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| BM-K1 ★ | Gaza/Houthi ceasefire state and deadlines | No Houthi attacks on merchant vessels in February 2026 ([JMIC Feb 2026](https://mscio.eu/media/documents/JMIC_Monthly_Statistics_-_Feb_2026.pdf)) | S15, S23 |
| BM-K2 ★ | Shifted Lunar New Year and Golden Week indicators | As SZ-K1 (hypothesis) | S11 |
| BM-K3 | Southwest monsoon (June to September) and wave-height forecasts in the Gulf of Aden | Hypothesis | S9 (marine API unverified) |

Past-only:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| BM-P1 ★ | JMIC incident counts | Direct driver ([JMIC dashboard](https://www.steamshipmutual.com/sites/default/files/medialibrary/files/JMIC%20Week%2023%20Dashboard%202%20JUNE%20-%208%20JUNE%202025%201.pdf)) | S15 |
| BM-P2 ★ | Cape of Good Hope transits | Substitution ([IMF Chart of the Week](https://content.govdelivery.com/accounts/USIMF/bulletins/38f4726)) | S8 |
| BM-P3 ★ | GDELT material-conflict events in Yemen, including US and Israeli strikes | Fresh | S7 |
| BM-P4 | Port calls at Djibouti, Jeddah, Salalah | Hypothesis | S8 |
| BM-P5 | Vessel-type split | As SZ-P4 | S8 |
| BM-P6 | Wikipedia "Houthis" views | Attention | S5 |
| BM-P7 | Freight indices, war-risk premia | Blocked | S21 |
| BM-P8 | Prediction markets on Houthi attacks | Licence | S20 |
| BM-P9 | Counts of Houthi military spokesman statements | Hypothesis. Telegram scraping, hard | none |

### Inferences
- Suez and Bab-el-Mandeb share drivers. Screen one shared Red Sea covariate set on both, to halve the work.

### Gaps
- Same as Suez. The Open-Meteo Marine API was not verified.

---

## 8. Taiwan Strait transits: candidate covariates

### Takeaway
The top candidates:
- ★ typhoon wind and wave forecasts (genuine known-future, honest from 2024);
- ★ the Chinese and Taiwanese holiday calendar beyond Lunar New Year;
- ★ PLA daily activity counts;
- ★ port calls at Chinese and Taiwanese ports;
- ★ the Taiwan political calendar, which predicts the triggers of large PLA drills.

### Cited Findings

Known-future:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| T-K1 ★ | Wind, wave and typhoon forecasts over the strait, lead 1 to 7 | Typhoons close ports: Saola closed Taiwan's ports ([MarineLink](https://marinelink.com/news/disrupts-shipping-typhoon346698)); Gaemi ([Ship & Bunker](https://shipandbunker.com/news/apac/509815-shipping-bunkering-disrupted-by-taiwan-typhoon)); Bavi (July 2026) closed the Taipei Port container terminal ([Cyprus Shipping News](https://cyprusshippingnews.com/2026/07/14/typhoon-bavi-hits-taiwan-china-disrupting-pacific-vessel-supply/)). During Dolphin (August 2026) Guangdong MSA imposed traffic controls on northbound ships entering the strait ([Baird Maritime](https://www.bairdmaritime.com/shipping/taipei-chinas-traffic-control-order-for-taiwan-strait-during-typhoon-ridiculous)) | S9 |
| T-K2 ★ | Chinese and Taiwanese holidays beyond Lunar New Year: Golden Week (1 to 7 October), Labour Day, Qingming, Dragon Boat, Mid-Autumn | Same factory-shutdown mechanism the spike saw at Lunar New Year (−27% median error in the holiday week). Hypothesis for the other holidays | S11 |
| T-K3 ★ | Taiwan political calendar: 20 May inauguration anniversary, 10 October National Day, elections, Han Kuang exercise | These dates trigger large PLA drills. Joint Sword-2024A came 3 days after the inauguration; Joint Sword-2024B followed the National Day speech ([ASPI](https://www.pressurepoints.aspi.org.au/taiwan-and-the-taiwan-strait/chinas-military-coercion/chinas-large-scale-exercises-since-2022), [Global Taiwan](https://globaltaiwan.org/2024/10/the-joint-sword-2024b-exercise/)). Strait Thunder-2025A followed a 13 March speech ([Global Taiwan](https://globaltaiwan.org/2025/04/the-plas-strait-thunder-exercise/)). Justice Mission 2025, on 29 to 30 December, rehearsed cutting the island off ([Jamestown](https://jamestown.org/pla-justice-mission-2025-further-rehearses-taiwan-invasion-operations)). Effect on transit counts not measured | S13, S23 |
| T-K4 | Typhoon-season month indicator (July to October) | Seasonal (hypothesis) | derived |

Past-only:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| T-P1 ★ | PLA aircraft and vessel counts | Escalation and drills (S12). Tracker CSV only from 2026-01-01; the PLATracker sheet from September 2020 must be requested | S12 |
| T-P2 ★ | Port calls at Kaohsiung, Taichung, Keelung, Xiamen, Fuzhou, Shanghai, Ningbo, Busan | Regional trade cycle (hypothesis). Same lag as the target | S8 |
| T-P3 | Observed storm state (Historical Forecast or ERA5 wind) | Lagged weather (hypothesis) | S9 |
| T-P4 | Container rates (SCFI) | Demand. Licence unverified | S21 |
| T-P5 | TWD/USD (`DEXTAUS`) | Risk sentiment (hypothesis). Weekly H.10 lag | S3 |
| T-P6 | GDELT China–Taiwan events and tone | Fresh | S7 |
| T-P7 | Wikipedia "Taiwan Strait" views | Attention | S5 |
| T-P8 | Prediction markets on a blockade or invasion | Licence | S20 |

### Inferences
- Taiwan Strait is the only series where a known-future covariate (Lunar New Year) already showed an interpretable effect. Typhoons and other holidays are the natural extension. Both are cheap: an Open-Meteo call or a calendar.
- PLA drill dates themselves are not announced in advance. Only their political triggers are, so T-K3 is a trigger window, not an event list.

### Gaps
- No AIS-based quantification found of the drop in transits during a typhoon in the strait.
- Not checked whether PortWatch transit counts dipped during the PLA drills.

---

## 9. Ukraine air-raid alert-hours: candidate covariates

### Takeaway
The top candidates:
- ★ weather forecasts (cloud, precipitation, visibility, wind) from Open-Meteo Previous Runs;
- ★ night length and moon illumination (cheap, but with no evidence for the moon);
- ★ Air Force launched counts;
- ★ a derived "days since last mass strike" stockpiling clock;
- ★ a dated diplomacy and truce calendar.

The weather evidence is qualitative and partly contradictory.

### Cited Findings

Known-future:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| A-K1 ★ | Weather forecasts over Ukraine and launch areas: cloud cover, precipitation, fog or visibility, wind | **For:** Russian planners check weather along the route and at the target before jet Shahed launches ([Censor.net, Ihnat](https://censor.net/en/news/4024498/air-force-1-900-jet-powered-shaheds-launched)). Air-defence effectiveness fell "20-30%" in overcast weather ([Kyiv Independent, Oct 2025](https://kyivindependent.com/ukraines-autumn-rains-help-shahed-type-drones-evade-ukrainian-air-defense/)). An 863-drone barrage flew under cloud ([Migflug](https://migflug.com/afterburner/russia-863-drone-barrage-ukraine-cloud-cover-geran-2026/), a secondary source). **Against:** "Shaheds fly in any weather" ([Kyiv Independent](https://kyivindependent.com/ukraines-autumn-rains-help-shahed-type-drones-evade-ukrainian-air-defense/), [Mind.ua](https://mind.ua/en/news/20259931-occupiers-use-poor-weather-for-air-attacks-on-ukraine)). No quantitative study found | S9 |
| A-K2 ★ | Night length and moon illumination | Hypothesis: nocturnal raids and visual detection by mobile fire groups ([Kyiv Independent](https://kyivindependent.com/ukraines-autumn-rains-help-shahed-type-drones-evade-ukrainian-air-defense/)). But daytime attacks grew more frequent by April 2026 ([Moscow Times / AFP](https://www.themoscowtimes.com/2026/05/01/russia-fired-record-number-of-drones-at-ukraine-in-april-afp-analysis-a92664/pdf)). No moon-phase evidence found | S10 |
| A-K3 ★ | Dated calendar of talks, summits, announced truces and energy-strike moratoria | Hypothesis. Announcement-dated | S23 |
| A-K4 | Holidays and symbolic dates (Ukrainian Independence Day, Orthodox Easter and Christmas, 9 May) | Hypothesis | S11 |
| A-K5 | Heating-season indicator (October to March) | Hypothesis: the energy-grid campaign before winter | derived |

Past-only:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| A-P1 ★ | Air Force launched counts by weapon type (Shahed/Geran, decoys, missiles) | Strike intensity. This is a different series from the General Staff drones count that the spike tested. Datasets: [ua-energy](https://map.ua-energy.org/en/resources/12f3148d-841a-478d-b9ed-72bf0764b286), Kaggle (NC-SA, with reporting gaps since 2026-08-10, [Kaggle](https://www.kaggle.com/api/v1/datasets/view/piterfm/massive-missile-attacks-on-ukraine)) | S16 |
| A-P2 ★ | Days since the last mass strike, rolling launched totals (derived) | Stockpiling: Russian pauses were explained as "preparing the next phase" ([RBC-Ukraine](https://newsukraine.rbc.ua/news/night-without-shaheds-why-russia-pauses-uav-1733836876)) | derived from S16 or the target |
| A-P3 | Alert composition by region (frontline against rear oblasts) | A region's alert status depends strongly on its neighbours, with hour, day of week and month also important (5-minute horizon) ([Pavlyshenko, arXiv 2411.14625](https://arxiv.org/abs/2411.14625)) | target source |
| A-P4 | Russian MoD claims of Ukrainian drones downed | Hypothesis: retaliation cycles. Claims reached up to 1,158 in a day ([Ukrainska Pravda](https://www.pravda.com.ua/eng/news/2026/08/02/8046907/)). No dataset found | S17 |
| A-P5 | FIRMS hotspots at Russian refineries and airbases | Hypothesis: Ukrainian strikes, then retaliation. Noisy ([data-sources.md](../../data-sources.md)) | FIRMS |
| A-P6 | Term counts from ISW daily assessments ("Shahed", "strike package") | Hypothesis. Terms of use not found | S19 |
| A-P7 | Cloudflare Radar traffic for Ukraine (outages after strikes) | Same-day. CC BY-NC ([data-sources.md](../../data-sources.md)) | Cloudflare |
| A-P8 | DeepState territorial change | Front intensity. Restrictive licence ([DeepState licence](https://deepstatemap.live/license-en.html)) | S18 |

### Inferences
- Alert-hours are a sum over regions and dominated by mass-strike nights. So the drivers that operate on a daily scale are Russia's launch decision (weather, stockpile, diplomacy) and Ukraine's detection conditions. Both are only partly observable before the fact.
- Weather forecasts are the one known-future family with a stated mechanism, and they can be backtested honestly from January 2024.

### Gaps
- No quantitative study found of weather or moon phase against Shahed launches or alerts.
- Truce dates (e.g. Easter or 9 May) were not verified this session.

---

## 10. Russian drones downed per day (claimed by Ukraine): candidate covariates

### Takeaway
The target is the General Staff category "Drone - UAV+RPA" ([PetroIvaniuk README](https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset)), about 1,600 a day ([data-sources.md](../../data-sources.md)). That volume suggests mostly front-line UAVs, not just Shaheds, but the composition is undocumented.

The top candidates:
- ★ weather forecasts along the front;
- ★ the other General Staff categories from the same file (front intensity);
- ★ Air Force launched counts for the long-range part;
- ★ air-raid alert-hours (the reverse link, untested).

### Cited Findings

Known-future:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| D-K1 ★ | Wind, precipitation, cloud and fog forecasts along the front and over Ukraine | Hypothesis for tactical UAVs. For Shahed detection, see A-K1 | S9 |
| D-K2 | Daylight hours, moon illumination | Hypothesis: visual and thermal operations | S10 |
| D-K3 | Day of week | Untested on this target (the spike used drones only as a covariate) | none |
| D-K4 | Dated truce and talks calendar | Hypothesis | S23 |

Past-only:

| # | Candidate | Mechanism and evidence | Source |
|---|---|---|---|
| D-P1 ★ | Other categories in the same General Staff file: personnel, artillery, vehicles | Front-line intensity, same report, free. The README notes category changes, e.g. "Vehicles and Fuel Tanks" merged on 2022-05-01 ([PetroIvaniuk README](https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset)) | same file |
| D-P2 ★ | Air-raid alert-hours | The reverse of the spike's test, untested. Same-night co-movement. Alerts are complete up to yesterday, while drones carry today's report (spike), so alerts enter 1 day older | Vadimkin dataset |
| D-P3 ★ | Air Force launched counts | The long-range component (S16) | S16 |
| D-P4 | Russian MoD claims of Ukrainian drones downed | Mirror intensity (hypothesis). No dataset | S17 |
| D-P5 | Oryx visually confirmed losses (`russia_losses_equipment_oryx.json`) | Slower, verified losses ([PetroIvaniuk README](https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset)) | same repo |
| D-P6 | DeepState territorial change, ISW text counts | Assault intensity. Licence problems | S18, S19 |
| D-P7 | Observed weather (Historical Forecast) | Lagged conditions | S9 |

### Inferences
- The target is one belligerent's claim with reporting artefacts. The equipment file has a corrections file covering 2022-10-13 and 2023-05-27 ([PetroIvaniuk README](https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset)). Covariates from the same report (D-P1) share its artefacts, which can help the forecast.

### Gaps
- The composition of "Drone - UAV+RPA" (tactical against long-range) is not documented in the sources checked.
- No study found on weather and tactical drone loss counts.
