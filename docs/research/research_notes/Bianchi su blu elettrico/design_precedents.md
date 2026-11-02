# Design precedents: visual hierarchy with one ink on blue and white

Scope: how one-colour and blue/white duotone systems build hierarchy (title, body, secondary, notes, data marks, gridlines), to inform the colour tokens of a pixel-art data site on electric blue #1b1bf2 with dithered engraving illustrations. Research date: 2026-10-31. Contrast ratios marked "computed" were calculated locally with the WCAG 2 relative-luminance formula, flat (opaque) mixes of #ffffff over the background.

## 1. Classic one-colour systems: blueprints and cyanotypes

### Takeaway
A cyanotype blueprint physically cannot make grey, so it builds hierarchy only from line weight (thick vs thin), line pattern (continuous, dashed, chain) and a precedence rule for overlaps. Those three tools map one to one onto chart roles: observed series, model path, average, uncertainty band, grid.

### Cited Findings
- The cyanotype blueprint was introduced by Sir John Herschel in 1842: paper coated with ammonium ferric citrate, exposed under a tracing, developed with potassium ferricyanide into insoluble Prussian blue (or Turnbull's blue). The result is a negative, "white lines on a blue background", with no colour or grey tones ([Wikipedia: Blueprint](https://en.wikipedia.org/wiki/Blueprint)).
- Diazo "whiteprints" replaced cyanotype in the early 1940s and produce the inverse: blue lines on white ([Wikipedia: Blueprint](https://en.wikipedia.org/wiki/Blueprint)).
- The dark ground made blueprints hard to alter, which helped preserve approved drawings, alteration histories and cross-references ([Wikipedia: Blueprint](https://en.wikipedia.org/wiki/Blueprint)).
- The "alphabet of lines" gives a precedence order for coinciding lines, highest first: object (visible) line, hidden line, cutting-plane line, centre line, break line, dimension and extension lines, section (hatching) lines. The object line wins over a hidden line, and a hidden line wins over a centre line ([LibreTexts: Line styles and types](https://workforce.libretexts.org/Courses/Northeast_Wisconsin_Technical_College/Technical_Sketching_(NWTC)/03%3A_Lines_Styles_and_Types/3.01%3A_Line_styles_and_types); [ISBE drafting curriculum](https://www.isbe.net/CTEDocuments/TEE-670089.pdf)). Course material, consistent across many sources, not the standard itself.
- Weight is the hierarchy: object lines are the thick, dark weight; hidden, centre, phantom and dimension lines are thin. Hidden lines are dashed (one course gives 1/8 in dash, 1/16 in gap); centre lines are long-short chain dashes marking an axis ([LibreTexts](https://workforce.libretexts.org/Courses/Northeast_Wisconsin_Technical_College/Technical_Sketching_(NWTC)/03%3A_Lines_Styles_and_Types/3.01%3A_Line_styles_and_types); [ISBE](https://www.isbe.net/CTEDocuments/TEE-670089.pdf)).
- Offices typically use three to six pen weights, for example 0.13, 0.18, 0.25, 0.35, 0.50, 0.70 mm, with the exact set chosen by the organisation ([Geosurge: Line types and lineweights](https://www.geosurge.ai/corpus/gen-4384/engineering-drawing/line-types-and-lineweights.html)). Weak, aggregator-style source; not checked against ISO 128 / ASME Y14.2.

### Inferences
- Chart-role mapping borrowed from the alphabet of lines (all white on #1b1bf2, no second hue needed):
  - Observed series = object line: thickest stroke, solid, full white. In pixel terms 2-3 px.
  - Model / forecast path = hidden line: same or one step thinner, dashed (e.g. 4 px on, 2 px off).
  - Average / baseline / reference = centre line: thin, chain dash (e.g. 6 on, 2 off, 1 on, 2 off).
  - Uncertainty band = section hatching: no outline or a thin one, filled by a diagonal hatch or ordered-dither pattern whose density sets its "tint". Lower density reads as further back.
  - Grid = construction / extension lines: thinnest, lowest precedence, ideally dotted (1 on, 3 off) so it reads as texture, not as data.
- The precedence rule becomes a z-order rule: where marks coincide, draw observed over forecast over average over band over grid, and never let the grid cross the data line (break the grid under the line, as drafting breaks extension lines short of the object).
- Because the site's engravings are already dithered, a band rendered as a 25 % or 50 % dither of white pixels stays in the same "one ink, no grey" grammar as the blueprint, whereas a semi-transparent white fill would introduce a true tint. Both are defensible; the dither is the more blueprint-faithful option.
- Pen-weight ratios: the 0.13 / 0.18 / 0.25 / 0.35 / 0.50 / 0.70 series grows by about x1.4 per step. On a pixel grid the nearest usable ladder is 1 / 2 / 3 px; three weights are enough for a chart.

### Gaps
- ASME Y14.2 and ISO 128-20 were not read directly, so exact standard weights and dash lengths are unverified.
- No source found on blueprint lettering conventions (title-block vs note lettering heights) or on hatching density standards; these would support the title/note size ladder.

## 2. Klein blue, IBM blue posters, Swiss style and modern electric-blue systems

### Takeaway
The verified hex values are IKB at about #002FA7 (an approximation of a pigment, sources disagree) and IBM Carbon's blue ramp (#0f62fe at blue 60). Klein's lesson is a flat, matte, saturated field with nothing competing. For Rand and the Swiss posters I found no reliable colour data, only the general practice of a few sizes and hierarchy carried by layout.

### Cited Findings
- International Klein Blue is given as #002FA7, sRGB (0, 47, 167), with ColorHexa as the cited source ([Wikipedia: International Klein Blue](https://en.wikipedia.org/wiki/International_Klein_Blue)). Colour databases disagree: #0228b0 ([colorswall](https://colorswall.com/color/0228b0)), #00239C ([brandkit](https://brandkit.pro/color/00239C)), #1C34B0 ([brandkit mirror](https://brandkit-4m0.pages.dev/color/1C34B0)). No source gave an authoritative Pantone match.
- Klein made IKB the central subject of his works from 1958 (monochrome canvases, and the body-print performances). The paint suspends ultramarine in a matte synthetic resin binder meant to preserve the pigment's intensity, often applied thick and textured ([Wikipedia: IKB](https://en.wikipedia.org/wiki/International_Klein_Blue)).
- Paul Rand's "Eye-Bee-M" poster replaces the I and B of the IBM logotype with an eye and a bee, keeping the striped M; made for IBM's THINK campaign, dated 1981 (IBM, SFMOMA) or 1982 (Art Institute of Chicago) ([Art Institute of Chicago](https://www.artic.edu/artworks/239908/eye-bee-m-ibm-poster); [UMMA](https://umma.umich.edu/objects/eye-bee-m-rebus-2016-2-202)).
- Its colour is not consistent across copies: UMMA describes "a black poster", AIC lists a colour lithograph, Cooper Hewitt's automatic colour tags include darkslateblue and grey ([UMMA](https://umma.umich.edu/objects/eye-bee-m-rebus-2016-2-202); [Cooper Hewitt](https://collection.cooperhewitt.org/objects/18695343)).
- IBM Carbon (current IBM design system) blue ramp: blue10 #edf5ff, blue20 #d0e2ff, blue30 #a6c8ff, blue40 #78a9ff, blue50 #4589ff, blue60 #0f62fe, blue70 #0043ce, blue80 #002d9c, blue90 #001d6c, blue100 #001141; white #ffffff ([@carbon/colors v11 package source](https://unpkg.com/@carbon/colors@11/lib/index.js)).
- A modern electric-blue brand, Nous Research's Hermes Agent, uses #0000f2 as its base blue with #f2f2f2 as its "white" (detail in section 4) ([hermes-agent.nousresearch.com, CSS](https://hermes-agent.nousresearch.com/)).
- Swiss Style: a student process book suggests Müller-Brockmann often built emphasis with rules and layout position rather than by changing type size ([Ivy Tompkins, Swiss Style process book, issuu](https://issuu.com/itompkins8888/docs/ivy_tompkins_-_process_book)). Weak, secondary.

### Inferences
- #1b1bf2 compared with the precedents: it is lighter and more violet than IKB (#002FA7) and close to Hermes #0000f2 (same 0xF2 blue channel). Full white on it is 8.45:1 (computed), against 10.69:1 on IKB, 9.20:1 on #0000f2 and 13.29:1 on CGA #0000AA. So the electric blue gives less headroom for tint steps than the classic dark DOS blue: tints run out sooner.
- Klein's principle applied to a data site: keep the blue field flat and uninterrupted (no gradients, no blue-on-blue panels of a different blue), and let all hierarchy live in the white layer. Carbon-style lighter blues (#a6c8ff and similar) used as text on #1b1bf2 would act as a second ink and should be avoided if the "one ink" rule is the goal.
- Carbon's ramp is built for blue-on-white UI; its lightest steps (#edf5ff, #d0e2ff) are useful only as the paper colour for an inverse (white page, blue ink) mode of the site, in diazo whiteprint style.

### Gaps
- No verified hex or Pantone values for Paul Rand's IBM posters, for the IBM 8-bar logo blue, or for specific Swiss/International Style blue posters; IBM's design archive and MoMA/Cooper Hewitt records did not expose colour data.
- I could not reach Müller-Brockmann's own text on typographic hierarchy (Grid Systems in Graphic Design, Niggli, 1981); claims about his practice above are second-hand.
- Fonds Yves Klein material was not reached; the IKB hex is a ColorHexa approximation.

## 3. Single-colour terminals and dashboards

### Takeaway
DOS-era blue UIs ran on a 16-colour palette with exactly two brightness levels per colour, and they separated levels on blue with light grey (#AAAAAA) for passive or normal and white (#FFFFFF) for active or important, plus inverse video (swapping foreground and background) for menus and selection. Only a few states got a second hue, usually yellow. The IBM 3270 used the same idea: intensity was a field attribute, and colour was derived from it.

### Cited Findings
- CGA/EGA-default 16-colour RGBI palette: 0 #000000, 1 blue #0000AA, 2 #00AA00, 3 cyan #00AAAA, 4 #AA0000, 5 #AA00AA, 6 brown #AA5500, 7 light grey #AAAAAA, 8 dark grey #555555, 9 light blue #5555FF, 10 #55FF55, 11 light cyan #55FFFF, 12 #FF5555, 13 #FF55FF, 14 yellow #FFFF55, 15 white #FFFFFF. The intensity bit raises R, G and B together, so colours 8-15 are the bright twins of 0-7; brown is a monitor-side exception (the IBM 5153 halves green for colour 6) ([Wikipedia: Color Graphics Adapter](https://en.wikipedia.org/wiki/Color_Graphics_Adapter)).
- Text mode stores 4 bits of foreground and 4 bits of background per character cell. By default the top background bit means blink, not intensity, so backgrounds are limited to the 8 dark colours unless blink is disabled through a hardware register ([Wikipedia: CGA](https://en.wikipedia.org/wiki/Color_Graphics_Adapter)).
- Turbo Vision (Borland, 1990) attribute bytes, high nibble = background, low nibble = foreground: menu normal 0x70 black on light grey; menu disabled 0x78 dark grey on light grey; menu shortcut letter 0x74 red on light grey; menu selected 0x20 black on green; blue window frame passive 0x17 light grey on blue; blue window frame active 0x1F white on blue; frame icon 0x1A light green on blue ([turbo-vision Rust port, palette.rs, stated as Borland-compatible](https://docs.rs/crate/turbo-vision/latest/source/src/core/palette.rs)). The same port's README says the blue window interior is yellow on blue ([turbo-vision README](https://docs.rs/crate/turbo-vision/latest/source/README.md)).
- In Borland's palette scheme a window's colour entry is mapped to different application-palette entries depending on whether the window is blue, cyan or grey, so the same widget code renders in three themes ([Borland, Turbo Pascal 6.0 Turbo Vision Guide, 1990](https://archive.decromancer.ca/bitsavers.org/pdf/borland/turbo_pascal/Turbo_Pascal_Version_6.0_Turbo_Vision_1990.pdf)). Seen via search summary, not read in full.
- Norton Commander 5.0: panels are blue, menus cyan, dialogs grey ([Ilya Birman, UI Museum: Norton Commander 5.0](https://ilyabirman.net/meanwhile/all/ui-museum-norton-commander-5-0/)). Files marked with Insert turn yellow; Midnight Commander's default skin also shows marked files as yellow on blue ([Midnight Commander skins documentation](https://midnight-commander.org/wiki/doc/common/skins?format=txt)).
- Windows blue screen: NT 3.1-4.0 used silver #A8A8A8 text (later white #FFFFFF) on royal blue #0000A8; Windows 2000-7 used #000080. The colours were hard-coded. Windows 3.1/95/98 let users change them via MessageTextColor and MessageBackColor in SYSTEM.INI ([Wikipedia: Blue screen of death](https://en.wikipedia.org/wiki/Blue_screen_of_death)).
- IBM 3270: intensity is a field attribute ("intensified (bright)"). In base-colour mode the protection and intensity attributes alone decide colour: unprotected normal = green, unprotected intensified = red, protected normal = blue, protected intensified = white. Extended attributes (3278/3279 and later) add seven colours (neutral/white, red, blue, green, pink, yellow, turquoise), blinking, reverse video and underscore; character attributes override field attributes ([Wikipedia: IBM 3270](https://en.wikipedia.org/wiki/IBM_3270)).
- Bloomberg Terminal: its visual language is described as amber, red and green on black ([Bluecadet](https://www.bluecadet.com/?p=12098)). Unofficial brand-colour sites list amber around #FFA028 on black around #0B0B0B; these are not official specifications ([colorfyi: Bloomberg](https://colorfyi.com/brands/bloomberg/)). Bloomberg estimates about 20,000 users have colour vision deficiency and lets users switch scheme with PDFU COLORS &lt;GO&gt; ([Bloomberg UX: Accessibility](https://www.bloomberg.com/ux/accessibility/)).

### Inferences
- The DOS blue convention is a two-ink-level system on blue: light grey = normal, white = active or emphasised. Computed contrast on #0000AA: #AAAAAA 5.72:1, #FFFFFF 13.29:1, a gap of about 2.3x. Reproduced on #1b1bf2 with the same proportion: white #ffffff (8.45:1) and a 65-70 % white, about #bbbbfb (4.67:1). That is a direct, historically grounded "primary / secondary text" pair.
- #0000AA (CGA, 2/3 of 255) vs #0000A8 (blue screen): the 0xA8 value fits the VGA DAC's 6-bit channels (42 x 4 = 168). When reproducing a "DOS look", either value is authentic; they differ by an imperceptible amount.
- Inverse video is the strongest one-ink emphasis available: a white block with blue text (Turbo Vision's menu bar, 3270 reverse video). For the site: use it sparingly for the single most important item per view (today's value, the active tab, a "now" marker on the time axis), not for headings.
- Every DOS UI kept a second hue for a single job: marked or selected (yellow), hotkey (red), focus icon (green). If the site ever needs one non-white signal, history supports exactly one, reserved for one meaning (for example "alert" or "selected"). Otherwise inverse plus weight is enough.
- The 3270 model of colour derived from attribute is a good token architecture: define semantic roles (protected/unprotected, normal/intensified ~ secondary/primary) and derive the tint from the role, never pick tints per component.

### Gaps
- Bloomberg's "Designing the Terminal for color accessibility" article returned HTTP 403; no official Bloomberg colour values or emphasis rules were obtained.
- No primary source found for Norton Commander's exact default attribute bytes (panel text colour, cursor bar).
- IBM 3270 phosphor colours have no meaningful sRGB values in the sources; only names are known.

## 4. Contemporary engraving-and-signal aesthetics (Hermes Agent and blue duotone)

### Takeaway
The Hermes Agent site (Nous Research) is the closest precedent to aseri: base blue #0000f2, off-white #f2f2f2, and an explicit opacity ladder of white over blue (2/5/10/20/40/60/80/90/98 %). On blue it uses three white steps: 100 % for foreground, 60 % for secondary text, 20 % for pressed or hover fills. I could read its CSS tokens but could not view its illustrations, so how it handles text over art is only partly evidenced.

### Cited Findings
All from the HTML and CSS of [hermes-agent.nousresearch.com](https://hermes-agent.nousresearch.com/) (CSS chunks on web-assets.nousresearch.com), fetched 2026-10-31:
- Hue tokens all share a 0xF2 maximum channel: --hermes-color-blue #0000f2, --hermes-color-white #f2f2f2, cyan #00f2f2, green #00f279, indigo #7900f2, magenta #f200f2, neon #79f200, orange #f27900, pink #f20079, red #f20000, yellow #f2f200, neutral #616191. --hermes-color-base is set to the blue, --hermes-accent to the yellow.
- Opacity ladder: --hermes-layer-2/5/10/20/40/60/80/90/98 = 2 % to 98 %, applied as color-mix(in srgb, &lt;layer colour&gt; N %, transparent) with --hermes-layer-light #fff and --hermes-layer-dark #000. Tone ramps (--hermes-tone-light-N, --hermes-tone-dark-N, aliased as --hermes-blue-light-N / -dark-N) are derived from the base blue by mixing it with the layer colour at calc(100 % - N).
- On blue surfaces the semantic tokens resolve to: --hermes-fg = white, --hermes-fg-secondary = white-60, --hermes-bg-pressed and --hermes-dropdown-hover = white-20, --hermes-dropdown-action-hover = white-60, --hermes-dropdown-fg-muted = white-60. On white surfaces the same roles resolve to the primary blue and to primary-20 for fills.
- Typefaces: EB Garamond (serif), "Rules Gothic Compressed" for display, "Rules Condensed" for mono and labels, "Rules Variable" for body.
- The CSS includes mix-blend-mode values plus-lighter, lighten, screen, color-burn and exclusion, filter: brightness(.6), and blur filters tied to hero and footer scroll progress (--hw-hero-progress, --hw-footer-opacity).
- The page references raster art files hero.webp, platform-art.webp, footer.webp and feature-*.webp plus SVG art ([hermes-agent.nousresearch.com via WebFetch](https://hermes-agent.nousresearch.com/)).
- A third-party page on "Hermes design" skills recommends encoding rules such as "no hero cards, max two typefaces, brand-first hierarchy", and warns against soft gradients, floating panels, oversized rounded corners and dramatic shadows ([Open Design: hermes-design](https://pr-4050.open-design-landing-staging.pages.dev/agents/hermes-design/)). Not an official Nous Research document.

### Inferences
- Hermes ladder transposed to #1b1bf2 (computed, opaque equivalents): white 100 % #ffffff 8.45:1; 60 % #a4a4fa 3.73:1; 20 % #4949f5 1.43:1. On #0000f2 the same steps give 9.20 / 3.63 / 1.29. Hermes's 60 % secondary text is below the WCAG AA 4.5:1 for small text on both blues; it only passes the 3:1 large-text threshold. For aseri's small pixel text, the secondary step should be at least about 70 % (#bbbbfb, 4.67:1).
- Hermes's choice of #f2f2f2 rather than #ffffff as "white" keeps the white ink at the same 0xF2 intensity as the blue, which softens glare on a saturated field. On #1b1bf2 the cost is small (7.55:1 instead of 8.45:1, computed) and it would also leave pure #ffffff free as an "intensified" level, mirroring the DOS grey/white pair.
- Blend modes such as lighten and screen are the usual way to let white engraving lines sit on a blue field without a box: on blue, lighten keeps only the light strokes, so text placed on solid blue next to the art never fights a dark halftone. That this is how Hermes uses them is my reading of the CSS, not something I verified visually.
- Legibility rules that follow from the one-ink constraint, for dithered art: (1) never set text directly on dithered areas, because the dither has the same luminance as the 30-60 % tints and erases them; (2) reserve a solid-blue "quiet zone" or knock-out rectangle behind every label (the Turbo Vision window over a patterned desktop works this way); (3) keep illustration density low (sparse dither) wherever data marks cross the art.

### Gaps
- I did not view the Hermes images, so I cannot confirm they are blue duotone engravings or document the exact text-over-image technique (overlay, panel, knock-out).
- No other blue-duotone engraving systems were researched (for example editorial duotone illustration styles); the brief's mention of them remains unsourced here.
- No official Nous Research brand guidelines were found.

## 5. Hierarchy without colour: typographic principles

### Takeaway
The typographic literature favours few levels (two, at most three), small size steps, space as the main emphasis, and weight over italics or caps. Tint differences come after these, which suits a one-ink palette where tints quickly run out of contrast.

### Cited Findings
- Butterick: "Limit yourself to three levels of headings. Two is better." Headings should mark the structure of the argument, not every subtopic ([Butterick, Practical Typography: Headings](https://practicaltypography.com/headings.html)).
- "The best way to emphasize a heading is by putting space above and below." Prefer bold over italic; bold is optional ([Butterick: Headings](https://practicaltypography.com/headings.html)).
- Size steps should be the smallest visible change: from 12 pt to 12.5 or 13 pt, not 14 or 15; with a heavy bold, the size can even go down half a point or a full point ([Butterick: Headings](https://practicaltypography.com/headings.html)).
- Avoid all caps for headings, do not underline, do not centre, use no more than two indent levels; modular scales are rejected: "When your headings look right, they are right." ([Butterick: Headings](https://practicaltypography.com/headings.html)).
- Swiss practice (second-hand): emphasis through rules and position rather than size changes ([Tompkins process book](https://issuu.com/itompkins8888/docs/ivy_tompkins_-_process_book)); "max two typefaces, brand-first hierarchy" as a modern codified rule ([Open Design: hermes-design](https://pr-4050.open-design-landing-staging.pages.dev/agents/hermes-design/)).
- Hierarchy carried by attribute and not hue is the historical terminal norm: the 3270 has normal vs intensified, reverse video, underscore and blink ([Wikipedia: IBM 3270](https://en.wikipedia.org/wiki/IBM_3270)); CGA text mode has two intensity levels and blink ([Wikipedia: CGA](https://en.wikipedia.org/wiki/Color_Graphics_Adapter)).

### Inferences
- Pixel fonts break Butterick's "smallest visible step" rule: sizes come in integer multiples (for example 8, 16, 24 px), so size steps are coarse. That makes space, position, case and weight the main tools, with tint as the last cue. Note that in pixel fonts uppercase labels are often the clearest small-text form, which is a reasonable exception to the no-caps advice for short labels and axis ticks.
- Suggested cue budget per level (one cue change per step, as Butterick advises): title = largest size + full white; section head = body size + bold or caps + space above; body = full or 80-90 % white; secondary or axis = same size, 70 % white; notes and footnotes = position (bottom, indented) + 70 % white, never below the 4.5:1 floor; emphasis inside text = inverse video or bold, never a lower tint.
- Candidate white-on-#1b1bf2 token ladder, consolidating sections 1-5 (computed contrast, opaque hex). WCAG thresholds are 4.5:1 for normal text, 3:1 for large text and for meaningful non-text graphics (WCAG 2.x SC 1.4.3 and 1.4.11, [W3C Understanding 1.4.11](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html); thresholds recalled, the page was not fetched this session):
  - ink-100 #ffffff, 8.45:1: titles, observed data line, current value, inverse-video blocks.
  - ink-90 #e8e8fe, 7.00:1: body text (optional; or use 100 %).
  - ink-80 #d1d1fc, 5.73:1: body or forecast line.
  - ink-70 #bbbbfb, 4.67:1: secondary text, axis labels, notes; the lowest step safe for small text.
  - ink-60 #a4a4fa, 3.73:1: average / reference line, band outlines; large text only.
  - ink-50 #8d8df8, 2.94:1: just under 3:1, so decorative only.
  - ink-30 #5f5ff6, 1.79:1: gridlines (decorative, exempt from 1.4.11 if the data stays readable without them).
  - ink-20 #4949f5, 1.43:1: band fills, hover fills (Hermes uses 20 % for the same job).
  - In practice four or five steps are enough (100 / 70 / 60 / 30 / 20), which matches the DOS two-level text pair plus Hermes's 20 % fill.
- Define the tints as opaque hex, not rgba alpha. Over dithered illustrations an alpha white would shift with the pixels below it and break the ladder.

### Gaps
- Bringhurst's Elements of Typographic Style was not consulted directly; no citable passage on contrast or hierarchy was obtained.
- No source tested how many white-tint steps readers can tell apart on saturated blue; the ladder above is a contrast calculation, not a perception study.
