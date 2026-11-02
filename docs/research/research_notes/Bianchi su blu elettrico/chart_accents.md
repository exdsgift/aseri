# Chart accent colours for an electric-blue (#1b1bf2) and white pixel-art palette

Method note for the report writer. Every number marked "computed" was produced by a Python script written for this note (`chart_accents.py`, kept in the session scratchpad, not in the repo). It implements:
- WCAG 2.x relative luminance and contrast ratio ([W3C WCAG 2.1 definition](https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio));
- APCA-W3 0.0.98G-4g, with the constants quoted from the [apca-w3 README](https://github.com/Myndex/apca-w3). The script self-checks against the reference values: #888888 on white gives Lc 63.06 and white on #888888 gives Lc -68.54. A negative Lc means light-on-dark polarity;
- OKLab/OKLCH ([Ottosson, OKLab](https://bottosson.github.io/posts/oklab/)). Colour difference is given as ΔE_OK x100 (Euclidean OKLab distance x100), for relative comparison only;
- Machado et al. 2009 CVD simulation at severity 1.0 (dichromacy), using the matrices from the [authors' project page](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html), verified this session. They are applied to **linear** RGB. That is a methodological choice, because the project page does not say which encoding to use, so simulated hexes will differ somewhat from tools that apply them to gamma-encoded values;
- the perceived colour of a Bayer dither band, computed as the linear-light average of the foreground and ground pixels at density 1/16, 1/8 or 1/4.

Ground #1b1bf2 (computed): OKLCH L 0.452, C 0.289, H 266.6. WCAG relative luminance 0.074. White on the ground is 8.45:1, APCA Lc -91.5.

---

## Q1. Which accent hues work on #1b1bf2? (WCAG, APCA, vibration risk)

### Takeaway
Only the warm-light family (yellow, gold, amber) and the light-cool family (cyan, mint, pale periwinkle) clear 3:1 against #1b1bf2 with room to spare. Orange, red and Riso Fluorescent Pink all fall below 3:1 (2.2 to 3.0:1). They are the classic long-wavelength-on-blue pairs that vibrate. A slightly orange gold near the exact OKLCH complement, such as **#ffc94a**, has the best balance: 5.51:1, Lc -62, and clearly separated from white.

### Cited Findings
- WCAG 2.1 SC 1.4.11 (Non-text Contrast) requires 3:1 for the graphical objects needed to understand content, which covers chart lines ([W3C Understanding 1.4.11](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html)).
- APCA guidance: even "non-fluent spot text" may not go below Lc 30, and fonts over 24 px at weight 300 or more have a maximum contrast of Lc 90 ([apca-w3 README](https://github.com/Myndex/apca-w3)). The README states its full Lc lookup table only as images, so the per-level meanings were not machine-readable (see Gaps).
- Chromostereopsis: red and blue placed side by side make one colour seem to advance and the other recede. Sources describe the effect as tiring and hard to read ([The Visual Communication Guy](https://thevisualcommunicationguy.com/2015/10/16/design-principle-chromostereopsis-or-why-blue-on-red-doesnt-work/); peer-reviewed display study: [Frontiers in Psychology 2015](https://www.frontiersin.org/articles/10.3389/fpsyg.2015.00337)).
- Vibration is reported as strongest for highly saturated, roughly complementary colours (about 180° apart) at equal luminance. Edges suffer most, so fine detail such as small icons and thin strokes is most vulnerable. Suggested fixes: desaturate, shift the hue, or separate the two colours with a neutral ([Envato Tuts+ web design article](https://webdesign.tutsplus.com/--------cms-25621a); [The Visual Communication Guy](https://thevisualcommunicationguy.com/2015/10/16/design-principle-chromostereopsis-or-why-blue-on-red-doesnt-work/)). These come from search-result summaries, and the exact attribution of each sentence between these two pages was not verified by a full fetch.
- Datawrapper: "Avoid pure colors" (hues at exactly 0/60/120/180/240/300° look harsh; shift them 5 to 10°), and "avoid 100% saturation combined with 100% lightness". When using green, "make it a yellow or blue one" ([Datawrapper, Lisa Charlotte Muth](https://www.datawrapper.de/blog/beautifulcolors/)).

**Computed: candidates on the ground.** The source hexes come from the [Riso ink list (risoinks)](https://rdrr.io/github/anfederico/risoinks/src/R/color.R), [PICO-8 on Lospec](https://lospec.com/palette-list/pico-8) and [Endesga 32 on Lospec](https://lospec.com/palette-list/endesga-32). Rows marked "built" were constructed in OKLCH.

| Candidate | Hex | OKLCH L / C / H | WCAG vs #1b1bf2 | APCA Lc on ground | WCAG vs white | Vibration / chromostereopsis risk |
|---|---|---|---|---|---|---|
| White | `#ffffff` | 1.00 / 0 / n.a. | **8.45** | -91.5 | 1.00 | none |
| Pale blue tint (built) | `#c8c8ff` | 0.85 / 0.076 / 285 | 5.30 | -59.7 | 1.60 | none (same hue) |
| Periwinkle (built) | `#9a9aff` | 0.73 / 0.145 / 282 | 3.40 | -36.8 | 2.49 | none (same hue) |
| Riso Yellow | `#ffe800` | 0.92 / 0.193 / 102 | 6.76 | -75.4 | **1.25** | low (large luminance gap) |
| PICO-8 yellow | `#ffec27` | 0.93 / 0.189 / 103 | 6.95 | -77.3 | 1.22 | low |
| Endesga 32 yellow | `#fee761` | 0.92 / 0.153 / 100 | 6.77 | -75.3 | 1.25 | low |
| **Gold (built, near complement)** | **`#ffc94a`** | 0.86 / 0.151 / 85 | **5.51** | **-62.2** | 1.53 | low |
| Gold, brighter (built) | `#ffd23f` | 0.88 / 0.162 / 91 | 5.85 | -65.9 | 1.43 | low |
| Riso Sunflower | `#ffb511` | 0.82 / 0.169 / 79 | 4.78 | -54.1 | 1.77 | low to medium |
| Endesga 32 amber | `#feae34` | 0.81 / 0.157 / 72 | 4.55 | -51.5 | 1.86 | low to medium |
| PICO-8 orange | `#ffa300` | 0.79 / 0.171 / 70 | 4.22 | -47.6 | 2.00 | medium |
| Riso Orange | `#ff6c2f` | 0.71 / 0.193 / 41 | 2.99 (fails 3:1) | -32.0 | 2.82 | **high** (long wavelength, near-equiluminant) |
| Endesga 32 orange | `#f77622` | 0.71 / 0.180 / 48 | 3.05 | -32.6 | 2.77 | **high** |
| PICO-8 red | `#ff004d` | 0.63 / 0.254 / 18 | 2.16 (fails) | -21.6 | 3.92 | **very high** (classic red/blue) |
| Riso Fluorescent Pink | `#ff48b0` | 0.69 / 0.236 / 350 | 2.74 (fails) | -28.9 | 3.09 | **high** |
| PICO-8 pink | `#ff77a8` | 0.74 / 0.172 / 359 | 3.40 | -37.3 | 2.48 | medium to high |
| Riso Bubble-gum | `#f984ca` | 0.76 / 0.163 / 345 | 3.69 | -41.0 | 2.29 | medium |
| Pink (built, H0+90) | `#fb9dbf` | 0.80 / 0.119 / 357 | 4.30 | -48.3 | 1.97 | medium |
| Endesga 32 cyan | `#2ce8f5` | 0.85 / 0.138 / 202 | 5.62 | -63.8 | 1.50 | low |
| Riso Aqua | `#5ec8e5` | 0.78 / 0.105 / 218 | 4.37 | -49.2 | 1.93 | low |
| Riso Mint | `#82d8d5` | 0.83 / 0.084 / 193 | 5.12 | -57.8 | 1.65 | low |
| PICO-8 blue | `#29adff` | 0.72 / 0.160 / 243 | 3.43 | -37.6 | 2.47 | none (same family) |
| PICO-8 green | `#00e436` | 0.80 / 0.257 / 144 | 4.89 | -56.0 | 1.73 | medium (pure, neon) |
| Riso Fluorescent Green | `#44d62c` | 0.77 / 0.236 / 141 | 4.39 | -49.7 | 1.93 | medium |
| Endesga 32 green | `#63c74d` | 0.74 / 0.186 / 140 | 3.95 | -44.1 | 2.14 | low to medium |
| Riso Light Lime | `#e3ed55` | 0.91 / 0.171 / 113 | 6.64 | -74.1 | 1.27 | low |

**Computed: the grid.** It should sit just above the ground.

| Grid hex | WCAG vs ground | APCA Lc | ΔE_OK vs ground |
|---|---|---|---|
| `#3a3af4` | 1.24 | 0 (below APCA clip) | 5.7 |
| `#4b4bf5` | 1.46 | 0 | 9.7 |
| `#5c5cf7` | 1.74 | -12.2 | 14.0 |

### Inferences
- The "vibration" candidates are exactly those whose WCAG contrast against #1b1bf2 sits between 2.2 and 3.0. Red, orange and fluorescent pink are long-wavelength hues placed against short-wavelength blue at low luminance contrast, which matches the vibration conditions in the sources (saturated, opposed hues, close luminance). Yellow and gold are hue-opposed too, but sit 5.5 to 7:1 apart in luminance, so the luminance edge dominates and vibration should be low.
- Pure Riso Yellow `#ffe800` has the most contrast with the ground, but it is almost as light as white (only 1.25:1 between them). On 1 to 2 px lines, white and yellow would then differ mainly by hue, and that difference is weakest at fine scale (see Q2). Darkening it towards gold (`#ffc94a`, 1.53:1 against white, Lc 24.5 gold-on-white) trades about 1.2:1 of ground contrast for clear separation from white, while staying above 4.5:1.
- Greens at hue 140 to 144 are "pure" hues by Datawrapper's rule and also turn yellow-ish under protanopia and deuteranopia (see Q2). They add nothing that gold does not already give.
- The grid works at 1.2 to 1.5:1 (`#3a3af4` or `#4b4bf5`). Because it is in the same hue as the ground, it adds no new colour to the palette.

### Gaps
- The meanings of the APCA Lc levels for non-text elements (the commonly quoted Lc 15 and Lc 30 non-text thresholds) were not confirmed: the README's lookup table is an image. Only the Lc 30 floor for text was confirmed from the text.
- I found no quantitative threshold, in contrast or ΔE, at which chromostereopsis or vibration starts. The risk column is a qualitative judgement built from the cited conditions plus the computed contrast.

---

## Q2. Colour-vision deficiency: do forecast and real lines stay distinguishable?

### Takeaway
Gold (`#ffc94a`) keeps at least 18 ΔE_OK from white and at least 3.35:1 against the ground under all three dichromacies. That makes it the most robust "not white" hue on this blue. Cyan and mint collapse towards white and pale-blue tints under protanopia and deuteranopia. Pink and red lose almost all contrast with the ground under protanopia. Pure yellow is weakest under tritanopia and at fine line widths.

### Cited Findings
- Machado et al. 2009 model: "A Physiologically-based Model for Simulation of Color Vision Deficiency", IEEE TVCG 15(6) 1291-1298. Severity 1.0 corresponds to dichromacy. Intermediate severities can be interpolated from the precomputed matrices, which come in steps of 0.1 ([project page](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html)).
- The authors' page notes an erratum (a typo in Eqs 17 and 18 of the Vis 2009 paper) ([project page](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html)). The `colour` library notes that its tritanomaly simulation uses a shift paradigm as an approximation ([colour-science docs](https://colour.readthedocs.io/en/latest/colour.blindness.html)). The tritan rows below are therefore the least reliable.
- Small-field tritanopia: making a short-wave target very small or very brief raises the threshold of the short-wave (S-cone) mechanism much more than that of the other mechanisms ([Mollon 1982](https://vision.psychol.campsych.vs.mythic-beasts.com/jdmollon/papers/Mollon1982Tritanopias.pdf)). Some researchers argue that tritanopia is characteristic of small fields in general, not only the central fovea ([Williams et al. 1981](https://aria.cvs.rochester.edu/papers/williams-etal_VR1981b.pdf)).
- Datawrapper: yellow, orange, red and blue are "easy to tell apart for colorblind viewers", and "when in doubt, use an orange/red with blue" ([Datawrapper](https://www.datawrapper.de/blog/beautifulcolors/)).

**Computed: simulated views of the ground and white.** White stays `#ffffff` under all three. The ground becomes:
- protanopia: `#0058f7`;
- deuteranopia: `#0041ef`;
- tritanopia: `#006990` (dark teal).

**Computed: candidates under Machado severity 1.0.** The ΔE column gives separation from white (normal / protanopia / deuteranopia / tritanopia). The next column is the lowest contrast against the ground, which is simulated too, across the three CVDs.

| Candidate | Hex | Protanopia | Deuteranopia | Tritanopia | ΔE_OK vs white N/P/D/T | Min WCAG vs ground under CVD |
|---|---|---|---|---|---|---|
| **Gold** | `#ffc94a` | `#e1c838` | `#eed750` | `#ffb7af` | **20 / 23 / 20 / 18** | **3.35** |
| Gold, brighter | `#ffd23f` | `#eacf24` | `#f5dc48` | `#ffc0b6` | 20 / 23 / 20 / 16 | 3.60 |
| Riso Yellow | `#ffe800` | `#ffe000` | `#ffea2a` | `#ffd6c6` | 21 / 21 / 20 / **11** | 4.26 |
| PICO-8 yellow | `#ffec27` | `#ffe400` | `#ffed3b` | `#ffdbca` | 20 / 21 / 19 / **9** | 4.37 |
| Endesga 32 amber | `#feae34` | `#cab31c` | `#ddc638` | `#ff9a97` | 25 / 28 / 24 / 24 | 2.67 |
| Riso Sunflower | `#ffb511` | `#d1b800` | `#e2ca1f` | `#ffa09b` | 25 / 27 / 24 / 23 | 2.83 |
| Riso Orange | `#ff6c2f` | `#968525` | `#baa629` | `#ff4860` | 35 / 40 / 31 / 39 | **1.52** |
| PICO-8 red | `#ff004d` | `#68624d` | `#a09145` | `#ff002e` | 45 / 51 / 36 / 45 | **1.09** |
| Riso Fluorescent Pink | `#ff48b0` | `#667eb3` | `#9a9eac` | `#ff3d76` | 39 / 41 / 30 / 40 | **1.39** |
| PICO-8 pink | `#ff77a8` | `#8d95a9` | `#b0aea5` | `#ff6c89` | 31 / 33 / 25 / 33 | 1.87 |
| Pink (built) | `#fb9dbf` | `#a9afc0` | `#c0bfbd` | `#ff98a9` | 23 / 25 / 20 / 24 | 2.56 |
| Endesga 32 cyan | `#2ce8f5` | `#d5def6` | `#bbcaf6` | `#00f2ec` | 20 / **10** / 17 / 20 | 4.17 |
| Riso Mint | `#82d8d5` | `#ced0d5` | `#bfc5d6` | `#5dddd7` | 19 / **14** / 18 / 21 | 3.64 |
| Mint (built) | `#5dfdd9` | `#f4eed7` | `#dedddc` | `#00fff2` | 17 / **6** / 10 / 19 | 4.83 |
| PICO-8 green | `#00e436` | `#e8cd05` | `#d4bf4a` | `#00dec3` | 33 / 23 / 24 / 24 | 3.52 |
| Periwinkle | `#9a9aff` | `#77a8ff` | `#72a1fd` | `#7caec0` | 31 / 30 / 32 / 28 | 2.36 |
| Pale blue tint | `#c8c8ff` | `#baceff` | `#b8cbfe` | `#bcd1db` | 17 / 16 / 17 / 15 | 3.57 |

**Computed: separation between pairs of chart colours.** "Min CVD" is the smallest ΔE_OK across protanopia, deuteranopia and tritanopia.

| Pair | ΔE_OK normal | Min CVD (which) | WCAG between |
|---|---|---|---|
| Gold `#ffd23f` vs periwinkle `#9a9aff` | 34.0 | 19.3 | n.a. |
| Gold `#ffd23f` vs pale `#b0b0ff` | 28.7 | 14.1 | n.a. |
| Yellow `#ffe800` vs periwinkle `#9a9aff` | 38.9 | 21.5 (trit) | 1.99 |
| Yellow `#ffe800` vs pale `#c8c8ff` | 27.8 | 9.7 (trit) | 1.28 |
| Cyan `#2ce8f5` vs pale `#c8c8ff` | 14.9 | **1.1 (deut)** | 1.06 |
| Cyan `#2ce8f5` vs periwinkle `#9a9aff` | 21.9 | 15.1 (deut) | 1.65 |
| Pink `#ff48b0` vs periwinkle `#9a9aff` | 22.9 | 12.5 (deut) | 1.24 |
| Gold `#ffd23f` vs cyan `#2ce8f5` | 25.0 | 20.9 | n.a. |
| Gold `#ffd23f` vs pink `#ff48b0` | 36.1 | 25.3 | n.a. |

### Inferences
- **The most robust forecast-vs-real pair is white vs gold** (`#ffc94a` or `#ffd23f`). Gold stays at least 16 to 18 ΔE_OK from white in every simulation, and it is the only candidate family that also keeps at least 3:1 against the simulated ground in all of them.
- Pure Riso or PICO-8 yellow is a **worse** forecast colour than gold, even though it has more contrast with the ground. Under tritanopia it drops to 9 to 11 ΔE_OK from white. The difference between white and yellow is mostly an S-cone (blue) difference, and Mollon 1982 shows that channel weakens for small targets. A 1 to 2 px yellow line next to a white one may therefore be hard to tell apart even for viewers with typical colour vision. Gold adds a luminance gap (1.53:1 against white) that survives thin strokes.
- Cyan, aqua and mint are risky whenever pale-blue tints are also in use: cyan against `#c8c8ff` collapses to ΔE 1.1 under deuteranopia, which is effectively the same colour.
- Pink, red and orange become near-invisible against the ground for protanopes (1.09 to 1.52:1). They are unsuitable for thin lines and only usable for large fills or markers with a white outline.
- Whatever the colours, the forecast-vs-real distinction should also be carried by a non-colour cue: a dashed forecast against a solid real line (see Q4). That is the only cue that works in every CVD and in greyscale.

### Gaps
- No empirical study was found that tests yellow-vs-white discrimination on 1 to 2 px lines specifically. The small-field argument is an inference from S-cone threshold literature, not a direct measurement.
- Simulations are at severity 1.0 (dichromacy). Anomalous trichromats, who are more common, will see intermediate results. Interpolated matrices were not computed.
- Applying the Machado matrices to linear rather than gamma-encoded RGB is a choice. Simulators such as Coblis or Chrome DevTools may show slightly different hexes.

---

## Q3. Harmony: principled ways to pick accents that look "in palette"

### Takeaway
The OKLCH complement of the ground (hue 266.6 + 180 = **86.6**) lands on gold, not on orange. That gives a principled reason for a gold accent. It matches the oldest duotone and risograph pairing (blue plus yellow), and it sits between the gold and amber ramp steps that pixel palettes such as Endesga 32 and PICO-8 already contain.

### Cited Findings
- OKLCH lightness is perceptual, unlike HSL, where "adding 10% lightness will have different results for blue and purple colors". Keeping L and C fixed and rotating H gives hue variants of matching perceived lightness and saturation ([Evil Martians, OKLCH in CSS](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)).
- Gamut caveat: "not all combinations of L, C, and H" are displayable, and naive clipping "could change a color's hue". Reduce chroma instead ([Evil Martians](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)).
- Datawrapper's harmony rules: "Don't dance all over the color wheel"; "When in doubt, use complementary colors and their neighbors"; "Use warm colors & blue"; "Use saturation and lightness to make your hues work" before adding hues; "Reserve strong emphasis for one or two highlight colors". It also advises **against** colourful backgrounds: for dark grounds, keep saturation under 20% and lightness between 10 and 25%, because colourful backgrounds distract and limit palette options ([Datawrapper](https://www.datawrapper.de/blog/beautifulcolors/)).
- Riso ink hex approximations ([risoinks R package](https://rdrr.io/github/anfederico/risoinks/src/R/color.R); confirmed for Yellow and Fluorescent Pink by the [SAIC Everything Riso 2024 PDF](https://sites.saic.edu/servicebureau/wp-content/uploads/sites/20/2025/03/EverythingRiso_2024.pdf) and the [MCAD list](https://intranet.mcad.edu/node/3411) via search summaries):
  - blues: Blue `#0078BF`, Medium Blue `#3255A4`, Cornflower `#62A8E5`;
  - yellows and oranges: Yellow `#FFE800`, Fluorescent Yellow `#FFE900`, Sunflower `#FFB511`, Melon `#FFAE3B`, Orange `#FF6C2F`;
  - pinks: Fluorescent Pink `#FF48B0`, Bubble-gum `#F984CA`;
  - cool lights: Aqua `#5EC8E5`, Mint `#82D8D5`, Light Lime `#E3ED55`.
  The sources disagree slightly on Blue (SAIC gives `#0075BF`, MCAD `#0078BF`), and they describe the hexes as approximations ("for reference only").
- PICO-8 16-colour palette: `#000000 #1D2B53 #7E2553 #008751 #AB5236 #5F574F #C2C3C7 #FFF1E8 #FF004D #FFA300 #FFEC27 #00E436 #29ADFF #83769C #FF77A8 #FFCCAA` ([Lospec PICO-8](https://lospec.com/palette-list/pico-8)).
- Endesga 32 includes a blue ramp `#124e89 #0099db #2ce8f5`, a yellow ramp `#f77622 #feae34 #fee761`, cool greys `#c0cbdc #8b9bb4 #5a6988 #3a4466 #262b44` and pinks `#b55088 #f6757a` ([Lospec Endesga 32](https://lospec.com/palette-list/endesga-32)).

### Inferences
- **Complementary (OKLCH) is the principled pick.** The ground's OKLCH hue is 266.6, so its complement is 86.6, which is gold. Riso Yellow (hue 102) and PICO-8 yellow (103) are about 15° greener than the true complement. Riso Sunflower (79) and Endesga amber (72) are slightly warmer than it. The built gold `#ffc94a` (hue 85) is the closest to the complement. It also follows Datawrapper's "avoid pure colors" advice: it is not the pure sRGB yellow at 60° HSL, and its chroma is held below the gamut maximum.
- **Analogous is the alternative.** Hues within about 60° of 266 (periwinkle, PICO-8 blue `#29adff`, Endesga cyan `#2ce8f5` at 202) are the most "in palette". But they separate from white mainly by lightness, which costs either contrast or CVD robustness (Q2).
- **Lightness matching.** Choosing the accent at OKLCH L of about 0.86 to 0.88 puts it between the pale-blue tint (L 0.85) and white (L 1.0). It reads as a peer of the white family rather than a foreign neon.
- **Print and pixel precedent.** Blue plus yellow is the canonical two-ink pairing in the Riso lists, and Fluorescent Pink is the usual third ink. The ground is much more saturated and more violet than Riso Blue `#0078BF` (computed OKLCH: C 0.29 at H 267 against C 0.14 at H 245), so the vibe is "ultramarine plus gold" rather than a literal Riso match.
- Pixel palettes keep warm accents as **2 to 3 step ramps**: Endesga 32 `#f77622 → #feae34 → #fee761`, PICO-8 `#FFA300 → #FFEC27`. A two-step gold ramp (`#ffc94a` for the line, plus a dimmer step for the band dither) is idiomatic and adds no new hue.
- The site breaks Datawrapper's "desaturated background" rule by design. That is exactly why the palette has to stay at 1 or 2 accents: a highly saturated ground leaves few hues that clear 3:1 without vibrating (Q1).

### Gaps
- No primary source was found that publishes a data-viz palette built for a saturated blue (not dark-neutral) ground. Lisa Charlotte Muth's dark-mode guidance assumes low-saturation grounds.
- Viz Palette (Meeks and Lu) and ColorBrewer were not consulted directly, because of the tool-call budget. ColorBrewer palettes are designed for white grounds, so they would mainly serve as a sanity check.

---

## Q4. Roles: is the real line white and the forecast an accent, or the reverse?

### Takeaway
Make the **real values white and solid**, and the **forecast gold and dashed**. That follows the dominant convention: solid for observed data, dashed and shaded for projections, with the uncertainty fan carrying the colour. It also gives "truth" the highest-contrast mark on the page (white: 8.45:1, Lc -91.5; gold: 5.51:1, Lc -62).

### Cited Findings
- A survey of COVID-19 crisis visualisations found:
  - "solid line charts with shade" were the most common way to show projection uncertainty (16 of 29);
  - a solid line for the past followed by a dashed, shaded projection appeared in 6 of 29 ([Zhang et al., arXiv 2101.04743](https://arxiv.org/pdf/2101.04743)).
- An actual-plus-forecast chart convention: "actuals so far in a solid line with forecast numbers in a dashed line" ([Exceljet](https://exceljet.net/chart/line-chart-actual-with-forecast)). Storytelling with Data recommends a second series for the forecast that overlaps the last actual point, so there is no gap ([SWD, when to use a dotted line](https://www.storytellingwithdata.com/blog/2018/5/8/when-to-use-a-dotted-line)). SAP Fiori guidance dashes the connector from the last actual to the first projected value ([SAP Fiori](https://experience.sap.com/fiori-design-web/?p=46035)).
- Fan charts: a solid line for history, a dashed central forecast, and shaded bands that widen with uncertainty, typically at 50%, 75% and 90% ([visualizing.org fan chart](https://www.visualizing.org/fan-chart)).
- The Bank of England's fan chart was designed to avoid "suggesting a degree of precision that would be spurious" ([BoE Quarterly Bulletin 1998 Q1](https://www.bankofengland.co.uk/quarterly-bulletin/1998/q1/the-inflation-report-projections-understanding-the-fan-chart)). Search results report that its red shading earned it the nickname "rivers of blood" ([Wikipedia, Fan chart (time series)](https://en.wikipedia.org/wiki/Fan_chart_(time_series))). This was not verified by a full fetch.
- One source notes that solid vs dashed is a common convention, not a formal rule ([search summary, general-audience source](https://www.storytellingwithdata.com/blog/2018/6/27/visualizing-uncertainty)).

### Inferences
- In fan-chart practice the **projection is the coloured element** and observed data is the plain, neutral line. On this site, "neutral" means white. So white real and gold forecast maps directly onto that convention.
- "What happened after a forecast" should use the same white as history. It is all observed truth. Drawing the white realised line **on top of** the gold dashed forecast makes "reality overwrites the prediction" readable at a glance. A 1 px gap in the ground colour around the white line, the pixel-art "outline" trick, also keeps the two apart where they cross.
- The reverse mapping (white forecast, gold real) would only make sense if the product wanted the forecast to dominate. It conflicts with the fan-chart convention and with "truth is most salient". It would also spend the highest-contrast colour on the most uncertain series.
- The **7-day average** belongs to the observed family. Draw it in periwinkle `#9a9aff` (3.40:1, Lc -36.8) as a 1 px solid line. It is the same hue as the ground, so it adds no new hue, and it is clearly subordinate to white. It stays at least 28 ΔE_OK from white and at least 19 from gold in every CVD simulation. If more legibility is wanted, `#b0b0ff` (4.22:1) works, at the cost of less separation from gold under CVD (14.1).
- A dash pattern in whole pixels (for example 3 on, 2 off) keeps the forecast crisp and pixel-art native.

### Gaps
- FiveThirtyEight's and The New York Times' specific forecast styling (colours, line styles, and which series is the most salient) were not retrieved from primary sources in this session.
- The Bank of England's current house colours for fan charts and outturn lines were not found in a primary style specification.

---

## Q5. Bands: how to colour the dithered uncertainty bands

### Takeaway
Dither the bands at **at most 1/8 (12.5%) Bayer density**, using either the forecast gold or the pale-blue tint `#c8c8ff`. Use 1/16 for the outer band and 1/8 for the inner one. At 1/4 density or above, the band's perceived colour rises so far that the gold line on it falls below 3:1.

### Cited Findings
- Datawrapper: make highlight colours few, and keep the rest "more or less equally attention-grabbing"; adjust saturation and lightness before adding hues ([Datawrapper](https://www.datawrapper.de/blog/beautifulcolors/)).
- Fan charts conventionally nest bands at 50%, 75% and 90% intervals ([visualizing.org fan chart](https://www.visualizing.org/fan-chart)).

**Computed: perceived band colour and line contrast over the band.** The perceived colour is the linear-light average of the dither pixels and the ground.

| Band fill @ Bayer density | Perceived mix | Band vs ground | White line on band (WCAG / Lc) | Gold `#ffc94a` line on band (WCAG / Lc) | Periwinkle `#9a9aff` on band |
|---|---|---|---|---|---|
| Gold `#ffc94a` @ 1/16 | `#4c3dec` | 1.28 | 6.59 / -86.7 | 4.30 / -57.5 | 2.65 |
| Gold `#ffc94a` @ 1/8 | `#6751e5` | 1.56 | 5.41 / -81.7 | **3.53** / -52.5 | 2.17 |
| Gold `#ffc94a` @ 1/4 | `#8b6dd7` | 2.12 | 3.99 / -72.5 | **2.60 (fails)** / -43.3 | 1.60 |
| Pale `#c8c8ff` @ 1/16 | `#3d3df3` | 1.27 | 6.65 / -86.7 | 4.34 / -57.5 | 2.67 |
| Pale `#c8c8ff` @ 1/8 | `#5151f4` | 1.54 | 5.48 / -81.9 | **3.58** / -52.7 | 2.20 |
| Pale `#c8c8ff` @ 1/4 | `#6d6df5` | 2.07 | 4.07 / -73.1 | 2.66 (fails) / -43.9 | 1.64 |
| White @ 1/8 | `#6767f4` | 1.94 | 4.35 / -75.2 | 2.84 (fails) / -46.0 | 1.75 |
| White @ 1/4 | `#8b8bf5` | 2.86 | 2.95 (fails) / -61.2 | 1.93 (fails) / -32.0 | 1.19 |
| Riso Yellow `#ffe800` @ 1/2 | `#bcabb2` | 3.86 | 2.19 (fails) | n.a. | n.a. |
| Riso Fl. Pink `#ff48b0` @ 1/4 | `#8b2be4` | 1.43 | 5.89 | n.a. | n.a. |

### Inferences
- **Density, not hue, decides whether the band competes with the lines.** Any fill at 1/4 density or more pushes the band luminance up so far that the gold forecast line drops under 3:1. White dither is the worst offender, because it is the lightest fill.
- **Gold dither vs pale-blue dither.** They have nearly identical luminance (1.56 vs 1.54:1 at 1/8), so the choice is semantic and aesthetic.
  - Gold dither ties the band to the forecast, like the coloured fan in fan-chart practice: "this uncertainty belongs to the model". Up close the pixels read as gold speckle. From a distance, the complementary mix averages towards a muted violet (`#6751e5`), which reads as quieter, not as a new colour.
  - Pale-blue dither stays strictly in hue (`#5151f4`). It is the calmest option, but it visually belongs to the observed family (white and periwinkle).
  - Recommendation: gold dither for the forecast's bands, matching the convention. Pale blue is the fallback if the owner finds gold speckle too busy.
- A two-step nest gives a "fan" with only one hue:
  - outer interval (80 to 90%) at 1/16;
  - inner interval (50%) at 1/8.
  Both keep the white line above 5.4:1 and the gold line above 3.5:1.
- The periwinkle 7-day average falls to 2.17 to 2.67:1 over bands. It should be drawn **under** the bands, or allowed to recede there. Its role is secondary, and it never needs to be read inside the forecast fan if it stops at "today".
- The pink dither at 1/4 (`#8b2be4`) barely separates from the ground in luminance (1.43:1) and shifts towards violet. Pink is a poor band colour on this ground.

### Gaps
- The perceived-mix model assumes the dither pixels are small enough to fuse. At large pixel scale (for example 3x upscaling on a desktop), the individual gold pixels will read at full contrast. In that case the "band competes with line" risk depends on dot spacing, not on the average. It was not tested visually.
- Display gamma and subpixel layout affect how 1-pixel dithers fuse. No measurements were taken.

---

### Ranked palette recommendation (inference: synthesis of Q1 to Q5)

**1. Gold duotone (recommended, one accent).**

| Role | Colour | Notes |
|---|---|---|
| Ground | `#1b1bf2` | |
| Real values (history and realised) | `#ffffff`, solid, 2 px | 8.45:1, Lc -91.5 |
| Forecast path | **`#ffc94a`**, 2 px, dashed 3 on / 2 off | 5.51:1, Lc -62.2; OKLCH 0.86 / 0.151 / 85 = complement of the ground. A brighter variant is `#ffd23f` (5.85:1) |
| 7-day average | `#9a9aff`, 1 px solid | 3.40:1 |
| Bands | gold `#ffc94a` Bayer dither, 1/16 outer, 1/8 inner | pale `#c8c8ff` as the fallback |
| Grid | `#3a3af4` (1.24:1) or `#4b4bf5` (1.46:1), 1 px | |

All line pairs stay at least 14 ΔE_OK apart under every simulated CVD, and the forecast stays at least 3.35:1 against the ground under every CVD.

**2. Riso tritone (two accents).** Palette 1 plus a pink used only for markers and annotations: the "today" marker, highlighted points, forecast-error callouts. Never use it for 1 to 2 px lines.
- `#fb9dbf` (built, 4.30:1) is the safest pink.
- Riso Fluorescent Pink `#ff48b0` has the right print flavour but fails 3:1 (2.74), falls to 1.39:1 for protanopes, and is a chromostereopsis risk. If used, give it a 1 px white or gold outline.
- Gold vs pink stays at least 25 ΔE_OK apart under CVD.

**3. Cool analogous (one accent, most "in hue", least robust).** White real lines and a cyan forecast, Endesga 32 `#2ce8f5` (5.62:1). It is the most tonally unified with the ground. But cyan falls to 10 ΔE_OK from white under protanopia, so the dashed style becomes mandatory. The 7-day average must use periwinkle `#9a9aff`, never pale tints, because cyan vs `#c8c8ff` collapses to ΔE 1.1 under deuteranopia.

**Rejected for lines:**
- orange (`#ff6c2f`, `#f77622`), red (`#ff004d`) and fluorescent pink: below 3:1, protan collapse, vibration;
- pure greens: neon, turning yellow for protanopes and deuteranopes;
- mint: collapses with white under deuteranopia (ΔE 6);
- pure Riso or PICO-8 yellow: too close to white in luminance, weak under tritanopia and on thin lines.
