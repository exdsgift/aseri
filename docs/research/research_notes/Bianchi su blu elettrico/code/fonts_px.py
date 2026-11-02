import sys, math, os
from functools import reduce
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from contrast import font_lookup, apca, mix_lin
FONTS = {"Press Start 2P": "PressStart2P-Regular.ttf", "DotGothic16": "DotGothic16-Regular.ttf", "Jacquard 24": "Jacquard24-Regular.ttf"}
for name, fn in FONTS.items():
    f = TTFont(f"{D}/{fn}"); upm = f["head"].unitsPerEm; gs = f.getGlyphSet(); cmap = f.getBestCmap()
    coords = set()
    for ch in "HIlxoaegn0":
        rp = RecordingPen(); gs[cmap[ord(ch)]].draw(rp)
        for op, args in rp.value:
            for pt in args: coords |= {abs(round(pt[0])), abs(round(pt[1]))}
    grid = reduce(math.gcd, [c for c in coords if c])
    print(f"{name}: upm={upm}, outline-coordinate GCD={grid} units -> {upm/grid:.2f} grid cells per em")
ref = {"Press Start 2P": [8, 10, 12, 16, 24], "DotGothic16": [8, 10, 12, 16, 24, 32], "Jacquard 24": [24, 32, 48, 64, 72, 96]}
TXT = "HAMBURG hamburg 0123"
for name, sizes in ref.items():
    for px in sizes:
        font = ImageFont.truetype(f"{D}/{FONTS[name]}", px)
        im = Image.new("L", (px * 30, px * 3), 0); ImageDraw.Draw(im).text((px, px // 2), TXT, font=font, fill=255)
        hist = im.histogram(); ink = sum(hist[1:]); partial = sum(hist[1:255])
        # stem: longest horizontal run of full pixels across the 'H' mid row is not robust; use 'I'-like vertical of H: measure run length at H mid-height
        hi = Image.new("L", (px * 3, px * 3), 0); ImageDraw.Draw(hi).text((px, px // 2), "H", font=font, fill=255)
        bb = hi.getbbox(); midy = (bb[1] + bb[3]) // 2
        rowv = [hi.getpixel((x, midy)) for x in range(bb[0], bb[2])]
        stem_cov = 0.0
        for v in rowv:  # coverage-weighted width of the left stem
            if v == 0 and stem_cov > 0: break
            stem_cov += v / 255
        xi = Image.new("L", (px * 3, px * 3), 0); ImageDraw.Draw(xi).text((px, px // 2), "x", font=font, fill=255)
        xb = xi.getbbox()
        print(f"  {name} @ {px}px: ink pixels {ink}, partial-coverage share {partial/ink:.0%}, H stem ~{stem_cov:.2f}px, "
              f"x-height box {xb[3]-xb[1]}px, cap box {bb[3]-bb[1]}px")
for lc in (91.5, 96.6, 101.6, 103.7, 85.0, 75.3, 64.9):
    print(f"APCA font lookup |Lc| {lc}: wt100..900 px = {font_lookup(lc)}")
