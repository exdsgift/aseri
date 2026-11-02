"""Contrast metrics for white / pale-blue tints on electric blue (#1b1bf2).
WCAG 2.x relative luminance + ratio, APCA-W3 0.1.9 (0.0.98G-4g constants), CIELAB D65,
CIEDE2000 (Sharma/Wu/Dalal 2005), OKLab (Ottosson). Cross-checked against apca-w3.js via node.
"""

import json
import math
import subprocess
import os

HERE = os.path.dirname(os.path.abspath(__file__))
GROUND = "#1b1bf2"


def rgb(h):
    return [int(h[i : i + 2], 16) for i in (1, 3, 5)]


def hx(c):
    return "#" + "".join(f"{max(0, min(255, round(v))):02x}" for v in c)


# ---- WCAG 2.x (Understanding 1.4.3 / definition of relative luminance) ----
def lin(v):
    v /= 255
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def Y_wcag(h):
    r, g, b = map(lin, rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = sorted((Y_wcag(a), Y_wcag(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


# ---- APCA-W3 0.1.9, constants 0.0.98G-4g (Myndex/apca-w3 src/apca-w3.js) ----
def Y_apca(h):
    r, g, b = [(v / 255) ** 2.4 for v in rgb(h)]
    return 0.2126729 * r + 0.7151522 * g + 0.0721750 * b


def apca(txt, bg):
    t, b = Y_apca(txt), Y_apca(bg)
    t = t if t > 0.022 else t + (0.022 - t) ** 1.414
    b = b if b > 0.022 else b + (0.022 - b) ** 1.414
    if abs(b - t) < 0.0005:
        return 0.0
    if b > t:
        s = (b**0.56 - t**0.57) * 1.14
        return 0.0 if s < 0.1 else (s - 0.027) * 100
    s = (b**0.65 - t**0.62) * 1.14
    return 0.0 if s > -0.1 else (s + 0.027) * 100


# ---- CIELAB (D65, sRGB->XYZ matrix of IEC 61966-2-1) and CIEDE2000 ----
M_XYZ = [
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.0721750],
    [0.0193339, 0.1191920, 0.9503041],
]
WHITE = (0.95047, 1.0, 1.08883)


def lab(h):
    l = list(map(lin, rgb(h)))
    X, Y, Z = (sum(m * c for m, c in zip(row, l)) for row in M_XYZ)
    f = lambda t: (
        t ** (1 / 3) if t > (6 / 29) ** 3 else t / (3 * (6 / 29) ** 2) + 4 / 29
    )
    fx, fy, fz = f(X / WHITE[0]), f(Y / WHITE[1]), f(Z / WHITE[2])
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def de2000(L1a1b1, L2a2b2):
    L1, a1, b1 = L1a1b1
    L2, a2, b2 = L2a2b2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb**7 / (Cb**7 + 25**7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360 if C1p else 0.0
    h2p = math.degrees(math.atan2(b2, a2p)) % 360 if C2p else 0.0
    dLp, dCp = L2 - L1, C2p - C1p
    if C1p * C2p == 0:
        dhp = 0.0
    else:
        dhp = h2p - h1p
        if dhp > 180:
            dhp -= 360
        elif dhp < -180:
            dhp += 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbp = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbp = (h1p + h2p) / 2
    elif h1p + h2p < 360:
        hbp = (h1p + h2p + 360) / 2
    else:
        hbp = (h1p + h2p - 360) / 2
    T = (
        1
        - 0.17 * math.cos(math.radians(hbp - 30))
        + 0.24 * math.cos(math.radians(2 * hbp))
        + 0.32 * math.cos(math.radians(3 * hbp + 6))
        - 0.20 * math.cos(math.radians(4 * hbp - 63))
    )
    dth = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    RC = 2 * math.sqrt(Cbp**7 / (Cbp**7 + 25**7))
    SL = 1 + 0.015 * (Lbp - 50) ** 2 / math.sqrt(20 + (Lbp - 50) ** 2)
    SC, SH = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    RT = -math.sin(math.radians(2 * dth)) * RC
    return math.sqrt(
        (dLp / SL) ** 2
        + (dCp / SC) ** 2
        + (dHp / SH) ** 2
        + RT * (dCp / SC) * (dHp / SH)
    )


# ---- OKLab (Ottosson 2020, matrices updated 2021-01-25) ----
def oklab(h):
    r, g, b = map(lin, rgb(h))
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = (math.copysign(abs(v) ** (1 / 3), v) for v in (l, m, s))
    return (
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    )


def oklch(h):
    L, a, b = oklab(h)
    return L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360


def deok(x, y):
    return math.dist(oklab(x), oklab(y))


def oklab_to_hex(L, a, b):
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    lr = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ]
    enc = lambda v: 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055
    ing = all(-1e-4 <= v <= 1 + 1e-4 for v in lr)
    return hx([enc(min(1, max(0, v))) * 255 for v in lr]), ing


# ---- APCA font lookup 0.1.7 (G) port (fontLookupAPCA in apca-w3.js) ----
FM = [
    [0] + [999] * 9,
    [10] + [999] * 9,
    [15] + [777] * 9,
    [20] + [777] * 9,
    [25, 777, 777, 777, 120, 120, 108, 96, 96, 96],
    [30, 777, 777, 120, 108, 108, 96, 72, 72, 72],
    [35, 777, 120, 108, 96, 72, 60, 48, 48, 48],
    [40, 120, 108, 96, 60, 48, 42, 32, 32, 32],
    [45, 108, 96, 72, 42, 32, 28, 24, 24, 24],
    [50, 96, 72, 60, 32, 28, 24, 21, 21, 21],
    [55, 80, 60, 48, 28, 24, 21, 18, 18, 18],
    [60, 72, 48, 42, 24, 21, 18, 16, 16, 18],
    [65, 68, 46, 32, 21.75, 19, 17, 15, 16, 18],
    [70, 64, 44, 28, 19.5, 18, 16, 14.5, 16, 18],
    [75, 60, 42, 24, 18, 16, 15, 14, 16, 18],
    [80, 56, 38.25, 23, 17.25, 15.81, 14.81, 14, 16, 18],
    [85, 52, 34.5, 22, 16.5, 15.625, 14.625, 14, 16, 18],
    [90, 48, 32, 21, 16, 15.5, 14.5, 14, 16, 18],
    [95, 45, 28, 19.5, 15.5, 15, 14, 13.5, 16, 18],
    [100, 42, 26.5, 18.5, 15, 14.5, 13.5, 13, 16, 18],
    [105, 39, 25, 18, 14.5, 14, 13, 12, 16, 18],
    [110, 36, 24, 18, 14, 13, 12, 11, 16, 18],
    [115, 34.5, 22.5, 17.25, 12.5, 11.875, 11.25, 10.625, 14.5, 16.5],
    [120, 33, 21, 16.5, 11, 10.75, 10.5, 10.25, 13, 15],
    [125, 32, 20, 16, 10, 10, 10, 10, 12, 14],
]
FD = [[0] * 10] * 4 + [
    [25, 0, 0, 0, 12, 12, 12, 24, 24, 24],
    [30, 0, 0, 12, 12, 36, 36, 24, 24, 24],
    [35, 0, 12, 12, 36, 24, 18, 16, 16, 16],
    [40, 12, 12, 24, 18, 16, 14, 8, 8, 8],
    [45, 12, 24, 12, 10, 4, 4, 3, 3, 3],
    [50, 16, 12, 12, 4, 4, 3, 3, 3, 3],
    [55, 8, 12, 6, 4, 3, 3, 2, 2, 0],
    [60, 4, 2, 10, 2.25, 2, 1, 1, 0, 0],
    [65, 4, 2, 4, 2.25, 1, 1, 0.5, 0, 0],
    [70, 4, 2, 4, 1.5, 2, 1, 0.5, 0, 0],
    [75, 4, 3.75, 1, 0.75, 0.188, 0.188, 0, 0, 0],
    [80, 4, 3.75, 1, 0.75, 0.188, 0.188, 0, 0, 0],
    [85, 4, 2.5, 1, 0.5, 0.125, 0.125, 0, 0, 0],
    [90, 3, 4, 1.5, 0.5, 0.5, 0.5, 0.5, 0, 0],
    [95, 3, 1.5, 1, 0.5, 0.5, 0.5, 0.5, 0, 0],
    [100, 3, 1.5, 0.5, 0.5, 0.5, 0.5, 1, 0, 0],
    [105, 3, 1, 0, 0.5, 1, 1, 1, 0, 0],
    [110, 1.5, 1.5, 0.75, 1.5, 1.125, 0.75, 0.375, 1.5, 1.5],
    [115, 1.5, 1.5, 0.75, 1.5, 1.125, 0.75, 0.375, 1.5, 1.5],
    [120, 1, 1, 0.5, 1, 0.75, 0.5, 0.25, 1, 1],
    [125] + [0] * 9,
]


def font_lookup(lc):
    c = abs(lc)
    # JS table has a header row at index 0; ours does not, so shift by one
    i = 0 if c == 0 else max(0, int(c * 0.2) - 1)
    adj = (c - FM[i][0]) * 0.2
    out = []
    for w in range(1, 10):
        t = FM[i][w]
        if t > 400:
            out.append(t)
        elif c < 14.5:
            out.append(999)
        elif c < 29.5:
            out.append(777)
        elif t > 24:
            out.append(round(t - FD[i][w] * adj))
        else:
            out.append(t - int(2.0 * FD[i][w] * adj) * 0.5)
    return out


def mix(
    c1, c2, p
):  # p = share of c1, gamma-encoded sRGB (= CSS color-mix(in srgb, c1 p, c2))
    return hx([p * a + (1 - p) * b for a, b in zip(rgb(c1), rgb(c2))])


def mix_lin(
    c1, c2, p
):  # physical (linear-light) mix: what dithering / sub-pixel coverage averages to
    enc = lambda v: 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055
    return hx(
        [enc(p * lin(a) + (1 - p) * lin(b)) * 255 for a, b in zip(rgb(c1), rgb(c2))]
    )


# ---------------- self-checks ----------------
def selfcheck():
    rows = [
        list(map(float, l.split()[:7]))
        for l in open(os.path.join(HERE, "dl", "sharma.txt"))
        if l.strip()
    ]
    err = max(abs(de2000(r[0:3], r[3:6]) - r[6]) for r in rows)
    assert err < 1e-4, err
    assert abs(ratio("#ffffff", "#000000") - 21) < 1e-9
    assert abs(apca("#888888", "#ffffff") - 63.056469930209424) < 1e-9
    assert abs(apca("#ffffff", "#888888") + 68.54146436644962) < 1e-9
    L, a, b = oklab("#0000ff")
    assert abs(L - 0.4520) < 1e-3 and abs(b + 0.3115) < 1e-3, (L, a, b)
    return len(rows), err


def node_check(pairs, lcs):
    out = subprocess.run(
        [
            "node",
            os.path.join(HERE, "ref", "run.mjs"),
            json.dumps(pairs),
            json.dumps(lcs),
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    ref = json.loads(out)
    worst = max(abs(apca(t, b) - r) for (t, b), r in zip(pairs, ref["lc"]))
    assert worst < 1e-9, worst
    for lc, f in zip(lcs, ref["font"]):
        assert font_lookup(lc) == f[1:], (lc, font_lookup(lc), f)
    return worst


def band(lc):
    c = abs(lc)
    for t in (90, 75, 60, 45, 30, 15):
        if c >= t:
            return f">={t}"
    return "<15"


def fmt_font(lc):
    f = font_lookup(lc)
    show = lambda v: {999: "no", 777: "non-text"}.get(v, "spot" if v == 666 else str(v))
    return f"{show(f[3])}/{show(f[6])}"  # weight 400 / 700


def row(h, g=GROUND):
    r, lc = ratio(h, g), apca(h, g)
    aa = "AAA" if r >= 7 else "AA" if r >= 4.5 else "AA-large/UI" if r >= 3 else "fail"
    return (
        f"| `{h}` | {r:.2f} | {aa} | {lc:.1f} | {band(lc)} | {fmt_font(lc)} | {lab(h)[0]:.1f} | "
        f"{oklab(h)[0]:.3f} | {deok(h, g):.3f} | {de2000(lab(h), lab(g)):.1f} |"
    )


HEAD = (
    "| hex | WCAG ratio | WCAG level | APCA Lc | Lc band | APCA min px wt400/wt700 | CIE L* | OKLab L | "
    "dEOK vs ground | dE00 vs ground |\n|---|---|---|---|---|---|---|---|---|---|"
)


def first_pass(metric, target, g=GROUND, mixer=mix):
    """Darkest white-into-ground mix (1/1000 steps) whose rounded hex meets metric >= target."""
    for k in range(0, 1001):
        h = mixer("#ffffff", g, k / 1000)
        if metric(h, g) >= target:
            return k / 10, h
    return None, None


def ladder(step_metric, thr, g=GROUND, mixer=mix):
    """Greedy: from ground, keep adding the next tint on the mix line that is >= thr from the last level."""
    levels, last = [g], g
    for k in range(1, 1001):
        h = mixer("#ffffff", g, k / 1000)
        if step_metric(h, last) >= thr:
            levels.append(h)
            last = h
    return levels


if __name__ == "__main__":
    n, err = selfcheck()
    print(f"selfcheck ok: CIEDE2000 vs Sharma ({n} pairs) max err {err:.2e}")
    USER = [
        "#ffffff",
        "#f2efe8",
        "#e4e4ff",
        "#d0d2ff",
        "#b8baff",
        "#a5a8ff",
        "#8d8dff",
        "#6e6ef8",
        "#4545f6",
    ]
    WARMCOOL = {
        "#fffaf0": "floralwhite (warm)",
        "#fdf6e3": "Solarized base3 (warm)",
        "#fff8e7": "cosmic latte (warm)",
        "#faf0e6": "linen (warm)",
        "#f8f8ff": "ghostwhite (cool)",
        "#f0f8ff": "aliceblue (cool)",
        "#eef2ff": "cool tint",
        "#f5f5f5": "whitesmoke (neutral grey)",
    }
    GRID = [mix("#ffffff", GROUND, p / 10) for p in range(1, 10)]
    GRID_LIN = [mix_lin("#ffffff", GROUND, p / 10) for p in range(1, 10)]
    allpairs = [[h, GROUND] for h in USER + list(WARMCOOL) + GRID + GRID_LIN]
    worst = node_check(
        allpairs,
        [abs(apca(h, GROUND)) for h in USER] + [15, 33.3, 47.9, 61.2, 77.7, 91.46, 104],
    )
    print(
        f"APCA python port == apca-w3.js reference on {len(allpairs)} pairs (max diff {worst:.1e}); font lookup identical\n"
    )

    g = GROUND
    print(
        f"GROUND {g}: WCAG Y={Y_wcag(g):.5f}, APCA Y={Y_apca(g):.5f}, CIELAB={tuple(round(v, 2) for v in lab(g))}, "
        f"OKLCH=({oklch(g)[0]:.4f}, {oklch(g)[1]:.4f}, {oklch(g)[2]:.1f})\n"
    )
    print("## A. User candidates\n" + HEAD)
    [print(row(h)) for h in USER]
    print("\n## B. Warm / cool whites\n" + HEAD)
    [print(row(h) + f" {WARMCOOL[h]}") for h in WARMCOOL]
    print(
        "\n## C1. Grid: white mixed into ground in gamma sRGB (CSS color-mix(in srgb, white p%, ground))\n"
        + HEAD
    )
    [print(row(h) + f" {10 * (i + 1)}% white") for i, h in enumerate(GRID)]
    print(
        "\n## C2. Grid: white mixed in LINEAR light (= what a p% Bayer dither / p% pixel coverage averages to)\n"
        + HEAD
    )
    [print(row(h) + f" {10 * (i + 1)}% white") for i, h in enumerate(GRID_LIN)]

    print(
        "\n## D. Threshold tints (darkest sRGB-mix tint whose hex meets the target vs ground)"
    )
    for name, m, t in [
        ("WCAG 7:1 (AAA)", ratio, 7),
        ("WCAG 4.5:1 (AA text)", ratio, 4.5),
        ("WCAG 3:1 (large/UI)", ratio, 3),
    ] + [
        (f"APCA |Lc| {t}", lambda a, b: abs(apca(a, b)), t)
        for t in (90, 75, 60, 45, 30, 15)
    ]:
        p, h = first_pass(m, t)
        print(
            f"- {name}: {p}% white -> `{h}` (ratio {ratio(h, g):.2f}, Lc {apca(h, g):.1f}, OKLab L {oklab(h)[0]:.3f})"
            if h
            else f"- {name}: unreachable"
        )

    print(
        "\n## E. Adjacent-pair distinctness, user candidates (lighter vs next darker)"
    )
    print(
        "| pair | dL* | dE00 | dEOK | dEOK in JND (0.02) | WCAG ratio between | APCA Lc lighter-on-darker |\n|---|---|---|---|---|---|---|"
    )
    for a, b in zip(USER, USER[1:]):
        print(
            f"| `{a}` vs `{b}` | {lab(a)[0] - lab(b)[0]:.1f} | {de2000(lab(a), lab(b)):.1f} | {deok(a, b):.3f} | {deok(a, b) / 0.02:.1f} | "
            f"{ratio(a, b):.2f} | {apca(a, b):.1f} |"
        )
    for a, b in [
        ("#ffffff", "#f2efe8"),
        ("#ffffff", "#e4e4ff"),
        ("#ffffff", "#d0d2ff"),
        ("#f2efe8", "#e4e4ff"),
        ("#ffffff", "#fffaf0"),
        ("#ffffff", "#f8f8ff"),
        ("#ffffff", "#b8baff"),
        ("#e4e4ff", "#b8baff"),
    ]:
        print(
            f"| `{a}` vs `{b}` | {lab(a)[0] - lab(b)[0]:.1f} | {de2000(lab(a), lab(b)):.1f} | {deok(a, b):.3f} | {deok(a, b) / 0.02:.1f} | "
            f"{ratio(a, b):.2f} | {apca(a, b):.1f} |"
        )

    print(
        "\n## F. How many levels fit between ground and white (greedy along the sRGB mix line, ground counted as level 0)"
    )
    for name, m, t in [
        ("dEOK >= 0.02 (1 JND, CSS Color 4)", deok, 0.02),
        ("dEOK >= 0.05", deok, 0.05),
        ("dEOK >= 0.10", deok, 0.10),
        ("dE00 >= 2 (CSS Color 4 JND)", lambda a, b: de2000(lab(a), lab(b)), 2),
        ("dE00 >= 5", lambda a, b: de2000(lab(a), lab(b)), 5),
        ("dE00 >= 10", lambda a, b: de2000(lab(a), lab(b)), 10),
        ("APCA |Lc| >= 15 between neighbours", lambda a, b: abs(apca(a, b)), 15),
        ("WCAG >= 1.5 between neighbours", ratio, 1.5),
        ("WCAG >= 3 between neighbours", ratio, 3),
    ]:
        lv = ladder(m, t)
        print(
            f"- {name}: {len(lv) - 1} steps above ground; levels: "
            + ", ".join(f"`{h}`" for h in lv[1:])
        )
    for lo, label in [
        (75, "body text (|Lc|>=75)"),
        (60, "content text (|Lc|>=60)"),
        (45, "large text (|Lc|>=45)"),
    ]:
        p, h = first_pass(lambda a, b: abs(apca(a, b)), lo)
        span = deok("#ffffff", h)
        print(
            f"- Tints usable as {label}: `{h}`..`#ffffff`, dEOK span {span:.3f} = {span / 0.02:.1f} JND, "
            f"dE00 span {de2000(lab('#ffffff'), lab(h)):.1f}, Lc between ends {apca('#ffffff', h):.1f}, WCAG between ends {ratio('#ffffff', h):.2f}"
        )

    print("\n## G. Two adjacent chart marks (WCAG 1.4.11 3:1)")
    Yg, Yw = Y_wcag(g) + 0.05, 1.05
    print(
        f"- white:ground = {Yw / Yg:.3f}; best symmetric split sqrt = {math.sqrt(Yw / Yg):.3f}:1 (both mark-vs-ground and mark-vs-mark)"
    )
    p3, h3 = first_pass(ratio, 3)
    print(
        f"- darkest 3:1 tint `{h3}` vs white: {ratio('#ffffff', h3):.2f}:1 -> two marks both >=3:1 vs ground can only reach this vs each other"
    )
    print(
        f"- Y needed for a 2nd mark 3:1 above the 3:1 tint: {3 * (Y_wcag(h3) + 0.05) - 0.05:.3f} (max possible Y = 1.0)"
    )

    print("\n## H. Ground variants")
    var = {
        "#1b1bf2": "base",
        "#0000ff": "pure sRGB blue",
        "#2a2aff": "brighter",
        "#1717d9": "-10% RGB",
        "#1515c8": "user option",
        "#1212b0": "-27% RGB",
        "#10109a": "user option",
        "#0c0c80": "-47% RGB",
    }
    L0, C0, h0 = oklch(GROUND)
    for k in (0.85, 0.7, 0.5):
        a, b = C0 * k * math.cos(math.radians(h0)), C0 * k * math.sin(math.radians(h0))
        var[oklab_to_hex(L0, a, b)[0]] = f"same OKLab L, chroma x{k}"
    for dl in (-0.05, -0.10, -0.15):
        a, b = C0 * math.cos(math.radians(h0)), C0 * math.sin(math.radians(h0))
        hh, ing = oklab_to_hex(L0 + dl, a, b)
        var[hh] = f"OKLab L{dl:+.2f}, same chroma" + ("" if ing else " (clipped)")
    print(
        "| ground | note | OKLCH L | OKLCH C | hue | WCAG white | APCA white | Lc #e4e4ff | Lc #d0d2ff | Lc #b8baff | WCAG #b8baff | "
        "Lc75 tint (% white) | Lc60 tint | 4.5:1 tint | 3:1 tint | sqrt split | dEOK white-ground (JND) |"
    )
    print("|" + "---|" * 17)
    for gv, note in var.items():
        L, C, hue = oklch(gv)
        cells = [
            first_pass(lambda a, b: abs(apca(a, b)), 75, gv),
            first_pass(lambda a, b: abs(apca(a, b)), 60, gv),
            first_pass(ratio, 4.5, gv),
            first_pass(ratio, 3, gv),
        ]
        cs = [f"{p}% `{h}`" if h else "n/a" for p, h in cells]
        print(
            f"| `{gv}` | {note} | {L:.3f} | {C:.3f} | {hue:.1f} | {ratio('#ffffff', gv):.2f} | {apca('#ffffff', gv):.1f} | "
            f"{apca('#e4e4ff', gv):.1f} | {apca('#d0d2ff', gv):.1f} | {apca('#b8baff', gv):.1f} | {ratio('#b8baff', gv):.2f} | "
            + " | ".join(cs)
            + f" | {math.sqrt(ratio('#ffffff', gv)):.2f} | {deok('#ffffff', gv) / 0.02:.0f} |"
        )

    print("\n## I. Partial coverage / dither: white at coverage p over ground")
    print(
        "| coverage p | linear-light result | WCAG | Lc | gamma-sRGB result | WCAG | Lc |\n|---|---|---|---|---|---|---|"
    )
    for k in (1, 2, 4, 6, 8, 10, 12, 14, 15):
        p = k / 16
        hl, hs = mix_lin("#ffffff", g, p), mix("#ffffff", g, p)
        print(
            f"| {k}/16 | `{hl}` | {ratio(hl, g):.2f} | {apca(hl, g):.1f} | `{hs}` | {ratio(hs, g):.2f} | {apca(hs, g):.1f} |"
        )
    print(
        "\nAdjacent 4x4-Bayer levels (linear-light averages), dEOK between neighbours:"
    )
    lv = [mix_lin("#ffffff", g, k / 16) for k in range(17)]
    print(", ".join(f"{k}->{k + 1}: {deok(lv[k], lv[k + 1]):.3f}" for k in range(16)))
    lv2 = [mix_lin("#ffffff", g, k / 4) for k in range(5)]
    print(
        "2x2-Bayer (0,1/4,1/2,3/4,1): "
        + ", ".join(
            f"`{h}` (dEOK step {deok(lv2[i], lv2[i + 1]):.3f}, Lc vs ground {apca(lv2[i + 1], g):.1f})"
            for i, h in enumerate(lv2[1:])
        )
    )
    print(
        "\nWhite-dither over a tint band instead of ground: e.g. 50% white dither over #6e6ef8 -> "
        f"`{mix_lin('#ffffff', '#6e6ef8', 0.5)}`"
    )
