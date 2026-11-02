# Prototype: text outline and margins (throwaway)

Questions (owner, 2026-11-02):
1. How would the text look with a thin dark outline round the characters, for a little more contrast?
2. On a desktop, the margins beside the column are empty blue. What could fill them, after about.dos-age.com and the Hermes Agent look (classical engravings degraded digitally, rays, op-art, two colours)?

Artifact: https://claude.ai/artifact/WYEKf7FdSmYGs1kodVXJWw

`index.html` is `prototypes/less-text/index.html` from branch `prototype-less-text`, fixed to `#A-none-still-none` (what #152 shipped), its old switches removed. The bottom bar holds two switches, kept in the hash in this order, for example `#navy-rays`:

| Switch | Option (hash) | What it does | On a phone |
|---|---|---|---|
| Text outline | `none` | As today | |
| | `black` | 1 px black outline in 4 directions: stacked text-shadows, no blur, no `-webkit-text-stroke` | |
| | `navy` | The same in deep navy, #0a0a6e | |
| | `drop` | 1 px black drop shadow, down and right | |
| Margins | `none` | As today | nothing |
| | `dither` | 4x4 Bayer dither in the frame colour, dense at the page edge, gone at the column | a 16 px dithered strip |
| | `rays` | Messenger's fans carried on from the hero's Mercury across both margins and down the page, swaying up to 0.3 degrees | nothing |
| | `engravings` | Mercury, Hercules and Apollo as dithered fragments beside the sections, cut by scanlines, slipped slices and an inverted band | nothing |
| | `opart` | Vortex's stripes as a current: they bend toward the page edge and thin out to nothing at the column; the bends travel slowly | a 16 px strip of the pattern |
| | `hatch` | Engraver's hatching: wavy diagonals, a cross set, then scanlines toward the page edge | a 16 px strip of single hatching |

How it is built:
- The outline is one `text-shadow` on `body`, which every word inherits, the chart labels included: the charts draw no text on their canvas, only marks, here and on the live page.
- The margins are one canvas fixed behind the page, in 2 px art pixels like the charts, painted only outside the column and a calm gap of 24 px beside it, in the frame and dim inks (never gold). It scrolls with the page.
- Rays and op-art move slowly (8 frames a second). Under reduced motion every option is still.

Differences from the live page:
- The hero is the less-text prototype's: a 320 px Mercury bust in the column. The live hero is a full screen with Mercury beside the text and rays across its own margins, so on the live page the margins beside the hero are already drawn, and these options matter from the panel down.
- Signals and Record are 720 px wide here; on the live page they are 1040 px, so their margins are narrower (200 px each at 1440 instead of 344).
- No side navigation: on the live page it sits in the right margin from 1344 px, and a margin decoration would have to clear it.
- Inherited from less-text: the chart shows 2 weeks of history on a phone and 4 on a desktop; no count-up, scan-in or keyboard hints.

The file follows the claude.ai Artifact page contract: no doctype, html, head or body tags, so opened locally it renders in quirks mode.

Image credits, all public domain (CC0), from `web/src/assets/`:
- Hendrick Goltzius after Polidoro da Caravaggio, *Mercury*, probably 1592. National Gallery of Art.
- Hendrick Goltzius, *The Farnese Hercules*, c. 1592, published 1617. The Metropolitan Museum of Art.
- *Apollo Belvedere (Apollo Pythius)*, engraving. Rijksmuseum.
