"""Contrast, APCA, OKLCH, Machado-2009 CVD and dither-blend numbers for chart accents on #1b1bf2."""

import math
import numpy as np

GROUND = "#1b1bf2"
WHITE = "#ffffff"

# Machado et al. 2009, severity 1.0, from the authors' project page (applied in linear RGB here).
MACHADO = {
    "prot": np.array(
        [
            [0.152286, 1.052583, -0.204868],
            [0.114503, 0.786281, 0.099216],
            [-0.003882, -0.048116, 1.051998],
        ]
    ),
    "deut": np.array(
        [
            [0.367322, 0.860646, -0.227968],
            [0.280085, 0.672501, 0.047413],
            [-0.011820, 0.042940, 0.968881],
        ]
    ),
    "trit": np.array(
        [
            [1.255528, -0.076749, -0.178779],
            [-0.078411, 0.930809, 0.147602],
            [0.004733, 0.691367, 0.303900],
        ]
    ),
}


def hex2rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)])


def rgb2hex(c):
    c = np.clip(c, 0, 1)
    return "#" + "".join(f"{round(v * 255):02x}" for v in c)


def lin(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def delin(c):
    c = np.clip(np.asarray(c, float), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def wcag_lum(h):
    return float(np.dot([0.2126, 0.7152, 0.0722], lin(hex2rgb(h))))


def wcag(a, b):
    la, lb = sorted([wcag_lum(a), wcag_lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


def apca(txt, bg):
    """APCA-W3 0.0.98G-4g, returns signed Lc (negative = light text on dark bg)."""

    def y(h):
        r, g, b = hex2rgb(h)
        Y = 0.2126729 * r**2.4 + 0.7151522 * g**2.4 + 0.0721750 * b**2.4
        return Y + (0.022 - Y) ** 1.414 if Y < 0.022 else Y

    yt, yb = y(txt), y(bg)
    if abs(yb - yt) < 0.0005:
        return 0.0
    if yb > yt:
        s = (yb**0.56 - yt**0.57) * 1.14
        return 0.0 if s < 0.1 else (s - 0.027) * 100
    s = (yb**0.65 - yt**0.62) * 1.14
    return 0.0 if s > -0.1 else (s + 0.027) * 100


M1 = np.array(
    [
        [0.4122214708, 0.5363325363, 0.0514459929],
        [0.2119034982, 0.6806995451, 0.1073969566],
        [0.0883024619, 0.2817188376, 0.6299787005],
    ]
)
M2 = np.array(
    [
        [0.2104542553, 0.7936177850, -0.0040720468],
        [1.9779984951, -2.4285922050, 0.4505937099],
        [0.0259040371, 0.7827717662, -0.8086757660],
    ]
)


def oklab(h):
    return M2 @ np.cbrt(M1 @ lin(hex2rgb(h)))


def oklch(h):
    L, a, b = oklab(h)
    return L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360


def oklch2hex(L, C, H):
    a, b = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    lms = np.linalg.solve(M2, [L, a, b]) ** 3
    rgb = np.linalg.solve(M1, lms)
    return rgb2hex(delin(rgb)), bool(np.all(rgb >= -1e-4) and np.all(rgb <= 1 + 1e-4))


def max_chroma(L, H):
    lo, hi = 0.0, 0.4
    for _ in range(40):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if oklch2hex(L, mid, H)[1] else (lo, mid)
    return lo


def dE(a, b):
    return float(np.linalg.norm(oklab(a) - oklab(b)) * 100)  # deltaE_OK x100


def cvd(h, kind):
    return rgb2hex(delin(np.clip(MACHADO[kind] @ lin(hex2rgb(h)), 0, 1)))


def blend(fg, bg, frac):
    """Perceived colour of an ordered dither with `frac` of pixels fg: pixels average in linear light."""
    return rgb2hex(delin(frac * lin(hex2rgb(fg)) + (1 - frac) * lin(hex2rgb(bg))))


# Self-checks against published values.
assert abs(wcag("#000000", "#ffffff") - 21) < 1e-9
assert abs(apca("#888888", "#ffffff") - 63.06) < 0.1, apca(
    "#888888", "#ffffff"
)  # APCA reference value
assert abs(apca("#ffffff", "#888888") + 68.54) < 0.1, apca("#ffffff", "#888888")
assert (
    cvd("#ffffff", "deut") == "#ffffff" or dE(cvd("#ffffff", "deut"), "#ffffff") < 1.5
)
L0, C0, H0 = oklch(GROUND)
assert oklch2hex(L0, C0, H0)[0] == GROUND

CANDS = [
    # name, hex, source tag
    ("White", "#ffffff", "base"),
    ("Pale blue tint", "#c8c8ff", "constructed"),
    ("Periwinkle", "#9a9aff", "constructed"),
    ("Riso Yellow", "#ffe800", "Riso"),
    ("Riso Fluor. Yellow", "#ffe900", "Riso"),
    ("PICO-8 yellow", "#ffec27", "PICO-8"),
    ("Endesga 32 yellow", "#fee761", "Endesga 32"),
    ("Riso Sunflower", "#ffb511", "Riso"),
    ("Endesga 32 amber", "#feae34", "Endesga 32"),
    ("PICO-8 orange", "#ffa300", "PICO-8"),
    ("Riso Orange", "#ff6c2f", "Riso"),
    ("Endesga 32 orange", "#f77622", "Endesga 32"),
    ("PICO-8 red", "#ff004d", "PICO-8"),
    ("Riso Fluor. Pink", "#ff48b0", "Riso"),
    ("PICO-8 pink", "#ff77a8", "PICO-8"),
    ("Riso Bubble-gum", "#f984ca", "Riso"),
    ("Endesga 32 cyan", "#2ce8f5", "Endesga 32"),
    ("Riso Aqua", "#5ec8e5", "Riso"),
    ("Riso Mint", "#82d8d5", "Riso"),
    ("PICO-8 blue", "#29adff", "PICO-8"),
    ("PICO-8 green", "#00e436", "PICO-8"),
    ("Riso Fluor. Green", "#44d62c", "Riso"),
    ("Endesga 32 green", "#63c74d", "Endesga 32"),
    ("Riso Light Lime", "#e3ed55", "Riso"),
]

# OKLCH-constructed accents: complement (H0+180) and analogous cyan, pastel-ish lightness.
comp_h = (H0 + 180) % 360
built = []
for name, L, H in [
    ("OKLCH complement yellow", 0.93, comp_h),
    ("OKLCH complement gold", 0.86, comp_h - 15),
    ("OKLCH analogous cyan", 0.88, 205),
    ("OKLCH analogous mint", 0.90, 175),
    ("OKLCH pink (H0+90)", 0.80, (H0 + 90) % 360),
]:
    C = round(
        max_chroma(L, H) * 0.92, 3
    )  # 92 % of max chroma: stays in sRGB, avoids "pure" neon
    built.append((name, oklch2hex(L, C, H)[0], f"oklch({L} {C} {H:.0f})"))
CANDS += built

print(
    f"Ground {GROUND}: OKLCH L={L0:.3f} C={C0:.3f} H={H0:.1f}; WCAG lum={wcag_lum(GROUND):.4f}"
)
print(f"Complement hue (H0+180) = {comp_h:.1f}")
print()
hdr = "| Name | Hex | Src | OKLCH L/C/H | WCAG vs ground | APCA Lc on ground | WCAG vs white | dE_OK vs white | Prot sim | Deut sim | Trit sim | min dE vs white (N/P/D/T) | min WCAG vs ground under CVD |"
print(hdr)
print(
    "|" + "---|" * hdr.count("|")[:-1] if False else "|" + "---|" * (hdr.count("|") - 1)
)
for name, h, src in CANDS:
    L, C, H = oklch(h)
    sims = {k: cvd(h, k) for k in MACHADO}
    wsims = {k: cvd(WHITE, k) for k in MACHADO}
    gsims = {k: cvd(GROUND, k) for k in MACHADO}
    dEs = [dE(h, WHITE)] + [dE(sims[k], wsims[k]) for k in MACHADO]
    gw = [wcag(sims[k], gsims[k]) for k in MACHADO]
    print(
        f"| {name} | `{h}` | {src} | {L:.2f} / {C:.3f} / {H:.0f} | {wcag(h, GROUND):.2f} | {apca(h, GROUND):.1f} | "
        f"{wcag(h, WHITE):.2f} | {dEs[0]:.1f} | `{sims['prot']}` | `{sims['deut']}` | `{sims['trit']}` | "
        f"{'/'.join(f'{d:.0f}' for d in dEs)} (min {min(dEs):.0f}) | {min(gw):.2f} |"
    )

print()
print("CVD view of the ground and white:")
for k in MACHADO:
    print(f"  {k}: ground -> {cvd(GROUND, k)}, white -> {cvd(WHITE, k)}")

print()
print(
    "Dithered bands: perceived colour of Bayer densities over the ground, and how a line reads on top."
)
for fg in ["#ffffff", "#c8c8ff", "#9a9aff", "#ffe800", "#2ce8f5", "#ff48b0"]:
    for frac in (0.125, 0.25, 0.5):
        m = blend(fg, GROUND, frac)
        print(
            f"  {fg} @ {frac:>5}: mix {m}  WCAG vs ground {wcag(m, GROUND):.2f}  Lc {apca(m, GROUND):6.1f}"
            f" | white line on band WCAG {wcag(WHITE, m):.2f} | yellow #ffe800 on band {wcag('#ffe800', m):.2f}"
            f" | cyan #2ce8f5 on band {wcag('#2ce8f5', m):.2f}"
        )

print()
print("Grid candidates (should be faint):")
for g in ["#3a3af4", "#4b4bf5", "#5c5cf7", "#6e6ef8"]:
    print(
        f"  {g}: WCAG vs ground {wcag(g, GROUND):.2f}, Lc {apca(g, GROUND):.1f}, dE {dE(g, GROUND):.1f}"
    )

print()
print("Pairwise accent separation (dE_OK, normal and min over P/D/T):")
pairs = [
    ("#ffe800", "#2ce8f5"),
    ("#ffe800", "#ff48b0"),
    ("#2ce8f5", "#ff48b0"),
    ("#ffe800", "#9a9aff"),
    ("#2ce8f5", "#9a9aff"),
    ("#ff48b0", "#9a9aff"),
    ("#feae34", "#9a9aff"),
    ("#ffe800", "#c8c8ff"),
    ("#2ce8f5", "#c8c8ff"),
    ("#ff48b0", "#c8c8ff"),
    ("#82d8d5", "#9a9aff"),
    ("#ffe800", "#82d8d5"),
]
for a, b in pairs:
    n = dE(a, b)
    m = min(dE(cvd(a, k), cvd(b, k)) for k in MACHADO)
    worst = min(MACHADO, key=lambda k: dE(cvd(a, k), cvd(b, k)))
    print(
        f"  {a} vs {b}: normal {n:.1f}, min CVD {m:.1f} ({worst}), WCAG between {wcag(a, b):.2f}"
    )
