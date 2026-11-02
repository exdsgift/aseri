# Two whites and one gold carry aseri's blue

Keep the ground at **#1b1bf2** and build everything else from four steps of one white plus a single gold. Text gets **exactly two tints**: **#ffffff** (8.45:1, APCA Lc 91.5) for titles, body copy and every number, and **#dbdbfd** (6.26:1, Lc 70.0) for secondary text and labels. On this blue no lighter second tint keeps margin on all three needs at once: WCAG AA, at least Lc 60, and a dependable gap from white (here 19.7 Lc and 5.4 just-noticeable differences). Chart structure takes two more steps on the same white-to-blue line: **#adadfa** (4.08:1, Lc 45.4) for the 7-day average and the bands, and **#5454f5** (1.59:1, decorative only) for frames and grid. Two darker surfaces of the same hue, **#1818d6** for rows and **#1616c3** for a picked card, replace today's raised greys. The model's path gets the one accent, gold **#ffc94a**, which is the OKLCH complement of the ground (hue 85 against 86.6). It reaches 5.51:1 and Lc 62.2, sits 1.53:1 darker than white, and stays at least 0.177 ΔE_OK from white under every simulated dichromacy. Real values stay white. Darkening the blue would buy the second text tint about 5 Lc at a visible cost, and desaturating it lowers contrast, so the blue stays where it is. Beyond two levels, everything must be carried by size, case, weight, mark shape and dither density, not tint: titles against body, real against forecast, inner against outer band, and states. The one new drawing rule is a 1-art-pixel gap in the band dither around every line, because the gold path over today's 50 % inner band averages only **2.16:1**. All of this can be tested in the existing `web/src/contrast.test.ts`: WCAG and APCA read from the CSS tokens, a palette rule replacing today's "every token is a grey", a simulated colour-vision check on the forecast/real pair, and a pixel check on what `paintChart` draws.

## Eight hexes replace today's nine greys

The recommendation is ranked below. Option 1 is the default. Option 2 is the same palette with a dashed forecast, kept as a choice because the owner has removed dashes before. Option 3 shows what a darker ground buys. Option 4 is the most in-hue accent, and it loses on colour-vision robustness. Every number in this report was computed for it with the research notes' scripts (`code/contrast.py`, `code/chart_accents.py`). They implement the WCAG 2.x luminance formula ([W3C 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)), APCA-W3 0.0.98G-4g ported from the reference code ([apca-w3.js](https://github.com/Myndex/apca-w3/blob/master/src/apca-w3.js)), OKLab ([Ottosson](https://bottosson.github.io/posts/oklab/)) and Machado et al. 2009 dichromacy simulation at severity 1.0 ([project page](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html)). APCA Lc is negative for light text on a dark ground, and this report shows it as a magnitude. ΔE_OK is Euclidean OKLab distance, where 0.02 is one just-noticeable difference ([CSS Color 4](https://www.w3.org/TR/css-color-4/#gamut-mapping)).

| Rank | Option | Ground and surfaces | Text tints | Model's path against real values | Main cost |
|---|---|---|---|---|---|
| **1** | **Default** | #1b1bf2, rows #1818d6, picked #1616c3 | #ffffff, #dbdbfd | gold #ffc94a solid 1 art px; real white solid and heavier (2 art px); band dither cleared 1 art px around lines | second tint is Lc 70, under APCA's Lc 75 body level |
| 2 | Dashed forecast | as 1 | as 1 | gold dashed 3 on, 2 off art pixels; real white solid | the owner removed dashes once; jagged sample paths break into fragments |
| 3 | Darker ground | #1717d0 | #ffffff (10.15:1, Lc 95.6), #ddddf8 (Lc 75.1) | as 1 | 2.9 JND darker and 11 % less chroma: less electric |
| 4 | Cool analogous | as 1 | as 1 | cyan #2ce8f5 (5.62:1), dashes mandatory | cyan falls to 0.105 ΔE_OK from white under protanopia, and collapses with pale tints under deuteranopia |

The token table for option 1 gives each role with its measured contrast on all three surfaces it can sit on. The last column is the lowest WCAG ratio against the ground across simulated protanopia, deuteranopia and tritanopia.

| Token(s) | Role | Hex | On ground #1b1bf2: WCAG / Lc | On row #1818d6 | On picked #1616c3 | Worst CVD, WCAG on ground |
|---|---|---|---|---|---|---|
| `--primary`, `--foreground`, `--white`, `--destructive`, `--ring` | titles, body, numbers, daily values, what happened, art, caution, focus | **#ffffff** | **8.45 / 91.5** | 9.81 / 94.9 | 10.84 / 97.1 | 5.62 |
| `--secondary`, `--muted-foreground` | secondary text, labels and axis, origin and baseline, controls | **#dbdbfd** | **6.26 / 70.0** | 7.27 / 73.5 | 8.03 / 75.7 | 4.22 |
| `--forecast` (new) | model's path, most-likely mark, its legend swatch | **#ffc94a** | **5.51 / 62.2** | 6.40 / 65.7 | 7.08 / 67.9 | 3.35 |
| `--dim` | 7-day average, band dither and band edges | **#adadfa** | **4.08 / 45.4** | 4.73 / 48.9 | 5.23 / 51.1 | 2.81 |
| `--border`, `--input` | frames, forecast-zone hatch, value-tick grid | **#5454f5** | **1.59 / 9.7** | 1.85 / 13.1 | 2.05 / 15.3 | 1.29 |
| `--background`, `--card`, `--popover`, `--sidebar` | ground | **#1b1bf2** | n/a | | | |
| `--muted` | row surface | **#1818d6** | 1.16:1 darker than ground | | | |
| `--accent`, `--sidebar-accent` | picked surface | **#1616c3** | 1.28:1 darker than ground | | | |
| `--primary-foreground`, `--secondary-foreground` | blue text on white or #dbdbfd chips | #1b1bf2 | 8.45 / 86.7 on white; 6.26 / 67.1 on #dbdbfd | | | |

The mapping from `web/src/index.css` is mechanical. Each current token keeps its name and takes a new value. One new token, `--forecast`, takes over the "model's path" half of `--muted-foreground`.

| Current token | Today | New | What changes |
|---|---|---|---|
| `--background`, `--card`, `--popover`, `--sidebar` | #050505 | #1b1bf2 | the ground |
| `--foreground`, `--card-foreground`, `--popover-foreground` | #cfcac0 | #ffffff | body text moves up to white (see the next section) |
| `--primary`, `--accent-foreground`, `--destructive`, `--ring`, `--sidebar-primary`, `--sidebar-accent-foreground`, `--sidebar-ring` | #f2efe8 | #ffffff | the warm white goes |
| `--white` | #ffffff | #ffffff | unchanged; now the same hex as `--primary` |
| `--secondary` | #cfcac0 | #dbdbfd | second text tint |
| `--muted-foreground`, `--sidebar-foreground` | #a5a19a | #dbdbfd | labels join the second tint |
| (new) `--forecast`, plus `--color-forecast: var(--forecast)` in `@theme inline` | n/a | #ffc94a | model's marks |
| `--dim` | #726e68 | #adadfa | same 4.0:1 step as today |
| `--border`, `--input`, `--sidebar-border` | #34322e | #5454f5 | same 1.59:1 step as today |
| `--muted` | #1a1917 | #1818d6 | same 1.16:1 step, now darker than the ground |
| `--accent`, `--sidebar-accent` | #24221f | #1616c3 | same 1.28:1 step, now darker |
| `--primary-foreground`, `--secondary-foreground`, `--sidebar-primary-foreground` | #050505 | #1b1bf2 | chips print blue on white |
| `--chart-1` to `--chart-5` | greys | #ffffff, #dbdbfd, #ffc94a, #adadfa, #5454f5 | no component uses them |

Four call sites change along with the values. `chartTokens.path` in `web/src/lib/chart.ts` moves from `"--muted-foreground"` to `"--forecast"`. The legend swatch for the path in `ForecastPanel.tsx` and the most-likely mark in `Intervals.tsx` move from `bg-muted-foreground` to `bg-forecast`. The side navigation's `opacity-58` becomes `opacity-82`, which the existing nav test will force on its own (see the section on shape and size). The test that asserts "leaves no gold and no navy: every token is a grey" has to be replaced by the palette rule described in the testing section.

## Only two text whites fit between 4.5:1 and pure white

The blue compresses the luminance budget. White on #1b1bf2 tops out at **8.45:1**, against 20.38:1 for white on today's #050505. The WCAG AA floor for normal text, 4.5:1 ([W3C 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)), is reached at only 68.7 % white (#b8b8fb). APCA's body-text minimum of Lc 75 ([APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell)) is reached at 88 % white (#e4e4fd). Side by side, the eye can tell about 29 to 32 one-JND steps apart between the ground and white. Steps that read as separate levels are far fewer. A ladder with every neighbour at least Lc 15 apart (the point APCA calls invisible for many users) holds only five levels: #6666f6, #8f8ff9, #b1b1fb, #d0d0fc and #ededfe. **Only two of them clear 4.5:1.** On this ground, then, the count of text tints is set by arithmetic, not taste.

The second tint has to balance two pulls. Pulled toward white, it reads better; pulled away, it stays distinguishable. Three criteria fix it: at least 4.5:1, at least Lc 60 (APCA's floor for non-body content text), and at least Lc 15 and 5 JND (ΔE_OK 0.10) from white. Inside the window those criteria leave, **#dbdbfd** (84 % white) is the choice with margin on both distinctness bars: **6.26:1, Lc 70.0, 19.7 Lc and 5.4 JND below white**. Under the worst simulated dichromacy it still sits 0.102 ΔE_OK from white. The obvious lighter candidate, #e4e4ff, is body-safe at Lc 75.3 but only **14.2 Lc and 4.1 JND** from white. It sits just under the invisibility line, and the gap is probably smaller in practice than the numbers say. Whittle found that lightness discrimination is sharpest near the background's luminance and coarser far above it ([Whittle 1992](https://pubmed.ncbi.nlm.nih.gov/1455722)), and both near-white tints sit far above the ground's luminance of 0.074. The CSS JND, built for a mid-grey surround, is therefore optimistic here ([CSS Color 4](https://www.w3.org/TR/css-color-4/)).

A literal translation of today's three text greys does not survive the move. Matching each grey's APCA level on the new ground gives #ffffff (Lc 91.5), #e4e4fd (Lc 75.2) and #b8b8fb (Lc 51.0). The top pair is then only 14.3 Lc apart. The bottom tint passes AA by 0.04 (4.54:1) and drops to 3.1:1 under simulated protanopia. Butterick's rule that three heading levels is the limit and "two is better" ([Practical Typography](https://practicaltypography.com/headings.html)) and the DOS convention of exactly two text intensities on blue, light grey for normal and white for active ([CGA palette](https://en.wikipedia.org/wiki/Color_Graphics_Adapter); [Turbo Vision attributes](https://docs.rs/crate/turbo-vision/latest/source/src/core/palette.rs)), point the same way. Two tints, with the third level carried by size and case.

**Body text moves up to white**, because the second tint cannot carry it. Body copy is 12 px Press Start 2P (`index.css` sets `font-size: 12px`). The font's x-height makes that about 14.4 px of APCA's reference font, with stems heavier than Arial Bold. APCA's size lookup allows white at 14 px for weight 700 but asks 14.5 px of #dbdbfd ([apca-w3.js lookup](https://github.com/Myndex/apca-w3/blob/master/src/apca-w3.js)). Titles and numbers lose their brighter tint as a result, and keep their size, face and position. Warm or dimmed whites do not earn a place. The current #f2efe8 would cost 10 Lc on blue (Lc 81.1), and against #e4e4ff it differs by hue only (Lc 0). That kind of difference fades for tritan viewers and at the centre of the fovea, which has almost no blue-sensitive cones ([Williams et al. 1981](https://aria.cvs.rochester.edu/papers/williams-etal_VR1981.pdf)). Material's 87 % white text is vendor practice, not a tested finding ([Material codelab](https://codelabs.developers.google.com/codelabs/design-material-darktheme/)). APCA says small fonts have no contrast maximum, so dimming small white text is the wrong lever ([APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell)). The closest precedent shows the trap. Hermes Agent's electric-blue site uses 60 % white for secondary text ([hermes-agent.nousresearch.com](https://hermes-agent.nousresearch.com/)), which on #1b1bf2 is #a4a4fa at 3.73:1, below AA.

All four tints sit on the straight line from the ground to white, with R equal to G. That is deliberate. A Bayer dither of white over blue averages in linear light to a colour on the same line, so a flat tint and a dithered area of the same lightness match. Mixing in OKLab would instead drift the tints to sky blue, a second hue family. The line also makes every step a luminance step, which is the step that survives tritan simulation and small targets. Blue-only differences between tints lose about half their distance under tritanopia (perception notes, via [DaltonLens](https://daltonlens.org/opensource-cvd-simulation/)). The mark tints follow today's proportions. **#adadfa** keeps the current dim's 4.0:1 step and clears Lc 45, the APCA minimum for fine detail ([APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell)), which a 2 px line is. **#5454f5** keeps the border's 1.59:1 step. At Lc 9.7 it sits below APCA's visibility floor, so it may only ever decorate. If frames look too faint in review, #6666f6 (1.93:1, Lc 15.3) is the next step.

| Neighbouring pair | WCAG between | Lc, lighter on darker | ΔE_OK normal | Lowest ΔE_OK under simulated CVD |
|---|---|---|---|---|
| #ffffff and #dbdbfd | 1.35 | 19.7 | 0.108 | 0.102 |
| #dbdbfd and #adadfa | 1.54 | 23.6 | 0.140 | 0.130 |
| #adadfa and #5454f5 | 2.56 | 35.0 | 0.260 | 0.229 |
| #ffffff and #ffc94a | 1.53 | 27.7 | 0.205 | 0.177 (tritan) |
| #ffc94a and #adadfa | 1.35 | 15.8 | 0.271 | 0.144 (tritan) |

## Darkening the blue buys five Lc and costs the electric look

The ground is already near the best version of itself. Desaturating at constant lightness *lowers* contrast. Less chroma at the same OKLab lightness means higher luminance, so white falls from 8.45:1 to 7.60:1 at half chroma while APCA barely moves (91.5 to 90.9). Brightening hurts (#2a2aff gives 7.31:1). Pure #0000ff gains nothing (8.59:1, Lc 90.7). Only darkening helps, and the table shows how little it buys per step.

| Ground | Change from #1b1bf2 | OKLCH chroma | White: WCAG / Lc | Lightest second tint at Lc 75 | Its gap to white |
|---|---|---|---|---|---|
| #1b1bf2 | none | 0.289 | 8.45 / 91.5 | #e4e4fd | 14.3 Lc, 4.0 JND |
| #1a1ae6 | 1.0 JND | 0.278 | 9.00 / 92.9 | #e2e2fc | 15.6 Lc, 4.4 JND |
| **#1717d0** | 2.9 JND | 0.257 | 10.15 / 95.6 | **#ddddf8** | **18.8 Lc, 5.1 JND** |
| #1515c8 | 3.6 JND | 0.250 | 10.64 / 96.6 | #dcdcf7 | 19.4 Lc, 5.2 JND |
| #10109a | 7.6 JND | 0.204 | 13.44 / 101.6 | n/c | n/c |

**#1717d0 is the lightest ground on which a second text tint is both body-safe (Lc 75) and clearly apart from white (15 Lc, 5 JND).** It costs 11 % of the chroma and drops OKLab lightness from 0.45 to 0.41. That chroma at medium lightness is the "electric" quality the owner chose. The gain for small text is marginal. White's APCA minimum size at weight 400 falls only from 16 to 15 px between #1b1bf2 and #10109a, so no blue makes 8 to 12 px pixel text APCA-conformant. Option 1 therefore keeps #1b1bf2 and spends the darker steps locally, as surfaces. Rows at **#1818d6** and picked cards at **#1616c3** repeat today's 1.16:1 and 1.28:1 surface steps in the same hue, and on the picked surface the second tint reaches Lc 75.7. The direction flips on purpose. A lighter panel would cut every ratio on it by 14 to 22 % (the dim would fall to 3.19:1 on a 1.28:1-lighter panel), while the darker ones raise every ratio by 16 to 28 %. This trades against the Klein-style ideal of one flat, uninterrupted field. Because the site's states never rest on a shade (each has a marker or words), setting `--muted` and `--accent` to the ground is a valid flat alternative. For readers who ask for more, a `prefers-contrast: more` block could switch the ground to #1515c8 and all text to white (10.64:1, Lc 96.6), as the perception notes suggest. Two effects remain unquantified: how much darkening a viewer tolerates before the blue stops reading as electric, and how display gamut shifts an untagged #1b1bf2.

## Gold, the blue's own complement, marks the model

On a saturated blue, very few hues can mark a chart line. Only two families clear 3:1 with room to spare: warm lights (yellow, gold, amber) and cool lights (cyan, mint). Red, orange and fluorescent pink land at **2.16 to 2.99:1**. They are also the long-wave against short-wave pairs that produce chromostereopsis, the effect where one colour seems to float in front of the other. Faubert showed that luminance profiles drive this depth effect, and that it can arise with achromatic information plus only one other colour ([Kitaoka on chromostereopsis](https://www.ritsumei.ac.jp/~akitaoka/scolor-e.html)). Material warns that saturated colours "vibrate" on dark grounds ([Material codelab](https://codelabs.developers.google.com/codelabs/design-material-darktheme/)). Under simulated protanopia those warm hues fall to **1.09 to 1.52:1** against the ground. Cyan and mint fail differently: they converge on white and on the pale tints. Cyan against #c8c8ff collapses to ΔE_OK 0.011 under deuteranopia, effectively one colour.

Gold wins on more than hue. The ground's OKLCH hue is 266.6°, so its complement is 86.6°. **#ffc94a sits at 85°**, which follows Datawrapper's "use complementary colors" and its advice to keep accents off the pure 60° yellow ([Datawrapper](https://www.datawrapper.de/blog/beautifulcolors/)). It also sits between the amber and yellow steps that pixel palettes already ramp through ([Endesga 32](https://lospec.com/palette-list/endesga-32); [PICO-8](https://lospec.com/palette-list/pico-8)). The decisive property is its lightness. Pure Riso or PICO-8 yellow beats gold against the ground (6.8 to 7.0:1). But it is only 1.22 to 1.25:1 from white, so a yellow line differs from a white one mainly through blue-sensitive cones. Those cones are weakest for small targets ([Mollon 1982](https://vision.psychol.campsych.vs.mythic-beasts.com/jdmollon/papers/Mollon1982Tritanopias.pdf)), and under tritanopia yellow drops to 0.09 to 0.11 ΔE_OK from white. Gold adds a **1.53:1 luminance step** that the red and green channels carry. That step survives 2 px lines, dichromacy and greyscale. Gold stays at least 0.177 ΔE_OK from white and at least **3.35:1** from the simulated ground under all three dichromacies. The only other hue that holds both is pure green (#00e436), a neon close to the pure sRGB hue that Datawrapper advises against. It also turns yellowish for protan and deutan viewers, so it adds nothing gold does not.

**One accent is enough, and a second would cost more than it gives.** The hues that remain either vibrate (pink #ff48b0 is 2.74:1) or collapse into the white family (cyan, mint). DOS interfaces on blue kept a single extra hue for a single meaning: marked files turned yellow ([Midnight Commander skins](https://midnight-commander.org/wiki/doc/common/skins?format=txt)). Where a view needs one more signal, such as today's value, a selected item or an alert, inverse video does the job inside the palette: blue on a white chip gives 8.45:1 and Lc 86.7. If the owner wants a second hue anyway, the safest choice is the notes' built pink #fb9dbf (4.30:1), used only for markers with a white outline and never for 1 to 2 px lines.

The role assignment follows forecasting convention. **Real values are white, the model is gold.** Observed data is the plain line and the projection carries the colour ([visualizing.org fan chart](https://www.visualizing.org/fan-chart); [Exceljet](https://exceljet.net/chart/line-chart-actual-with-forecast)). White also gives truth the highest contrast on the page, so the most uncertain series never gets the strongest mark. Daily values and what happened share that white, as all observed truth should. They stay apart by mark and side: a line before the origin, 2-art-pixel squares and a closing ring after it, which `paintChart` already draws. Gold is a mark colour, not a text colour. At Lc 62.2, APCA wants 16 px at weight 700, so gold text is legal only on 16 px Press Start 2P numerals or larger. The forecast zone's "Next ..." label and the tooltip's "Most likely" stay white or #dbdbfd, and the legend swatch ties them to the line.

The owner's history with dashes argues for a solid default with a dashed option, not a mandate. The convention is less strict than it looks. A survey of COVID-19 projection charts found "solid line charts with shade" in 16 of 29 cases, against 6 that switched to a dashed projection ([Zhang et al.](https://arxiv.org/pdf/2101.04743)). Solid against dashed is a convention, not a rule ([Storytelling with Data](https://www.storytellingwithdata.com/blog/2018/6/27/visualizing-uncertainty)).

| | Option A, solid: hue plus weight (default) | Option B, dashed forecast |
|---|---|---|
| Real values | white, solid, 2 art px (4 CSS px), drawn last | white, solid, 1 art px |
| Model's path | gold, solid, 1 art px (2 CSS px) | gold, 3 on and 2 off, counted along the Bresenham steps |
| What still separates them in greyscale | 1.53:1 luminance plus 2:1 stroke weight | 1.53:1 luminance plus pattern |
| Under simulated dichromacy | ΔE_OK at least 0.177, plus weight | same, plus pattern |
| Cost | heavier real line; where the forecast was right, white covers gold | dashes the owner removed once; a jagged sample path breaks into fragments, worst on the small card chart |

The bands need one rule change. Today the inner band dithers `--dim` at 50 % and the outer at 25 %, with solid edges (`paintChart` in `web/src/lib/chart.ts`). Averaged in linear light, the inner band of #adadfa reads as #8080f6. **Gold on it is 2.16:1 and white 3.31:1.** On the black site, today's grey path kept 3.17:1 over the same band. Seen pixel by pixel, a gold pixel beside a dim pixel is only 1.35:1. Art pixels are 2 CSS px, so the 50 % checker repeats every 4 CSS px, about 8 cycles per degree at 50 cm, coarse enough for the eye to resolve. The robust fix is the pixel-art outline: **clear band pixels within 1 art pixel of any path or real-value pixel**, so every line has a ground-coloured edge (5.51:1 for gold, 8.45:1 for white). This keeps the 25/50 % look and the `dither-25`/`dither-50` legend swatches unchanged. The alternative is to halve the densities to 12.5 and 25 %, which lifts gold to 3.99 and 3.13:1 over the bands but changes the legend. Gold-speckle bands, the fan-chart idea that "the uncertainty belongs to the model", would merge with a gold path wherever the two touch. The bands therefore stay in `--dim`.

## Size, shape and dither density carry every other level

With two text tints, one accent and one line tint, every other distinction must come from something other than colour. This continues the site's own rule that "a state never rests on a shade", and it is how the cyanotype blueprint, which "cannot make grey", always worked. Weight, line pattern and a precedence order separated object lines from hidden and centre lines ([LibreTexts alphabet of lines](https://workforce.libretexts.org/Courses/Northeast_Wisconsin_Technical_College/Technical_Sketching_(NWTC)/03%3A_Lines_Styles_and_Types/3.01%3A_Line_styles_and_types)). WCAG asks only that chart lines contrast 3:1 with the background, not with each other ([W3C 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)), so these cues are what keep adjacent marks apart.

| Role | Carried by | Tint allowed | Minimum |
|---|---|---|---|
| Title against body | size and face (Jacquard 24, or larger Press Start 2P), space above | white only | Jacquard 24 at 48 px or more |
| Labels and axis ticks against body | 8 px uppercase, position | #dbdbfd, or white for must-read values (end values, tooltip numbers) | 8 px, on whole pixels |
| Emphasis inside text | inverse chip (blue on white), never a lower tint | white chip | as the text |
| Daily values against what happened | line before the origin; 2-art-px squares and closing ring after it | same white | squares 2 by 2 art px |
| Model's path against real values | hue plus weight (option A) or pattern (option B), real drawn on top | gold and white | 1 art px path, 2 art px real |
| Daily against 7-day average | a 2.07:1 luminance step (Lc 45) plus legend and tooltip words | white and dim | 1 art px |
| Inner against outer band | Bayer density, 50 % against 25 %, solid outer edges | dim | 1 art px cells |
| Picked, active, caution, filled or hollow | marker, frame, shape, words | surface shade is decoration only | n/a |
| Grid, hatch, frames | dotted and diagonal patterns, lowest in z-order | #5454f5 | decorative only |

Press Start 2P stays sharp only where its 8-cell em lands on whole device pixels. **Of the sizes the site uses (8, 12, 16, 24 px), 16 px is the only one crisp at device pixel ratios 1, 1.5 and 2.** 8 px and 24 px are crisp at 1 and 2. 12 px is crisp only at ratio 2: on 1x screens a third of its ink pixels are half-covered, which pulls white's local contrast at those pixels down to roughly Lc 31 to 54 (FreeType rasters in the notes; a browser was not measured). So 12 px text stays white, and moving body copy to 16 px where layouts allow is the stronger fix. At 8 px no colour passes APCA's lookup: the font's 5 px x-height equals about 9.6 px of the reference font, below every row of the lookup. But the new labels at Lc 70 (73.5 on rows) are a clear step up from today's #a5a19a, which reads at Lc 51.6 on black. DotGothic16 at 8 to 12 px renders 1-dot strokes thinner than a pixel, so the wordmark and its four glyphs need 16 px or more, in white. Jacquard 24's hairline stems (0.047 em) behave like weight 100 to 200, so display text needs 48 px or more, in white.

Chart marks are already in good shape. The canvas plots whole art pixels (2 CSS px) and scales them with `image-rendering: pixelated`, so lines never fade through anti-aliasing. The notes measured that fade at up to half of a line's contrast when a 1 px line falls between pixels, and WCAG warns that thin lines render fainter ([W3C 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)). The rule that remains: **any line that carries data uses a token of Lc 45 or more** (white, gold or dim, never the border). Two current uses break it. The interval lane's year line and the replay slider's unreached-week dots are drawn in `--border`; if readers should read either, move it to `--dim`. Two more consequences follow mechanically. First, the side-navigation test pins inactive labels to the lowest opacity that keeps 4.5:1. On blue that is **opacity-82** (#b8b8fb, 4.54:1, Lc 51), so the dimming shrinks from 42 % to 18 %. The active link already carries a border marker, so dropping the dim altogether would also work. Second, text must never sit on the dithered engravings. Their mid-tones average to the same luminance as the 30 to 60 % tints and erase them, so labels need a solid blue quiet zone. The band dither itself is calmer than today's: its pixel contrast (Michelson 0.72 against the blue) is lower than the grey-on-black dither it replaces, which matters because discomfort peaks for high-contrast patterns near 3 cycles per degree ([Evans and Stevenson 2008](https://pubmed.ncbi.nlm.nih.gov/18565084/)).

## Three test layers check tokens, simulated eyes and painted pixels

The existing `web/src/contrast.test.ts` already parses `:root` from `index.css`, computes WCAG ratios and checks the chart tokens. Extending it covers this whole report in about a hundred lines, with no new dependency. The first layer adds APCA beside WCAG. The port below matches the reference implementation's published values (#888 on #fff is Lc 63.06, #fff on #888 is Lc −68.54) and returns −70.03 for #dbdbfd on #1b1bf2. It was run under Node for this report.

```ts
// APCA-W3 0.0.98G-4g (Myndex apca-w3.js); light text on a dark ground gives a negative Lc.
const apcaY = (rgb: number[]) => {
  const [r, g, b] = rgb.map((c) => (c / 255) ** 2.4)
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  return y > 0.022 ? y : y + (0.022 - y) ** 1.414
}
const apca = (text: number[], ground: number[]) => {
  const [t, b] = [apcaY(text), apcaY(ground)]
  if (Math.abs(b - t) < 0.0005) return 0
  const s = b > t ? (b ** 0.56 - t ** 0.57) * 1.14 : (b ** 0.65 - t ** 0.62) * 1.14
  if (Math.abs(s) < 0.1) return 0
  return (s > 0 ? s - 0.027 : s + 0.027) * 100
}
```

| Layer | Assertion | Threshold | Option 1 today |
|---|---|---|---|
| Tokens, WCAG (kept) | every text token on `--background`, `--muted`, `--accent` | 4.5:1 | lowest 6.26 |
| Tokens, WCAG (kept) | `daily`, `path`, `average`, `band`, `origin`, `real` on the three surfaces | 3:1 | lowest 4.08 |
| Tokens, APCA (new) | white 90, `--secondary` 70, `--forecast` 60, `--dim` 45, on every surface | magnitude of Lc | 91.5, 70.0, 62.2, 45.4 |
| Distinctness (new) | white against `--secondary`: Lc at least 15 and ΔE_OK at least 0.10; `--secondary` against `--dim`: Lc at least 15 | Lc, OKLab | 19.7 and 0.108; 23.6 |
| Palette (replaces "every token is a grey") | every token has R equal to G within 1 and B at least R, or is in a named accent list of at most two | membership | passes with `--forecast` as the one accent |
| Simulated CVD (new) | Machado severity 1.0 in linear RGB: `--forecast` against `--white` ΔE_OK at least 0.15, and both at least 3:1 against the simulated ground, for protan, deutan and tritan | ΔE_OK, WCAG | 0.177; 3.35 |
| Band average (new) | white on the 50 % `--dim` dither averaged in linear light, using the Bayer thresholds from `chart.ts` | 3:1 | 3.31 |
| Painted pixels (new, in `chart.test.ts`) | in the `seen` map of last-painted colours, no `band` pixel among the 8 neighbours of any `path` or `real` pixel | none | fails until the keyline lands |

The palette rule is what turns "not too many colours, everything in palette" into a check that fails a pull request. Any new hex off the white-to-blue line, other than the named accent, breaks it. Gate the simulated-CVD layer only on the data marks. Simulated contrast is a proxy computed with normal-vision luminance weights, and the two standard models disagree by up to 1.6 ratio points on white's worst case (Brettel 7.16 against Machado 5.57 for protanopia). Machado is also the weaker model for tritanopia, where Brettel 1997 remains the recommended one ([DaltonLens review](https://daltonlens.org/opensource-cvd-simulation/)). The secondary tint's 4.22:1 under simulated protanopia should therefore be printed, not asserted. The painted-pixel test reuses the pattern `chart.test.ts` already has: `paintChart` takes a plot callback, and the file records the last colour per pixel. Two checks stay manual because jsdom cannot render. One is Chrome DevTools' **Rendering > Emulate vision deficiencies** (protanopia, deuteranopia, tritanopia, achromatopsia, blurred vision, reduced contrast) ([Chrome DevTools](https://developer.chrome.com/docs/devtools/rendering/apply-effects)). The other is a pass at browser zoom levels that produce device pixel ratios of 1, 1.25, 1.5 and 2, to catch off-grid pixel text. WCAG 2.x remains the normative gate. The notes did not verify APCA's current standing in WCAG 3 drafts, so its thresholds are best treated as a second gate the team chooses to enforce.

## Conclusion

Moving from black to electric blue cuts the luminance range from 20:1 to 8.45:1. That turns the palette into a budget, and every extra tint is paid for in distinctness. The budget allows two text levels and no more, so the hierarchy has to move from colour into typography and pixel shape. That is the blueprint's old discipline, and the site's own rule that states never rest on a shade already points there. The accent works for a reason that is easy to miss. Gold is chosen less for its hue than for its luminance. Being 1.53:1 darker than white is what keeps it apart on thin lines, under dichromacy and in the fovea's blind spot for blue, and pure yellow fails precisely because it lacks that step.

Three things remain open, and a short user test on the real dithered charts would settle all three. No colour makes 8 px pixel text APCA-conformant on this ground. The thresholds used here to tell two near-white tints apart (15 Lc, 5 JND) are inferences, not measured perception. And no study has compared reading on a saturated blue with reading on near-black at matched contrast. The test should include protan, deutan and tritan participants and a 1x Windows laptop. Until then, option 1 is the configuration where every number has margin.
