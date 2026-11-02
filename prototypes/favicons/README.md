# Favicon options (throwaway prototype)

Eight favicon options for aseri, drawn as pixel art in the site's palette (`web/src/index.css`): blue ground, white marks, gold only for the model's path. Open `index.html` to compare them at 16, 32, 48 and 180 px, zoomed, in light and dark browser tabs and on a phone home screen. Reply with a number.

| # | Name | What it is |
|---|------|------------|
| 1 | Kanji | 焦 alone: DotGothic16's own 16-dot glyph, the wordmark's first character, one font dot to a pixel. |
| 2 | Fan | Messenger's motif: three white rays from a corner between two dashed dim edge rays. |
| 3 | Path | The chart: the white daily values, then the gold path rising out of a Bayer-dithered band. |
| 4 | Winged hat | Mercury's petasos from the front, a wing swept up on each side. |
| 5 | Monogram | "as" in heavy pixel letters over the chart's 50% and 25% dither. |
| 6 | Gauge | Vortex's dial as a half ring, white up to a 45-degree arm. |
| 7 | Kana | り from the wordmark, redrawn with two-pixel strokes: the minimal mark. |
| 8 | Frame | Signal's selection brackets round one white block with a slipped row. |

Each folder `NN-name/` holds:

- `favicon-16.png` and `favicon-32.png`, with the site's chipped corners;
- `apple-touch-icon.png`, 180 px: the 32 drawing centred on a 36 grid, 5 px a cell, square, since iOS rounds the corners;
- `favicon.svg`: the 16 drawing as rectangles, exact at 16, 32 and 48 px. Where the 32 PNG has its own finer drawing (2 Fan, 6 Gauge), the SVG shows the 16 one.

`make_favicons.py` draws every grid, writes these files and puts the grids into `index.html`. Change a grid, then run:

```
python prototypes/favicons/make_favicons.py
```

It needs Pillow.
