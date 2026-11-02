# Prototype: API page typography (throwaway)

Question (owner, 2026-11-02): the API page (`web/api/index.html`, live at https://exdsgift.github.io/aseri/api/) is hard to read in its current font. Which typography keeps the site's look and reads well as documentation?

Artifact: https://claude.ai/artifact/6DL4uxY5rCx3SVwMjT1QdE

`index.html` carries the live page's text, headings, list, code block and links word for word (links made absolute), on the site's tokens: the #1b1bf2 ground, white and #dbdbfd text, #5454f5 frames, #1818d6 and #1616c3 surfaces, gold #ffc94a. A bar at the foot switches the variant, kept in the hash (`#a` to `#f`, or the keys A to F), and keeps the block at the top of the screen in place so two variants compare at one spot. It shows each variant's readability: body font, size, line height and characters per line, measured in the browser at the current width.

| Hash | Variant | Title and headings | Body | Code and paths |
|---|---|---|---|---|
| `a` | Today, as live | Jacquard 24, 96 and 48 px | Press Start 2P 12/20 px, labels 8 px uppercase | Press Start 2P, block 8 px |
| `b` | Pixel headings, mono body | Jacquard 24 | JetBrains Mono 15 px, 1.6 | JetBrains Mono, block 14 px |
| `c` | Pixel headings, sans body | Jacquard 24 | IBM Plex Sans 16 px, 1.6 | IBM Plex Mono, block 14 px |
| `d` | DotGothic16 body | Press Start 2P, 48 and 24 px | DotGothic16 16 px (its native grid), 1.75 | DotGothic16, block 16 px |
| `e` | All mono, pixel title | Jacquard 24 title, Plex Mono inverse blocks | IBM Plex Mono 15 px, 1.6 | IBM Plex Mono, block 14 px |
| `f` | Hyperlegible body | Jacquard 24, labels Press Start 2P 8 px | Atkinson Hyperlegible Next 17 px, 1.6 | Atkinson Hyperlegible Mono, block 15 px, `{variables}` in gold |

B to F share: sentence case, inline code on the #1616c3 surface, the file list as one framed #1818d6 table with ruled rows, the code block on #1616c3, links underlined with an offset, paths that break after a `/` (`<wbr>`) on a phone, and the 1 px black drop on the pixel headings only. A stays exactly as live.

Contrast on the ground: white 8.4:1, #dbdbfd 6.3:1, gold 5.5:1. #adadfa is 4.1:1, so it is never used for text.

Differences from the live page: no JSON-LD or meta description; the favicon is inlined as a data URI. The file follows the claude.ai Artifact page contract: no doctype, html, head or body tags, so opened locally it renders in quirks mode.
