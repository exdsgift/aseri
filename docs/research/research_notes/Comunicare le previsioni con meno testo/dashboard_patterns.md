# Glanceable, low-text dashboard and forecast-page patterns, with progressive disclosure

Scope: a daily forecast page with one hero number, a detailed forecast panel (chart, replay slider, interval rows) and nine small series cards, on a site with a strong pixel-art identity. Citation format: claim, then source link. Items marked "(search summary)" come from search-result summaries, not from a page I fetched in full. Treat them as lower confidence.

## 1. KPI and summary cards: anatomy of an effective card

### Takeaway
Every authority I fetched agrees on the same core: a number never stands alone. It needs a comparison (vs normal, vs target, vs yesterday), a qualitative state, only as much precision as the task needs, and a fixed, consistent layout repeated across cards. A card of "label, big number, one delta against a reference, one small trend line, an optional one-line takeaway" is the shape these sources imply. No source gives that exact recipe in those words.

### Cited Findings
- Few defines a dashboard as "a visual display of the most important information needed to achieve one or more objectives, consolidated and arranged on a single screen so the information can be monitored at a glance." [Few, Common Pitfalls in Dashboard Design, 2006](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf)
- Few's 13 pitfalls include #1 exceeding a single screen, #2 inadequate context, #3 excessive detail or precision, #4 expressing measures indirectly, #6 meaningless variety, #12 misusing or overusing colour and #13 an unappealing display. [Few](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf)
- Context (pitfall #2): a bare "$736,502" "means little. Compared to what? Is this good or bad? How good or bad? Are we on track?" Few recommends adding "one or more comparative measures, such as a target or some history, as well as a quick visual means for assessing the measure's qualitative state (for example, good, satisfactory, or bad)." [Few](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf)
- Precision (pitfall #3): show "$3.8M" rather than "$3,848,305.93". Few calls 4 to 10 decimal digits and times to the second excessive on a dashboard: "every unnecessary piece of information results in wasted time." [Few](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf)
- Directness (pitfall #4): show the variance directly, ideally as a percentage ("-10%"), rather than making the viewer subtract actual from budget. [Few](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf)
- Single screen (pitfall #1): "simultaneity of vision" matters because "we can only hold a few chunks of information at a time in short-term memory". Splitting metrics behind radio buttons or tabs so they can "never [be seen] together" is a mistake. [Few](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf)
- Meaningless variety (pitfall #6): consistency in display media "saves them time and energy". Choosing chart types "for the sake of variety" hurts. Few also criticises spending "the most prominent position, the top left" on a logo. [Few](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf)
- NN/g: dashboards are "focused on a single task: communicating critical information" that "can be consumed fast, with a minimum of interaction or cognitive processing". They are not for exploration. Gauges "consume a lot of precious space". Linear bullet charts are better. Avoid pies "most of the time" and 3D. [NN/g, Dashboards: Making Charts and Graphs Easier to Understand](https://www.nngroup.com/articles/dashboards-preattentive/)
- NN/g: length and 2D position are the best encodings for quantities. Colour "should not be used to communicate information about quantitative values" and "should only be used to reinforce information that is already communicated in a different way." Shape or clear spatial grouping signals relatedness more reliably than colour. [NN/g](https://www.nngroup.com/articles/dashboards-preattentive/)
- IBM Carbon (presentation dashboards): "Prioritize data by importance, then create a clear visual hierarchy". The most important data gets "the highest contrast and occupy the largest area". Readers scan in an F-shaped pattern, so the most important item goes at the top. "Non-essential information should be provided as needed." Use consistent colours per data set. Carbon cites research that white space "increases comprehension by almost 20 percent". [IBM Carbon, Dashboards](https://carbondesignsystem.com/data-visualization/dashboards/)
- IBM Carbon (consistency): "All charts should use the same layout and spacing". Keep legends in the same position. Use annotations for trends, averages, peaks and valleys, but "avoid annotations that obstruct the view of data." [IBM Carbon](https://carbondesignsystem.com/data-visualization/dashboards/)
- Apple HIG: "An effective chart highlights a few key pieces of information". "The data itself [should be] most prominent, while letting the descriptions and axes provide additional context without competing with the data." [Apple HIG, Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- Apple HIG, small or compact charts: "maximize the width of the plot area", keep axis labels "as short as possible", put units in the title. On watchOS, "avoid requiring complex chart interactions" and prefer "useful information people can get at a glance". A small chart inside a button can open "a more detailed version", and that small chart can carry one high-level accessibility label. [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/charts)
- Apple HIG, axes: use a fixed range when min and max are meaningful (for example 0 to 100%) and a dynamic range otherwise. Zero is not always the right lower bound for line marks. Prefer familiar tick sequences (0, 5, 10). With interactive inspection you can use "fewer grid lines and light label colors." [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/charts)

### Inferences
- A card anatomy that follows from Few, Carbon and Apple, for each of the nine series cards, top to bottom:
  1. A short label (2 to 4 words).
  2. A big value at Few's level of precision ("-88%", "3.8M", never 4 decimals).
  3. One delta expressed directly against a stated reference ("vs 2019 normal", "vs yesterday"). That is Few's "compared to what".
  4. A state glyph (good, watch, bad) that does not rely on colour alone.
  5. A sparkline at full card width.
  6. At most one sentence, and only when the number is not self-explanatory.
- All nine cards should be identical in structure, size and scale conventions (Few #6, Carbon consistency). A pixel-art identity can carry the uniformity: one card "sprite" frame repeated nine times.
- Hero number: the largest and highest-contrast element on the page, top-left or top-centre (Carbon, F-pattern). Remove the logo from the top-left prime spot (Few).
- Pixel-art fit: a bullet-graph or bar meter (NN/g, Few) suits pixel art far better than a gauge, because horizontal blocks align to the pixel grid. A stepped sparkline drawn on whole pixels is still a length or position encoding, so it stays readable.
- State shown by shape plus colour (Apple, NN/g), for example a pixel up arrow, flat bar or down arrow, or pixel icons for "normal", "watch" and "alert". This survives a limited pixel palette.

### Gaps
- Google Material's data-visualisation page (m2.material.io) is client-rendered and returned no content. I could not verify Material's guidance on highlight colour, sparklines or dashboards.
- None of the fetched sources gives a canonical pixel size for KPI numbers, sparklines or cards. Few's book "Information Dashboard Design" has sparkline and bullet-graph specs, but I only had the 2006 whitepaper. The bullet-graph spec PDF was not fetched.
- The exact "1 number + 1 delta + 1 sparkline + 1 sentence" formula is a synthesis, not a quoted standard.

## 2. Charts that explain themselves: takeaway titles, direct labels, annotations, highlight colour

### Takeaway
Put the conclusion in the title ("Hormuz traffic is 88% below normal"). Put the precise measure, geography and period in a smaller subtitle. Label lines directly instead of using a legend. Annotate the one or two points that need explaining. Keep text to two visual levels. Exact values go to tooltips or details.

### Cited Findings
- Datawrapper (Lisa Charlotte Muth): titles should lead with the plain takeaway, for example "Is higher than ever" over "peaks", "More x than y" over "x surpassed y". Avoid jargon ("median", "standard deviation") in titles. Keep precision for the description, for example "Change in rent from Q1 2020 to Q1 2022". [Datawrapper, Text in data visualizations](https://www.datawrapper.de/blog/text-in-data-visualizations)
- Datawrapper: remove the colour key and label categories directly, to reduce eye travel. Datawrapper does this by default for line, pie and donut charts on desktop. [Datawrapper](https://www.datawrapper.de/blog/text-in-data-visualizations)
- Datawrapper typography: sans-serif, regular weight, sentence case, text above 12px, nearly black. The title gets the biggest, boldest, highest-contrast text. Secondary text is small, thin and grey. "Limit annotations and labels to two clearly different levels, such as 12px gray and 14px black." Left-align text longer than about 10 words. Use "20m" formats. Move exact values to tooltips or downloads. [Datawrapper](https://www.datawrapper.de/blog/text-in-data-visualizations)
- Datawrapper annotations should explain highlight ranges and drawn lines, call out outliers ("Texas has the lowest income..."), and explain why values look as they do ("The latest recession happened here..."). [Datawrapper](https://www.datawrapper.de/blog/text-in-data-visualizations)
- Datawrapper: in line and area charts, annotations can replace axis labels. (search summary) [Datawrapper Academy](https://www.datawrapper.de/academy/why-datawrapper-does-not-include-axis-labels-for-many-charts)
- UK ONS service manual: titles are "front-loaded", active voice, sentence case, "15 words or fewer", and must "describe the main trend you want the chart to show". If the titled trend is not the most visible one, change the data or the chart. Example: "More people felt low satisfaction with their lives in January to March 2024 than in the same period five years ago". Interactive tools may use prompt titles ("Explore the top 11 boys' names..."). [ONS, Chart text](https://service-manual.ons.gov.uk/data-visualisation/guidance/chart-text)
- ONS subtitles: "statistical measure, geographic coverage, and time period", in that order, separated by commas, not repeating the title. Axis titles carry the unit only. Footnotes only for "essential contextual information", with "no lengthy footnotes that require scrolling", and not repeated across charts. Alt text is 100 to 200 characters: "A [chart type] showing that [chart title]." [ONS](https://service-manual.ons.gov.uk/data-visualisation/guidance/chart-text)
- Apple HIG: "Summarize the main message of your chart". Weather titles and subtitles the next-hour precipitation chart so people get the key information "without requiring them to examine the details of the chart." Use "descriptive titles, subtitles, and annotations". [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/charts)
- Apple HIG on colour: use colour to "highlight differences and elevate key details". "Avoid relying solely on color". Add shapes or patterns, as Health does with circle vs diamond marks for blood pressure. [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/charts)
- Apple HIG on accessibility labels: avoid subjective words ("rapidly", "gradually", "almost") and use real values. Write "June 6", not "6/6". "Describe what the chart's details represent, not what they look like." [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/charts)
- Knaflic, Storytelling with Data: action titles that state the takeaway, for example "Estimated 2015 spending is above budget" instead of a generic label. (search summary, secondary plot-summary site) [SuperSummary](https://www.supersummary.com/storytelling-with-data/summary)
- Knaflic's "declutter, then focus": remove non-critical gridlines, excess data labels and colour variety, then direct attention with colour, bold and contrast. The Ajani, Lee, Xiong, Knaflic, Kemper and Franconeri paper "Declutter and Focus" reports that "the overwhelming majority of visualizations intended for explanatory purposes include graphical clutter and do not focus attention". (search summary; full-text fetch failed, so I have no sample size or effect sizes) [Ajani et al., Declutter and Focus (NSF PAR)](https://par.nsf.gov/servlets/purl/10350268)
- World Bank data-viz style guide: "Legends can be used whenever direct labeling is not possible (e.g. in maps or scatterplots)." (search summary) [World Bank style guide](https://worldbank.github.io/data-visualization-style-guide/chartelements)
- FT Visual Vocabulary, "Change over time": the line is "the standard way to show a changing time series". The fan chart "shows uncertainty in projections, which typically widens further into the future". Slope charts work if the data reduce to 2 or 3 points. Column charts must start at zero. Lines are less strict. [FT Visual Vocabulary (chart-doctor)](https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary)
- FT Visual Vocabulary, "Deviation": variation (+/-) from a fixed reference such as zero, a target or a long-term average. Charts: diverging bar, surplus/deficit filled line. [FT Visual Vocabulary](https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary)
- Economist titles: the EU data-visualisation guide notes that The Economist uses humour in chart titles ("Rust in space"). (search summary) [data.europa.eu, Guidelines for visualisation titles](https://data.europa.eu/apps/data-visualisation-guide/guidelines-for-visualisation-titles)

### Inferences
- Title pattern for the detailed panel and cards: "[Series] is [N]% [above/below] [reference]". Example: "Hormuz traffic is 88% below normal". Subtitle, ONS order: "Daily transits, Strait of Hormuz, 1 Jan to 31 Oct 2026".
- "Deviation from normal" is the FT category most of these series fall in. A surplus/deficit filled line (area above or below a baseline, filled in two colours) reads at a glance and is easy to draw in pixel art as filled columns.
- The forecast interval is the FT fan chart. It needs one direct label at the right edge ("80% range") instead of a legend.
- Two text levels map cleanly onto a pixel font at two integer scales (for example 1x for notes, 2x for labels), plus the title. That honours Datawrapper's "two levels" rule without anti-aliased intermediate sizes.
- Highlight colour: one accent for "today / forecast", everything else in a neutral palette tone. On a limited pixel palette this is natural and it matches "declutter, then focus".
- Keep pixel typography above about 12px effective height (Datawrapper's minimum). Pixel fonts at 1x often fall below that.

### Gaps
- The official Economist chart style guide and the FT house chart style guide (beyond the Visual Vocabulary) were not found or fetchable. medium.economist.com ("Mistakes, we've drawn a few") blocked fetching. The red-tag and title conventions found came only from an unofficial homage page, so I did not cite them.
- Flourish's guidance was not researched (tool budget).
- I could not open the Knaflic "Declutter and Focus" paper itself (connection refused), so it has no numbers.

## 3. Progressive disclosure: what goes on layer one vs behind tap, hover or "details"

### Takeaway
Use two layers, not three. Layer one holds everything users need often: hero number, takeaway title, chart with interval, deltas. Methodology, scores, caveats, sources and exact values go one tap away, behind a clearly labelled control. On mobile, numbered annotation keys and nonmodal bottom sheets keep context. Never hide critical information behind interaction.

### Cited Findings
- NN/g: progressive disclosure defers "advanced or rarely used features to a secondary screen". "You have to disclose everything that users frequently need up front." Presence on the first display signals importance. [NN/g, Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- NN/g: designs beyond 2 levels "typically have low usability because users often get lost when moving between the levels". If you seem to need 3 or more, simplify first. The control that reveals more must be visible and labelled with strong "information scent". The pattern "improves 3 of usability's 5 components": learnability, efficiency and error rate. Use analytics and usability testing to decide what is frequent. [NN/g](https://www.nngroup.com/articles/progressive-disclosure/)
- NN/g, staged disclosure (wizard-like) suits linear, independent steps. It is "problematic" when users must move back and forth. [NN/g](https://www.nngroup.com/articles/progressive-disclosure/)
- Apple HIG: "Let people interact with the data when it makes sense, but don't require interaction to reveal critical information." Stocks lets people "drag a vertical indicator through the line graph, revealing the value at the selected time". For small marks, expand the hit target to the whole plot area so people can scrub. [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/charts)
- Apple HIG: a small chart in a button that opens "a more detailed version" is an endorsed pattern. On watchOS, defer detail and extra interactions to the iPhone version. [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/charts)
- IBM Carbon: "Non-essential information should be provided as needed". Exploration-dashboard interactions (filter, drill down) are for users who "have to be very interactive". [IBM Carbon](https://carbondesignsystem.com/data-visualization/dashboards/)
- Datawrapper on mobile: "On small screens, annotations get numbered and move below the chart". An author can mark an annotation to stay on the chart ("Show as key on mobile" off). Annotation width scales with the chart: an 800px chart in a 600px column makes annotations 25% narrower. [Datawrapper, Responsive annotations](https://www.datawrapper.de/blog/better-more-responsive-annotations-in-datawrapper-data-visualizations/)
- Datawrapper: on small screens, hide the least important annotations or move them below the chart. The colour key moves to the top. [Datawrapper, Text in data visualizations](https://www.datawrapper.de/blog/text-in-data-visualizations)
- NN/g bottom sheets: nonmodal sheets suit "presenting detailed information or options in parallel with the main information on the screen". Expandable sheets "start off as nonmodal in their minimized state but become modal when expanded". Provide "a clear Close button" (not only a grab handle), support Back to dismiss, and do not rely on vertical swipe ("prone to swipe ambiguity"). Do not stack sheets. Do not use them "for displaying complex content". A sheet "preserves some of the user's current context", whereas a new page requires "spatial reorientation". [NN/g, Bottom Sheets](https://www.nngroup.com/articles/bottom-sheet/)
- Our World in Data Grapher: the data source shows on every chart, with a "Learn more about this data" overlay for details. View tabs (chart, map, table) sit top-left and controls relevant to the current view top-right. Download and share live bottom-right. All options sit in one "Settings" menu. There is a full-screen button. [OWID, Redesigning our interactive data visualizations](https://ourworldindata.org/redesigning-our-interactive-data-visualizations)

### Inferences
- Layer one (always visible): hero number plus its delta, takeaway title, forecast chart with interval band and "today" marker, the interval rows reduced to 1 or 2 key quantiles, the nine cards (value, delta, sparkline), and a one-line source.
- Layer two (one tap, a single level): methodology, model scores or calibration, full interval table, caveats, data sources, the replay slider history. Use one "about this forecast" control per panel, labelled concretely ("How this forecast works", "Sources and caveats"), not "More".
- The replay slider is an exploration control (Carbon's exploration mode). It can stay on layer one if it does not displace the headline. Otherwise it belongs on layer two.
- Mobile: tapping a series card opens a nonmodal bottom sheet with that series' detail chart. One sheet at a time, with a visible pixel "X" close button and Back support (NN/g). Chart annotations collapse into numbered pixel markers ([1], [2]) with the key list below the chart (Datawrapper).
- Hover-only tooltips do not exist on touch. Use Apple's scrub-anywhere-on-plot pattern for exact values, and keep critical values printed (Apple: never require interaction for critical info).

### Gaps
- No NN/g accordion or tooltip article was fetched (tool budget), so no cited evidence here on accordions vs bottom sheets vs tooltips on mobile.
- No source gave sheet heights or detents (NN/g's article does not cover them).

## 4. Wall-of-text reduction: microcopy, readability targets and caveats without paragraphs

### Takeaway
Plain language is a hard standard. GOV.UK: sentences of 25 words or fewer, paragraphs of 5 sentences or fewer, short common words, active voice. ONS: chart titles of 15 words or fewer. Caveats should be short footnotes tied to a specific chart, grey fine print, or numbered annotations, with the long form behind an "about this data" layer.

### Cited Findings
- GOV.UK: "Try to split up sentences that are over 25 words long." "Paragraphs should have no more than 5 sentences each." Plain English is "mandatory for all of GOV.UK". Prefer "buy" over "purchase", "help" over "assist", "about" over "approximately". Be wary of words ending in "-ion" or "-ment". Explain specialist terms on first use. Use active voice. [GOV.UK, Clear language](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/)
- GOV.UK evidence: "1 in 6 adults in England have very poor literacy skills". Higher-literacy readers also prefer plain English because they grasp it faster. A cited SSRN study found 80% of people preferred clearly written sentences, and the preference grew with complexity and with reader expertise. [GOV.UK, Clear language](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/)
- GOV.UK modal verbs: "must" for legal requirements, "need" for administrative steps, "can" for optional actions. Avoid "may be able to". [GOV.UK](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/)
- ONS: titles 15 words or fewer, front-loaded. Footnotes only for "essential contextual information", "as clear and concise as possible", with no scrolling footnotes and no cross-chart footnote references. Do not spell out acronyms in titles; define them in the subtitle or footnotes. [ONS, Chart text](https://service-manual.ons.gov.uk/data-visualisation/guidance/chart-text)
- Datawrapper: fine print (methodology such as "Price estimates are for multi-family rentals in counties with at least 1,000 units") goes in small, thin, grey text under the chart. Shorten sentences and rephrase official axis labels. [Datawrapper](https://www.datawrapper.de/blog/text-in-data-visualizations)
- Apple HIG: avoid subjective qualifiers ("rapidly", "almost") in favour of actual values. Avoid ambiguous abbreviations ("60 meters", not "60m", in accessibility text). [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/charts)
- Few: a dashboard should never show "information that is more detailed or precise than necessary". [Few](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf)
- FiveThirtyEight 2020 forecast: a mascot, Fivey Fox, guided readers. Commentators compared him to Clippy, "providing hints and tips to interpret the results". His messages mostly reminded readers of low-probability, counter-trend outcomes. In other words, he delivered caveats as short speech-bubble annotations rather than paragraphs. (search summary, secondary commentary; the 538 design post now redirects to ABC News) [FiveThirtyEight design post (original URL)](https://fivethirtyeight.com/features/how-we-designed-the-look-of-our-2020-forecast); critique in [Real Life, "What the chart wants"](https://reallifemag.com/what-the-chart-wants/)

### Inferences
- Microcopy budget per element: title 15 words or fewer (ONS), and in practice under 10 on cards. One sentence per card or panel, 25 words or fewer (GOV.UK). Footnotes one line each.
- Caveat tiers: (a) a pixel glyph marker (such as "!" or "*") next to the affected number, linking to (b) a one-line grey footnote under that chart, and (c) the "about this data" sheet for the full method. This is the Datawrapper fine-print plus ONS footnote plus OWID "Learn more" stack.
- A pixel-art site is well placed to adopt 538's mascot pattern. A small sprite with a speech bubble carries caveats and "how to read this" hints, replacing paragraphs while staying on brand. The 538 critique (Real Life) warns that a cute guide can be read as softening bad news, so keep its lines factual.
- Replace adverbs with numbers everywhere (Apple): "88% below normal", not "sharply down".

### Gaps
- GOV.UK's "reading age 9" target and its "how people read online / front-load the first 2 words" guidance were not on the pages I could fetch (the old content-design URLs redirect). Treat them as unverified here.
- No dedicated research found on icon-based caveat markers vs footnotes for comprehension.

## 5. Scrolling narrative vs dashboard grid for a daily forecast page

### Takeaway
The research supports a hybrid "martini glass": a short author-driven top (one headline number and one takeaway chart) that opens into a reader-driven grid (nine cards, replay, details). That matches Few's single-screen ideal for the glance layer and Carbon's F-pattern ordering.

### Cited Findings
- Segel and Heer (2010) place narrative visualisation on a spectrum. Purely author-driven means "a strict linear path... relies heavily on messaging, and includes no interactivity". Purely reader-driven means "no prescribed ordering... no messaging, and a high degree of interactivity". They name 7 genres: magazine style, annotated chart, partitioned poster, flow chart, comic strip, slide show, video. (search summary) [Segel and Heer, Narrative Visualization](https://homes.cs.washington.edu/~jheer/files/narrative.pdf)
- The martini-glass structure follows "a tight narrative path early on (the stem...) and then opening up later for free exploration (the body)". The drill-down story is a more reader-driven alternative. (search summary of the paper and course material; one blog disputes the author/reader framing, but the primary paper supports it) [Segel and Heer](https://homes.cs.washington.edu/~jheer/files/narrative.pdf)
- Few: a dashboard's power is "simultaneity of vision". Scrolling to see the rest sacrifices comparison. [Few](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf)
- IBM Carbon: F-shaped scanning, so most important at top, least important at the end. Highest contrast and largest area go to the most important data. [IBM Carbon](https://carbondesignsystem.com/data-visualization/dashboards/)
- NN/g: dashboards are for monitoring, not exploration. Analytical dashboards flag issues for "further thought, investigation". [NN/g](https://www.nngroup.com/articles/dashboards-preattentive/)
- NN/g: staged (linear) disclosure fails when users need to go back and forth. [NN/g](https://www.nngroup.com/articles/progressive-disclosure/)

### Inferences
- A daily forecast is a monitoring task (Few, NN/g), so the core belongs in a grid, not a long scrollytelling piece. A scrollytelling sequence suits an occasional "explainer" or methodology page, not the daily view. Daily repeat visitors need the same positions every day.
- Suggested order (martini glass): (1) hero number plus takeaway sentence, (2) the detailed forecast chart with interval, (3) the 3x3 grid of nine cards on desktop, 1 or 2 columns on mobile, (4) the "about this data" layer. Steps 1 and 2 are the stem. Steps 3 and 4 are the bowl.
- Nine cards in a 3x3 grid fit Few's single-screen ideal on desktop. On mobile, a horizontal row of 9 compact chips, or a 2-column grid of mini cards above the fold, keeps "simultaneity" better than 9 full-height cards.

### Gaps
- No empirical study found comparing scrollytelling vs grid comprehension for daily, repeat-visit forecast pages.
- NYT Upshot's design rationale for its forecast pages (the "needle") was not researched (tool budget).

## 6. Examples to cite

### Takeaway
The strongest cited examples are Apple Weather (title and subtitle summarise the chart), Apple Stocks (scrub-to-reveal), FiveThirtyEight 2020 (frequency-framed uncertainty plus a mascot carrying caveats), OWID Grapher (source on every chart plus a "Learn more" overlay plus consistent control placement), and the FT Visual Vocabulary (fan chart for forecast uncertainty).

### Cited Findings
- Apple Weather: title and subtitle describe next-hour precipitation so the key information comes "without requiring them to examine the details of the chart". [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/charts)
- Apple Stocks: line by default, and dragging a vertical indicator reveals the value at a time. Apple Health: circle and diamond marks, not colour alone. watchOS Heart Rate shows today only, while the iPhone shows more periods. [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/charts)
- FiveThirtyEight 2020: the "ball swarm", a nod to bee-swarm plots, shows 100 representative outcomes as dots. It was praised for frequency framing of probability, though critics noted it still made "probability of winning" the easy read. Fivey Fox annotated the illustrations. (search summary) [FiveThirtyEight design post](https://fivethirtyeight.com/features/how-we-designed-the-look-of-our-2020-forecast); [Statistical Modeling blog, "Forecast displays that emphasize uncertainty"](https://statmodeling.stat.columbia.edu/2021/08/11/forecast-displays-that-emphasize-uncertainty/)
- Our World in Data Grapher: chart, map and table tabs in one frame. The source is shown on every visualisation. "Learn more about this data" overlay. Per-view controls only. Download and share bottom-right. [OWID](https://ourworldindata.org/redesigning-our-interactive-data-visualizations)
- FT Visual Vocabulary: nine relationship categories (deviation, correlation, ranking, distribution, change over time, magnitude, part-to-whole, spatial, flow). Fan chart for projections. [FT chart-doctor](https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary)

### Inferences
- The "100 dots" frequency framing (538) fits pixel art naturally, since each outcome is one pixel block. It could present interval rows as "in 80 of 100 runs, between X and Y" instead of quantile tables.
- OWID's fixed control geography (tabs top-left, actions bottom-right, one Settings menu) is a good model for the detailed forecast panel's chrome, rendered as pixel buttons.

### Gaps
- Carrot Weather, the Met Office app, NYT Upshot and Bloomberg terminal-style cards were not researched within the tool budget. I have no cited design facts for them.
- The 538 design post itself could not be fetched (fivethirtyeight.com now redirects to ABC News, and web.archive.org was blocked). Its claims above rest on search summaries and secondary commentary.
