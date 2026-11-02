# Perception and accessibility of white and pale-blue foregrounds on electric blue (#1b1bf2)

Scope: a one-colour data site, saturated electric blue ground (#1b1bf2), white or pale-blue foregrounds, 8 to 12 px pixel fonts, 1 to 2 px chart lines, Bayer-dithered patterns and dithered engraving illustrations. Peer-reviewed sources are preferred; vendor and practitioner guidance is marked **[vendor]** or **[practitioner]**. Numbers marked **[computed]** come from my own simulation run (method at the end of the colour-vision section), not from a publication.

Baseline facts about the ground, **[computed]** with the WCAG 2 relative-luminance formula ([W3C WCAG 2.2, relative luminance](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance)):
- #1b1bf2 has relative luminance Y = 0.074 (white = 1.0; Material's dark surface #121212 is about 0.006). So in luminance terms it is a "dark mode" ground, but about 12 times brighter than a near-black one.
- Its blue primary is driven at 88.8% of the linear output of a white screen, while red and green are at 1.1%. So it delivers about 89% of a white page's blue-primary light at only 7.4% of its luminance.
- White on #1b1bf2 is 8.45:1 (WCAG 2) and APCA Lc -91.5.

---

## 1. Halation and irradiation: does bright white text or a thin line spread on saturated blue, especially for astigmatic readers? Is pure white worse than dimmed white?

### Takeaway
The peer-reviewed evidence clearly supports a **positive-polarity advantage**: dark text on a light ground beats light text on a dark ground, and the advantage is **largest for small characters**. This bears directly on 8 to 12 px pixel fonts in white on #1b1bf2. The accepted mechanism is luminance and pupil size: a dark ground opens the pupil and increases optical aberration. Bright figures also look larger through intraocular scatter (irradiation). But I found **no peer-reviewed study** that specifically measures "halation" for astigmatic readers, and **no controlled study** comparing pure #ffffff with a dimmed white on a dark ground. The astigmatism claim and the "use off-white" rule are practitioner and vendor lore with a plausible mechanism, not measured findings.

### Cited Findings
- **Small fonts are hit hardest.** Piepenbrock, Mayr and Buchner (2013/2014, *Human Factors*) found the positive-polarity advantage grows as character size shrinks ("Positive Display Polarity Is Particularly Advantageous for Small Character Sizes"). NN/g summarises it as "The smaller the font, the better it is for users to see the text in light mode", and notes participants did not *perceive* the difference despite performing better. [NN/g summary, citing doi:10.1177/0018720813515509](https://www.nngroup.com/articles/dark-mode/) **[practitioner summary of peer-reviewed work]**
- Piepenbrock, Mayr, Mund and Buchner (2013, *Ergonomics*) tested younger (18 to 33) and older (60 to 85) adults on Landolt-C acuity and proofreading. Positive polarity was better on both tasks for both age groups, with a smaller acuity advantage in older adults. Fatigue measures showed no significant polarity effect. [NN/g, citing doi:10.1080/00140139.2013.790485](https://www.nngroup.com/articles/dark-mode/)
- **Pupil mechanism.** Piepenbrock et al. (2014, *Ergonomics*, "Smaller pupil size and better proofreading performance with positive than with negative polarity displays") measured smaller pupils and better proofreading with positive polarity, and concluded this is compatible with the hypothesis that the advantage is an effect of display luminance. [Ergonomics abstract](https://informahealthcare.com/doi/abs/10.1080/00140139.2014.948496)
- Mathôt and Ivanov (2019, *PeerJ*): small pupils help fine-detail discrimination, while large pupils help detection of faint stimuli. They note the link between pupil size and acuity in the literature is mixed. [PeerJ 8220](https://peerj.com/articles/8220)
- NN/g's mechanistic summary: light mode constricts the pupil, which reduces spherical aberration and increases depth of field. [NN/g](https://www.nngroup.com/articles/dark-mode/) **[practitioner]**
- Dobres, Chahine and Reimer (2017, *Applied Ergonomics*), glance-like reading: no polarity effect under simulated daytime light. At night, light mode performed better. [NN/g, citing doi:10.1016/j.apergo.2016.11.001](https://www.nngroup.com/articles/dark-mode/)
- **Counter-evidence for some users.** Legge et al. (1985, *Vision Research*): all 7 low-vision participants with cloudy ocular media (for example cataract, which scatters light) read faster with light-on-dark. Participants with central-field loss were unaffected by polarity. NN/g notes these were CRT studies, where flicker may have biased results against light mode. [NN/g](https://www.nngroup.com/articles/dark-mode/)
- **Irradiation illusion.** A bright area looks larger than an identical dark one. Galileo noted it in 1632 and Helmholtz named it around 1867, and intraocular light scatter enlarging the retinal image of the bright area is a partial explanation. [Wikipedia, Irradiation illusion](https://en.wikipedia.org/wiki/Irradiation_illusion). A NASA report describes the apparent edge between bright and darker areas shifting toward the darker side. [NASA NTRS 19680025308](https://ntrs.nasa.gov/api/citations/19680025308/downloads/19680025308.pdf)
- **Astigmatism claim.** The widely repeated statement that people with astigmatism find white-on-black harder to read, attributed to Jason Harrison (UBC), circulates only in secondary web pages. Its prevalence figure ("approximately 50%") is inconsistent with other figures (about a third). I found no primary study behind it. [example of the repeated claim](https://library.peoplespharmacy.com/white-letters-black-background) **[non-peer-reviewed]**
- **Vendor practice on dimmed white.** Material Design's dark theme sets high-emphasis text at 87% white opacity (medium 60%, disabled 38%) on a #121212 surface, not pure white on pure black. [Google Material dark-theme codelab](https://codelabs.developers.google.com/codelabs/design-material-darktheme/) **[vendor]**
- **APCA caps contrast only for large text.** APCA treats Lc 90 as "a suggested maximum for very large and bold fonts (greater than 36px bold)" and for large areas of colour, but "Small fonts do not have a maximum". So dimming white is a large-text and large-area measure, not a small-text one. [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html) **[draft standard / independent]**

### Inferences
- #1b1bf2 (Y 0.074) is darker than any light-mode page, so the negative-polarity penalty applies in principle. It is also about 12 times brighter than #121212, so the pupil should be smaller than in true dark mode, putting it between the two in the pupil mechanism. The ground is also dominated by short-wavelength light, which may drive extra pupil constriction through melanopsin. I found no source quantifying this for display grounds, so treat it as unverified.
- Irradiation predicts that bright strokes spread into dark gaps. With 8 to 10 px pixel fonts, counters and inter-letter gaps are often 1 px. So the likely failure is **counters filling in** ("e", "a", "8", "B" losing their holes) and adjacent glyphs merging, rather than blur at the outer edge. The same mechanism makes 1 px white chart lines look *bolder* than they are (good for detection) and closes up fine dither gaps.
- The evidence pulls two ways. For **small text** (8 to 12 px), contrast should stay maximal: pure or near-pure white, because the polarity penalty is worst at small sizes and APCA wants Lc 90 or more at 12 px (see section 6). For **long running text at larger sizes**, a slightly dimmed white is a reasonable, vendor-backed but untested comfort measure.
- For astigmatic and cataract readers the predictions conflict. Scatter-limited eyes (cataract) may *prefer* light-on-dark (Legge 1985), while the astigmatism-halation claim says the opposite. This argues for a user-selectable light (inverted) theme rather than a single fixed polarity.

### Gaps
- No peer-reviewed study found that measures halation or legibility of light-on-dark text specifically in astigmatic observers (induced or natural) on displays.
- No controlled study found that compares pure #ffffff with an off-white (for example #e6e6e6 or 87% white) on a dark or saturated ground for legibility, speed or comfort.
- Did not obtain Westheimer's or other primary vision-science papers that quantify irradiation width in arcminutes at display luminances.
- Apple HIG dark-mode text guidance was not fetched in this pass.

---

## 2. Chromostereopsis and vibration: which colour pairs to avoid on this ground, and do dithered patterns vibrate on saturated blue?

### Takeaway
Chromostereopsis (apparent depth between colours) is driven by the eye's chromatic aberration. It is strongest for red against blue, but Faubert showed it can arise with **achromatic information plus only one other colour**, so white on saturated blue is not immune. Any red or orange accent on #1b1bf2 is the worst case: high chromatic contrast with low luminance contrast. Vendor guidance warns that saturated colours "vibrate" against dark grounds. Separately, high-contrast regular patterns near **3 cycles/degree** cause visual discomfort (pattern glare), which matters for scaled-up Bayer dither on phones.

### Cited Findings
- Faubert (1994), "Seeing depth in colour: more than just what meets the eyes," *Vision Research* 34:1165-1186: colour-induced binocular depth illusions in 2-D images. Some reference plane seems necessary, and the effect is driven by **transverse chromatic aberration** as a global, not only local, process. [abstract record](https://data.zhenzhi.com/details/1/985398000); citation confirmed at [Kitaoka chromostereopsis page](https://www.ritsumei.ac.jp/~akitaoka/scolor-e.html)
- Faubert (1995), "Colour induced stereopsis in images with achromatic information and only one other colour," *Vision Research* 35:3161-3167. A review credits this paper with showing the critical role of **luminance profiles** produced by transverse chromatic aberration, and notes that **reversing the luminance order between the two colours reverses the apparent depth**. [Kitaoka 2015, reference work entry](https://www.psy.ritsumei.ac.jp/akitaoka/Kitaoka2015_ReferenceWorkEntry_Chromostereopsis.pdf); [Kitaoka page](https://www.ritsumei.ac.jp/~akitaoka/scolor-e.html)
- Classic red/blue chromostereopsis: "positive" when red appears in front of blue, "negative" when behind. Both occur across observers. [Wikipedia, Chromostereopsis](https://en.wikipedia.org/wiki/Chromostereopsis); interactive demo: [Michael Bach](https://michaelbach.de/ot/col-chromostereopsis/)
- Longitudinal chromatic aberration of the eye is about 2 to 2.5 dioptres between 400 and 700 nm (the Thibos et al. 1992 "chromatic eye" model). Short wavelengths focus in front of the retina when mid and long wavelengths are in focus, and the effect is highly consistent across individuals. [Thibos et al. 1992 record](https://typeset.io/papers/the-chromatic-eye-a-new-reduced-eye-model-of-ocular-53jvwggddq); [secondary summary](https://telescope-optics.net/eye_chromatism.htm)
- **Vibration [vendor].** "More saturated colors tend to visually 'vibrate' against darker backgrounds, making them harder to read." [Google Material dark-theme codelab](https://codelabs.developers.google.com/codelabs/design-material-darktheme/). The Material 2 dark-theme page advises avoiding saturated colours on dark surfaces, which it says cause optical vibration and eye strain, in favour of lighter, desaturated tones. I could only read this through a search summary; a direct fetch returned no body text. [Material 2 dark theme](https://m2.material.io/design/color/dark-theme)
- **Pattern glare.** Discomfort peaks for high-contrast square-wave stripes near 3 cycles/degree with equal bar widths. The clinical Pattern Glare Test uses 0.5, 3 and 12 cpd plates, with the 12 cpd plate as the low-discomfort comparison. [Evans and Stevenson 2008, PubMed 18565084](https://pubmed.ncbi.nlm.nih.gov/18565084/). Discomfort depends on contrast, and susceptibility is higher in migraine and visual stress. [Monger, Wilkins and Allen 2015, Frontiers in Psychology](https://pmc.ncbi.nlm.nih.gov/articles/PMC4621622)

**[computed]** Spatial frequency of a 1-px checker (Bayer 2x2) and its upscaled versions, with 1 CSS px = 0.2646 mm:

| Viewing distance | 1 px | 2 px period (native checker) | 4 px period (2x scaled) | 6 px period (3x) | 8 px period (4x) |
|---|---|---|---|---|---|
| 30 cm (phone) | 3.0 arcmin | 9.9 cpd | 4.9 cpd | **3.3 cpd** | **2.5 cpd** |
| 50 cm (laptop) | 1.8 arcmin | 16.5 cpd | 8.2 cpd | 5.5 cpd | **4.1 cpd** |
| 70 cm (desktop) | 1.3 arcmin | 23.1 cpd | 11.5 cpd | 7.7 cpd | 5.8 cpd |

**[computed]** Michelson contrast of white/#1b1bf2 dither = 0.86; #d0d2ff/#1b1bf2 = 0.80; #a5a8ff/#1b1bf2 = 0.71.

**[computed]** A pure red #ff0000 on #1b1bf2 is only about 2.4:1 and orange #ff8000 about 3.4:1 (WCAG 2), while being maximally different in hue.

### Inferences
- **Avoid red, orange or magenta accents placed directly against #1b1bf2.** They combine the classic chromostereopsis pair (long vs short wavelength) with low luminance contrast, which is the recipe for a "floating", shimmering edge. Red also fails the 3:1 graphics threshold. If a warm accent is unavoidable (for example an alert), make it pale and high-luminance (well above 4.5:1), and surround it with a white or pale keyline so red never shares an edge with the blue. That changes the luminance profile that Faubert identified as driving the depth effect.
- **White on blue can also show mild depth effects** (Faubert 1995: achromatic plus one colour). These should be weak relative to red/blue, and they depend on luminance order, which is fixed here: bright foreground, dark ground.
- **Dither vibration risk depends on scale and device.** A native 1-px checker at laptop distance (16.5 cpd) sits above the discomfort peak, near the "control" 12 cpd plate. A Bayer pattern **upscaled 3x to 4x on a phone** lands at 2.5 to 3.3 cpd, in the peak discomfort band, at high contrast (0.86). Large uniform dithered areas (for example a full-width 50% white/blue fill) are the riskiest. Ordered Bayer dither concentrates energy at a few regular frequencies, unlike error-diffusion or blue-noise dither (a known property of ordered dithering; not sourced in this pass).
- Non-integer device pixel ratios (for example 1.25 or 1.5 Windows scaling, or browser zoom) resample 1-px dither unevenly and can produce moiré bands. This is an inference, not sourced; testing at those ratios is needed.

### Gaps
- No study found on "vibration" specifically for dithered or halftone patterns on saturated chromatic grounds; the pattern-glare literature uses achromatic gratings.
- Murch (1984), "Physiological principles for the effective use of color," *IEEE CG&A* 4(11), is often credited with "avoid pure blue for thin lines and text" and "avoid red/blue adjacency". I confirmed the paper exists ([scilit record](https://scilit.com/publications/59a42549d7c7834469e4a5556399f98d)) but could not read its text, so those specific rules are not verified here.
- Did not find a quantitative threshold for when chromostereopsis becomes disturbing in UI.

---

## 3. Colour-vision deficiencies: how do protan, deutan and tritan viewers see #1b1bf2 and the pale-blue candidates? Do blue-saturation-only tints collapse for tritans?

### Takeaway
Because the candidate tints differ from each other and from the ground mainly in **luminance** (their red and green channels), they survive all simulated deficiencies reasonably well. Tritan simulations shift the ground from violet-blue toward a dark teal (#005e81 Brettel), but the luminance steps between tints are almost unchanged. The biggest risk is for **protan and deutan viewers**, for whom blue looks relatively lighter: worst-case contrast of white drops to about 5.6:1 and #a5a8ff falls below 3:1. Tints that differ **only in blue saturation** do collapse for tritans: CAM02-UCS distance roughly halves. They would also fail for normal viewers at pixel-font scale, because the central fovea has almost no S-cones.

### Cited Findings
- **Simulation model choice.** For tritanopia, Brettel, Viénot and Mollon (1997) is "still the most solid and basically only valid choice". Machado et al. (2009) "does not work very well for tritanopia" and was not validated on tritanopes. For protan and deutan dichromacy, Brettel and Viénot rank ahead of Machado after sRGB adaptation, and Machado is recommended mainly for **anomalous** trichromacy. [DaltonLens review of open-source CVD simulations](https://daltonlens.org/opensource-cvd-simulation/) **[practitioner review of peer-reviewed models]**
- Primary model papers: [Machado, Oliveira and Fernandes 2009, IEEE TVCG (project page and matrices)](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html); [Brettel, Viénot and Mollon 1997, JOSA A 14(10):2647](https://doi.org/10.1364/JOSAA.14.002647)
- **Foveal tritanopia (affects everyone).** The central fovea lacks functioning blue-sensitive cones (Williams et al. 1981). [Williams et al. 1981, Vision Research](https://aria.cvs.rochester.edu/papers/williams-etal_VR1981.pdf); [Mollon 1982, "Tritanopias"](https://vision.psychol.campsych.vs.mythic-beasts.com/jdmollon/papers/Mollon1982Tritanopias.pdf). S-cones are about 1% of central cones, peaking at 6 to 8% around 2 degrees eccentricity, and one human-retina study found them absent in a zone about 0.35 degrees across. S-cone mechanisms have reportedly not responded above about 4 cycles/degree (Humanski and Wilson). These figures come from search-result summaries of the literature, not the papers' full text. [secondary source](https://pmc.ncbi.nlm.nih.gov/articles/PMC4289478)

**[computed] Simulated colours and contrast on the simulated ground.** Method: DaltonLens-Python 0.1.5 simulators on sRGB values. WCAG 2 contrast and APCA 0.0.98G-4g Lc are computed on the simulated sRGB (a proxy, see Inferences). ΔE is CAM02-UCS (colorspacious 1.1.2). Libraries: [DaltonLens-Python](https://github.com/DaltonLens/DaltonLens-Python), [colorspacious](https://github.com/njsmith/colorspacious), [APCA-W3 formula](https://github.com/Myndex/apca-w3).

Normal vision (ground #1b1bf2, Y 0.074)

| Candidate | WCAG | APCA Lc | ΔE vs ground |
|---|---|---|---|
| #ffffff | 8.45 | -91.5 | 77.3 |
| #e4e4ff | 6.78 | -75.3 | 66.3 |
| #d0d2ff | 5.77 | -64.9 | 59.4 |
| #a5a8ff | 3.88 | -43.0 | 44.4 |
| #8d8dff | 2.97 | -31.0 | 35.4 |
| #4545f6 | 1.38 | 0 (below APCA clip) | 10.9 |

Tritanopia, Brettel 1997 (recommended model): ground → **#005e81** (Y 0.096)

| Candidate | Simulated | WCAG | APCA Lc | ΔE vs ground |
|---|---|---|---|---|
| #ffffff | #fefefe | 7.14 | -88.7 | 65.2 |
| #e4e4ff | #e0e7ea | 5.75 | -73.0 | 57.3 |
| #d0d2ff | #c9d7de | 4.89 | -62.4 | 51.1 |
| #a5a8ff | #94b4c2 | 3.28 | -40.5 | 36.9 |
| #8d8dff | #72a0b1 | 2.53 | -28.8 | 28.2 |
| #4545f6 | #006f8d | 1.25 | 0 | 6.7 |

Tritanopia, Machado 2009 (severity 1.0; less valid for tritan): ground → **#00688f** (Y 0.119)

| Candidate | Simulated | WCAG | APCA Lc | ΔE vs ground |
|---|---|---|---|---|
| #ffffff | #fefefe | 6.17 | -84.9 | 61.8 |
| #e4e4ff | #dee8ec | 4.99 | -69.5 | 53.7 |
| #d0d2ff | #c5d9e0 | 4.26 | -59.1 | 47.5 |
| #a5a8ff | #8cb8c7 | 2.90 | -37.9 | 33.5 |
| #8d8dff | #66a4b9 | 2.24 | -26.2 | 24.7 |
| #4545f6 | #007799 | 1.21 | 0 | 5.9 |

Tritanomaly, Machado 2009 (severity 0.6): ground → **#0047cc** (Y 0.089)

| Candidate | Simulated | WCAG | APCA Lc | ΔE vs ground |
|---|---|---|---|---|
| #ffffff | #fefefe | 7.51 | -89.4 | 71.8 |
| #e4e4ff | #e2e5f6 | 6.05 | -73.6 | 62.1 |
| #d0d2ff | #ccd5f1 | 5.18 | -63.5 | 55.6 |
| #a5a8ff | #9dafe7 | 3.50 | -41.9 | 40.7 |
| #8d8dff | #8297e2 | 2.70 | -30.0 | 31.6 |
| #4545f6 | #185dd2 | 1.27 | 0 | 7.1 |

Protanopia: Brettel ground → #003bf2 (Y 0.095); Machado ground → #0058f7 (Y 0.137)

| Candidate | Brettel sim | WCAG | APCA | Machado sim | WCAG | APCA |
|---|---|---|---|---|---|---|
| #ffffff | #fefefe | 7.16 | -87.7 | #fefefe | 5.57 | -81.5 |
| #e4e4ff | #dae5fe | 5.72 | -71.3 | #dde6fe | 4.50 | -66.0 |
| #d0d2ff | #c0d3fe | 4.81 | -60.2 | #c6d6fe | 3.86 | -56.0 |
| #a5a8ff | #7bacfe | 3.16 | -37.6 | #8cb2fe | 2.65 | -35.1 |
| #8d8dff | #3893fe | 2.33 | -24.7 | #5f9dfe | 2.07 | -23.8 |
| #4545f6 | #0055f6 | 1.25 | 0 | #006afb | 1.19 | 0 |

Deuteranopia: Brettel ground → #0056f1 (Y 0.130); Machado ground → #0040ee (Y 0.098)

| Candidate | Brettel sim | WCAG | APCA | Machado sim | WCAG | APCA |
|---|---|---|---|---|---|---|
| #ffffff | #fefefe | 5.78 | -82.6 | #fefefe | 7.02 | -87.3 |
| #e4e4ff | #dde6fe | 4.67 | -67.0 | #dde5fe | 5.63 | -71.3 |
| #d0d2ff | #c4d6fe | 4.00 | -56.9 | #c5d3fd | 4.75 | -60.4 |
| #a5a8ff | #88b1fe | 2.71 | -35.5 | #88acfc | 3.15 | -38.1 |
| #8d8dff | #589cfe | 2.11 | -24.2 | #5895fc | 2.40 | -26.2 |
| #4545f6 | #0068f5 | 1.19 | 0 | #0059f2 | 1.25 | 0 |

**[computed] Separation between adjacent tints** (ΔE CAM02-UCS / WCAG ratio between the two tints):

| Pair | Normal | Tritan (Brettel) | Worst protan/deutan |
|---|---|---|---|
| #ffffff vs #e4e4ff | 12.9 / 1.25 | **7.9** / 1.24 | 12.6 / 1.24 |
| #e4e4ff vs #d0d2ff | **7.5** / 1.17 | **6.3** / 1.18 | **7.3** / 1.16 |
| #d0d2ff vs #a5a8ff | 16.0 / 1.49 | 14.4 / 1.49 | 15.8 / 1.46 |
| #a5a8ff vs #8d8dff | 9.5 / 1.31 | 8.9 / 1.30 | 9.6 / 1.28 |
| #8d8dff vs #4545f6 | 24.8 / 2.15 | 22.2 / 2.02 | 18.2 / 1.74 |

**[computed] Blue-saturation-only test** (same R and G, only B varies): #a5a8ff vs #a5a8d0 has ΔE 10.1 for normal vision, falling to **5.7** (Brettel tritan) or 6.8 (Machado tritan). #a5a8ff vs #a5a8a5 falls from 26.7 to 11.1 (Brettel).

### Inferences
- **Tritan viewers** see the ground as a dark teal-blue, not violet-blue, but keep almost the full luminance ladder. Tritan defects barely affect luminance, so the WCAG ratios between adjacent tints are unchanged (1.24, 1.18, 1.49, 1.30, 2.02). The pair that loses most is **#ffffff vs #e4e4ff** (ΔE 12.9 to 7.9), because part of their difference is lavender chroma, which tritans lose.
- **Protan and deutan** viewers are the bigger contrast risk on this ground. The two models disagree on which type is worse (protan: Machado worse; deutan: Brettel worse), but both show the ground getting lighter (Y up to about 0.13 to 0.14). Worst case across models: white ≥ 5.6:1, #e4e4ff ≥ 4.5:1, #d0d2ff ≥ 3.9:1 (fails 4.5:1 for small text), **#a5a8ff ≥ 2.65:1 (fails the 3:1 graphics threshold)**, #8d8dff ≥ 2.1:1.
- **#4545f6 is decorative only for everyone**: 1.2 to 1.4:1, below APCA's clip, ΔE about 6 to 11. It can serve as a large-area tone, never as a line, a label or a data-bearing fill.
- **#e4e4ff and #d0d2ff are nearly indistinguishable from each other** at text and line scale for all viewers (1.17:1, ΔE 6 to 8). Do not use them as two separate data categories.
- **Blue-only tint differences fail twice**: they collapse for tritans (ΔE roughly halves), and because the foveal centre has almost no S-cones and S-cone resolution tops out around 4 cpd, a normal viewer cannot resolve a blue-only distinction on an 8 to 12 px glyph (about 15 to 22 arcmin at 50 cm) or a 1 to 2 px line. **Every tint step must be a luminance step** (change R and G), which the given candidates already are.
- A corollary about chromatic blur: the white/#1b1bf2 edge is carried almost entirely by the red and green primaries (1.0 vs 0.011 linear). The blue primary is nearly equal on both sides (1.0 vs 0.888). So the edge is defined by the well-focused, foveally dense L and M cones, and the blue channel's chromatic defocus barely blurs white-on-blue edges. This is better than blue-on-black or blue-on-white, where the edge is carried by the defocused blue channel.
- Caveat: WCAG and APCA computed on simulated sRGB use the *normal* observer's luminance weights on the simulated colour. This is a common but approximate proxy for what a dichromat perceives as luminance. The direction (blue looks relatively lighter to protans) is expected, but the exact numbers are model-dependent, as the Brettel/Machado disagreement shows.

### Gaps
- No empirical (observer-based) data found on tritan viewers judging pale-blue tint ladders on blue grounds; all figures above are model simulations.
- Prevalence figures for each CVD type were not gathered in this pass.
- The S-cone 4 cpd and 0.35 degree figures come from search summaries of the literature (Humanski and Wilson; a human-retina study, likely Curcio et al. 1991), not from the full papers.

---

## 4. Saturated blue at length: reading comfort, fatigue, short-wavelength grounds, and text on coloured vs near-black backgrounds

### Takeaway
There is **little direct evidence** on long reading on a saturated blue ground. What exists points to luminance contrast, not hue, as the main driver of legibility. Cool (blue) backgrounds were read more slowly than warm ones in one large study, but with black text on pale backgrounds. "Blue light causes eye strain" is not supported: a Cochrane review found blue-filtering lenses probably make no difference to computer eye strain. The defensible concerns are the general negative-polarity penalty (section 1) and possible circadian exposure at night, which I could not quantify from sources here.

### Cited Findings
- Rello and Bigham (2017, ASSETS; 341 participants, 89 with dyslexia): warm backgrounds (peach, orange, yellow) gave significantly better reading performance than cool ones (blue, blue-grey, green), with comparable effects for readers with and without dyslexia. All pairs were **black text on light tints** at >7:1. [Rello and Bigham 2017, PDF](https://www.changedyslexia.org/publications/pdfs/2017-ASSETS-Good%20Background%20Colors.pdf)
- Screen-reading study (Zorko et al. 2017, *Tehnički Glasnik*): reading speed was slowest for blue text on light grey, and the paper restates that black on white is among the best combinations. [Hrčak record](https://hrcak.srce.hr/186649)
- Peripheral moving-word detection (MDPI *Applied Sciences* 2025): white text on blue gave the shortest detection time (1.376 s), while black on white gave the highest accuracy (79%). This measures noticing, not continuous reading. [MDPI Applied Sciences 15(14):7636](https://www.mdpi.com/2076-3417/15/14/7636)
- Search with black text on textured backgrounds: blue backgrounds produced slower and more variable search times than grey or yellow. [Scharff, legibility of displays by colour, saturation and texture](https://www.laurenscharff.com/research/Oxford.html) **[conference work]**
- Cochrane review (Singh et al. 2023; 17 RCTs): blue-light-filtering spectacles "probably make no difference" to computer eye strain or sleep quality. Evidence certainty was low, and retinal protection was not evaluated. [EurekAlert release on the Cochrane review](https://www.eurekalert.org/news-releases/998545)
- Aleman, Wang and Schaeffel (2018, *Scientific Reports*, n = 7): reading black-on-white thinned the choroid (a change linked to myopia), while white-on-black thickened it. This is a small sample with long-term relevance unproven. [NN/g, citing doi:10.1038/s41598-018-28904-x](https://www.nngroup.com/articles/dark-mode/)
- NN/g recommendation **[practitioner]**: do not default to dark mode for general audiences; offer a user-selectable mode; long-form reading and news sites especially should offer one. [NN/g](https://www.nngroup.com/articles/dark-mode/)

### Inferences
- **[computed basis]** A full-bleed #1b1bf2 page emits about 89% of the blue-primary light of a white page at 7.4% of its luminance. In short-wavelength and melanopic terms it is much closer to a white page than to a dark mode. So the "dark mode reduces evening blue exposure" argument does **not** carry over to this palette. The exact melanopic ratio depends on the display's blue primary (not measured here).
- Since hue effects on legibility are small next to luminance contrast, the main long-reading risk is the **negative-polarity penalty at small sizes** plus **pattern-glare risk from dither**, not the blue hue itself. The Rello and Bigham "cool is slower" result is suggestive but is a different configuration (dark text on pale grounds).
- Large saturated fields can leave strong afterimages (a yellowish ghost after looking away). This is classic colour adaptation, but I did not find a source in this pass that quantifies it for UI grounds.

### Gaps
- No study found comparing reading speed, comprehension or fatigue for light text on a **saturated blue** ground vs **near-black** at matched contrast. This is the key missing evidence.
- No source found quantifying melanopic/circadian exposure for saturated-blue UI grounds vs white or black pages (for example Chang et al. 2015 on e-readers was not fetched).
- No source found on afterimage or chromatic adaptation discomfort from full-screen saturated grounds.

---

## 5. Thin lines and dither: legibility of 1 to 2 px lines and fine dither on blue; minimum line weight and contrast for graphics

### Takeaway
WCAG 2 requires **3:1** for chart lines and other graphical objects against adjacent colours. It warns that anti-aliasing renders thin lines fainter and that authors should avoid particularly thin lines, but sets no minimum thickness. APCA (draft) is stricter for fine detail: Lc 15 non-text must be at least **5 px solid** in its smallest dimension, and fine details need more. On #1b1bf2 that means 1 px lines and fine dither should use white to #d0d2ff only; #a5a8ff needs 2 px or more and fails for protan/deutan viewers in worst-case simulation; #8d8dff and #4545f6 are not usable for data-bearing lines.

### Cited Findings
- WCAG 2.2 SC 1.4.11 Non-text Contrast: "Parts of graphics required to understand the content" need "a contrast ratio of at least 3:1 against adjacent color(s)". In a line graph, "The lines should have 3:1 contrast against their background". Lines with little overlap "do not need to contrast with each other or the graduated lines". [W3C Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- The same page: "Due to anti-aliasing, particularly thin lines and shapes of non-text elements may be rendered by user agents with a much fainter color", and "best practice would be for authors to avoid particularly thin lines and shapes". No minimum line thickness is given, and patterns or hatching are not addressed. [W3C Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- APCA (candidate method for WCAG 3, developed as an independent "APCA Readability Criterion"; ARC guidelines labelled draft): Lc 15 is "the absolute minimum for any non-semantic non-text that needs to be discernible", should be "no less than 5px (solid) in its smallest dimension", and "does not include fine details which have a higher minimum". Lc 30 covers mostly solid icons, and Lc 45 is "the minimum for pictograms with fine details, or smaller outline icons". APCA states WCAG 2.x contrast "cannot be used for guidance designing 'dark mode'". [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html) **[draft / independent standard]**

**[computed]** Classification of the candidates as lines and graphics on #1b1bf2:

| Candidate | WCAG (normal) | Worst CVD sim WCAG | APCA Lc | 1 px line | 2 px line | Fill / dither |
|---|---|---|---|---|---|---|
| #ffffff | 8.45 | 5.57 | -91.5 | yes | yes | yes |
| #e4e4ff | 6.78 | 4.50 | -75.3 | yes | yes | yes |
| #d0d2ff | 5.77 | 3.86 | -64.9 | yes | yes | yes |
| #a5a8ff | 3.88 | **2.65** | -43.0 | no (fine detail, Lc < 45) | marginal (fails 3:1 in worst CVD case) | yes for areas ≥ 5 px |
| #8d8dff | **2.97** | 2.07 | -31.0 | no | no (fails 3:1) | non-essential only |
| #4545f6 | **1.38** | 1.19 | 0 | no | no | decorative only |

### Inferences
- Irradiation (section 1) works in favour of white 1 px lines on a dark ground (they look bolder) but **against** fine white dither, where 1-px blue gaps fill in. A dithered engraving will look lighter and lower in contrast than its pixel count suggests, and midtone detail will merge. Coarser dither, or a slightly lower white density in the dither, may be needed to keep midtones. This is untested.
- Two-category line charts should not rely on tint alone (for example #ffffff vs #e4e4ff at 1.25:1). Use **dash pattern, marker shape or line weight** as the category cue, which is also the WCAG-friendly route because tint differences barely exist for some viewers.
- Bayer-dithered *fills* are themselves graphics. If a dithered area carries data (for example a choropleth class), its mean perceived colour and its texture must differ from neighbours by more than tint. Texture density (25/50/75%) is a luminance cue and survives all CVD simulations, since luminance is largely preserved.
- Because 1 CSS px is 2 to 3 device pixels on HiDPI screens but 1 device pixel (or a fractional one) on 1x and 1.25x screens, 1 px lines and 1 px dither will look different across devices. Anti-aliased half-pixel positions halve their effective contrast (WCAG's warning). Snapping lines to whole device pixels and rendering dither with `image-rendering: pixelated` at integer scales follows from the WCAG caution, but is my inference.

### Gaps
- No peer-reviewed study found that gives a minimum line weight for chart lines as a function of contrast on chromatic grounds; neither WCAG 2 nor the APCA summary gives a thickness for 1 to 2 px lines.
- No study found on the legibility of halftone or dither illustrations on saturated grounds.

---

## 6. Mitigations: lighter or darker grounds, off-white text, larger minimum sizes, weight and shape cues, avoiding pure #ffffff for long text

### Takeaway
The evidence-backed levers are: (1) keep **maximal contrast for small text**, because the polarity penalty is worst at small sizes, and **raise the minimum size** rather than dimming small text; (2) **darken the ground slightly**, which buys contrast headroom so off-white can be used for long text while still meeting APCA Lc 90; (3) encode categories with **shape, weight, dash and texture**, not tint; (4) avoid warm accents against the blue; (5) offer a **user-selectable light/inverted theme**. Avoiding pure #ffffff for long text is vendor practice (Material 87% white), not a tested finding.

### Cited Findings
- Small characters suffer most from negative polarity. [Piepenbrock et al. 2013/2014 Human Factors, via NN/g](https://www.nngroup.com/articles/dark-mode/)
- APCA font guidance: Lc 90 is "preferred level for fluent text and columns of body text with a font no smaller than 18px/weight 300", and it covers "non-body text with a font no smaller than 12px/400". Lc 75 is the minimum for body-text columns at larger sizes; Lc 60 for other content text; Lc 30 the absolute minimum for any "spot readable" text. Sizes are CSS reference px. [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html) **[draft]**
- WCAG 2 text thresholds: 4.5:1 (AA) and 7:1 (AAA) for normal text. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/#contrast-minimum)
- Material dark theme: 87%/60%/38% white text emphasis on #121212, and avoid saturated colours on dark surfaces because they vibrate. [Material codelab](https://codelabs.developers.google.com/codelabs/design-material-darktheme/) **[vendor]**
- Offer a user-selectable mode rather than imposing one polarity. [NN/g](https://www.nngroup.com/articles/dark-mode/) **[practitioner]**; APCA also recommends users can "choose at least one light mode or one dark mode color scheme". [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html)
- Colored tints and contrast modulate pattern glare. [Monger, Wilkins and Allen 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4621622)

**[computed] Ground options vs foreground (WCAG ratio / APCA Lc):**

| Ground (Y) | #ffffff | #f4f4ff | #ebebff | #e4e4ff | #d0d2ff | #a5a8ff |
|---|---|---|---|---|---|---|
| #3030f5 lighter (0.093) | 7.32 / -89 | 6.71 / -82 | 6.23 / -77 | 5.87 / -73 | 5.00 / -62 | 3.36 / -40 |
| **#1b1bf2 current (0.074)** | 8.45 / -91 | 7.74 / -85 | 7.19 / -79 | 6.78 / -75 | 5.77 / -65 | 3.88 / -43 |
| #1717d4 (0.055) | 9.95 / -95 | 9.12 / -88 | 8.47 / -83 | 7.98 / -79 | 6.80 / -69 | 4.57 / -47 |
| #1313b0 (0.037) | 12.02 / -99 | 11.00 / -93 | 10.22 / -87 | 9.64 / -83 | 8.21 / -73 | 5.52 / -51 |
| #11118a (0.024) | 14.28 / -103 | 13.07 / -96 | 12.14 / -91 | 11.45 / -87 | 9.75 / -76 | 6.56 / -54 |

### Inferences
- **On the current #1b1bf2, only pure #ffffff reaches APCA Lc 90 (-91.5)**, the level APCA wants for 12 px non-body text. Any off-white (#f4f4ff = -85) drops below it. So "avoid pure white" conflicts with "12 px text" on this exact ground. 8 to 11 px text falls below APCA's size lookup entirely.
- **A lighter ground makes everything worse** (#3030f5: white only Lc -89, #a5a8ff 3.36:1). **A modestly darker, still saturated ground** (#1717d4 to #1313b0) lets an off-white such as #f4f4ff reach Lc -88 to -93, keeps #a5a8ff above 4.5:1 on #1313b0, and gives headroom against the protan/deutan contrast loss in section 3. The cost is a less "electric" look; whether #1313b0 still reads as the brand blue is a design call. A hybrid is possible: keep #1b1bf2 for large brand areas and headers, and use a darker blue panel behind dense small text and charts.
- **Proposed role map** (inference from the computed tables and the WCAG/APCA thresholds):
  - Small text (≤ 12 px) and 1 px data lines: #ffffff only on #1b1bf2, or #f4f4ff on a ground at or below #1313b0.
  - Secondary labels at 12 px or more, and 1 to 2 px lines: #e4e4ff or #d0d2ff (treat these two as *one* tier; they are 1.17:1 apart).
  - Gridlines and non-essential graphics ≥ 2 px: #a5a8ff (passes 3:1 for normal vision, not in the worst CVD case, so never the only carrier of meaning).
  - Large areas and fills ≥ 5 px only: #8d8dff.
  - Decoration only: #4545f6.
- **Minimum sizes**: render pixel fonts at integer multiples (8 px design shown at 16 px) for anything essential, keeping 8 px for non-essential tags only. Prefer pixel fonts with open counters and 1 px or more letter gaps at the rendered size, to counter irradiation fill-in.
- **Long text**: if any long-form text exists, set it larger (16 px or more) with an off-white (for example #ebebff to #f4f4ff), ideally on a darker blue panel so APCA stays at or near Lc 90. This applies the Material 87%-white practice while keeping contrast.
- **Category encoding**: dash pattern, marker shape, line weight and dither density (25/50/75%) rather than tint. These survive all CVD simulations because they are spatial or luminance cues.
- **Accents**: no saturated red or orange next to blue. If an alert colour is needed, use a pale warm tint with a white keyline, or encode alerts with weight, inversion (blue text on a white chip) or iconography.
- **Dither**: keep Bayer cells at native 1-px scale, or use blue-noise or error-diffusion for large areas. Avoid 3x to 4x upscaled checker fields on mobile (about 2.5 to 3.3 cpd at 30 cm). Reduce dither contrast (for example #a5a8ff instead of white as the light dot) for decorative backgrounds.
- **User control**: provide an inverted theme (blue ink on white or off-white). For normal vision, the positive-polarity evidence favours it for small text, while the blue-primary edge would then be carried by the defocused blue channel. Respect `prefers-contrast: more` by switching to the darker ground and pure white.

### Gaps
- None of the mitigations above (darker saturated ground, off-white on blue, integer-scaled pixel fonts) has been tested in a published reading study on saturated blue grounds. They are derived from general polarity, contrast and pattern-glare evidence plus the computed contrast tables.
- Apple HIG dark-mode guidance was not retrieved in this pass. WebAIM guidance was not fetched separately; WCAG thresholds were taken from W3C directly.
- A user test with astigmatic, protan/deutan and tritan participants on the actual dithered charts would close most of the gaps in sections 1, 3 and 5.
