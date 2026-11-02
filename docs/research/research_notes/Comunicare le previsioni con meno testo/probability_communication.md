# Communicating forecast probability and uncertainty to non-experts with minimal text

Scope: the empirical evidence on wording and visual encodings of probability and uncertainty, aimed at replacing or justifying phrases on a geopolitical forecasting site such as "8 in 10 between 111 and 251", "most likely 168", "5 in 10" and "beats/ties/loses the 28-day mean". Where a claim comes only from a search-result snippet rather than a full text I read, it is flagged "(snippet)".

Main secondary syntheses used:
- Ripberger et al. 2022, *Weather, Climate, and Society* 14(2): 481-498, a living systematic review of 327 studies. Full text read via [NOAA repository PDF](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf).
- Full Fact / Africa Check / Chequeado, "How to communicate uncertainty" (Oct 2020), which summarises the Winton Centre experiments. Full text read via [Full Fact PDF](https://fullfact.org/media/uploads/en-communicating-uncertainty.pdf).

## 1. Wording: frequencies ("8 in 10") vs percentages ("80%") vs verbal probability vs ranges

### Takeaway
Use numbers, not words alone. A numeric range does not measurably reduce trust, while vague verbal uncertainty does. Verbal labels ("likely") are read very inconsistently and drift toward 50%, so if you use them, put the number right next to them in the text: tooltips and legend tables mostly go unread. "X in 10" and "X%" perform about the same overall. What matters more is naming the reference class ("8 in 10 *of what*"), avoiding "1 in X" formats, and avoiding vague hedges such as "possible", "chance" or "estimated".

### Cited Findings

**Trust: numeric ranges vs verbal hedges (Winton Centre, van der Bles et al. 2020)**
- van der Bles, van der Linden, Freeman & Spiegelhalter (2020, *PNAS* 117(14): 7672) ran 4 online experiments plus 1 field experiment on the BBC News website, with about 5,780 UK participants in total. Studies 1-3 had about 1,000 each (Prolific), study 4 was a preregistered replication with 1,050 (Qualtrics panel), and study 5 had about 1,700 BBC readers. Topics were UK unemployment, EU-UK migration, global temperature rise and tiger numbers in India. Sources: [AI Impacts summary](https://blog.aiimpacts.org/p/paper-summary-the-effects-of-communicating) and [ADS abstract](https://ui.adsabs.harvard.edu/abs/2020PNAS..117.7672V/abstract).
- Stimuli used:
  - Point estimate: "an estimated 1,484,000" unemployed.
  - Numeric range: "minimum 1,413,000 to maximum 1,555,000".
  - Verbal: "there is some uncertainty around the estimate, it could be somewhat higher or lower".
  - Both formats raised perceived uncertainty, the verbal one more so. Trust in the number and in the source among range readers was no different from control. The verbal condition slightly decreased trust in both the number and the writers. [Full Fact briefing](https://fullfact.org/media/uploads/en-communicating-uncertainty.pdf)
- BBC field experiment (labour statistics, 15 Oct 2019). Three versions were tested: "unexpectedly rose to 3.9%", "rose to an estimated 3.9%", and "rose to an estimated 3.9% (between 3.7% and 4.1%)". The numeric range did not affect trust in the number, the statisticians or the BBC journalists. The word "estimated" alone did not raise perceived uncertainty above control. [Full Fact briefing](https://fullfact.org/media/uploads/en-communicating-uncertainty.pdf); field-study trust shifts were not significant per [AI Impacts summary](https://blog.aiimpacts.org/p/paper-summary-the-effects-of-communicating)
- A later Royal Society Open Science study on statistics found a small negative effect of uncertainty on trust in the numbers only when more than 10,000 participants were pooled, and again found that a verbal statement hurt trustworthiness more than numeric uncertainty (snippet). [RSOS 2023](https://royalsocietypublishing.org/rsos/article/10/11/230604/91800/The-effects-of-communicating-uncertainty-around)
- Howe et al. (2019, *Nature Climate Change*) used a representative US sample of 1,174 adults and sea-level-rise predictions:
  - A version with best- and worst-case scenarios was trusted more than a single-value version.
  - Adding a disclosure that sea-level rise may be unmeasurable because of unpredictable forces lowered high trust in scientists by about 5 percentage points.
  - Sources: [Full Fact briefing](https://fullfact.org/media/uploads/en-communicating-uncertainty.pdf). Ripberger et al. likewise note that "overly broad statements" of epistemic uncertainty "can undermine trust in forecasts". [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf)

**Verbal probability terms (Budescu on IPCC language; Wintle on intelligence language)**
- Budescu, Broomell & Por (2009, *Psychological Science* 20(3): 299-308): 233 University of Illinois students read 13 IPCC sentences and gave best, lowest and highest probability estimates. Conditions were: no guidance (control); the IPCC translation table available ("translation"); and numeric ranges printed next to each term, either wide IPCC ranges or narrower ones (verbal-numerical).
  - Interpretations diverged widely from IPCC intent even when the table was available.
  - "Very likely" (IPCC: >90%) had a typical median reading of 65-75%.
  - Quantifiers such as "the majority" were read as about 60% when 90-100% consensus was meant.
  - Sources: [Full Fact briefing](https://fullfact.org/media/uploads/en-communicating-uncertainty.pdf). Consistency was highest in the verbal-numerical conditions, lower with the table, and lowest in control (snippet): [Budescu et al. PDF](https://storm.colorado.edu/~whan/ATOC4800_5000/Spring_2018/Materials/Effective_communication_of_unc.pdf)
- Budescu, Broomell & Smithson (2014, *Nature Climate Change* 4: 508) covered 25 samples in 24 countries and 17 languages:
  - The verbal-plus-numeric format raised consistency with IPCC meaning from 27% to 40%.
  - Laypeople read IPCC statements as closer to 50% than intended (regressive interpretation).
  - Source (snippet; verify figures against the original): [EconPapers record](https://econpapers.repec.org/article/natnatcli/v_3a4_3ay_3a2014_3ai_3a6_3ad_3a10.1038_5fnclimate2194.htm)
- Wintle, Fraser, Wills, Nicholson & Fidler (2019, *PLOS ONE*) tested the US Intelligence Community lexicon (ICD 203) on 924 members of the public in 4 conditions.
  - Overlap of readers' ranges with the official ranges:
    - Numeric range in brackets in the text: 66%
    - Tooltip: 40%
    - Linked table: 39%
    - Words only: 32%
  - Best estimates falling inside the guideline range: 82% (brackets) vs 59% (words only).
  - Only about 47% of table users and 46% of tooltip users ever opened their aid.
  - Readers overestimated "very unlikely" and underestimated "very likely" (regression to 50%), and negatively worded terms ("unlikely") were the least consistent.
  - Numeracy correlated with consistency (r = 0.25).
  - Authors' recommendation: numbers must be "highly visible alongside verbal expressions".
  - Source: [Wintle et al. 2019](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0213522)
- Ripberger et al. (2022) say the evidence is strong that communicators should always attach a numeric translation, and that it should appear "directly in or next to the verbal expression itself". Their example is "severe thunderstorms are possible (20% chance) this evening". They add:
  - Vague terms ("it is possible", "there is a chance") should be avoided.
  - Rank adjectives (low/medium/high chance) are preferable.
  - People generally prefer mixed formats (number plus words, or number plus visual).
  - Source: [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf)
- Other verbal-term effects reported in the same review [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf):
  - **Severity effect:** the same phrase ("slight chance") is read as a higher probability for a more severe outcome, for example 1-5% for showers but 10-15% for a hurricane.
  - **Directionality:** a positive frame ("possible that X hits") raises perceived probability and action, while a negative frame ("likely to miss") lowers them.
  - **Can vs will:** "can" focuses readers on extreme values, "will" on likely ones.
  - **"Improbable":** often read as near-impossible (about 1%).
  - **Motivated reasoning:** verbal expressions invite more of it than numeric or visual ones (Budescu et al. 2012; Dieckmann et al. 2017; Piercey 2009).
- Verbal probabilities are "counted", while numbers are averaged:
  - Mislavsky & Gaertig ran 7 studies with more than 6,700 participants. Hearing "likely" from several sources pushed readers toward "very likely", whereas several numeric forecasts were averaged. [Full Fact briefing](https://fullfact.org/media/uploads/en-communicating-uncertainty.pdf)
- Credibility after the outcome depends on format. Jenkins & Harris (2020, *Thinking & Reasoning*, n = 436) used a flood vignette:
  - When the flood happened after it was called "doubtful", the expert was judged more harshly than after "10-30% chance".
  - Conversely, when the flood did not happen, the "10-30%" forecaster was criticised more than the "unlikely" one.
  - The authors' reading is that wording sets a directional expectation.
  - Source: [Full Fact briefing](https://fullfact.org/media/uploads/en-communicating-uncertainty.pdf)

**Numbers vs words for national-security / geopolitical judgments**
- Friedman, Lerner & Zeckhauser (2017, *International Organization* 71(4): 803-826) ran survey experiments with national security professionals:
  - Precise numeric probabilities made decision makers *less* willing to support proposed actions and more receptive to gathering more information. This contradicts the worry that numbers create false confidence among consumers.
  - When respondents produced probabilities themselves, quantification magnified overconfidence among low performers.
  - Sources: [paper PDF](https://scholar.harvard.edu/files/rzeckhauser/files/behavioral_consequences.pdf); [EconPapers](https://econpapers.repec.org/article/cupintorg/v_3a71_3ay_3a2017_3ai_3a04_3ap_3a803-826_5f00.htm)
- Related work by Friedman and colleagues: coarsening numeric estimates into qualitative phrasings, including those recommended for intelligence analysts, "consistently sacrifices predictive accuracy" (snippet). [Value of Precision paper](https://bpb-us-e1.wpmucdn.com/sites.dartmouth.edu/dist/0/433/files/2017/06/Value-of-Precision-June-17.pdf); [Dartmouth publications page](https://sites.dartmouth.edu/friedman/publications/)

**Percentages vs frequencies, and Gigerenzer's natural frequencies**
- Ripberger et al. (2022) review the percentage vs frequency question:
  - Some studies favour percentages (Fuller 2002; Cuite 2008; Joslyn & Nichols 2009) and some favour frequencies (Knapp 2009).
  - Multiple studies "conclude that there are no consistent benefits to percentage or frequency formats" (Hendrickx 1989; Joslyn et al. 2009; Neace 2008; Knapp 2016; Evans 2000; Ruiz 2013; Strathie 2017).
  - The right format depends on task and context.
  - Source: [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf)
- "1 in X" formats (e.g. "1 in 33") inflate perceived probability compared with equivalent "N in X×N" formats (e.g. "3 in 100") (Pighin et al. 2015; Oudhoff & Timmermans 2015). Researchers "urge caution" with 1-in-X. [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf)
- **Reference class ambiguity.** "30% chance of rain" does not say 30% *of what*. Gigerenzer et al. (2005) proposed "on 3 of 10 days like tomorrow, it will rain". Specifying the reference class generally improves interpretation (Neace et al. 2008; Juanchich & Sirota 2019). Juanchich & Sirota found that "X% of simulations predict rain" is a fluent framing most people interpret correctly. [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf)
- In Joslyn's precipitation work, stating the complementary "chance of no rain" significantly lowered interpretation errors (University of Washington press release, 2009). [UW News](https://www.washington.edu/news/2009/04/14/peoples-misperceptions-cloud-their-understanding-of-rainy-weather-forecasts)
- Joslyn & Nichols (2009): percentages were understood better than frequencies for weather forecasts. This comes only from a secondary citation: [arXiv 1408.4812](https://arxiv.org/pdf/1408.4812). A related 2009 study by Joslyn, Nadav-Greenberg, Taing & Nichols found framing and format had little impact compared with matching wording to the task (snippet). [zendy record](https://zendy.io/title/10.1002/acp.1449)
- **Natural frequencies.** McDowell & Jacobs (2017, *Psychological Bulletin*) meta-analysed Bayesian-reasoning tasks after Gigerenzer & Hoffrage (1995): 35 studies and 226 effect estimates. Average accuracy was about 4% with probability formats and about 24% with natural frequencies, so roughly three-quarters still fail even with frequencies. [Frontiers 2018 citing the meta-analysis](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2018.01833/full); [PMC6194348](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6194348/)

**Does probability information help at all?**
- "Nearly all of the studies we review indicate that people make better decisions, have more trust in information, and/or display more understanding of forecast information when forecasters use probability information in place of deterministic statements." Examples include Joslyn & LeClerc 2012, 2016; Roulston et al. 2006; and LeClerc & Joslyn 2012. [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf)
- Joslyn & LeClerc (2012, *JEP: Applied* 18(1): 126) used overnight low-temperature forecasts with or without uncertainty estimates:
  - Uncertainty information improved decision quality and increased trust.
  - When forecast error rose, people with deterministic forecasts became reluctant to act; uncertainty forecasts attenuated this.
  - Sources: [ERIC record](https://eric.ed.gov/?id=EJ968865); [APA PDF](https://www.apa.org/pubs/journals/features/xap-18-1-126.pdf)
- Most people already infer uncertainty from deterministic forecasts (Savelli & Joslyn 2012; Morss et al. 2008). [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf)
- Higher stated probabilities make a forecast seem more accurate: "70% chance of sun" is judged more accurate than "30% chance of rain" (Bagchi & Ince 2016; Løhre et al. 2019; Juanchich & Sirota 2017). [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf)
- The "trend effect": a "moderate" risk worries people more if it was upgraded from "low" than if it was downgraded from "high" (Hohle & Teigen 2015). [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf)

### Inferences
- **"8 in 10 between 111 and 251".** The "8 in 10" format itself is defensible: there is no consistent percentage vs frequency penalty, and it avoids 1-in-X inflation. Two problems remain:
  - The reference class is missing. Name it once, for example "in 8 of 10 simulated futures, the count lands between 111 and 251". Better still, draw it, so the phrase becomes a visual band label.
  - The unit is missing. Readers cannot tell 111 and 251 *what*.
- **"5 in 10".** This is the regression-prone middle of the scale. Readers already push verbal terms toward 50%, and a 50% forecast carries the least information and looks least "accurate" (Løhre/Juanchich effect). A one-word gist label next to the number, such as "toss-up", plus the number is consistent with the dual-format evidence. That specific label is my suggestion and has not been tested.
- **Verbal labels.** If the site adds "likely" or "very likely", print the number inline ("likely (8 in 10)"), never only in a tooltip or legend (Wintle: tooltips used by about 46%). Prefer rank adjectives (low/medium/high) over "possible" or "chance".
- **Geopolitical framing.** Directionality and severity effects are likely amplified for geopolitical events, where outcomes are severe and politically charged. That argues for neutral, number-first phrasing and for showing both directions ("8 in 10 above X; 2 in 10 below") rather than a one-sided frame.
- **Natural frequencies.** Their headline benefit comes from Bayesian *updating* tasks, not single-event forecasts. Using it to justify "8 in 10" would overstate the evidence. For single-event forecasts the defensible argument is reference-class clarity and compatibility with dot or icon visuals.

### Gaps
- I did not obtain per-condition effect sizes for van der Bles et al. 2020; the PNAS full text returned HTTP 403.
- I could not verify the exact Budescu 2014 consistency figures (27% to 40%) beyond the snippet.
- I found no study directly comparing "8 in 10" with "80%" for geopolitical or single-event forecasts with intervals; the evidence is mostly from weather and health.
- I did not retrieve Gigerenzer & Hoffrage's (1995) original per-format percentages; only the meta-analytic averages above are sourced.
- I found no study testing "toss-up" or "coin flip" labels at 50%.

## 2. Visual encodings: fan charts, gradients, quantile dotplots, HOPs, error bars, icon arrays

### Takeaway
For non-experts, *discrete-outcome* displays tested best for probability reading and decisions:
- Quantile dotplots with about 20 countable dots.
- Icon arrays for single probabilities.
- HOPs, when animation is acceptable and multivariate comparisons matter.

Fan charts are well understood for time series: the Bank of England 2026 experiment ranked them best overall, ahead of dot plots, box plots, ranges and speedometers. Plain error bars and bar-plus-error-bar charts are the weakest: they produce within-the-bar bias, overconfidence, and the "deterministic construal" misreading. Every review still recommends a short label or legend, and pretesting with the target audience.

### Cited Findings

**Quantile dotplots (Kay et al. 2016; Fernandes et al. 2018)**
- Kay, Kola, Hullman & Munson (CHI 2016, "When (ish) is my bus?") studied bus-arrival predictions:
  - A design survey of 172 OneBusAway users, then an experiment with 541 participants (320 bus-timeline layout, 221 route-timeline layout).
  - Visualizations compared: density, stripeplot, and quantile dotplots with 20 or 100 dots.
  - A 20-dot quantile dotplot gave about 1.15 times lower variance in probability estimates than a density plot, i.e. estimates 1-3 percentage points more precise, and more confident answers.
  - With 100 dots, performance was about like the density plot, presumably because people estimate area instead of counting.
  - Authors' recommendation: low-density dotplots, or density plots (slightly higher variance but rated more visually appealing).
  - Sources: [CHI 2016 PDF](https://www.mjskay.com/papers/chi_2016_uncertain_bus.pdf); [project page](https://mucollective.northwestern.edu/project/when-ish-is-my-bus)
- Fernandes, Walls, Munson, Hullman & Kay (CHI 2018, honorable mention) ran an incentivised bus-catching decision task with predictive distributions fitted to real Seattle data:
  - Displays: textual predictive intervals (60/85/99%), quantile dotplots (20 or 50 dots), CDFs, and others.
  - Quantile dotplots and CDFs performed best and most consistently.
  - 50-outcome dotplots reached about 97% of optimal expected payoff, 5 points above control, with a within-subject SD 4 points lower than control.
  - Sources: [CHI 2018 PDF](https://www.mjskay.com/papers/chi2018-uncertain-bus-decisions.pdf); [Zenodo data](https://zenodo.org/records/1136329)

**Hypothetical outcome plots (Hullman, Kale) and intervals vs predictions**
- Hullman, Resnick & Adar (2015, *PLOS ONE*): 288 Mechanical Turk workers (96 per condition), comparing animated HOPs, error bars and violin plots.
  - Single-variable questions (mean, probability above a threshold): accuracy was similar across displays. HOPs were *worse* for estimating the mean under high variance.
  - Pr(B > A): HOPs gave much lower error. With error bars and violins, "on no task was the mean absolute error less than 36 percentage points".
  - HOPs also won on "how often is B the largest of three".
  - Source: [PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0142444)
- Kale, Nguyen, Kay & Hullman (2019, IEEE TVCG), "Hypothetical Outcome Plots Help Untrained Observers Judge Trends in Ambiguous Data", compared HOPs, error bars and line ensembles for judging trends (abstract only; effect sizes not retrieved). [Semantic Scholar](https://www.semanticscholar.org/paper/Hypothetical-Outcome-Plots-Help-Untrained-Observers-Kale-Nguyen/ec5a0718d3f820e73c7b51101c7e409a7f2edd11)
- Hofman, Goldstein & Hullman (CHI 2020) ran 2 experiments in a fictional "boulder-sliding" competition where participants paid for an improved boulder:
  - Viewers of 95% *confidence* intervals (inferential uncertainty) paid more and overestimated the treatment effect compared with viewers of 95% *prediction* intervals (outcome variability).
  - Axis rescaling helped less than prediction intervals or HOPs.
  - A 2023 PNAS follow-up found that even experts confuse inferential uncertainty with outcome variability.
  - Sources: [CHI 2020 PDF](https://www.dangoldstein.com/papers/Hofman_Goldstein_Hullman_Visualizing_Uncertainty_Mislead_Scientific.pdf); [PNAS 2023](https://www.pnas.org/doi/10.1073/pnas.2302491120)

**Error bars, bars, gradients and violins**
- Correll & Gleicher (2014, IEEE TVCG 20(12): 2142-2151): bar charts with error bars invite "within-the-bar bias", where values inside the bar are judged more likely. Error bars also made people "unjustifiably confident". Visually symmetric encodings (violin plots, gradient plots) mitigated the bias. Pentoney & Berger (2016) replicated that the effect requires the bar. [Correll & Gleicher PDF](https://graphics.cs.wisc.edu/Papers/2014/CG14/Error%20Bars%20Considered%20Harmful%20Exploring%20Alternate%20Encodings%20for%20Mean%20and%20Error.pdf); [ResearchGate: within-the-bar bias](https://www.researchgate.net/publication/295396174_Confidence_Intervals_and_the_Within-the-Bar_Bias)
- **Deterministic construal error** (Joslyn & LeClerc). Viewers of temperature forecasts with 95% bars took the bar ends to be the forecast high and low temperatures, and kept this belief even when a prominent key explained the correct reading. [Joslyn & Savelli 2021, Frontiers in Computer Science](https://public-pages-files-2025.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2020.590232/pdf)
- Winton Centre working paper (van der Bles et al. 2018), as summarised by Full Fact: 2 experiments with 1,000+ UK adults each, on migration and unemployment trends, comparing error bars, fan chart, "fuzzy" (gradient) chart and fuzzy fan chart against no uncertainty.
  - Showing uncertainty did not change trend comprehension or trust in the data or producers.
  - Error bars helped people judge how certain the trend was.
  - *No* format got people to realise that values near the centre are more likely than values at the edges.
  - Source: [Full Fact briefing](https://fullfact.org/media/uploads/en-communicating-uncertainty.pdf)

**Fan charts (Bank of England)**
- McMahon, Naylor, Rholes & Rickards (2026, Bank of England Staff Working Paper No. 1,196, "Anchors aweigh?"), Part I: 300 UK public and 75 experts compared point forecast, fan chart (70%/90% bands), 99% range, box-and-whisker, dot plot (Fed SEP-style), and a novel "speedometer".
  - Fan charts "perform best overall", combining high perceived usability with the most accurate reading of distributional information.
  - Point forecasts were rated easiest (public 4.9/7; experts 6.2/7).
  - The speedometer was least liked (3.3 public, 3.4 experts).
  - Source: [BoE SWP 1196](https://www.bankofengland.co.uk/-/media/boe/files/working-paper/2026/anchors-aweigh-the-effect-of-communicating-forecast-uncertainty.pdf)
- Each format in that study came with one to three sentences of plain explanation, for example "The darker area shows outcomes with a 70% chance of occurring. The lighter area extends this to 90%." [BoE SWP 1196](https://www.bankofengland.co.uk/-/media/boe/files/working-paper/2026/anchors-aweigh-the-effect-of-communicating-forecast-uncertainty.pdf)
- The Bernanke Review (2024) recommended *eliminating* BoE fan charts. It found they have "weak" conceptual foundations, convey little beyond more direct methods, and attract little public attention, and it proposed alternative scenarios instead. [BoE IEO review](https://www.bankofengland.co.uk/independent-evaluation-office/forecasting-for-monetary-policy-making-and-communication-at-the-bank-of-england-a-review/forecasting-for-monetary-policy-making-and-communication-at-the-bank-of-england-a-review). This conflicts with the 2026 experimental result above.

**Hurricane cone vs ensembles (Ruginski/Padilla)**
- The "cone of uncertainty" is commonly misread as storm size or intensity growing over time.
- Ensemble track displays reduced reliance on the distance-to-centre heuristic (Ruginski et al. 2016). However, they made people overweight locations that a single track happened to cross (Padilla et al. 2017).
- Sample sizes were not retrieved.
- Sources: [Ruginski et al. 2016](https://www.researchgate.net/publication/281409757_Understanding_the_Cone_of_Uncertainty_Non-expert_interpretations_of_hurricane_forecast_uncertainty_visualizations); [Padilla et al. 2017, Cognitive Research](https://link.springer.com/article/10.1186/s41235-017-0076-1)

**Icon arrays and general visual guidance**
- "Many studies show that [icon arrays] can increase risk comprehension and avoidance actions" (Ancker 2011; Galesic et al. 2009; Garcia-Retamero & Galesic 2009/2010; Zikmund-Fisher et al. 2011, 2014 and others).
  - They help low-numeracy readers by conveying both an exact proportion and a "gist" impression.
  - Most studies find icon arrays more transparent than bar-type graphics.
  - Source: [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf)
- Further guidance from the same review [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf):
  - There is no single best visual. Pretest with the audience.
  - Explanatory labels and numbers inside graphics matter, especially for low-numeracy readers (Okan et al. 2015; Boone et al. 2018).
  - Colour has mixed and limited effects. Warm colours signal more risk, and polychromatic scales may beat monochromatic ones.

**Election forecast visualizations in the wild (trust, emotion)**
- Yang, Cai, Mortenson, … Hullman, Franconeri, Diakopoulos, Nisbet & Kay (IEEE TVCG 30(1), 2024; VIS 2023) ran a longitudinal field experiment during the 2022 US governor races: 1,327 participants in 15 states.
  - Designs: single quantile dotplot (1-Dotplot), dual quantile dotplots, dual histogram intervals (2-Interval), and an animated "Plinko" quantile dotplot. The 2-Interval design showed both parties' vote distributions as histograms with intervals.
  - Forecast visualizations heightened emotions, increased trust, and slightly shifted intentions to participate.
  - 2-Interval had the strongest effects on nearly all measures, and 1-Dotplot raised trust most after the election.
  - Both created partisan emotion and trust gaps, especially when a Republican was forecast to win.
  - The authors excluded text-only representations because prior work and their pilots showed text elicits larger variance in interpretation.
  - Source: [paper PDF](https://mucollective.northwestern.edu/files/2023-US_midterm.pdf)
- "In Dice We Trust" (CHI 2024) reports that its uncertainty displays consistently raised attitudinal trust in election forecasts over time. It also says the earlier study found Plinko dotplots improved understanding but slightly undermined trust (snippet; full text returned 403). [ACM](https://dl.acm.org/doi/fullHtml/10.1145/3613904.3642371)

**Point-estimate overlays (see section 4)**
- Kale, Kay & Hullman (IEEE VIS 2020) tested intervals, HOPs, densities and quantile dotplots, each with and without a mean. The designs best for unbiased effect-size estimation were not the best for decisions. [arXiv 2007.14516](https://arxiv.org/abs/2007.14516)

### Inferences
- **Least explanatory text needed:** a quantile dotplot with about 20 dots, or an icon array of 10 or 20 icons. "Each dot = 1 in 20 outcomes" is the entire legend, and readers can verify "8 in 10" by counting 16 dots inside the shaded band. This turns the sentence "8 in 10 between 111 and 251" into a picture with two axis labels.
- **Time series:** a 2-band fan (e.g. 50% and 80% or 90%) with a one-line key, following the BoE wording. It is the best-tested option for trajectories. Avoid bars with error bars entirely.
- **HOPs:** strongest for "how often does A beat B", which matters for multi-outcome geopolitical questions, but they need animation, are worse for reading means, and need more framing. They are a secondary option.
- **Interval semantics:** show *predictive* intervals for future outcomes, not confidence intervals around a model parameter (Hofman et al. 2020).
- **Single bands:** no visual reliably conveys that the centre is more likely than the edges (Winton Centre). A dotplot's dot stacking does this structurally, which is an argument for dotplots over a single flat band.

### Gaps
- Fernandes et al. 2018 sample size was not retrieved.
- Kale et al. 2019 effect sizes were not retrieved.
- Padilla/Ruginski sample sizes were not retrieved.
- The Padilla, Kay & Hullman 2022 review chapter could not be fetched (TLS certificate error), so I relied on primary-paper summaries.
- I found no head-to-head test of quantile dotplots vs fan charts for the same time-series forecast.
- I found no study specific to geopolitical event counts.

## 3. Comparing against a baseline or a track record: "how good is this forecast?"

### Takeaway
The leading sites show track record in three ways:
1. Calibration ("things we said had 70% happened about 70% of the time"): FiveThirtyEight, Metaculus.
2. Skill vs an unskilled baseline: FiveThirtyEight.
3. Plain "percentage of forecasts within a stated tolerance, by horizon": Met Office.

I found **no empirical study testing whether lay readers understand "beats/ties/loses [a baseline]"**. The Met Office pattern needs the least statistical vocabulary. Showing misses is risky without uncertainty framing: seeing a forecaster err sharply reduces reliance ("algorithm aversion"). Uncertainty displays, on the other hand, buffer the trust lost after misses (BoE 2026; Joslyn & LeClerc 2012).

### Cited Findings
- **FiveThirtyEight.** Evaluation looked at "the calibration of a forecast, and how our forecast compared with an unskilled estimate that relies solely on historical averages", using calibration plots plus skill scores. [FiveThirtyEight sports review](https://fivethirtyeight.com/features/how-well-did-our-sports-predictions-hold-up-during-a-year-of-chaos/)
  - Its "checking our work" calibration plots are reproduced in [ResearchGate figure](https://www.researchgate.net/figure/Calibration-plots-of-FiveThirtyEight-projectsfivethirtyeightcom-checking-our-work_fig1_364516820).
  - An early NCAA bracket review noted deviations from perfect calibration were "not statistically significant". [FiveThirtyEight NCAA](https://fivethirtyeight.com/features/the-ncaa-bracket-checking-our-work)
  - fivethirtyeight.com feature URLs now 301-redirect to abcnews.com/politics (observed when fetching the 2020 design article, Oct 2026), so the original pages are offline.
- **Metaculus.** The track record page shows calibration plots for binary and continuous questions (continuous plots added Aug 2020; a flat curve means perfect calibration) and score distributions (log, Brier, points).
  - The Brier reference point is 0 for a perfect forecaster and 0.25 for always saying 50%.
  - For questions resolved in 2021 the Metaculus Prediction scored Brier 0.107 vs 0.108 for the Community Prediction, which is a recency-weighted median.
  - The Metaculus Prediction has been deprecated since November 2024.
  - Sources: [Metaculus platform update thread](https://pandemic.metaculus.com/questions/3430/platform-update-thread/); [Metaculus FAQ](https://www.metaculus.com/faq/); [EA Forum analysis](https://forum.effectivealtruism.org/posts/e9htD7txe8RDdcehm/exploring-metaculus-s-ai-track-record)
- **Met Office.** Accuracy is published as "% of forecasts accurate" with a stated tolerance, by lead time, checked at about 120 UK sites:
  - Temperature counts as accurate within 2°C; wind direction within one point of a 16-point compass.
  - Spring 2026: 1-day maximum temperature 95% accurate, 5-day 77%.
  - The headline claim is that "four-day forecast is now as accurate as one-day forecast was 30 years ago".
  - Sources: [Met Office accuracy page](https://www.metoffice.gov.uk/about-us/who-we-are/accuracy); [Spring 2026 blog](https://www.metoffice.gov.uk/blog/2026/how-accurate-was-the-met-office-forecast-during-a-record-laden-spring-); [Winter 2025/26 blog](https://www.metoffice.gov.uk/blog/2026/how-accurate-was-the-met-office-during-winters-weather)
- **Algorithm aversion.** Dietvorst, Simmons & Massey (2015, *JEP: General* 144: 114-126), 5 studies:
  - Participants who *saw* an algorithm's forecasts and errors were less confident in it and less likely to bet on it over an inferior human, even when they had seen it outperform the human.
  - A 2018 follow-up found that letting people slightly adjust the algorithm's forecast reduces the aversion.
  - Sources: [Wharton PDF](https://faculty.wharton.upenn.edu/wp-content/uploads/2016/11/20-Dietvorst-Simmons-Massey-2015.pdf); [Management Science 2018](https://econpapers.repec.org/RePEc:inm:ormnsc:v:64:y:2018:i:3:p:1155-1170)
- **Uncertainty displays as insurance against misses.** In BoE SWP 1196 Part II (1,600 representative UK participants, 4 stages, incentivised):
  - Point forecasts anchored expectations "marginally more" than fan charts at first, but forecast errors "significantly de-anchor expectations".
  - Fan charts "materially mitigate this de-anchoring, acting as an 'insurance policy'".
  - The public "consistently underestimates the degree of uncertainty", and fan charts, especially wider 90% ones, helped them learn more realistic uncertainty.
  - Source: [BoE SWP 1196](https://www.bankofengland.co.uk/-/media/boe/files/working-paper/2026/anchors-aweigh-the-effect-of-communicating-forecast-uncertainty.pdf)
  - Joslyn & LeClerc (2012) similarly found uncertainty forecasts attenuated the loss of willingness to act when forecast error rose. [ERIC](https://eric.ed.gov/?id=EJ968865)
- **Wording of track-record statistics.** BBC audience research with 97 respondents found only a minority "think in numbers", and statistical terms such as "net" or "mean" are particular stumbling blocks. [Full Fact briefing](https://fullfact.org/media/uploads/en-communicating-uncertainty.pdf)
  - Confidence intervals in particular confuse a significant share of the public (Dieckmann et al. 2015). [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf)

### Inferences
- **"Beats/ties/loses the 28-day mean"** combines three things without lay-tested support:
  - an unexplained baseline ("28-day mean": "mean" is a known stumbling term);
  - a sports-results metaphor with no stated margin for "ties";
  - a per-forecast verdict that highlights individual misses, which invites algorithm aversion.
- **Lower-text alternatives** grounded in the patterns above. None of them has been user-tested for this audience.
  1. **Coverage, Met Office style.** "Last 30 forecasts: 24 landed inside the 8-in-10 band." Readers can see this directly as dots inside or outside a band. It also checks calibration of the "8 in 10" claim itself.
  2. **Baseline as plain words.** "Closer than 'same as the last 4 weeks' in 19 of 30." Name the naive rule rather than "28-day mean".
  3. **Calibration plot.** For a long-run page aimed at sophisticated readers (FiveThirtyEight/Metaculus), not for per-forecast cards.
- Pair any display of misses with the forecast's uncertainty band, since the BoE and Joslyn results suggest the band is what preserves credibility after a miss.

### Gaps
- I found no experiment testing lay comprehension of skill scores, "beats the baseline" verdicts, or calibration plots.
- I could not access the live FiveThirtyEight "checking our work" page (offline) or the current Metaculus track-record page conventions.
- No sourced evidence on how many past forecasts to show.

## 4. Point estimates: show "most likely" / median at all?

### Takeaway
Show a central value, but make it subordinate to the range. Experiments show:
- Adding a mean to an uncertainty display slightly biases judgments, because people discount the uncertainty.
- A point estimate anchors expectations a little more at first, but that anchor is fragile after misses.
- A point estimate *with* a numeric range does not hurt trust.

"Most likely" is a specific claim (the mode) and should be used only if the value really is the mode.

### Cited Findings
- **Kale, Kay & Hullman (IEEE VIS 2020; TVCG 2021).** Mixed-design Mechanical Turk experiment with 4 uncertainty displays (95% intervals, HOPs, densities, quantile dotplots), each with and without a mean.
  - "Adding means to uncertainty visualizations has small biasing effects on both magnitude estimation and decision-making", which the authors attribute to users discounting uncertainty.
  - Many users switched strategies and satisficed with heuristics.
  - Source: [arXiv 2007.14516](https://arxiv.org/abs/2007.14516)
- **BoE SWP 1196 (2026).** Point forecasts were rated the easiest format (4.9/7 public) and anchored expectations marginally more at first. After forecast errors, point-forecast viewers de-anchored more than fan-chart viewers. [BoE SWP 1196](https://www.bankofengland.co.uk/-/media/boe/files/working-paper/2026/anchors-aweigh-the-effect-of-communicating-forecast-uncertainty.pdf)
- **Winton/BBC (van der Bles 2020).** The recommended and tested format keeps the point estimate and adds the range in brackets: "3.9% (between 3.7% and 4.1%)". This did not lower trust.
  - Full Fact's recommendation: "Indicate uncertainty in existing data using numerical ranges in brackets, after the main value".
  - For predictions: "use verbal expressions to indicate the general direction of travel, but supplement these with numerical probability ranges", e.g. "likely (66% chance)".
  - Source: [Full Fact briefing](https://fullfact.org/media/uploads/en-communicating-uncertainty.pdf)
- **Howe et al. 2019** (n = 1,174): best-case/worst-case versions were trusted more than a single projected value. [Full Fact briefing](https://fullfact.org/media/uploads/en-communicating-uncertainty.pdf)
- **Deterministic construal error.** People substitute visual uncertainty markers for deterministic values, reading interval ends as the forecast itself. [Joslyn & Savelli 2021](https://public-pages-files-2025.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2020.590232/pdf)
- **Can vs will.** Asked what "will" happen, people focus on likely values; asked what "can" happen, they focus on extremes (Teigen et al.). [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf)
- **NYT needle.** It showed a single needle with a jittering range. Designers argued that motion within the 25th-75th percentile band conveyed uncertainty better than printing those percentiles. [FlowingData](https://flowingdata.com/2016/11/15/showing-uncertainty-during-the-live-election-forecast/)

### Inferences
- **"Most likely 168".** If 168 is the median of a right-skewed simulation distribution (111 to 251 suggests skew), it is not "most likely". Options:
  - Relabel it ("middle estimate", or simply "~170" drawn as a tick inside the dotplot or band).
  - Compute the true mode.
- Make the range or dotplot the headline and the point a secondary mark. Kale et al. show a small bias from the mean; BoE shows the point's anchoring advantage disappears after misses.
- Rounding 168 to "about 170" signals estimate-ness without the word "estimated", which the BBC experiment showed carries no uncertainty on its own. The rounding step itself is my inference; see section 5.

### Gaps
- Effect sizes and sample size for Kale et al. were not retrieved (the arXiv abstract page omits them).
- I found no study comparing "median" vs "most likely" vs unlabeled tick for lay readers.

## 5. Number formatting for the public: rounding, ranges, units, "X in 10" vs "X%"

### Takeaway
Put the range in brackets right after the main value, inline. Use consistent units and magnitude labels. Use "N in 10" or "N in 100" rather than "1 in X". State what the number refers to: the reference class and the unit. Percentages and "X in 10" are roughly equivalent overall. I found no strong empirical source on rounding rules specifically.

### Cited Findings
- **Range format.** "unemployment is estimated at 3.9% (between 3.7% and 4.1%)" was tested in the BBC field experiment without trust loss. "Estimated" or "around" alone is not enough. [Full Fact briefing](https://fullfact.org/media/uploads/en-communicating-uncertainty.pdf)
- **Inline numbers.** In-text bracketed numbers beat tooltips and tables (66% vs about 40% consistency), because about half of readers never open tooltips or tables. [Wintle et al. 2019](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0213522)
- **Frequency format.** Use "N in X×N" over "1 in X", because 1-in-X inflates perceived risk. There is no consistent percentage vs frequency advantage. [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf)
- **Reference class.** "3 of 10 days like tomorrow"; "X% of simulations". [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf)
- **Large numbers and units.**
  - Nearly half of (non-representative) US participants placed 1 million halfway between 1,000 and 1 billion (Landy, Silbert & Goldin 2013, *Cognitive Science*).
  - Comparisons were clearer when both numbers used the same magnitude label ("980 million vs 2,000 million"), per Landy, unpublished and reported in an interview.
  - Source: [Full Fact briefing](https://fullfact.org/media/uploads/en-communicating-uncertainty.pdf)
- **Public numeracy.** In a Royal Statistical Society survey of 1,000 UK adults, 90% could compute 50 as a percentage of 200, 71% an average of three numbers, but only 30% the probability of two heads in two coin flips. [Full Fact briefing](https://fullfact.org/media/uploads/en-communicating-uncertainty.pdf)
- **Plain-language preference.** In a Cochrane plain-language-summary study (n = 34), participants preferred words supplemented by numbers in a table over words only or numbers embedded in text (Glenton et al. 2010). [Full Fact briefing](https://fullfact.org/media/uploads/en-communicating-uncertainty.pdf). This partly conflicts with Wintle's finding that tables go unread.
- **Discrete-outcome dot counts.** Use countable numbers of dots (about 20; Kay used 20, Fernandes 50). At 100 dots, readers stop counting and estimate area. [Kay et al. 2016](https://www.mjskay.com/papers/chi_2016_uncertain_bus.pdf)
- **Long time frames.** Expressions such as "once in X years" and long or time-uncertain frames lead audiences to overestimate risk (Grounds et al. 2018; Bell & Tobin 2007; Ballard & Lewandowsky 2015). [Ripberger et al. 2022](https://repository.library.noaa.gov/view/noaa/60526/noaa_60526_DS1.pdf)
- **Spiegelhalter / Winton Centre.** They promoted expected-frequency formats and icon arrays as good practice. [Cambridge REF impact case study](https://impact.ref.ac.uk/casestudies/CaseStudy.aspx?Id=17235); [SSA webinar description](https://www.statsoc.org.au/forum-event-announcements/8128324)

### Inferences
- **Proposed house format:** `~170 (8 in 10 between 110 and 250) [unit]`, or better, the same numbers as labels on a dotplot. Rounding interval ends to 2 significant figures is consistent with the evidence that readers process gist, but it is my inference, not a tested rule.
- Keep one frequency denominator site-wide (all "in 10", or all "in 20" if dotplots use 20 dots) so readers do not have to convert. Never mix "1 in 5" with "8 in 10".
- The geopolitical horizon should be explicit ("by 30 Nov"), given evidence that people misread when within a period an event is likely and overestimate risk over long frames.

### Gaps
- I found no peer-reviewed study specifically on rounding precision (e.g. 168 vs 170) and trust or comprehension in forecasts.
- I did not locate a written Spiegelhalter/Winton style guide with explicit rounding rules; searches returned only talks and summaries.
- I did not locate RSS "Making Numbers Count" guidance text.

## 6. Concrete patterns from exemplary sites

### Takeaway
Across sites, the common moves are:
- Lead with a frequency or probability headline plus a verbal gist word ("favored").
- Show the distribution of simulated outcomes as countable dots, a fan, or animation.
- Repeat that unlikely outcomes happen.
- Publish a separate track-record page.

The NYT needle shows the cost of motion-as-uncertainty: readers hated the jitter, and it was removed after 2016. The BoE fan chart is simultaneously the best-performing format in a 2026 experiment and recommended for elimination by the 2024 Bernanke review.

### Cited Findings
- **NYT needle (2016 onward).**
  - In 2016 the gauge jittered within the 25th-75th percentile of simulated outcomes. Designer Gregor Aisch argued this conveyed uncertainty better than printing percentiles, and the jitter narrowed as the night went on. [FlowingData](https://flowingdata.com/2016/11/15/showing-uncertainty-during-the-live-election-forecast/)
  - Critics called it "irresponsible" and an artificial dramatic element. [FAIR](https://fair.org/home/the-needle-and-the-damage-done/); [Quartz](https://qz.com/831944/the-new-york-times-election-result-projections-are-mostly-random-jitters)
  - The jitter was dropped for the 2018 midterms. [Columbia Journalism Review](https://www.cjr.org/special_report/2018-midterms-forecasts-538-cnn-times-needle.php)
  - Fast Company described it as "the most hated data visualization in politics" in 2020. [Fast Company](https://www.fastcompany.com/90459366/the-most-hated-data-visualization-in-politics-is-back-to-spike-your-blood-pressure)
  - The needle was still run in 2024. [Poynter](https://www.poynter.org/tech-tools/2024/ny-times-election-needle/)
- **FiveThirtyEight 2020 presidential forecast.**
  - Its design write-up ("How we designed the look of our 2020 forecast", Anna Wiederkehr) chose a top-line chart "to show the scope of that universe of simulated outcomes". The model ran about 40,000 simulations per update.
  - The page used modest gist wording ("Biden is favored to win").
  - A cartoon mascot, "Fivey Fox", in the margins reminded readers that low-probability outcomes can happen.
  - Coverage noted that FiveThirtyEight and The Economist led with frequencies rather than percentages (snippet).
  - Sources: [FlowingData](https://flowingdata.com/2020/08/12/fivethirtyeight-launches-2020-election-forecast/); [The Hill](https://thehill.com/opinion/campaign/515291-theres-more-than-meets-the-eye-in-2020-election-forecasts/); [Nieman Lab](https://www.niemanlab.org/2020/10/should-news-outlets-stop-making-election-forecasts-based-on-polling-data/); [FiveThirtyEight interactive map note](https://fivethirtyeight.com/features/were-letting-you-mess-with-our-presidential-forecast-but-try-not-to-make-the-map-too-weird/)
  - Gelman, Hullman, Wlezien & Morris discuss how forecaster incentives shape the uncertainty shown, and show FiveThirtyEight's 2020 dot distribution. [JDM paper](https://www.cambridge.org/core/journals/judgment-and-decision-making/article/information-incentives-and-goals-in-election-forecasts/CDED59D35F6599BF9D31348A79B196F9)
- **The Economist 2020 model.**
  - A Bayesian Stan model, built by G. Elliott Morris with Andrew Gelman and Merlin Heidemanns. The code was open-sourced (MIT licence).
  - Reported headline odds were about 89% for Biden, with an electoral-vote range of 223-429.
  - Polls were treated as missing by about twice their stated margins.
  - Sources: [Columbia DSI](https://www.datascience.columbia.edu/news/2020/dsi-member-andrew-gelman-designs-presidential-forecast-for-the-economist-2); [Morris newsletter](https://www.gelliottmorris.com/p/are-polls-overestimating-the-democrats)
- **Bank of England.**
  - Fan charts show the MPC's assessed probability bands (dating per Blinder et al., not cross-checked).
  - Since November 2017 the Inflation Report (now the Monetary Policy Report) has added plain-language "layers" for the general public. Haldane & McMahon (2018) found a substantial rise in web activity concentrated on the new content, and Blinder et al. report improved public comprehension.
  - Sources: [Blinder et al. working paper](https://gceps.princeton.edu/wp-content/uploads/2022/04/wp291_Blinder-et-al_Central-Bank-Communication.pdf); [Haldane & McMahon, ORA](https://ora.ox.ac.uk/objects/uuid:8c848644-2214-49cc-bbb8-a93352a4b643)
  - The Bernanke Review (2024) recommended replacing fan charts with scenarios, while BoE SWP 1196 (2026) found fan charts best and protective after misses. [BoE IEO review](https://www.bankofengland.co.uk/independent-evaluation-office/forecasting-for-monetary-policy-making-and-communication-at-the-bank-of-england-a-review/forecasting-for-monetary-policy-making-and-communication-at-the-bank-of-england-a-review); [BoE SWP 1196](https://www.bankofengland.co.uk/-/media/boe/files/working-paper/2026/anchors-aweigh-the-effect-of-communicating-forecast-uncertainty.pdf)
- **Met Office.** Public "How accurate are our public forecasts?" page plus seasonal verification blog posts with plain tolerance definitions and lead-time breakdowns. [Met Office accuracy page](https://www.metoffice.gov.uk/about-us/who-we-are/accuracy)
- **Research forecast site (Northwestern / Kay lab, 2022).** Public governor-race forecasts used quantile dotplots with one-line legends ("1 ball = 1 election outcome"; "20,000 equally likely election outcomes") and a Plinko animation ("The taller the Plinko board is, the more uncertain the election outcome is"). [Yang et al. PDF](https://mucollective.northwestern.edu/files/2023-US_midterm.pdf)

### Inferences
- **A pattern for a geopolitical card**, assembled from the evidence above. It is untested as a whole.
  - One line of gist text: "Likely above 150 (8 in 10)".
  - A 20-dot quantile dotplot with the 80% band shaded and a light tick at the median.
  - A one-line legend: "each dot = 1 in 20 simulated outcomes".
  - A link to a track-record page in Met Office style ("24 of last 30 inside the band"), not a per-card beats/loses verdict.
- Avoid motion for its own sake (NYT jitter backlash). If you animate, follow the HOPs or Plinko precedent with an explicit legend.
- Expect partisan or affective reactions on politically charged questions (Yang et al.). Neutral colours and neutral wording matter more for geopolitics than for weather.

### Gaps
- I did not retrieve the primary FiveThirtyEight design article: fivethirtyeight.com redirects to ABC News and web.archive.org was unreachable from this tool. So the exact dot count and frequency wording ("X in 100") is unverified.
- I did not retrieve The Economist's "how this works" page or its chart design rationale.
- I did not research BBC Weather's or Our World in Data's uncertainty displays; no sources were collected.
- Seen only in a search listing, findings not retrieved:
  - Two 2026 papers: a *Weather and Forecasting* survey of 965 US adults on wide probabilistic snowfall ranges ([WAF 2026](https://journals.ametsoc.org/view/journals/wefo/41/10/WAF-D-26-0006.1.xml)).
  - A *Risk Analysis* study reporting that communication strategy did not change perceived trustworthiness of meteorological authorities, per the search summary ([Lin 2026](https://onlinelibrary.wiley.com/doi/10.1111/risa.70328)).
  - Both could update sections 1-2 if read in full.
