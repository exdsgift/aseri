# Expert UX audit of the aseri site: how well it communicates its forecasts (state of 2026-10-31)

Scope and method, so the report writer can weigh the evidence:

- Live site: [exdsgift.github.io/aseri](https://exdsgift.github.io/aseri/), catalog `generated_at` 2026-10-31T09:27:57Z. Five series were live that day: Geopolitical risk (GPR), Suez Canal, Strait of Hormuz, Bab el-Mandeb, Taiwan Strait. `Signals.tsx` also defines Wikipedia "WW3" views, Brent and two Ukraine series, which are left out when not in the catalog ([Signals.tsx](../../../../web/src/components/Signals.tsx)).
- Screenshots taken with headless Edge on 2026-10-31. Hero at 1440x900 and 390 px from the live URL. Panel, cards and Record from a byte-for-byte local mirror of the live build and its `api/v1` JSON, rendered in a same-origin iframe with the hero pinned to one viewport height so a tall capture works. Files (session scratchpad, not in the repo):
  - `C:/Users/GAA321~1.DUR/AppData/Local/Temp/claude/C--Users-ga-durante/37928828-eb21-4657-9a52-fbf85ec7e3ec/scratchpad/shots/live_hero_1440.png`
  - `C:/Users/GAA321~1.DUR/AppData/Local/Temp/claude/C--Users-ga-durante/37928828-eb21-4657-9a52-fbf85ec7e3ec/scratchpad/shots/full_1440_00.png` to `full_1440_03.png` (desktop, top to bottom)
  - `C:/Users/GAA321~1.DUR/AppData/Local/Temp/claude/C--Users-ga-durante/37928828-eb21-4657-9a52-fbf85ec7e3ec/scratchpad/shots/full_390_00.png` to `full_390_04.png` (390 px, top to bottom)
  - Caveat: `live_hero_390.png` shows hero text clipped at the right edge. That is a headless-Edge artifact (the browser enforces a minimum window width); the 390 px iframe render (`full_390_00.png`) wraps correctly. It is not a site bug.
- Word counts: the rendered DOM (`--dump-dom`, desktop, 2026-10-31) parsed per section, counting visible text tokens (words and numbers; `aria-label` text and scripts excluded). Phrase counts come from the same dump.
- Every string quoted below is copied from the components in `web/src/components/` as rendered on 2026-10-31.
- Judgements (essential / redundant / move behind a tap, severity) are the auditor's heuristic expert review. No users were tested; see Gaps.

---

## First glance (5 seconds): what does a first-time visitor understand from each block, and what should they?

### Takeaway
In five seconds a newcomer gets one thing: "geopolitical risk is 181, 81% above its long-run average". They do not get where it is heading. The forecast arrives as a 27-word sentence that compares a 7-day average (181) with a single-day forecast (most likely 168), which reads as "risk will fall" when the forecast is in fact flat against the like-for-like value (last Monday 165). Below the hero, no block has a headline that states its takeaway. The panel opens with three date and metadata lines, the cards give the most newsworthy anomaly on the page (Hormuz traffic 88% below its mean) the same weight as normal lanes, and the Record repeats "Collecting live record: 0 of 30" five times before any verdict.

### Cited Findings
- **Hero, rendered text (desktop, 2026-10-31):** "焦り / あせり · ASERI" wordmark; "Geopolitical risk · today"; "181"; "7-day average to Oct 26"; "81% above its 1985-2019 average"; "Monday Nov 23, 4 weeks from the last data: 8 in 10 between 111 and 251, 2 in 10 outside. Most likely 168. (Last Monday: 165)"; "GPR runs on a weekly cycle: compare Monday with Monday. Data as of Oct 31, preliminary for about 4 weeks." ([Hero.tsx](../../../../web/src/components/Hero.tsx), lines 44-81; screenshot `live_hero_1440.png`)
- **181 versus 168 compares different quantities:** the giant number is `today.sevenDayAverage` ("7-day average to Oct 26"), while the forecast (`low`, `high`, `mostLikely`) is of the *daily* value on the target day. The only like-for-like comparison, the daily value on the reference Monday, sits last and in parentheses: "(Last Monday: 165)" ([Hero.tsx](../../../../web/src/components/Hero.tsx), lines 56-74). The panel's own comment confirms it: "The forecast is of the daily value: a range for one day, not for the days up to it" ([SignalCard.tsx](../../../../web/src/components/SignalCard.tsx), line 67).
- **"Today" versus the actual dates:** the hero eyebrow says "Geopolitical risk · today", but the number is an average to Oct 26, data are "as of Oct 31", and the panel says "forecast made Oct 30" ([Hero.tsx](../../../../web/src/components/Hero.tsx); [ForecastPanel.tsx](../../../../web/src/components/ForecastPanel.tsx), lines 89-110).
- **The hero's art carries data with no label:** the Mercury rays open wider as GPR's 7-day average rises against its baseline ("Each fan opens with GPR's 7-day average against its baseline"), and the component calls itself "Decorative: the number and the sentence under it say in words what it shows" ([web/src/lib/messenger.ts](../../../../web/src/lib/messenger.ts), lines 24-30; [Messenger.tsx](../../../../web/src/components/Messenger.tsx), lines 30-31).
- **The hero number counts up on arrival**, 40 ms a step ([Hero.tsx](../../../../web/src/components/Hero.tsx), lines 95-107). Captures taken shortly after load showed "159" and "166" instead of 181 (`live_hero_390.png`, `full_390_00.png`).
- **The first viewport of the forecast panel** (desktop, `full_1440_00.png`) shows, before the chart: "[F] Geopolitical risk · forecast made Oct 30" / "index (1985-2019 average = 100) · data to Oct 26" / "Data as of Oct 31, preliminary for about 4 weeks." / "Nov 23 · 8 in 10: 111-251 · most likely 168" / "Real value on Nov 23: not known yet" / "Scored as each real value comes in" ([ForecastPanel.tsx](../../../../web/src/components/ForecastPanel.tsx), lines 87-155).
- **The chart's only titles are descriptive labels:** "Daily values · 7-day avg" (phone: "Daily · 7d avg") over the past, "Next 28 days" over the forecast ([PixelForecastChart.tsx](../../../../web/src/components/PixelForecastChart.tsx), lines 222-225).
- **Signal cards (2026-10-31), as displayed:** Geopolitical risk "181 index (1985-2019 average = 100) / 7-day average to Oct 26 / 81% above its 1985-2019 average / In 28 days: 111-251 / 8 in 10 for Nov 23 alone"; Suez "41 ships a day / 1% above its 365-day mean / In 28 days: 33-51"; Strait of Hormuz "3 ships a day / 88% below its 365-day mean / In 14 days: 0-6 / 8 in 10 for Nov 08 alone"; Bab el-Mandeb "29 / 14% below / In 14 days: 20-36"; Taiwan Strait "190 / 18% below / In 28 days: 183-268" (`full_1440_02.png`; [SignalCard.tsx](../../../../web/src/components/SignalCard.tsx)). All cards share one visual weight; the cards are ordered by fixed group, not by how unusual they are ([Signals.tsx](../../../../web/src/components/Signals.tsx), lines 9-27).
- **Record, top of section:** "How past forecasts did against what happened. Pick a square to replay its forecast above." Then each of the 5 cards opens with "Collecting live record: 0 of 30" and "Backtest, not the live record" ([TrackRecord.tsx](../../../../web/src/components/TrackRecord.tsx), lines 42-45, 112-124; `full_1440_02.png`).
- **Backtest squares as displayed:** GPR 7 of 8, Suez 5 of 8, Hormuz 6 of 8, Bab el-Mandeb 8 of 8, Taiwan 7 of 8 "inside the 8 in 10 range" (`full_1440_02.png`, `full_1440_03.png`, `full_390_03.png`). Summed by the auditor: 33 of 40, about 8 in 10. The page never states this aggregate.
- **NN/g on reading behaviour:** "79 percent of our test users always scanned any new page they came across; only 16 percent read word-by-word"; recommended writing uses "the inverted pyramid style, starting with the conclusion" and "half the word count (or less) than conventional writing"; concise, scannable and objective text together scored "124% better usability" ([Nielsen, How Users Read on the Web, NN/g](https://www.nngroup.com/articles/how-users-read-on-the-web/)).
- **F-pattern:** readers fall into F-shaped scanning when "there are no strong cues to attract the eyes towards meaningful information"; put the most important points first and start headings with the words that carry the most meaning, so that someone who reads only the first two words of a section still gets its gist ([Pernice, F-Shaped Pattern, NN/g, 2017](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/)).
- **Knaflic:** title a chart with its takeaway instead of a generic label, e.g. "Headcount has increased 16% year-over-year" instead of "Retention" ([SHRM interview with Cole Nussbaumer Knaflic](https://shrm.org/topics-tools/news/technology/using-pictures-storytelling-to-present-business-data)); action titles that state the takeaway explicitly ([SuperSummary, Storytelling with Data](https://www.supersummary.com/storytelling-with-data/summary)). Secondary sources; the book itself was not consulted.
- **FiveThirtyEight 2020** led with a plain-language verdict, "Biden is favored to win the election", rather than a percentage, then showed 100 representative outcomes as a "ball swarm", with the Fivey Fox mascot reminding readers that upsets are possible ([FlowingData](https://flowingdata.com/2020/08/12/fivethirtyeight-launches-2020-election-forecast); [Nieman Lab](https://www.niemanlab.org/2020/07/this-is-how-fivethirtyeight-is-trying-to-build-the-right-amount-of-uncertainty-into-its-2020-election-data-analysis/)). Secondary: FiveThirtyEight's own design article now redirects to ABC News.

### Inferences
- **The single takeaway each block should give, versus what it gives today:**

| Block | Should say in 5 s | Says today | Verdict |
|---|---|---|---|
| Hero | "Risk is high (about double normal) and should stay about this high for the next 4 weeks." | "181, 81% above normal." The outlook is buried in a sentence that seems to say "falling to 168". | Half delivered. The level comes across; the direction is wrong or missing. |
| Forecast panel | "Here is where it has been and the range it should stay in through Nov 23." | Six lines of dates and metadata, then an unlabelled chart in which one spiky "model path" looks like the prediction, then 7 legend items and two paragraphs. | Not delivered without reading. |
| Signal cards | "Which lanes are abnormal right now, and which way they are heading." | Five same-weight cards. The striking item (Hormuz at 3 ships a day, 88% below its mean) sits in 8 px grey text. | Not delivered: nothing is ranked or flagged. |
| Record | "Can I trust these ranges? Yes: 33 of the last 40 landed in range, close to the 8 in 10 promised." | "Collecting live record: 0 of 30" ×5, "Backtest, not the live record" ×5, then 4-column tables of ratios with 95% ranges. | Not delivered. The best evidence (the squares) is there, but nothing sums it up. |

- **Most damaging first-glance problem:** placing the 7-day average (181) next to the daily median (168). A non-expert subtracts and concludes "risk is expected to fall by about 13 points". Against the comparable figure, last Monday's 165, the outlook is flat to slightly up. The same mismatch repeats on every card (e.g. Suez "41" as a 7-day average next to "33-51" as a one-day range).
- **The hero eyebrow "today" breaks information scent.** The reader expects today's reading and gets a five-day-old average plus three other dates.
- **The data-driven rays are, in effect, decoration.** No one can decode the fan angle, so it adds visual noise without information. That is acceptable as art, but it should not compete with the number.
- **Proposed hero (about 25 words, down from 61 tokens):**
  - Eyebrow: "Geopolitical risk" (drop "· today").
  - Number: "181".
  - Line 1: "Nearly double its long-run average · week to Oct 26".
  - Line 2 (the outlook, as a takeaway): "Next 4 weeks: likely to stay high." Then a one-line range bar instead of the sentence: `normal 100 | last Monday 165 ●  [111 ███ 251] by Nov 23`.
  - Move "GPR runs on a weekly cycle... preliminary for about 4 weeks." behind an "About this data" (i) tap.
  - Keep the stale-site caution ("Site last updated ...: the daily update may have stopped.") and the load-error alert visible. They are conditional and essential.

### Gaps
- No five-second test or first-click test with real users was run. The "understands / does not understand" column is an expert prediction and should be validated with 5 people per round (a standard NN/g practice that this session did not source).
- I could not confirm whether the owner means the Signals and Record sections to be read by every visitor or by a minority. That decides how aggressive the progressive disclosure should be.

---

## Inventory of every sentence and label: essential, redundant, or "move behind a tap or hover"; word count per section

### Takeaway
On 2026-10-31, with only 5 series live, the page renders about 906 visible text tokens: hero 61, forecast panel 297, Signals 166, Record 346, footer 27, side nav 8. The same forecast for GPR ("111-251", "most likely 168") is stated 4 times. "8 in 10" appears 23 times, "most likely" 8 times, "7-day average" 7 times, "Collecting live record" and "Backtest" 5 times each. About two thirds of the text can be cut, merged or moved behind a tap with no loss for a non-expert, which matches NN/g's "half the word count (or less)" guidance.

### Cited Findings
- **Rendered token counts per section** (desktop DOM dump, 2026-10-31): sidenav 8, hero (`#today`) 61, forecast panel 297, Signals (`#signals`) 166, Record (`#record`) 346, footer 27; total ≈ 906 (auditor's measurement from the live build; method in the header).
- **Phrase repetition in visible text** (same dump): "8 in 10" ×23; "5 in 10" ×4; "2 in 10" ×2; "most likely" ×8; "7-day average" ×7; "collecting live record" ×5; "backtest" ×5; "inside" ×10; "Nov 23" ×6; "Oct 26" ×5; "111-251" ×3, plus "111 and 251" ×1 in the hero.
- **Page length:** at 1440x900 the content runs about 3,850 px (≈ 4.3 screens), and at 390 px about 5,600 px (≈ 6.6 phone screens). The forecast panel alone is ≈ 1,200 px on desktop and ≈ 1,400 px on a phone (screenshots `full_1440_*`, `full_390_*`).
- **Typography of all secondary text:** the panel, cards and Record use `text-[8px]/[12px] uppercase` in the pixel fonts Press Start 2P / DotGothic16 ([ForecastPanel.tsx](../../../../web/src/components/ForecastPanel.tsx), line 85; [SignalCard.tsx](../../../../web/src/components/SignalCard.tsx), line 39; [TrackRecord.tsx](../../../../web/src/components/TrackRecord.tsx), line 100; [package.json](../../../../web/package.json)).
- **Progressive disclosure** "defers advanced or rarely used features to a secondary screen"; items on the initial display signal that they are "important"; "the primary list can't contain too many options"; features that are hard to understand should not appear on the initial display ([Nielsen, Progressive Disclosure, NN/g, 2006](https://www.nngroup.com/articles/progressive-disclosure/)).
- **Tufte's data-ink rule,** "Maximize the data-ink ratio. Erase non-data-ink; erase redundant data-ink" ([data.europa.eu data visualisation guide](https://data.europa.eu/apps/data-visualisation-guide/chart-junk-and-data-ink-origins)). Practitioners such as Stephen Few call the rule too narrow if followed literally ([eagereyes](https://eagereyes.org/blog/2013/definition-chart-junk)).

### Inferences
Classification key: **E** essential (keep visible), **R** redundant (cut or merge), **T** move behind a tap or hover, **V** show visually instead of in words. The strings are quoted from the files cited above. Replacements are proposals.

**Hero (61 tokens today, target ≤ 25)**

| String | Class | Proposal |
|---|---|---|
| "Geopolitical risk · today" | E, edit | "Geopolitical risk". "Today" is not true of an average to Oct 26. |
| "181" | E | Keep. Consider skipping the count-up, or making it shorter than 0.5 s. |
| "7-day average to Oct 26" | R, merge | Merge into the line below: "· week to Oct 26". |
| "81% above its 1985-2019 average" | E, edit | "Nearly double its long-run average". Put "1985-2019" in a hover. |
| "Monday Nov 23, 4 weeks from the last data: 8 in 10 between 111 and 251, 2 in 10 outside. Most likely 168. (Last Monday: 165)" | V + T | Replace with "Next 4 weeks: likely to stay high" plus a one-line range bar (baseline 100, last Monday 165, band 111-251). Put the exact numbers on the bar's labels. |
| "GPR runs on a weekly cycle: compare Monday with Monday. Data as of Oct 31, preliminary for about 4 weeks." | T | Move to "About this data (i)". "GPR" is never defined in the hero. |
| "Site last updated …: the daily update may have stopped." | E | Keep (shown only when the data are stale). |
| "Couldn't load today's data. Refresh to try again." | E | Keep. |

**Forecast panel (297 tokens today, target ≤ 70 in the default view)**

| String | Class | Proposal |
|---|---|---|
| "[F] Geopolitical risk · forecast made Oct 30" | E, edit | "Geopolitical risk: next 4 weeks". Show "forecast made …" in replay only. Drop the "[F]" game glyph or make it decorative. |
| "index (1985-2019 average = 100) · data to Oct 26" | merge | Show "normal = 100" as a direct label on a baseline line in the chart. "Data to Oct 26" becomes the label on the dotted "now" line. |
| "Data as of Oct 31, preliminary for about 4 weeks." | T | Into "About this data". It already appears in the hero. |
| "Note: {note}" | E (conditional) | Keep (data dropouts or a value under review). |
| "Nov 23 · 8 in 10: 111-251 · most likely 168" | R → chart title | Becomes the action title: "Likely between 111 and 251 by Nov 23, about where it is now". |
| "Real value on Nov 23: not known yet" | R (live) / E (replay) | Hide on today's forecast; in replay, keep "Real value: 190 · inside the range". |
| "Scored as each real value comes in" / "So far 3 of 5 days inside the range" | R (live) / E (replay) | Hide on today's forecast; in replay, it is the key result. Show it as squares, like the Record. |
| Chart labels "Daily values · 7-day avg", "Next 28 days", end values "251", "111" | E, edit | Keep the end values. Label the lines at their right ends ("daily", "7-day avg") instead of in a title-like corner label. |
| "Play" / "Next path" / "Path 1 of 20, the most likely" | T | One toggle, "Show 20 possible paths ▶". No path drawn by default (see Charts). |
| "The line ahead is one of 20 paths drawn from the model's forecast, the most likely first. Together they fall in the band as often as the forecast says." (27 words) | R | Cut. If the paths stay, a 6-word caption on the toggle: "Each line: one way it could go." |
| Legend: "Daily value", "7-day average", "What happened", "8 in 10", "5 in 10", "Model path", "Forecast made" (7 items) | V | Replace with direct labels on the chart. Keep at most 2 items, and only if a swatch cannot be labelled in place. |
| "The 8 in 10 band: where the daily value should land 8 days in 10, outside it about 2 in 10. Not a high and a low, nor volatility: it widens because later days are harder to call. Daily values can follow the week: compare a day with the same weekday." (45 words) | T + V | The band's own label says "8 days in 10 land here". The rest goes behind "How to read this (i)". Keep the anti-misreading sentence there; it is research-backed (see Statistics). |
| "Replay a past forecast", "Jun 28", "Today", "Forecast" (handle label) | E, edit | Keep the slider. The handle says "Forecast" while the end label says "Today" for the same position: use one word ("Today"). |
| "[‹][›] 1 day · [T] today" | T | Keyboard hints: show on hover or focus only, never on touch. |
| "[T] Back to today" | E | Keep (visible only in replay). |
| "[I] Intervals · how sure the model is" plus 4 rows ("Today · Oct 26 · that day 165"; "In 7 days · Nov 02 / 5 in 10: 143-207 / 8 in 10: 119-243 / most likely 173"; 14 and 28 days likewise), axis ticks, "1985-2019 average" | R / T | Collapse into "Show the numbers ▾". The 28-day row repeats the readout and the hero. The 7 and 14-day rows are already in the chart's hover tip (`DayTip`). |
| "Thin line: the 1-year range of the daily value, 22 to 501. Dotted: the day the forecast was made." | R / fix | "1-year range 22-501" is valuable context: bring it into the main chart as a faint range. The "Dotted" caption is wrong, see Charts. |
| "Source: Caldara, D. and M. Iacoviello (2022) … Forecasts: aseri (model aseri-timestral209m, Timestral-209M by Mistral AI)." (≈ 40 words) | T | A "Sources" disclosure or a small footer line. |
| Backtest disclaimer "Backtest: made after the fact, with only the data up to …, but as published later: it may have been revised since. The model's training cutoff is not published, so backtests may be optimistic." (≈ 40 words) | E, shorten | "Backtest: made after the fact, so it may look better than it was. (i)" |

**Signals (166 tokens today with 5 cards; ≈ 30 per card; target ≤ 12 per card)**

| String | Class | Proposal |
|---|---|---|
| "Signals" | E | Keep, or make it a takeaway: "2 of 5 sea lanes far below normal". |
| "Public series, each with its forecast. Pick one to open it above, with its replay and intervals." | R | "Pick one to see its forecast." Or drop it and rely on the hover state. |
| Group headings "Risk, attention and oil", "Sea lanes", "War in Ukraine" | E | Keep. |
| Card name + "[1]"…"[5]" hotkey | E / T | Keep the name. Show the hotkey only on hover or focus, never on touch. |
| Value + unit ("41 ships a day"; "181 index (1985-2019 average = 100)") | E, edit | Keep the value and a short unit. "(1985-2019 average = 100)" goes to a tooltip. |
| "7-day average to Oct 25" (on every card) | R | One line above the grid: "All values: 7-day averages to Oct 25". Keep the per-card "stale since …" caution. |
| "1% above / 88% below its 365-day mean" | E + V | Turn it into a status chip with direction and size ("▼ 88% vs usual"), and draw the mean line in the mini chart. |
| Mini chart | E, fix | Add the baseline line. Without it, "88% below" is invisible in the chart. |
| "In 28 days: 33-51" / "8 in 10 for Nov 22 alone" | R / edit | "Nov 22: likely 33-51". "Alone" is cryptic. Use the same horizon on every card (today 28 or 14 days, depending on the card). |

**Record (346 tokens today; target ≤ 60 in the default view)**

| String | Class | Proposal |
|---|---|---|
| "Record" + "How past forecasts did against what happened. Pick a square to replay its forecast above." | edit | An action title: "Past forecasts landed in range 33 of 40 times, about the 8 in 10 promised". Hint: "Tap a square to replay it." |
| "Collecting live record: 0 of 30" (×5) | R | One banner for the section: "Live record starts after 30 forecasts (0 so far). Until then, backtests." |
| "Backtest, not the live record" (×5) | R | Covered by the banner. Keep the visual separation (the grey box). |
| "Last 8 weekly forecasts, 7 days ahead" | E, shorten | "Last 8 weeks, 7 days ahead". |
| Squares (filled / hollow) | E (best element) | Keep. Add an inline key once: "■ landed in range □ missed". |
| "7 of 8 inside the 8 in 10 range" | E, shorten | "7 of 8 in range". |
| Score table: "Days ahead / Forecasts / Inside the 8 in 10 range / Error vs 28-day mean"; rows like "1-7 · 84 · 78% (74-81) · Beats 0.77 (0.65-0.91)" | T | Behind "Details ▾", with the wording rewritten (see Statistics). |
| Footnote "In brackets, 95% ranges. Those of the 8 in 10 coverage assume independent days, which neighbouring forecasts are not: read them as too narrow. Error: the most likely value's mean miss over the baseline's. Beats only when its whole range is under 1, loses when over 1, ties otherwise." (≈ 52 words) | T | Behind "How we score (i)". |

**Footer (27 tokens):** engraving credit. Fine as it is.

- **Projected total:** roughly 250-300 tokens in the default view, against ≈ 906 today (−65 to −70%), with nothing lost: everything removed stays one tap away.
- **The page will get worse as series are added.** Each extra series adds about 30 tokens of card and about 70 tokens of Record card, and `Signals.tsx` already defines 9 series against the 5 live today. Fix the per-card repetition before more series go live.
- **8 px all-caps pixel type for every secondary string** multiplies the reading cost of each word. That makes the word cuts above more urgent than they would be in a normal type setting (an inference; see Gaps).

### Gaps
- Token counts include numbers and dates, and the Record's tables inflate them. A words-only count would be lower, but the proportions between sections would hold.
- I found no source in this session on reading speed for all-caps or pixel fonts at 8 px. The legibility concern is an expert inference, not a cited fact.

---

## Statistics wording: where "8 in 10", "5 in 10", "most likely", "ties/beats/loses" and the interval rows confuse rather than help

### Takeaway
The site's statistical *choices* are research-backed: frequency framing, range before the median, stating the complement ("2 in 10 outside"), and words to prevent the "high and low" misreading. The trouble is how the wording is *used*. "8 in 10" has become a label repeated 23 times ("8 in 10: 111-251", "the 8 in 10 band", "Inside the 8 in 10 range") without saying 8 in 10 *of what*, which is the condition that makes frequency framing work. "5 in 10" adds a second interval most readers do not need. "Most likely" names two different things: the median, and the top-ranked sample path. The Record switches to percentages, 95% brackets and "Beats 0.77", a ratio where lower is better, so a lay reader cannot tell good from bad. Say it once as a full sentence with its reference class, then let the graphic carry it.

### Cited Findings
- **Frequency framing helps because it carries a reference class.** Gigerenzer et al. (2005) asked people in Amsterdam, Athens, Berlin, Milan and New York what "30% chance of rain tomorrow" means. Only in New York did most give the meteorological reading; elsewhere the favoured readings were "30% of the time" or "30% of the area". The authors conclude that a single-event probability does not name its reference class and recommend stating it ([Gigerenzer et al., Risk Analysis 25(3), 2005, LSE record](https://eprints.lse.ac.uk/16975); [MEDLINE record](https://pesquisa.bvsalud.org/bvsespana/resource/es/mdl-16022695)). Abstract-level access only.
- **Visual intervals invite the "deterministic construal error"**: viewers "interpret the image as representing some deterministic quantity". With a bracket graphic of an 80% predictive interval, "36% of participants misinterpreted the upper bound as the daytime high temperature"; with the same information as text, "Nearly everyone (94%) was able to correctly identify the numbers intended". Stating both outcomes ("70% chance of rain and 30% chance of no rain") reduced misreadings, and the authors suggest "not emphasizing particular points on a graph, such as medians". A prominent key and conventions like broken lines "did not reliably prevent the error" ([Joslyn & Savelli, Frontiers in Computer Science, 2021](https://www.frontiersin.org/article/10.3389/fcomp.2020.590232)).
- **People read verbal probability phrases very differently.** Mauboussin & Mauboussin surveyed about 1,700 people and found wide variation in the probability they assign to words such as "likely" ([FlowingData summary](https://flowingdata.com/2018/07/06/how-people-interpret-probability-through-words); [Harvard CHDS resource page](https://repository.chds.hsph.harvard.edu/repository/collection/resource-pack-probability/resource/3677/)). Secondary sources; the HBR original was not accessed.
- **The Met Office percentage** means the chance of measurable rain (≥ 0.1 mm) at that location in that period, and is not a share of time or area ([Wikipedia, Probability of precipitation](https://en.wikipedia.org/wiki/Probability_of_precipitation)): one number with a fixed, explained reference class.
- **What "most likely" means in the code:** the value labelled "most likely" is the 0.5 quantile (`at("0.5")`, `row.mostLikely`), i.e. the median ([ForecastPanel.tsx](../../../../web/src/components/ForecastPanel.tsx), line 126; [Intervals.tsx](../../../../web/src/components/Intervals.tsx), lines 113-117). "Path 1 of 20, the most likely" refers instead to the first of 20 sample paths ranked by `ranked(forecast, rho)` ([ForecastPanel.tsx](../../../../web/src/components/ForecastPanel.tsx), lines 64, 175).
- **Interval rows as rendered (GPR, 2026-10-31):** "In 7 days · Nov 02 / 5 in 10: 143-207 / 8 in 10: 119-243 / most likely 173"; "In 14 days · Nov 09 / 5 in 10: 140-207 / 8 in 10: 115-247 / most likely 170"; "In 28 days · Nov 23 / 5 in 10: 136-207 / 8 in 10: 111-251 / most likely 168" (`full_1440_01.png`).
- **The Record's wording as rendered:** column "Inside the 8 in 10 range" with cells like "78% (74-81)"; column "Error vs 28-day mean" (GPR, Suez, Bab el-Mandeb, Taiwan) or "Error vs last value" (Hormuz) with cells like "Beats 0.77 (0.65-0.91)", "Ties 0.99 (0.99-1.00)", "Loses 1.05 (1.00-1.10)" ([ScoreTable.tsx](../../../../web/src/components/ScoreTable.tsx), lines 5-9, 40-78; `full_1440_02.png`, `full_1440_03.png`). The ratio is "the most likely value's mean miss over the baseline's", so below 1 is better ([TrackRecord.tsx](../../../../web/src/components/TrackRecord.tsx), lines 57-62). The table never shows the 80% target that coverage should be compared with.
- **Frequency-based displays outperform text and abstract intervals for decisions.** Quantile dotplots reduced the variance of probability estimates about 1.15× against density plots ([Kay et al., CHI 2016](https://idl.uw.edu/papers/when-ish-is-my-bus)), and in a decision task dotplots and CDFs outperformed textual uncertainty ([Fernandes et al., CHI 2018](https://mucollective.northwestern.edu/project/uncertainty-bus)).

### Inferences
- **Why "8 in 10" does not convince the owner.** Used as a noun, "8 in 10" is not frequency framing; it is the jargon "80% PI" in other clothes. Frequency framing works as a *sentence with a class* ("8 days in 10 land in this range"). As a column header or legend swatch it is a code to decode, and the reader meets it 23 times. The panel's only full definition ("where the daily value should land 8 days in 10") is the third paragraph under the chart.
- **Recommended pattern: say it once, then show it.**
  - Hero or panel title: "Likely between 111 and 251 by Nov 23" (no "8 in 10" at all in the headline).
  - The band's own direct label: "8 days in 10 land in here".
  - Everywhere else: "range" or "likely range" ("Nov 22: likely 33-51"; "7 of 8 landed in range").
  - Keep the complement ("2 in 10 outside") as a visual: a small "2 in 10 outside" label at the band's outer edge, or the dotplot-style icon array the Record squares already resemble. Joslyn & Savelli support stating both outcomes, but it does not need a clause in every sentence.
- **Drop "5 in 10" from the default view.** It adds a second band whose dither (`dither-50`) is barely distinguishable from the 8-in-10 dither (`dither-25`) at pixel scale, and four more numbers per interval row. Keep it in "Show the numbers" for experts.
- **"Most likely" is the riskiest phrase on the page.**
  - For a median it is technically loose: the median is the value with even odds above and below, not the mode.
  - It invites anchoring, against the "do not emphasize medians" advice in Joslyn & Savelli; the code renders it bold and bright (`text-primary`).
  - It is reused for the top-ranked path.
  - Proposed wording: the median becomes "middle estimate 168" or "around 168", and is never bolder than the range; the path becomes "one possible path".
- **Proposed rewording of interval rows** (if they stay behind "Show the numbers"): "Nov 02 (7 days): likely 119-243, middle 173" and so on. Drop "5 in 10", or label it "half the time: 143-207".
- **Record wording.** Today's cells and proposed replacements:

| Today | Proposed |
|---|---|
| "Inside the 8 in 10 range: 78% (74-81)" | "Landed in range: 78% (target 80%)". Better still, a bar with a tick at 80. Brackets only in Details. |
| "Error vs 28-day mean: Beats 0.77 (0.65-0.91)" | "23% smaller misses than a simple average of the last 28 days" |
| "Ties 0.99 (0.99-1.00)" | "About as good as a simple 28-day average" |
| "Loses 1.05 (1.00-1.10)" | "5% bigger misses than a simple average" |

- "Beats 0.77" reads as a score where bigger is better, the opposite of its meaning.
- Different cards use different baselines ("28-day mean" and "last value"), so name the baseline in plain words on each.
- **Date wording:** "4 weeks from the last data" and "In 28 days" express the same horizon from different anchors. Use one form: "by Nov 23 (4 weeks)".

### Gaps
- None of the cited studies tested the exact phrase "8 in 10" against "80%" or "likely" with this site's audience. The recommendations transfer general findings.
- The Gigerenzer 2005 and Mauboussin papers were read only at abstract or summary level.
- The parallel note `probability_communication.md` in this folder covers the literature in more depth. This section only applies it to the site's strings.

---

## Charts: do they carry their own message (title stating the takeaway, direct labels, annotations), or do they rely on paragraphs?

### Takeaway
They rely on paragraphs. The main pixel chart has no takeaway title, a 7-item legend, two explanatory paragraphs (72 words), only one y-axis tick on desktop, and no reference line for the "normal = 100" baseline that the hero's headline compares against. By default it draws a single jagged "model path" through the forecast zone, which looks like data and will be read as *the* prediction. The band text says the band "widens because later days are harder to call", but for GPR the band barely widens (119-243 at 7 days, 111-251 at 28 days). The Intervals lanes repeat the main chart in a second visual grammar, and their caption mislabels a value marker as "the day the forecast was made". The mini charts on the cards have no baseline, so "88% below its 365-day mean" is invisible. The Record squares are the one graphic that carries its own message.

### Cited Findings
- **Main chart labels:** value ticks, three date ticks ("Sep 01", "Oct 26", "Nov 23" on desktop), corner labels "Daily values · 7-day avg" and "Next 28 days", end values of the 8-in-10 band ("251", "111"), and the real value in replay. A code comment says "No label on the path's end: it would read as the forecast" ([PixelForecastChart.tsx](../../../../web/src/components/PixelForecastChart.tsx), lines 191-284). On 2026-10-31 desktop shows a single y tick, "200" (`full_1440_01.png`).
- **The model path:** "The chart draws only the model's own paths, never an average: the most likely of the 20 first and, played, the others in order, the next every 1.2 s"; it plays only after a "Play" click ([ForecastPanel.tsx](../../../../web/src/components/ForecastPanel.tsx), lines 61-79, 162-176). A code comment concedes "Drawn from the forecast, a path reads like data: the words say what it is" (line 177). Another comment explains the one-at-a-time choice: "overlapping paths read as nothing" (line 23).
- **Legend and paragraphs under the chart:** 7 legend items (lines 13-21) plus two paragraphs, 27 + 45 words (lines 178-201).
- **Band width for GPR on 2026-10-31:** 8-in-10 band 119-243 at 7 days, 115-247 at 14, 111-251 at 28. The 5-in-10 band's upper edge is 207 at all three horizons (`full_1440_01.png`). The panel text says "it widens because later days are harder to call" ([ForecastPanel.tsx](../../../../web/src/components/ForecastPanel.tsx), lines 196-198).
- **Intervals lanes:** a dotted mark is placed at `at(thatDay)`, the *value* on the forecast day on the value axis ([Intervals.tsx](../../../../web/src/components/Intervals.tsx), lines 30, 61-64). Its caption reads "Dotted: the day the forecast was made." (lines 174-177). In the main chart's legend the same dotted glyph means a *time* marker ("Forecast made", [ForecastPanel.tsx](../../../../web/src/components/ForecastPanel.tsx), line 20).
- **The hover tip (`DayTip`)** already shows, for any forecast day, "8 in 10: …", "Most likely …" and "What happened …" ([PixelForecastChart.tsx](../../../../web/src/components/PixelForecastChart.tsx), lines 286-337). This makes the Intervals rows largely duplicates for pointer users.
- **Mini charts on the cards** draw the history and the most likely path with the band, without a baseline or mean line ([SignalCard.tsx](../../../../web/src/components/SignalCard.tsx), line 66; `full_1440_02.png`).
- **Record squares:** filled when the real value landed inside the 8-in-10 range, hollow when not. A tap replays that forecast, and the text "7 of 8 inside the 8 in 10 range" restates them ([RecordSquares.tsx](../../../../web/src/components/RecordSquares.tsx), lines 6-8, 33-58).
- **Hypothetical outcome plots** "animate a limited set of individual random draws" and let people judge distributions by "counting and integration". They beat error bars and violin plots for comparisons of two or three quantities, with similar accuracy for single-quantity questions ([Hullman, Resnick & Adar, PLOS ONE 2015](https://idl.uw.edu/papers/hops); [MU Collective project page](https://mucollective.northwestern.edu/project/hops)).
- **Ensembles versus cones:** the classic hurricane cone is misread as storm size. Ensemble or spaghetti displays of multiple possible outcomes appear to reduce the deterministic construal error ([Joslyn & Savelli, 2021](https://www.frontiersin.org/article/10.3389/fcomp.2020.590232)).
- **Clutter:** Tufte's call to erase non-data and redundant data ink ([data.europa.eu](https://data.europa.eu/apps/data-visualisation-guide/chart-junk-and-data-ink-origins)); see also [NN/g on chart clutter](https://www.nngroup.com/articles/clutter-charts/).

### Inferences
- **A frozen single path is the worst of both worlds.** HOP evidence relies on *many* draws over time, and an ensemble relies on many paths at once. One static draw, labelled "Path 1 of 20, the most likely", is exactly the deterministic reading the band is meant to prevent: its spikes look like a predicted Monday dip or Thursday peak. Options, from least to most change:
  1. Default view: band only (plus a faint median line, or none). Paths appear only while "Show possible paths ▶" is on.
  2. Autoplay the HOP when the panel is in view, with reduced motion falling back to option 1.
  3. Draw 20 faint paths at once (spaghetti). The owner rejected this ("overlapping paths read as nothing"), but the hurricane-ensemble evidence suggests it may read better than one bold path. Test it.
- **The main chart needs an action title and three annotations, after which the legend and both paragraphs can go:**
  - Title: "Likely to stay high: 111-251 by Nov 23" (computed from the data).
  - A horizontal reference line at 100, labelled "normal (1985-2019 avg)". This makes the hero's "81% above" visible.
  - A label on the dotted "now" line: "last data Oct 26".
  - A label inside the band: "8 days in 10 land here".
  - Line-end labels "daily" and "7-day avg" instead of legend swatches.
  - Optionally, the "1-year range 22-501" as a faint min/max strip on the right. It is valuable context that today lives only in the Intervals caption.
- **Rewrite the "it widens" sentence or make it data-aware.** When the band is roughly constant, the generic claim contradicts what the reader sees, which costs trust in all the explanatory text. Better: drop it, and let a well-scaled band show its own shape.
- **Merge Intervals into the main chart.** The 7/14/28-day rows duplicate the readout, the hover tip and the band, and their value-on-x lanes are a second chart grammar the reader must learn mid-scroll. Keep the numbers behind "Show the numbers ▾". If the lanes stay, fix the caption to "Dotted: the value on the day the forecast was made (165)".
- **Mini charts:** add a 1-px mean line and shade the deviation, or put the "% vs usual" chip on the chart. Use the same horizon on every card, so the cards can be compared.
- **Keep the Record squares and promote them.** They are frequency framing as an icon array, they link evidence to the replay, and they need no paragraph. One aggregate row above the cards ("33 of 40 landed in range") would make them the page's trust headline.

### Gaps
- No eye-tracking or first-click data was collected; whether readers take the path for the forecast is predicted from the literature, not observed.
- The NYT Upshot needle, The Economist's model, the NWS app and Our World in Data were not examined in this session, so I cannot cite their specific chart-title or annotation conventions. The `dashboard_patterns.md` note in this folder may cover them.
- Stephen Few's dashboard guidance ("at a glance") was not sourced in this session.

---

## Severity: problems ranked by how much they hurt comprehension

### Takeaway
Two critical problems mislead rather than merely slow the reader: the headline compares a 7-day average with a one-day forecast, and a static sample path looks like the prediction. Next in line: there is no takeaway headline anywhere, and "8 in 10" is used as a label without its reference class. Volume and redundancy (≈ 906 tokens, the same forecast stated 4 times) are high-severity because they bury everything else. Wording in the Record, date overload, inconsistent vocabulary and 8 px all-caps type are medium or low problems that compound the rest.

### Cited Findings
- All evidence is cited in the sections above. The additional facts for this ranking follow.
- **Dates visible on first scroll** (desktop, 2026-10-31): "Oct 26" ×5, "Oct 25" ×4, "Oct 30" ×1, "Oct 31" ×2, "Nov 23" ×6, plus "Nov 22", "Nov 08", "Nov 02", "Nov 09", "Sep 01", "Jun 28", "4 weeks from the last data", "In 28 days", "In 14 days" (DOM phrase counts; `full_1440_*`).
- **The Intervals row for Oct 26 is labelled "Today · Oct 26 · that day"** while the page date is Oct 31 and the forecast was "made Oct 30" ([Intervals.tsx](../../../../web/src/components/Intervals.tsx), lines 80-83; [ForecastPanel.tsx](../../../../web/src/components/ForecastPanel.tsx), lines 91-93).
- **The same concept under several names:** "Real value" (readout), "What happened" (legend and tip), "Real" (Intervals), "inside/outside" (squares); "8 in 10 range", "8 in 10 band", "the range", "8 in 10"; "Forecast" (slider handle) and "Today" (slider end) for one position ([ForecastPanel.tsx](../../../../web/src/components/ForecastPanel.tsx); [Intervals.tsx](../../../../web/src/components/Intervals.tsx); [ReplaySlider.tsx](../../../../web/src/components/ReplaySlider.tsx), lines 77, 103; [RecordSquares.tsx](../../../../web/src/components/RecordSquares.tsx)).
- **Keyboard-hint text is rendered for all users,** touch included: "[1]"…"[5]" on cards, "[‹][›] 1 day · [T] today" under the slider ([SignalCard.tsx](../../../../web/src/components/SignalCard.tsx), lines 46-48; [ReplaySlider.tsx](../../../../web/src/components/ReplaySlider.tsx), lines 97-104; `full_390_02.png`).
- **Nielsen's heuristics** "match between system and the real world" and "consistency and standards", and the NN/g scanning findings ([NN/g](https://www.nngroup.com/articles/how-users-read-on-the-web/)). The heuristics list itself was not fetched in this session.

### Inferences
Ranked by harm to comprehension (1 = worst). Fix order follows rank, except that S-8 (text cuts) is cheap and can ship first.

| # | Severity | Problem | Where | Fix (summary) |
|---|---|---|---|---|
| 1 | Critical (misleads) | The 7-day average headline (181) sits next to a daily-value forecast (168, 111-251), so readers infer a drop. The same happens on every card ("41" vs "33-51"). | Hero, cards | Compare like with like: lead the outlook with "about where it is now (last Monday 165)", or show the forecast against the daily line only. Label the headline number "week to Oct 26". |
| 2 | Critical (misleads) | A single static "model path" in the forecast zone reads as the prediction (deterministic construal). | Panel chart | Default to band only; paths only while playing, or as a faint ensemble. |
| 3 | High | No block states its takeaway: chart titles are labels, the forecast is a 27-word sentence, the Record has no verdict, and the strongest anomaly (Hormuz −88%) is not flagged. | All | Action titles computed from the data; sort or flag cards by deviation; aggregate line on the Record ("33 of 40 in range"). |
| 4 | High | "8 in 10" used as a label 23× without a reference class; nested "5 in 10"; "most likely" names both the median and a path. | All | One defining sentence ("8 days in 10 land here") on the band; elsewhere "likely range"; drop 5-in-10 from the default view; "middle estimate" for the median. |
| 5 | High | Volume and redundancy: ≈ 906 tokens; the forecast stated 4×; 7-item legend + 72 words of explanation under the chart; 5 identical "Collecting live record" / "Backtest" lines. | All | The inventory above: −65 to −70% in the default view, with the rest behind (i) and ▾. |
| 6 | Medium | Record scoring language: "Beats 0.77 (0.65-0.91)" where lower is better, 95% brackets, no 80% target shown, baselines differ per card. | Record | Plain-language deltas versus a named simple method, coverage with its target, details behind ▾. |
| 7 | Medium | The Intervals block duplicates the chart in a second grammar; the "Dotted" caption labels a value as a day. | Panel | Merge into the chart and hover tip; fix the caption if kept. |
| 8 | Medium | The explanatory text contradicts the data ("it widens…" when the band barely widens), which erodes trust in all the copy. | Panel | Remove, or make it conditional on the data. |
| 9 | Medium | Date overload (≥ 10 distinct dates in the first two screens; "Today" used for Oct 26). | Hero, panel | One "as of" line per block; relative phrasing ("by Nov 23, in 4 weeks"); reserve "today" for today. |
| 10 | Medium | No baseline in the main chart or the mini charts, so "81% above" and "88% below" are claims without a visual. | Panel, cards | Reference line at the baseline, labelled. |
| 11 | Low | Inconsistent vocabulary (Real value / What happened / Real; Forecast / Today). | All | A five-term glossary used everywhere: "range", "middle estimate", "what happened", "normal", "today". |
| 12 | Low | Keyboard hints shown on touch; "[F]", "[I]" game glyphs as text. | Panel, cards | Hover or focus only; mark the glyphs `aria-hidden` as decoration. |
| 13 | Low | Hero count-up shows wrong numbers in the first second; data-driven rays that cannot be decoded. | Hero | Shorter or no count-up; accept the rays as art. |
| 14 | Low (compounding) | 8 px all-caps pixel type for all secondary text multiplies the cost of every word. | Panel, cards, Record | Keep the pixel identity for titles and numbers; set explanatory text larger and in sentence case. Needs a legibility check (Gaps). |

- **What to keep, because it is right and research-aligned:**
  - The range comes before the median.
  - The complement is stated: "2 in 10 outside". Express it visually rather than drop it.
  - Words back every marker (an accessibility strength).
  - The anti-"high and low" sentence. Text reduces deterministic construal per Joslyn & Savelli, so keep it one tap away rather than deleting it.
  - The honest separation of backtest from live record.
  - The squares that open the replay.
- Aim the redesign at *less text in the default view*, not at abandoning the statistical framing.

### Gaps
- The ranking is expert judgement and has not been tested. A five-second test ("What is this page telling you?") and a comprehension probe ("Will risk be higher or lower in 4 weeks?") with 5 non-expert users per round would validate items 1-4 before any rewrite.
- The audit reflects 5 live series on 2026-10-31. With 9 series, Signals and Record grow by roughly 80% and items 5 and 6 get worse.
- I did not check screen-reader output beyond reading `aria-label` strings in code. Accessibility of the proposed direct labels (which today are `aria-hidden`) would need its own pass.
