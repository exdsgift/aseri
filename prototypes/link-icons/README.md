# Prototype: link icons (throwaway)

Question (owner, 2026-11-02): where on the page do the three link icons go, GitHub, LinkedIn and Buy Me a Coffee?

Artifact: https://claude.ai/artifact/TFNGi4E1xuo9G6p1LJRSbE

`index.html` is `prototypes/text-and-margins/index.html` from branch `prototype-text-and-margins`, fixed to the owner's `#drop-opart` (every text casts a crisp black 1 px drop shadow down and right, op-art stripes fill the margins), its old switches removed. It adds stand-ins for three parts of the live page: a hero that fills the first screen, the side navigation (`SideNav.tsx`: the four pictograms with their labels in the right margin, from 1344 px) and the footer (`Footer.tsx`).

The icons are 16x16 pixel art, drawn as `#` strings the way `Pictogram.tsx` draws its own: GitHub's cat (simplified), LinkedIn's "in", and a steaming cup for Buy Me a Coffee. White with the text's 1 px black drop shadow, gold on hover and focus. Each link opens in a new tab and keeps its name ("GitHub", "LinkedIn", "Buy me a coffee"):
- https://github.com/exdsgift
- https://www.linkedin.com/in/gabrieledurante/
- https://buymeacoffee.com/exdsgift

The bottom bar holds three switches, kept in the hash in this order, for example `#sidenav-tiles-16`:

| Switch | Option (hash) | What it does | On a phone (390 px) |
|---|---|---|---|
| Placement | `footer` | A row under "© 2026 Gabriele Durante" | The same row, centred under the copyright line |
| | `colophon` | A small framed block at the end of the footer: "Made by Gabriele Durante", then the icons | The block spans the column at the end of the page |
| | `corner` | A row in the hero's top right corner, as personal sites do | The same corner, 16 px in, above Mercury; gone once you scroll |
| | `sidenav` | Under the section links in the right margin, below a frame rule, from 1344 px | No side navigation, so the row falls back to the footer |
| | `wordmark` | A discreet row right under "あせり · aseri" | The same row, centred under the wordmark |
| | `dock` | A small dock fixed to the bottom left corner, always in view | Fixed over the column, it covers some text as the page scrolls |
| Style | `bare` | The icons alone | |
| | `tiles` | Each icon in a 2 px frame with chipped corners, the cards' frame | |
| | `labelled` | Icon plus a word: GitHub, LinkedIn, Coffee | |
| Size | `16` | One screen pixel per art pixel | |
| | `32` | Two screen pixels per art pixel, the page's 2 px grain | |

How it is built:
- One function writes the three links into the slot (or slots) a placement names. For `sidenav` the row is also in the footer, and CSS shows that copy only below 1344 px.
- In a margin (hero corner on a desktop, side navigation, dock) the row stands on a ground, as the live side navigation does, so the stripes do not run through the icons.
- Every link's hit area is at least 24 px. A focused tile shows its gold frame, since the chipped corners would clip an outline.
- Under reduced motion the stripes stand still and the icons light up without a transition.

Differences from the live page:
- The hero is the base page's: Mercury above the wordmark in the column, not beside the text, and op-art in its margins instead of the hero's own art.
- The footer's hero picker only marks the choice.
- Prototype only: on a screen under 820 px the dock waits above the bottom bar, which would cover it.

The file follows the claude.ai Artifact page contract: no doctype, html, head or body tags, so opened locally it renders in quirks mode.

Image credit: Hendrick Goltzius after Polidoro da Caravaggio, *Mercury*, probably 1592. National Gallery of Art. Public domain (CC0), from `web/src/assets/`.
