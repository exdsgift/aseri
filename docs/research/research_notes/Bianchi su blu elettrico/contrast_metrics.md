# Contrast metrics: white and white-tint foregrounds on electric blue #1b1bf2

All numbers below were computed for this note (2026-10-31) with a Python script that implements the published formulas, and were cross-checked against the reference code. The method is described once, under question 1, and applies to every table.

## 1. WCAG 2.x ratio and APCA Lc of the candidates against #1b1bf2: which pass what?

### Takeaway
Pure white reaches 8.45:1 (WCAG AAA) and APCA Lc -91.5 on #1b1bf2. Only white and the very lightest tints (down to about #e4e4ff, Lc -75) meet APCA's body-text level. WCAG AA 4.5:1 holds down to about #b8baff, but APCA rates that tint only Lc 52, which is enough for headlines and not for small text. Below #a5a8ff (3.88:1) nothing is usable as text, and #8d8dff and darker fail even WCAG's 3:1 for graphics. The binding constraint for the 8 to 12 px pixel fonts is APCA plus the font size, not WCAG.

### Cited Findings

#### Method (applies to all sections)
- **WCAG 2.x relative luminance.** L = 0.2126 R + 0.7152 G + 0.0722 B, where each channel is linearized as c/12.92 if c <= 0.04045, else ((c+0.055)/1.055)^2.4 ([W3C Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
  - The ratio is (L1+0.05)/(L2+0.05).
  - The threshold value was 0.03928 before May 2021. Ratios must not be rounded: 4.499:1 fails 4.5:1 ([same](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
- **APCA-W3.** Library 0.1.9 with base algorithm constants 0.0.98G-4g (Feb 15, 2021), ported line by line from `src/apca-w3.js` ([Myndex/apca-w3 source](https://github.com/Myndex/apca-w3/blob/master/src/apca-w3.js); [README version info](https://github.com/Myndex/apca-w3/blob/master/README.md)). The steps are:
  - Y = 0.2126729·(R/255)^2.4 + 0.7151522·(G/255)^2.4 + 0.0721750·(B/255)^2.4. This is a simple 2.4 power with no linear toe.
  - Soft-clamp black: if Y < 0.022, then Y += (0.022 - Y)^1.414.
  - Return 0 if |ΔY| < 0.0005.
  - Normal polarity (dark text): S = (Ybg^0.56 - Ytxt^0.57)·1.14. Lc = 0 if S < 0.1, else (S - 0.027)·100.
  - Reverse polarity (light text on dark, the case on this site): S = (Ybg^0.65 - Ytxt^0.62)·1.14. Lc = 0 if S > -0.1, else (S + 0.027)·100. Lc is negative for light-on-dark, so the tables give signed Lc and the text uses |Lc|.
- **APCA font-size lookup.** `fontLookupAPCA()` 0.1.7 (G) is ported from the same file ([source](https://github.com/Myndex/apca-w3/blob/master/src/apca-w3.js)).
  - The table gives a minimum px size for weights 100 to 900 at each Lc.
  - Its codes are 999 = do not use, 777 = non-text only.
  - Its comments say: "Lc values under 70 should have Lc 15 ADDED if used for body text" and "All font sizes are in px and reference font is Barlow".
- **Verification.**
  - The Python APCA port was run against the unmodified `apca-w3.js` under Node 22 on 35 colour pairs. The maximum difference was 2.1e-14, and the font lookup output was identical.
  - Known reference values reproduce: #888 on #fff = Lc 63.056, #fff on #888 = Lc -68.541.
  - CIEDE2000 was checked against all 34 pairs of the Sharma, Wu and Dalal test data, with a maximum error of 4.95e-5 ([Sharma CIEDE2000 page and test data](https://www.ece.rochester.edu/~gsharma/ciede2000/); paper: Color Res. Appl. 30(1):21-30, 2005).
- **CIELAB and OKLab.**
  - CIELAB uses D65, the sRGB-to-XYZ matrix with Y row 0.2126729/0.7151522/0.0721750, and the WCAG linearization.
  - OKLab uses Ottosson's M1/M2 matrices (updated 2021-01-25) ([Ottosson, "A perceptual color space for image processing"](https://bottosson.github.io/posts/oklab/)).
  - dEOK is the Euclidean distance in OKLab.

#### Ground
- #1b1bf2 has:
  - WCAG Y = 0.07428 and APCA Y = 0.06789
  - CIELAB (32.76, 70.81, -99.75)
  - OKLCH (L 0.4518, C 0.2890, h 266.6°)
  - HSV saturation 0.89
- These were computed with the formulas from [W3C 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [apca-w3.js](https://github.com/Myndex/apca-w3/blob/master/src/apca-w3.js) and [OKLab](https://bottosson.github.io/posts/oklab/).

#### Thresholds being tested
- **WCAG 1.4.3 (AA).** Text needs 4.5:1. "Large-scale" text needs 3:1; large scale is at least 18 pt, or 14 pt bold, which W3C equates to about 24 px and 18.5 px ([W3C 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
  - 4.5:1 was chosen because it "compensated for the loss in contrast sensitivity" of 20/40 vision ([same](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
  - Fonts with "extraordinarily thin strokes" are flagged, and authors should prefer thicker strokes ([same](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
- **WCAG 1.4.6 (AAA).** Text needs 7:1 and large text 4.5:1 ([W3C Understanding 1.4.6](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html)).
- **WCAG 1.4.11.** Graphical objects need 3:1 "against adjacent color(s)" ([W3C Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).
- **APCA use-case levels** ([APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell)):
  - **Lc 90:** preferred for body text at ≥18px/300 or ≥14px/400, and for non-body text ≥12px/400.
  - **Lc 75:** minimum for body text at 24px/300, 18px/400, 16px/500 or 14px/700. Non-body text needs ≥15px/400.
  - **Lc 60:** minimum for non-body content text at 48px/200, 36px/300, 24px/400, 21px/500, 18px/600 or 16px/700. Add Lc 15 if used as body text. These sizes are for the reference font Helvetica.
  - **Lc 45:** headlines (36px/400 or 24px bold), pictograms with fine detail, and outline icons.
  - **Lc 30:** absolute minimum for any text, including spot text such as placeholder, disabled or copyright text. Also the minimum for solid icons, generally ≥5.5px solid.
  - **Lc 15:** minimum for non-semantic non-text such as dividers, ≥5px solid. Below Lc 15 counts as "invisible".
  - Lc 90 is a suggested maximum for text larger than 36px bold. "Small fonts do not have a maximum."
- **APCA README modifiers** ([apca-w3 README](https://github.com/Myndex/apca-w3/blob/master/README.md)):
  - Body text: add Lc 15 to table values below Lc 75.
  - Sub-fluent text may be lowered by Lc 15 and non-fluent spot text by Lc 25, but never below Lc 30.
  - Fonts larger than 24px at weight ≥300 have a maximum of Lc 90.
- **Bronze Simple Mode** (draft, last change-log entry 2023-02-10) ([ARC Bronze Simple Mode](https://readtech.org/ARC/tests/bronze-simple-mode/)):
  - Body text: minimum Lc 75, preferred Lc 90. Other content text: Lc 60. Large fluent text (>36px): Lc 45, maximum Lc 90.
  - "There is no specified minimum font size."
  - Spot text (disabled, placeholder, decorative) is not covered.
  - Body text is defined against an x-height of about 19px or less.

#### Computed table A: the requested candidates on #1b1bf2
Column "APCA min px" is the `fontLookupAPCA` output at that Lc for weight 400 / weight 700 (reference font, not pixel fonts).

| hex | WCAG ratio | WCAG level | APCA Lc | Lc band | APCA min px wt400/wt700 | CIE L* | OKLab L | dEOK vs ground | dE00 vs ground |
|---|---|---|---|---|---|---|---|---|---|
| `#ffffff` | 8.45 | AAA | -91.5 | >=90 | 16.0/14.0 | 100.0 | 1.000 | 0.620 | 63.4 |
| `#f2efe8` | 7.36 | AAA | -81.1 | >=75 | 17.25/14.0 | 94.5 | 0.953 | 0.583 | 63.9 |
| `#e4e4ff` | 6.78 | AA | -75.3 | >=75 | 18.0/14.0 | 91.3 | 0.927 | 0.539 | 55.8 |
| `#d0d2ff` | 5.77 | AA | -64.9 | >=60 | 22.0/15.5 | 85.4 | 0.877 | 0.483 | 51.3 |
| `#b8baff` | 4.63 | AA | -52.1 | >=45 | 30/20.0 | 77.6 | 0.812 | 0.411 | 45.7 |
| `#a5a8ff` | 3.88 | AA-large/UI | -43.0 | >=30 | 49/27 | 71.7 | 0.763 | 0.356 | 41.1 |
| `#8d8dff` | 2.97 | fail | -31.0 | >=30 | 105/67 | 63.3 | 0.695 | 0.279 | 32.3 |
| `#6e6ef8` | 2.11 | fail | -18.3 | >=15 | non-text only | 53.2 | 0.612 | 0.190 | 20.6 |
| `#4545f6` | 1.38 | fail | 0.0 (below APCA low clip) | <15 | do not use | 41.5 | 0.519 | 0.082 | 8.3 |

#### Computed table B: warm, cool and neutral whites

| hex | name | WCAG ratio | APCA Lc | APCA min px wt400/wt700 | OKLab L | dEOK vs #ffffff |
|---|---|---|---|---|---|---|
| `#fffaf0` | floralwhite (warm) | 8.12 | -88.4 | 16.5/14.0 | 0.986 | 0.020 |
| `#fff8e7` | cosmic latte (warm) | 7.98 | -87.1 | 16.5/14.0 | 0.980 | n/c |
| `#fdf6e3` | Solarized base3 (warm) | 7.83 | -85.7 | 16.5/14.0 | 0.974 | n/c |
| `#faf0e6` | linen (warm) | 7.51 | -82.6 | 17.25/14.0 | 0.960 | n/c |
| `#f2efe8` | requested warm white | 7.36 | -81.1 | 17.25/14.0 | 0.953 | 0.048 |
| `#f8f8ff` | ghostwhite (cool) | 7.99 | -87.2 | 16.5/14.0 | 0.981 | 0.021 |
| `#f0f8ff` | aliceblue (cool) | 7.88 | -86.1 | 16.5/14.0 | 0.975 | n/c |
| `#eef2ff` | cool tint | 7.56 | -83.0 | 17.25/14.0 | 0.962 | n/c |
| `#f5f5f5` | whitesmoke (neutral) | 7.75 | -84.9 | 16.75/14.0 | 0.970 | n/c |

(n/c = not computed.) All of these whites are AAA (≥7:1) and APCA ≥ Lc 75 on #1b1bf2.

#### Computed table C: white mixed into #1b1bf2 in 10 % steps

| % white | gamma-sRGB mix (CSS `color-mix(in srgb)`) | WCAG | Lc | linear-light mix (what a dither or partial pixel averages to) | WCAG | Lc |
|---|---|---|---|---|---|---|
| 10 | `#3232f3` | 1.16 | 0.0 | `#5d5df3` | 1.74 | -12.1 |
| 20 | `#4949f5` | 1.43 | 0.0 | `#7e7ef5` | 2.49 | -24.1 |
| 30 | `#5f5ff6` | 1.79 | -13.1 | `#9797f6` | 3.25 | -34.8 |
| 40 | `#7676f7` | 2.30 | -21.1 | `#ababf7` | 3.98 | -44.3 |
| 50 | `#8d8df8` | 2.94 | -30.5 | `#bcbcf9` | 4.71 | -53.0 |
| 60 | `#a4a4fa` | 3.73 | -41.1 | `#ccccfa` | 5.47 | -61.5 |
| 70 | `#bbbbfb` | 4.67 | -52.6 | `#dadafb` | 6.20 | -69.4 |
| 80 | `#d1d1fc` | 5.73 | -64.4 | `#e7e7fc` | 6.93 | -76.9 |
| 90 | `#e8e8fe` | 7.00 | -77.6 | `#f4f4fe` | 7.73 | -84.7 |

#### Computed table D: threshold tints
Each row is the darkest gamma-sRGB mix whose rounded hex meets the target against #1b1bf2.

| target | % white | hex | WCAG | Lc | OKLab L |
|---|---|---|---|---|---|
| APCA \|Lc\| 90 | 99.0 | `#fdfdff` | 8.32 | -90.2 | 0.995 |
| WCAG 7:1 (AAA) | 89.7 | `#e8e8fe` | 7.00 | -77.6 | 0.938 |
| APCA \|Lc\| 75 | 88.0 | `#e4e4fd` | 6.76 | -75.2 | 0.926 |
| APCA \|Lc\| 60 | 76.1 | `#c9c9fc` | 5.33 | -60.0 | 0.853 |
| WCAG 4.5:1 (AA text) | 68.7 | `#b8b8fb` | 4.54 | -51.0 | 0.807 |
| APCA \|Lc\| 45 | 63.9 | `#adadfa` | 4.08 | -45.4 | 0.777 |
| WCAG 3:1 (large text / UI) | 50.7 | `#8f8ff9` | 3.00 | -31.5 | 0.696 |
| APCA \|Lc\| 30 | 49.4 | `#8c8cf8` | 2.91 | -30.1 | 0.688 |
| APCA \|Lc\| 15 | 32.7 | `#6666f6` | 1.93 | -15.3 | 0.591 |

- Mixing in OKLab instead of sRGB (CSS `color-mix(in oklab)`) keeps the ground's hue. The tints are sky-blue rather than lavender:
  - Lc 75: `#dbe7ff`, OKLCH hue 264.4
  - Lc 60: `#b7ceff`
  - Lc 45: `#92b3ff`
  - The sRGB-mix tints #e4e4ff/#d0d2ff sit at OKLCH hue 285.7/283.0, versus 266.6 for the ground. Hue prediction is OKLab's stated design goal ([Ottosson](https://bottosson.github.io/posts/oklab/)).
- The highest reachable reverse-polarity Lc is -107.9, for white on black; black on white is Lc 106.0 (computed with [apca-w3.js](https://github.com/Myndex/apca-w3/blob/master/src/apca-w3.js) constants). So the lookup rows at Lc 110 to 125, which allow 10 to 11px text, cannot be reached by any colour pair.

### Inferences
- **WCAG and APCA disagree in the middle of the ramp.** #b8baff passes WCAG AA for text of any size (4.63:1). APCA puts it at Lc 52, which needs ≥30px at weight 400 or ≥20px at weight 700. For 8 to 12px pixel text, the APCA reading is the safer one.
- **Practical text palette on #1b1bf2:**
  - Body or fluent text: #ffffff (Lc 91.5), down to about #e4e4ff (Lc 75).
  - Secondary content text: down to about #c9c9fc / #d0d2ff (Lc 60 to 65).
  - Large display text only: #b8baff (Lc 52).
  - Spot text: #a5a8ff (Lc 43). #8d8dff (Lc 31) is the APCA floor for spot text, but it is under WCAG's 3:1.
  - Non-text decoration only: #6e6ef8.
  - Below detectability (Lc 0, 1.38:1): #4545f6.
- **Warm and cool whites cost contrast for no hierarchy gain.**
  - #f2efe8 loses 10 Lc (-81.1 vs -91.5) and 1.1 ratio points against white.
  - #fffaf0 and #f8f8ff differ from #ffffff by only about 1 OKLab JND. They are a tone choice, not a usable second level.

### Gaps
- APCA's current standing (W3C draft status, and whether WCAG 3 drafts still reference it) was not verified in this pass. WCAG 2.x remains the normative test, and APCA is guidance.
- All values assume an ideal sRGB display. Wide-gamut or uncalibrated screens, and browser colour management of an untagged #1b1bf2, will shift the blue. This was not quantified.

## 2. How many white tints are perceptually distinct on this blue, and what separation is needed for two text levels and for two adjacent chart marks?

### Takeaway
Side by side, about 29 to 32 just-noticeable steps fit between #1b1bf2 and white. Steps that read reliably at a glance are far fewer: 5 at APCA Lc ≥15 between neighbours, or 6 at dEOK ≥0.10 (5 JND). Inside the body-text band (Lc ≥75) there is room for only two levels, #ffffff and about #e4e4ff, which are 4 JND and Lc 14 apart. Two chart marks cannot both be 3:1 against the ground and 3:1 against each other on #1b1bf2: the best symmetric split is 2.91:1.

### Cited Findings
- **JND definitions.**
  - CSS Color 4: "For the OkLCh color space, one JND is an OkLCh difference of 0.02". It also says that in CIE Lab "using deltaE2000, one JND is 2" ([CSS Color Module Level 4, gamut mapping](https://www.w3.org/TR/css-color-4/#gamut-mapping)).
  - The spec's CIEDE2000 sample code notes that the SL lightness term assumes "a background with L=50" ([CSS Color 4](https://www.w3.org/TR/css-color-4/)). The ground here is L* 32.8.
- **Lightness discrimination depends on the background (Whittle 1992, Vision Research 32(8):1493-1507)** ([PubMed 1455722](https://pubmed.ncbi.nlm.nih.gov/1455722)):
  - Equal-brightness steps follow Weber's law relative to luminance at low levels, and relative to the difference from the background near the background level. There is a sharp dip in step size at the background luminance (the "crispening effect").
  - "The Crispening Effect was abolished by a thin outline or a hue difference between circles and background."
- Kane and Bertalmío (2016) found that sensitivity to lightness change is higher near the background luminance. They conclude that contrast judgements depend on perceived lightness. (Abstract or snippet level only: [UPF repository](https://repositori.upf.edu/items/451cfa13-7df2-4ed5-bb8a-554efbc752ca).)
- **WCAG 1.4.11 on adjacent marks** ([W3C 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)):
  - For line charts, "The lines should have 3:1 contrast against their background" but "they do not need to contrast with each other".
  - For pie charts, "you have to discern each slice of the pie chart from the others". So adjacent segments that carry meaning need 3:1 against each other, or another separator.
  - "particularly thin lines and shapes ... may be rendered by user agents with a much fainter color"; authors should "avoid particularly thin lines" or exceed the minimum.
- **APCA thresholds that apply:**
  - "consider Lc 15 the point of invisibility for many users" ([APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell)).
  - APCA returns 0 when |S| < 0.1 (the low clip) ([apca-w3.js](https://github.com/Myndex/apca-w3/blob/master/src/apca-w3.js)). So it cannot score small differences between two near-white tints: #f2efe8 against #e4e4ff gives Lc 0.0.

#### Computed table E: separation between adjacent requested tints
"Lc lighter-on-darker" is the APCA Lc of the lighter tint as text on the darker one.

| pair | dL* | dE00 | dEOK | dEOK in JND | WCAG between | Lc lighter-on-darker |
|---|---|---|---|---|---|---|
| `#ffffff` / `#f2efe8` | 5.5 | 4.7 | 0.048 | 2.4 | 1.15 | -8.2 |
| `#f2efe8` / `#e4e4ff` | 3.2 | 15.2 | 0.053 | 2.6 | 1.09 | 0.0 |
| `#e4e4ff` / `#d0d2ff` | 6.0 | 6.6 | 0.056 | 2.8 | 1.17 | -8.9 |
| `#d0d2ff` / `#b8baff` | 7.8 | 7.5 | 0.074 | 3.7 | 1.25 | -11.6 |
| `#b8baff` / `#a5a8ff` | 5.9 | 5.4 | 0.056 | 2.8 | 1.19 | -8.1 |
| `#a5a8ff` / `#8d8dff` | 8.4 | 7.8 | 0.080 | 4.0 | 1.31 | -11.2 |
| `#8d8dff` / `#6e6ef8` | 10.1 | 9.7 | 0.091 | 4.5 | 1.41 | -12.0 |
| `#6e6ef8` / `#4545f6` | 11.7 | 12.5 | 0.109 | 5.4 | 1.53 | -11.5 |
| `#ffffff` / `#e4e4ff` | 8.7 | 12.4 | 0.082 | 4.1 | 1.25 | -14.2 |
| `#ffffff` / `#d0d2ff` | 14.6 | 18.4 | 0.138 | 6.9 | 1.46 | -25.0 |
| `#ffffff` / `#b8baff` | 22.4 | 25.2 | 0.211 | 10.6 | 1.83 | -38.2 |
| `#e4e4ff` / `#b8baff` | 13.7 | 14.0 | 0.130 | 6.5 | 1.46 | -22.0 |
| `#ffffff` / `#fffaf0` | 1.6 | 4.9 | 0.020 | 1.0 | 1.04 | 0.0 |
| `#ffffff` / `#f8f8ff` | 2.2 | 3.8 | 0.021 | 1.1 | 1.06 | 0.0 |

#### Computed table F: how many levels fit between #1b1bf2 and white
Levels are chosen greedily along the gamma-sRGB mix line, and the count excludes the ground.

| criterion between neighbours | steps | levels |
|---|---|---|
| dEOK ≥ 0.02 (1 JND) | 29 | `#2828f3` … `#fbfbff` |
| dE00 ≥ 2 (CSS JND) | 32 | `#2929f3` … `#fefeff` |
| dEOK ≥ 0.05 (2.5 JND) | 12 | `#3737f4 #4d4df5 #6060f6 #7272f7 #8484f8 #9595f9 #a6a6fa #b7b7fb #c8c8fc #d9d9fd #eaeafe #fbfbff` |
| dE00 ≥ 5 | 13 | `#3838f4` … `#fafaff` |
| dEOK ≥ 0.10 (5 JND) | 6 | `#4d4df5 #7272f7 #9494f9 #b5b5fb #d6d6fd #f8f8ff` |
| dE00 ≥ 10 | 6 | `#4c4cf5 #6d6df7 #8d8df8 #afaffa #d0d0fc #ececfe` |
| APCA \|Lc\| ≥ 15 | 5 | `#6666f6 #8f8ff9 #b1b1fb #d0d0fc #ededfe` |
| WCAG ≥ 1.5:1 | 5 | `#4e4ef5 #7575f7 #9c9cf9 #c6c6fc #f5f5fe` |
| WCAG ≥ 3:1 | 1 | `#8f8ff9` |

Range available inside each text band on #1b1bf2:

| band | range | dEOK span | Lc between the ends | WCAG between the ends |
|---|---|---|---|---|
| \|Lc\| ≥ 75 | `#e4e4fd` to `#ffffff` | 0.081 (4.0 JND) | 14.3 | 1.25 |
| \|Lc\| ≥ 60 | `#c9c9fc` to `#ffffff` | 0.163 (8.2 JND) | 30.0 | 1.59 |
| \|Lc\| ≥ 45 | `#adadfa` to `#ffffff` | 0.249 (12.4 JND) | 45.0 | 2.07 |

#### Two chart marks
- White against the ground is 8.449:1. The best symmetric three-level split (ground, mark A, mark B) is √8.449 = 2.907:1 per step.
- The darkest 3:1 tint, #8f8ff9, is only 2.81:1 against white.
- A second mark 3:1 above #8f8ff9 would need relative luminance 1.070, and the maximum is 1.0. So on #1b1bf2 two marks cannot be ≥3:1 from the ground and from each other. All of this is computed with the [W3C 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) formula.

### Inferences
- **Two text levels.** On #1b1bf2 the only pair that keeps both levels at body-text contrast is #ffffff with #e4e4ff (or #e8e8fe at AAA). They differ by 4.1 JND (dEOK 0.082), dE00 12.4 and Lc 14.2. That is visible side by side, but it sits just under APCA's Lc 15 "invisibility" line between the two levels.
  - A more legible hierarchy pairs body #ffffff with secondary #d0d2ff (Lc -64.9 against the ground). Those two differ by Lc 25 and 6.9 JND, at the cost of using the secondary level only at sizes allowed for Lc 60 to 65.
- **Usable ladder.** The 29 to 32 JND steps are side-by-side thresholds measured in perceptual-uniformity terms. They are not hierarchy levels a reader identifies alone.
  - A ladder of about 5 levels, each ≥Lc 15 / ≥5 JND apart, is the realistic maximum. One version is #6666f6, #8f8ff9, #b1b1fb, #d0d0fc, #ededfe, with white replacing the top level.
  - Only the top 2 or 3 of those levels are text colours. The rest are for fills, bands and dither.
- **Crispening favours the dark end.** Per Whittle, discrimination is sharpest near the ground's luminance and follows Weber behaviour far above it. So the near-white tints (Y 0.6 to 1.0, far from the ground's Y 0.074) need larger luminance steps than the dark tints to look equally distinct.
  - The strong hue and chroma difference between the tints and the saturated ground probably weakens crispening further ("abolished by ... a hue difference").
  - So the CSS 0.02 JND is optimistic for near-white text levels.
- **Hue-only differences do not make a level.** #f2efe8 against #e4e4ff has dE00 15.2 but WCAG 1.09 and Lc 0: they are distinguished only by warm versus cool hue. That is a yellow-blue difference, likely to vanish for tritan colour vision and on poorly calibrated screens, and it breaks the one-colour design. dE00 overstates its usefulness as a hierarchy cue.
- **Chart marks on #1b1bf2.**
  - Comply with 1.4.11 by making each mark ≥3:1 against the ground: white or tints down to #8f8ff9.
  - Separate adjacent marks by non-colour means: gaps of ground colour between bars or segments, Bayer pattern versus solid, dash patterns, direct labels.
  - The Understanding text allows lines that do not contrast with each other.

### Gaps
- No psychophysical data was found on JNDs for near-white tints on a saturated blue surround. The CSS JND is a gamut-mapping heuristic, and CIEDE2000 assumes a mid-grey (L*=50) background.
- No source was found that gives a minimum separation for two text hierarchy levels identified by lightness alone. The Lc 15 and 5-JND rules above are inferences.
- Chromatic induction (white looking yellowish on a saturated blue surround) was not modelled. That would need a colour appearance model with surround, such as CAM16.

## 3. Should the blue be adjusted (darker or less saturated) while keeping the electric look?

### Takeaway
Darkening helps contrast. Desaturating at constant lightness does not: it lowers the WCAG ratio and leaves APCA flat. A 5 % darker #1a1ae5 is the lightest scaled ground where white reaches 9:1, the point where two 3:1 chart marks fit. #1515c8 gives white 10.64:1 / Lc -96.6 and a 5.2-JND body-text band, for 13 % less OKLCH chroma. #10109a gives 13.44:1 / Lc -101.6 but loses 29 % chroma and drops to OKLab L 0.33, a navy rather than an electric blue. Brightening or using pure #0000ff gains nothing.

### Cited Findings
Computed table H uses the formulas and sources given in section 1: [W3C 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [apca-w3.js](https://github.com/Myndex/apca-w3/blob/master/src/apca-w3.js) and [OKLab](https://bottosson.github.io/posts/oklab/). The "x%" columns are the % white in a gamma-sRGB mix needed to reach the target on that ground.

| ground | note | OKLCH L | OKLCH C | hue | WCAG white | APCA white | Lc `#e4e4ff` | Lc `#d0d2ff` | Lc `#b8baff` | WCAG `#b8baff` | Lc 75 tint | Lc 60 tint | 4.5:1 tint | 3:1 tint | √(white ratio) | dEOK white-ground (JND) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `#1b1bf2` | base | 0.452 | 0.289 | 266.6 | 8.45 | -91.5 | -75.3 | -64.9 | -52.1 | 4.63 | 88.0% `#e4e4fd` | 76.1% `#c9c9fc` | 68.7% `#b8b8fb` | 50.7% `#8f8ff9` | 2.91 | 31 |
| `#0000ff` | pure sRGB blue | 0.452 | 0.313 | 264.1 | 8.59 | -90.7 | -74.5 | -64.0 | -51.3 | 4.71 | 89.7% `#e5e5ff` | 79.5% `#cbcbff` | 70.8% `#b5b5ff` | 55.1% `#8d8dff` | 2.93 | 32 |
| `#2a2aff` | brighter | 0.485 | 0.291 | 268.4 | 7.31 | -88.4 | -72.3 | -61.8 | -49.1 | 4.00 | 89.5% `#e9e9ff` | 77.3% `#cfcfff` | 73.5% `#c7c7ff` | 53.8% `#9d9dff` | 2.70 | 30 |
| `#1a1ae5` | RGB ×0.948 | 0.434 | 0.277 | 266.8 | 9.04 | -93.1 | n/c | n/c | n/c | n/c | n/c | n/c | n/c | n/c | 3.01 | n/c |
| `#1717d9` | RGB ×0.9 | 0.416 | 0.266 | 266.6 | 9.72 | -94.6 | -78.5 | -68.0 | -55.3 | 5.32 | 86.0% `#dfdffa` | 74.4% `#c4c4f5` | 63.2% `#aaaaf1` | 47.2% `#8585eb` | 3.12 | 32 |
| `#1515c8` | user option | 0.392 | 0.250 | 266.7 | 10.64 | -96.6 | -80.5 | -70.0 | -57.3 | 5.83 | 84.9% `#dcdcf7` | 73.3% `#c1c1f0` | 60.1% `#a2a2e9` | 44.7% `#7e7ee1` | 3.26 | 33 |
| `#1212b0` | RGB ×0.73 | 0.358 | 0.227 | 266.9 | 12.07 | -99.3 | -83.2 | -72.7 | -59.9 | 6.62 | 83.0% `#d7d7f2` | 72.0% `#bdbde9` | 56.4% `#9898dd` | 41.6% `#7575d1` | 3.47 | 34 |
| `#10109a` | user option | 0.326 | 0.204 | 267.3 | 13.44 | -101.6 | -85.4 | -75.0 | -62.2 | 7.36 | 81.8% `#d4d4ed` | 70.6% `#b9b9e1` | 53.4% `#9090d0` | 39.6% `#6f6fc2` | 3.67 | 35 |
| `#0c0c80` | RGB ×0.53 | 0.286 | 0.178 | 267.5 | 15.22 | -103.7 | -87.6 | -77.1 | -64.3 | 8.34 | 80.9% `#d1d1e7` | 69.8% `#b6b6d9` | 50.5% `#8787c0` | 37.5% `#6767b0` | 3.90 | 37 |
| `#1c36db` | same OKLab L, C ×0.85 | 0.453 | 0.246 | 266.5 | 8.08 | -91.4 | -75.2 | -64.8 | -52.0 | 4.43 | 87.1% `#e2e5fa` | 74.4% `#c5ccf6` | 68.0% `#b6bff3` | 48.7% `#8b98ed` | 2.84 | 30 |
| `#2343c4` | same OKLab L, C ×0.7 | 0.452 | 0.203 | 266.6 | 7.86 | -91.2 | -75.1 | -64.6 | -51.8 | 4.31 | 86.5% `#e1e6f7` | 73.2% `#c4cdef` | 67.9% `#b8c3ec` | 48.0% `#8d9de0` | 2.80 | 29 |
| `#314ea5` | same OKLab L, C ×0.5 | 0.452 | 0.145 | 266.7 | 7.60 | -90.9 | -74.7 | -64.2 | -51.5 | 4.16 | 86.2% `#e3e7f3` | 72.6% `#c7cfe6` | 68.3% `#bec7e2` | 47.2% `#92a2cf` | 2.76 | 28 |
| `#1900e0` | OKLab L −0.05, C kept (clipped) | 0.415 | 0.280 | 266.8 | 9.92 | -94.3 | -78.1 | -67.7 | -54.9 | 5.43 | 87.3% `#e2dffb` | 76.3% `#c8c3f8` | 65.0% `#aea6f4` | 49.7% `#8b7fef` | 3.15 | 32 |
| `#1a00ce` | OKLab L −0.10, C kept (clipped) | 0.391 | 0.262 | 267.5 | 10.85 | -96.3 | -80.1 | -69.7 | -56.9 | 5.95 | 85.7% `#dedbf8` | 75.1% `#c6c0f3` | 61.8% `#a89eec` | 46.9% `#8578e5` | 3.29 | 33 |
| `#1d00bc` | OKLab L −0.15, C kept (clipped) | 0.368 | 0.243 | 269.0 | 11.81 | -98.2 | -82.0 | -71.6 | -58.8 | 6.47 | 84.6% `#dcd8f5` | 73.9% `#c4bcee` | 58.7% `#a296e3` | 44.6% `#8272da` | 3.44 | 34 |

(n/c = not computed.)

Text-level and chart-mark headroom per ground, computed the same way:

| ground | Lc ≥75 band: Lc span, JND | Lc ≥60 band: Lc span, JND | 3:1 mark ladder | Lc-15 ladder |
|---|---|---|---|---|
| `#1b1bf2` | 14.3, 4.0 | 30.0, 8.2 | 1 mark (`#8f8ff9`) | 5 levels |
| `#0000ff` | 13.6, 3.9 | 28.7, 7.9 | 1 mark | 5 levels |
| `#1515c8` | 19.4, 5.2 | 35.1, 9.3 | 2 marks (`#7e7ee1` 3.02:1, `#ececfa` 3.01:1) | 5 levels |
| `#1a00ce` | 19.5, 5.3 | 34.7, 9.2 | 2 marks | 5 levels |
| `#10109a` | 24.6, 6.4 | 40.3, 10.4 | 2 marks (`#6f6fc2`, `#d3d3ec`) | 6 levels |

APCA font lookup for white on each ground ([fontLookupAPCA 0.1.7](https://github.com/Myndex/apca-w3/blob/master/src/apca-w3.js)), minimum px for weights 100 to 900:

| white Lc | ground | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| 91.5 | `#1b1bf2` | 47 | 31 | 21 | 16 | 15.5 | 14.5 | 14 | 16 | 18 |
| 96.6 | `#1515c8` | 44 | 28 | 19.5 | 15.5 | 15 | 14 | 13.5 | 16 | 18 |
| 101.6 | `#10109a` | 41 | 26 | 18.5 | 15 | 14.5 | 13.5 | 13 | 16 | 18 |
| 103.7 | `#0c0c80` | 40 | 25 | 18.5 | 15 | 14.5 | 13.5 | 12.5 | 16 | 18 |

### Inferences
- **Smallest useful change:** #1a1ae5 (5 % darker). White rises to 9.04:1 / Lc -93.1, enough for a white mark and a mid-tint mark to both clear 3:1, at only 4 % chroma loss (OKLCH C 0.277 against 0.289).
- **Best trade-off:** #1515c8, or #1a00ce if the hue may drift slightly violet.
  - Body-text headroom grows from Lc 14.3 to 19.4: secondary text can be about #dcdcf7 and still hold Lc 75.
  - #b8baff jumps from Lc 52 to 57.
  - Cost: 13 % chroma and OKLab L 0.39. #1a00ce keeps about 5 % more chroma than #1515c8 at the same L.
- **#10109a.** Maximizes small-text latitude (#d0d2ff reaches Lc 75; #b8baff reaches 7.36:1). But at OKLab L 0.33 and C 0.20 it reads as ultramarine or navy. The "electric" look, which comes from near-primary chroma at medium lightness, is mostly gone.
- **Desaturating does not help.** At constant OKLab L, lower chroma means higher luminance Y, so the WCAG ratio for white drops (8.45 → 7.60) and APCA barely moves (-91.5 → -90.9). Keeping the blue saturated is in fact what gives white its 8.45:1.
- **Pure #0000ff is no better** (8.59:1, Lc -90.7). Any lighter or brighter blue (#2a2aff: 7.31:1) is worse.
- **Darker grounds barely help small text.** Lc 91.5 → 101.6 lowers the APCA minimum for weight 400 only from 16 to 15 px, and for weight 700 from 14 to 13 px. A darker blue does not make 8 to 12 px text APCA-conformant; it mainly widens the room for secondary tints and chart marks.

### Gaps
- "Electric look" was approximated by OKLCH chroma and lightness only. There is no perceptual study of how much darkening a viewer tolerates before the blue stops reading as electric.
- The Helmholtz-Kohlrausch effect (saturated blue looking brighter than its luminance) is not captured by WCAG, APCA or OKLab L. It may make the darker variants look less dim than these numbers suggest. Not quantified.

## 4. Minimum sizes and weights for the pixel fonts at each contrast level

### Takeaway
- **APCA's lookup was built for a Helvetica/Barlow-like reference font.** By its rules, no colour on #1b1bf2 makes text below 14px conformant as fluent text.
- **Press Start 2P** is crisp only at multiples of 8px. Its 2-dot stems are heavier than Arial Bold. At 8px it has bold-text stroke width but a 5px x-height, so treat it as spot or label text that needs white (Lc ≥ 75, ideally 90). At 16px it qualifies for body-level use with white to #e4e4ff.
- **DotGothic16** at 8 to 12px renders 1-dot strokes thinner than one pixel. Anti-aliasing then cuts white's effective contrast from Lc 91 to Lc 41-82, so it needs ≥16px and white.
- **Jacquard 24** has hairline stems (0.047em), so it behaves like weight 100-200. Keep it ≥48px and ≥ Lc 75 (white to #e4e4ff).
- **Thin 1px chart lines** lose up to half their contrast when not pixel-snapped.

### Cited Findings
- APCA's reference font: the lookup table's comment says "reference font is Barlow" ([apca-w3.js](https://github.com/Myndex/apca-w3/blob/master/src/apca-w3.js)), and the Nutshell page says sizes are "based on the reference font Helvetica" ([APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell)).
- An APCA maintainer states that the reference x-height is 0.52 of the font size (Helvetica Neue). Other APCA material says 0.5, and fonts with a different x-height should be size-adjusted. This comes from search snippets only; I did not open the pages: [SAPC-APCA discussion #28](https://github.com/Myndex/SAPC-APCA/discussions/28), [discussion #90](https://www.github.com/Myndex/SAPC-APCA/discussions/90).
- APCA minimum-size rows from the lookup (reference font), at weight 400 / 700: Lc 90 = 16 / 14px; Lc 75 = 18 / 14px; Lc 60 = 24 / 16px; Lc 45 = 42 / 24px; Lc 30 = 108 / 72px (spot text only per guidance); below Lc 30 = non-text only. Weights 800 and 900 need 16 and 18px at every level ≥ Lc 60 ([apca-w3.js](https://github.com/Myndex/apca-w3/blob/master/src/apca-w3.js)).
- WCAG large-scale text is ≥18pt (≈24px), or ≥14pt bold (≈18.5px) ([W3C 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)). WCAG text contrast has no minimum font size.
- Thin lines and shapes may be rendered fainter by user agents ([W3C 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)). APCA requires Lc 45 for fine-detail pictograms and outline icons, Lc 30 for solid icons ≥5.5px, and Lc 15 for dividers ≥5px solid ([APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell)).

#### Font measurements (computed)
- **Method.** The TTFs come from [google/fonts](https://github.com/google/fonts/tree/main/ofl) (pressstart2p, dotgothic16, jacquard24). Outlines were read with fontTools. Each font was rasterized with Pillow 12.2 / FreeType greyscale anti-aliasing, which approximates a browser and is not one. Arial and Arial Bold (Windows) were measured as stand-ins for the APCA reference.

| font | units/em | design grid | stem (H) | x-height | cap height | x-height ÷ 0.52 (APCA size factor) |
|---|---|---|---|---|---|---|
| Press Start 2P | 1000 | 125 units = 8 cells/em | 250 = **0.250 em** (2 cells) | 0.625 em | 0.875 em | ×1.20 |
| DotGothic16 | 1000 | dot pitch ≈62 units (≈16/em); outlines not on an integer grid | 73-74 = **0.073 em** (1 dot) | 0.568 em (OS/2 0.540) | 0.815 em | ×1.09 |
| Jacquard 24 | 1290 | 30 units = 43 cells/em | 60 = **0.047 em** (2 cells) | 0.395 em | 0.721 em | ×0.76 |
| Arial (APCA-like reference) | 2048 | n/a | 194 = 0.095 em | 0.519 em | 0.716 em | ×1.00 |
| Arial Bold | 2048 | n/a | 296 = 0.145 em | 0.519 em | 0.716 em | ×1.00 |

Raster measurements. "Partial pixels" is the share of ink pixels with partial anti-aliasing coverage.

| font @ size | stem in px (peak coverage) | x-height px | partial pixels | APCA-equivalent size |
|---|---|---|---|---|
| Press Start 2P 8px | 2.0 (100 %) | 5 | 0 % | 9.6 px |
| Press Start 2P 10px | 2.5 (2 full + one 50 % px) | 7 (box) | 53 % | 12.0 px |
| Press Start 2P 12px | 3.0 | 7.5 (box 7) | 34 % (half-dots at 1.5 px/dot) | 14.4 px |
| Press Start 2P 16px | 4.0 (100 %) | 10 | 0 % | 19.2 px |
| DotGothic16 8px | 0.60 (peak 60 %) | 4 | 100 % | 8.7 px |
| DotGothic16 10px | 0.75 (peak 75 %) | 6 | 100 % | 10.9 px |
| DotGothic16 12px | 0.86 (peak 86 %) | 7 | 99 % | 13.1 px |
| DotGothic16 16px | 1.16 (one 99 % px + 17 %) | 9 | 86 % | 17.5 px |
| DotGothic16 24px | 1.74 | 14 | 53 % | 26.2 px |
| Jacquard 24 48px | 2.24 | 19 | 41 % | 36.5 px |
| Jacquard 24 64px | ≈3.0 | 25 | 33 % | 48.6 px |
| Jacquard 24 96px | 4.47 | 38 | 22 % | 73.0 px |
| Arial 400 @ 16px (APCA Lc 90 minimum) | 1.5 | 8.3 | n/a | 16 px |
| Arial 700 @ 14px (APCA Lc 75-90 minimum) | 2.0 | 7.3 | n/a | 14 px |

Contrast lost to partial pixel coverage. The table gives white text or lines at coverage p over #1b1bf2, under two blending models: physically correct linear-light blending, and naive gamma-space blending (as with CSS opacity). Real text rasterizers fall between the two.

| case | coverage | linear-light result | WCAG / Lc | gamma-space result | WCAG / Lc |
|---|---|---|---|---|---|
| DotGothic16 8px stem | 60 % | `#cbcbfa` | 5.42 / -61.0 | `#a3a3fa` | 3.69 / -40.6 |
| DotGothic16 10px stem | 75 % | `#e1e1fc` | 6.59 / -73.4 | `#c7c7fc` | 5.23 / -58.9 |
| DotGothic16 12px stem | 86 % | `#efeffd` | 7.42 / -81.7 | `#e0e0fd` | 6.54 / -72.9 |
| same, text colour #e4e4ff | 86 % | `#d6d6fd` | 5.99 / -67.2 | `#c8c8fd` | 5.28 / -59.5 |
| same, text colour #d0d2ff | 86 % | `#c3c5fd` | 5.12 / -57.7 | `#b7b9fd` | 4.58 / -51.4 |
| Press Start 2P 10/12px half-covered pixel | 50 % | `#bdbdf9` | 4.75 / -53.5 | `#8d8df9` | 2.94 / -30.6 |
| 1px #ffffff line on a half-pixel (2 px at 50 %) | 50 % | `#bcbcf9` | 4.71 / -53.0 | `#8d8df8` | 2.94 / -30.5 |
| 1px #e4e4ff line on a half-pixel | 50 % | `#a8a8f9` | 3.88 / -42.9 | `#8080f8` | 2.56 / -25.1 |
| 1px #b8baff line on a half-pixel | 50 % | `#8889f9` | 2.81 / -28.8 | `#6a6af8` | 2.02 / -16.9 |
| 1px #8f8ff9 line on a half-pixel | 50 % | `#6a6af6` | 2.01 / -16.7 | `#5555f6` | 1.62 / -10.0 |

Bayer-dithered bands of white over #1b1bf2 (the perceived average is the linear-light mix):
- **2×2 Bayer, 25 / 50 / 75 % white** averages to:
  - `#8b8bf5`: 2.86:1, Lc -29.4
  - `#bcbcf9`: 4.71:1, Lc -53.0
  - `#e1e1fc`: 6.59:1, Lc -73.4
  - Steps between adjacent levels are dEOK 0.274 / 0.150 / 0.113 / 0.090: every step is ≥4.5 JND.
- **4×4 Bayer, 16 levels.** Adjacent-level dEOK falls from 0.099 (0→1/16) to 0.021 (15/16→1). The top four levels (12/16 to 16/16) are only about 1 JND apart.
- **Dither over a tint band:** 50 % white over #6e6ef8 averages to `#c8c8fc`.
- Computed with the [OKLab](https://bottosson.github.io/posts/oklab/) and [W3C 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) formulas.

### Inferences
- **Press Start 2P** (crisp only at 8, 16, 24 px):
  - **8px.** The 2px stems match Arial Bold at APCA's 14px minimum, but the x-height is 5px against 7.3px, and the APCA-equivalent size of 9.6px is below every row the table reaches. Treat it as non-fluent spot or label text (short labels, axis ticks). It needs ≥ Lc 75: #ffffff, warm or cool whites, down to #e4e4ff. Prefer white (Lc 91.5) for anything a reader must actually read.
  - **10 and 12px.** These are off-grid: 34 to 53 % of ink pixels are half-covered. Those pixels average to Lc 31-54 in place of 91, which blurs the pixel-art look and lowers contrast. Avoid them, or render at 8/16/24px and scale with integer CSS transforms.
  - **16px** (APCA-equivalent 19.2px, 4px stems) meets the Lc 75 rows for weights 400-700 (18/14px). White to #e4e4ff is body-safe. #d0d2ff (Lc 65) suits short non-body text.
  - **WCAG.** Press Start 2P has no bold face, so WCAG "large text" relief (3:1) applies only at ≥24px. At 8 to 16px all text needs 4.5:1, which white through #b8baff satisfy.
- **DotGothic16** at 8 to 12px is the weakest case:
  - The stem is 0.073 em, about 77 % of Arial Regular, so roughly weight 300-400 equivalent. APCA's lookup then wants ≥16-21px at Lc 91.
  - Sub-pixel stems drop white to an effective Lc 41-61 (8px) or 73-82 (12px).
  - #e4e4ff at 12px falls to Lc 60-67 effective, and #d0d2ff to Lc 51-58.
  - Recommendation: DotGothic16 only at ≥16px (its 16-dot design size), and only in white or the lightest tints. For 8 to 12px text, Press Start 2P at 8px is the more robust choice.
- **Jacquard 24.** Its stems (0.047 em, half of Arial Regular) put it near APCA weight 100-200: at Lc 91.5 the lookup gives 47px (wt100) / 31px (wt200). Its x-height factor of 0.76 shrinks the effective size further.
  - Use it ≥48px (stems ≥2px), in white or ≥ Lc 75 tints.
  - Do not set it in mid tints such as #b8baff (Lc 52). The APCA lookup at Lc 52.1 gives 67px for weight 200 and 89px for weight 100.
  - The Lc 90 maximum for very large bold text does not bind here, because white is Lc 91.5 and the font is thin.
- **Chart lines.**
  - Draw 1px lines snapped to device pixels (for example, SVG `shape-rendering: crispEdges` and integer coordinates). Otherwise a white line can fall to 2.94:1 and a #b8baff line to 2.0-2.8:1, failing 1.4.11.
  - Better: use 2px lines in white or ≥ #c9c9fc (Lc 60). APCA's Lc 45 "fine detail" rule then holds even with some blur.
  - Lines in #8f8ff9-#a5a8ff are only safe when solid and ≥2px.
- **Bayer bands.** Use 2×2 levels (25/50/75 %) or every other 4×4 level for bands that must read as distinct. Adjacent 4×4 levels near white are about 1 JND apart and will merge.
  - This assumes the pattern is fine enough to average. If the dither is drawn at 2-3 CSS-px cells, the local pixel contrast is the full white-on-blue 8.45:1, and the band reads as texture rather than as a flat tint.
  - A 25 % dither averages to 2.86:1. It is below 3:1, so it cannot be the only thing that identifies a chart mark.

### Gaps
- No browser measurement was made. Chrome/Edge (DirectWrite + Skia gamma and contrast boost), Firefox and macOS (no hinting, different gamma) rasterize these fonts differently from FreeType in Pillow. The partial-coverage shares and effective Lc ranges are approximations bracketed by the linear and gamma blending models.
- No APCA or W3C guidance specific to bitmap or pixel fonts was found. The weight equivalence (stem/em against Arial) and size equivalence (x-height/0.52) are inferences. The 0.52 versus 0.5 reference x-height is unresolved and was seen at snippet level only.
- No empirical legibility study of Press Start 2P, DotGothic16 or Jacquard 24 at these sizes was found.
