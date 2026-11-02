"""Draws the favicon options on their pixel grids, writes each one's PNGs and SVG, and puts
the grids into index.html for the comparison page.

    python prototypes/favicons/make_favicons.py
"""

import json
import math
import pathlib
import re

from PIL import Image

HERE = pathlib.Path(__file__).parent

# The site's tokens (web/src/index.css): ground, white, secondary, dim, frame, and the one
# gold accent, kept for the model's forecast path. "." is a clear pixel, the chipped corner.
PALETTE = {
    "-": "#1b1bf2",
    "W": "#ffffff",
    "s": "#dbdbfd",
    "d": "#adadfa",
    "f": "#5454f5",
    "G": "#ffc94a",
    ".": None,
}
# The chart's 4x4 Bayer thresholds (web/src/lib/chart.ts).
BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]


def blank(n):
    return [["-"] * n for _ in range(n)]


def parse(rows, n=16, at=(0, 0), ink=None):
    """Puts ASCII art on an n grid at `at`; `ink` recolours its "#"."""
    g = blank(n)
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c != "-" and c != " ":
                put(g, x + at[0], y + at[1], ink if c == "#" and ink else c)
    return g


def put(g, x, y, c):
    if 0 <= y < len(g) and 0 <= x < len(g):
        g[y][x] = c


def bresenham(x0, y0, x1, y1):
    """The pixels of a one-pixel line, in order, with no smoothing."""
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        yield x0, y0
        if (x0, y0) == (x1, y1):
            return
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def line(g, x0, y0, x1, y1, c, dash=0):
    """A line; with `dash`, runs of that many pixels on, then as many off."""
    for i, (x, y) in enumerate(bresenham(x0, y0, x1, y1)):
        if not dash or (i // dash) % 2 == 0:
            put(g, x, y, c)


def polyline(g, points, c):
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        line(g, x0, y0, x1, y1, c)


def lit(x, y, share):
    """True where a Bayer dither of `share` (0 to 1) lights the pixel."""
    return BAYER[(y % 4) * 4 + x % 4] < 16 * share


def scaled(g, k):
    return [[c for c in row for _ in range(k)] for row in g for _ in range(k)]


def chipped(g):
    """The site's chipped corners: one pixel at 16, a three-pixel step at 32."""
    g = [row[:] for row in g]
    n = len(g)
    cut = [(0, 0)] if n <= 16 else [(0, 0), (1, 0), (0, 1)]
    for x, y in cut:
        for cx, cy in [(x, y), (n - 1 - x, y), (x, n - 1 - y), (n - 1 - x, n - 1 - y)]:
            g[cy][cx] = "."
    return g


def touch(g32):
    """The 180 px apple-touch icon: the 32 drawing centred on a 36 grid, 5 px a cell.
    No chip, since iOS rounds the corners itself."""
    marks = [
        (x, y) for y, row in enumerate(g32) for x, c in enumerate(row) if c not in "-."
    ]
    x0, x1 = min(x for x, _ in marks), max(x for x, _ in marks)
    y0, y1 = min(y for _, y in marks), max(y for _, y in marks)
    ox = (36 - (x1 - x0 + 1)) // 2 - x0
    oy = (36 - (y1 - y0 + 1)) // 2 - y0
    g = blank(36)
    for x, y in marks:
        g[y + oy][x + ox] = g32[y][x]
    return g


# 1. The kanji: DotGothic16's own 焦, the wordmark's first glyph, one font dot a pixel.
KANJI = [
    "---#-----#-----",
    "---#----#------",
    "--############-",
    "--#----#-------",
    "-############--",
    "-##----#-------",
    "#-#----#-------",
    "--###########--",
    "--#----#-------",
    "--#----#-------",
    "--############-",
    "---------------",
    "--#--#--#---#--",
    "-#----#--#---#-",
    "#-----#--#----#",
]


def kanji():
    g = parse(KANJI, at=(0, 1), ink="W")
    return g, scaled(g, 2)


# 2. The fan: Messenger's rays from the point that holds them, white, between the two dashed
# dim rays the site draws at the baseline's edges. Each ray keeps a whole-number slope (2:1,
# 1:1, 4:1...), so it steps evenly with no stray pixel.
def fan():
    def draw(n, origin, ends, edges, dash, hub):
        g = blank(n)
        ox, oy = origin
        for dx, dy in edges:
            line(g, ox, oy, ox + dx, oy - dy, "d", dash)
        for dx, dy in ends:
            line(g, ox, oy, ox + dx, oy - dy, "W")
        for x in range(hub):
            for y in range(hub):
                put(g, ox - hub // 2 + x, oy - hub // 2 + y, "W")
        return g

    g16 = draw(16, (1, 14), [(12, 6), (10, 10), (6, 12)], [(12, 3), (3, 12)], 1, 0)
    g32 = draw(
        32,
        (2, 29),
        [(22, 11), (18, 12), (19, 19), (12, 18), (11, 22), (21, 14), (14, 21)],
        [(24, 6), (6, 24)],
        2,
        2,
    )
    return g16, g32


# 3. The path: the daily values in white up to the last one, then the model's gold path
# rising through its dithered bands, with a pixel of ground round the path.
def path():
    g = blank(16)
    ox, oy = 7, 10
    for x in range(ox + 1, 15):
        d = x - ox
        centre = oy - d
        for y in range(1, 15):
            off = abs(y - centre)
            if off <= 0.55 * d:
                share = 0.5
            elif off <= 1.15 * d:
                share = 0.25
            else:
                continue
            if lit(x, y, share):
                g[y][x] = "d"
    polyline(g, [(1, 11), (2, 12), (4, 10), (5, 11), (ox, oy)], "W")
    gold = [(ox + d, oy - d) for d in range(1, 8)]
    for x, y in gold:
        for nx, ny in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]:
            if 0 <= nx < 16 and 0 <= ny < 16 and g[ny][nx] == "d":
                g[ny][nx] = "-"
    for x, y in gold:
        put(g, x, y, "G")
    return g, scaled(g, 2)


# 4. The winged hat: Mercury's petasos from the front, a wing swept up on each side, its band
# in the secondary white.
HAT = [
    "----------------",
    "----------------",
    "W--------------W",
    "WW------------WW",
    "WWW----------WWW",
    "-WWW--WWWW--WWW-",
    "WWWW-WWWWWW-WWWW",
    "-WWW-WWWWWW-WWW-",
    "--WW-WWWWWW-WW--",
    "----ssssssss----",
    "-WWWWWWWWWWWWWW-",
    "--WWWWWWWWWWWW--",
    "----------------",
]


def hat():
    g = parse(HAT, at=(0, 1))
    return g, scaled(g, 2)


# 5. The monogram: "as" in heavy pixel letters on a band dithered like the chart's.
AS = [
    "-####---#####",
    "----##-##----",
    "-#####--####-",
    "##--##-----##",
    "##--##-----##",
    "-#####-#####-",
]


def monogram():
    g = parse(AS, at=(1, 3), ink="W")
    for y in range(11, 15):
        for x in range(1, 15):
            if lit(x, y, 0.5 if y < 13 else 0.25):
                g[y][x] = "d"
    return g, scaled(g, 2)


# 6. The gauge: Vortex's dial as a half ring, white up to the arm and frame-blue past it, the
# arm at 45 degrees so it steps cleanly.
def gauge():
    def draw(n, gap):
        g = blank(n)
        k = n // 16
        cx, cy = 8 * k, 12 * k
        for y in range(n):
            for x in range(n):
                dx, dy = x + 0.5 - cx, cy - (y + 0.5)
                r = math.hypot(dx, dy)
                a = math.degrees(math.atan2(dy, dx))
                if dy > 0 and 5 * k <= r <= 7.3 * k:
                    if gap and 0 < a % 22.5 < gap:
                        continue
                    g[y][x] = "W" if a >= 45 else "f"
        for i in range(3 * k):
            for t in range(k):
                put(g, cx + i + t, cy - 1 - i, "W")
        for x in range(2 * k):
            for y in range(2 * k):
                put(g, cx - k + x, cy - k + y, "W")
        return g

    return draw(16, 0), draw(32, 3)


# 7. The kana: り, the wordmark's second glyph, redrawn with two-pixel strokes, the
# lightest mark here.
RI = [
    "----------------",
    "----------------",
    "---##----###----",
    "---##---##-##---",
    "---##--##---##--",
    "---##-##----##--",
    "---####-----##--",
    "---###------##--",
    "---##-------##--",
    "------------##--",
    "-----------##---",
    "----------###---",
    "---------###----",
    "------####------",
    "-----###--------",
    "----------------",
]


def kana():
    g = parse(RI, ink="W")
    return g, scaled(g, 2)


# 8. The frame: Signal's selection brackets round one value, its row slipped like a
# failing screen.
FRAME = [
    "----------------",
    "-####------####-",
    "-#------------#-",
    "-#------------#-",
    "-#------------#-",
    "----------------",
    "------WWWW------",
    "------WWWW------",
    "-------WWWW-d---",
    "------WWWW------",
    "----------------",
    "-#------------#-",
    "-#------------#-",
    "-#------------#-",
    "-####------####-",
    "----------------",
]


def frame():
    g = parse(FRAME, ink="W")
    return g, scaled(g, 2)


OPTIONS = [
    (
        "kanji",
        "Kanji",
        kanji,
        "Reads as 焦 to anyone who knows it and as a dense white crest to the rest: it is DotGothic16's own 16-dot glyph, one font dot to a pixel, so nothing is resampled.",
    ),
    (
        "fan",
        "Fan",
        fan,
        "Reads as rays from a corner: three white rays on whole-pixel slopes step evenly, and the two dashed dim rays at the edges are the site's baseline.",
    ),
    (
        "path",
        "Path",
        path,
        "Reads as a line going up: the gold diagonal is the only warm pixel in a tab strip, and the dither behind it stays a texture.",
    ),
    (
        "hat",
        "Winged hat",
        hat,
        "Reads as a winged helmet: the dome and brim are solid blocks, and a one-pixel gap keeps each wing apart from the dome.",
    ),
    (
        "monogram",
        "Monogram",
        monogram,
        "Reads as \"as\": two letters six pixels tall with two-pixel stems, over the chart's dither at 50% and then 25%.",
    ),
    (
        "gauge",
        "Gauge",
        gauge,
        "Reads as a dial pushed high: a two-pixel half ring, white up to a 45-degree arm and frame blue past it, a shape people know at any size.",
    ),
    (
        "kana",
        "Kana",
        kana,
        "Reads as two bold strokes: り drawn two pixels wide is the lightest mark here, though only readers of Japanese will see a letter.",
    ),
    (
        "frame",
        "Frame",
        frame,
        "Reads as something picked out: four corner brackets round one white block whose middle row has slipped a pixel, Signal's failing screen.",
    ),
]


def png(grid, scale, path):
    n = len(grid)
    im = Image.new("RGBA", (n * scale, n * scale), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(grid):
        for x, c in enumerate(row):
            hexa = PALETTE[c]
            if hexa is None:
                continue
            rgb = tuple(int(hexa[i : i + 2], 16) for i in (1, 3, 5)) + (255,)
            for sy in range(scale):
                for sx in range(scale):
                    px[x * scale + sx, y * scale + sy] = rgb
    im.save(path)


def svg(grid, path):
    """The 16 drawing as rectangles: exact at 16, 32 and 48, where browsers draw favicons."""
    n = len(grid)
    paths = {}
    for y, row in enumerate(grid):
        x = 0
        while x < n:
            c = row[x]
            end = x
            while end < n and row[end] == c:
                end += 1
            if PALETTE[c]:
                paths.setdefault(c, []).append(f"M{x} {y}h{end - x}v1h-{end - x}z")
            x = end
    body = "".join(
        f'<path fill="{PALETTE[c]}" d="{"".join(d)}"/>' for c, d in paths.items()
    )
    path.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges">{body}</svg>\n',
        encoding="utf-8",
    )


def check(slug, g16, g32, g36):
    for g, n in [(g16, 16), (g32, 32), (g36, 36)]:
        assert len(g) == n and all(len(row) == n for row in g), (slug, n)
        assert all(c in PALETTE for row in g for c in row), slug
    # Gold is the model's alone: only the path may use it.
    assert slug == "path" or all("G" not in row for row in g16 + g32), slug


def main():
    data = []
    for i, (slug, name, draw, read) in enumerate(OPTIONS, 1):
        g16, g32 = draw()
        g36 = touch(g32)
        g16, g32 = chipped(g16), chipped(g32)
        check(slug, g16, g32, g36)
        out = HERE / f"{i:02d}-{slug}"
        out.mkdir(exist_ok=True)
        png(g16, 1, out / "favicon-16.png")
        png(g32, 1, out / "favicon-32.png")
        png(g36, 5, out / "apple-touch-icon.png")
        svg(g16, out / "favicon.svg")
        data.append(
            {
                "n": i,
                "slug": slug,
                "name": name,
                "read": read,
                "g16": ["".join(r) for r in g16],
                "g32": ["".join(r) for r in g32],
                "g36": ["".join(r) for r in g36],
            }
        )
    page = HERE / "index.html"
    html = page.read_text(encoding="utf-8")
    blob = json.dumps(
        {"palette": PALETTE, "options": data}, ensure_ascii=False, separators=(",", ":")
    )
    html, count = re.subn(
        r"(/\*GRIDS\*/).*?(/\*END\*/)", lambda m: m[1] + blob + m[2], html, flags=re.S
    )
    assert count == 1, "index.html needs one /*GRIDS*/.../*END*/ marker"
    page.write_text(html, encoding="utf-8")
    return data


if __name__ == "__main__":
    for option in main():
        print(option["n"], option["slug"])
