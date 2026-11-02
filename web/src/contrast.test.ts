import { describe, expect, it } from "vitest"

import { bayer, chartTokens } from "@/lib/chart"

import sideNav from "./components/SideNav.tsx?raw"
import css from "./index.css?raw"

// The page's colours as index.css ships them, so the test reads the real tokens. The checks
// follow the colour study, docs/research/reports/Bianchi su blu elettrico.md.
const tokens: Record<string, string> = Object.fromEntries(
  [
    ...css
      .match(/:root\s*{([^}]*)}/)![1]
      .matchAll(/(--[\w-]+):\s*(#[\da-f]{6})\b/gi),
  ].map(([, name, hex]) => [name, hex.toLowerCase()])
)

// A colour's 8-bit channels, and the same in linear light.
const channels = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const linear = (rgb: number[]) =>
  rgb.map((channel) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
// WCAG 2's relative luminance of a colour in linear light, then the contrast ratio.
const luminance = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const linearRatio = (a: number[], b: number[]) => {
  const [high, low] = [a, b].map(luminance).toSorted((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}
const ratio = (a: number[], b: number[]) => linearRatio(linear(a), linear(b))
const hex = (name: string) => {
  if (!tokens[name])
    throw new Error(`${name} is not a 6-digit hex in index.css's :root`)
  return tokens[name]
}
const contrast = (a: string, b: string) =>
  ratio(channels(hex(a)), channels(hex(b)))
// A colour drawn at `opacity` over a surface, as the browser blends it.
const over = (color: string, surface: string, opacity: number) => {
  const [top, under] = [color, surface].map((name) => channels(hex(name)))
  return top.map((c, i) => Math.round(opacity * c + (1 - opacity) * under[i]))
}
const on = (colors: string[], surfaces: string[]) =>
  surfaces.flatMap((surface) => colors.map((color) => [color, surface]))

// APCA-W3 0.0.98G-4g (Myndex apca-w3.js), as a magnitude: light text on a dark ground gives
// a negative Lc.
const apcaY = (rgb: number[]) => {
  const [r, g, b] = rgb.map((c) => (c / 255) ** 2.4)
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  return y > 0.022 ? y : y + (0.022 - y) ** 1.414
}
const apca = (text: string, ground: string) => {
  const [t, b] = [text, ground].map((name) => apcaY(channels(hex(name))))
  if (Math.abs(b - t) < 0.0005) return 0
  const s =
    b > t ? (b ** 0.56 - t ** 0.57) * 1.14 : (b ** 0.65 - t ** 0.62) * 1.14
  if (Math.abs(s) < 0.1) return 0
  return Math.abs(s > 0 ? s - 0.027 : s + 0.027) * 100
}

// Ottosson's OKLab from linear light, and the distance between two colours in it, where
// 0.02 is one just-noticeable difference.
const oklab = ([r, g, b]: number[]) => {
  const [l, m, s] = [
    0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  ].map(Math.cbrt)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
const distance = (a: number[], b: number[]) =>
  Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]))

// Machado, Oliveira and Fernandes (2009) at severity 1.0, applied in linear light.
const dichromacies = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
}
const seen = (name: string, matrix: number[][]) => {
  const rgb = linear(channels(hex(name)))
  return matrix.map((row) =>
    Math.min(
      1,
      Math.max(
        0,
        row.reduce((sum, k, i) => sum + k * rgb[i], 0)
      )
    )
  )
}

const surfaces = ["--background", "--muted", "--accent"]

describe("text", () => {
  // Each text colour on each surface it is drawn on.
  it.each([
    // The page, the panel, the hero and the chart's labels.
    ...on(
      [
        "--foreground",
        "--muted-foreground",
        "--primary",
        "--secondary",
        "--destructive",
        "--white",
      ],
      ["--background"]
    ),
    // An interval row, and the record's backtest.
    ...on(
      ["--foreground", "--muted-foreground", "--primary", "--secondary"],
      ["--muted"]
    ),
    // A picked card.
    ...on(
      [
        "--foreground",
        "--muted-foreground",
        "--primary",
        "--secondary",
        "--destructive",
      ],
      ["--accent"]
    ),
    // Back to today, the panel's controls and the choice of hero, and a hovered one.
    ["--background", "--secondary"],
    ["--background", "--white"],
  ])("%s on %s reads at 4.5:1", (color, surface) => {
    expect(contrast(color, surface)).toBeGreaterThanOrEqual(4.5)
  })

  // APCA beside WCAG: Lc 90 for the white, 70 for the second tint, 60 for the gold, which
  // marks and never writes, and 45 for the dim, a 2 px line's floor.
  it.each(
    [
      ["--primary", 90],
      ["--foreground", 90],
      ["--secondary", 70],
      ["--muted-foreground", 70],
      ["--forecast", 60],
      ["--dim", 45],
    ].flatMap(([color, floor]) =>
      surfaces.map((surface) => [color, surface, floor])
    )
  )("%s on %s reaches APCA Lc %s", (color, surface, floor) => {
    expect(apca(color as string, surface as string)).toBeGreaterThanOrEqual(
      floor as number
    )
  })

  // Two text whites, never more: the second must still read apart from the first, and the
  // marks' tint apart from the second.
  it("keeps the text levels apart: Lc 15 and 5 just-noticeable differences", () => {
    expect(apca("--primary", "--secondary")).toBeGreaterThanOrEqual(15)
    expect(
      distance(
        ...(["--primary", "--secondary"].map((n) =>
          linear(channels(hex(n)))
        ) as [number[], number[]])
      )
    ).toBeGreaterThanOrEqual(0.1)
    expect(apca("--secondary", "--dim")).toBeGreaterThanOrEqual(15)
  })

  // An inactive link of the side navigation is dimmed, its label as far as it still reads
  // on the ground, and no further: a whole percent less would not.
  it("dims the side navigation's inactive labels to the lowest opacity that reads at 4.5:1", () => {
    // The bare utility, not a hover:, focus-visible: or aria-[...]: variant of it.
    const [, percent] = sideNav.match(/(?<![\w:-])opacity-(\d+)\b/)!
    const label = (opacity: number) =>
      ratio(
        over("--secondary", "--background", opacity / 100),
        channels(hex("--background"))
      )
    expect(label(Number(percent))).toBeGreaterThanOrEqual(4.5)
    expect(label(Number(percent) - 1)).toBeLessThan(4.5)
  })
})

// A retro game's shadow, for a touch more contrast on the blue: it replaces none of the
// checks above, and no outline is drawn round the letters.
it("gives every word a crisp black shadow, 1 px down and right", () => {
  expect(css).toMatch(/--drop:\s*1px 1px 0 #000000;/)
  expect(css).toMatch(/\*\s*\{[^}]*text-shadow:\s*var\(--drop\);/)
  expect(css).not.toMatch(/text-stroke/)
})

describe("marks", () => {
  // The frame's hatch and grid lines say nothing the text does not: the forecast zone's
  // name and the value ticks. WCAG 1.4.11 asks 3:1 only of marks that carry meaning.
  const chart = Object.entries(chartTokens)
    .filter(([mark]) => mark !== "frame")
    .map(([, token]) => token)

  it.each([
    // The panel's chart, and a card's chart once the card is picked.
    ...on(chart, ["--background", "--accent"]),
    // The interval lanes on their rows: the bands, the most likely value, the baseline and
    // the day the forecast was made, that day's value and what happened. The record's
    // squares, filled or hollow, on a card and in its backtest.
    ...on(
      ["--dim", "--forecast", "--secondary", "--primary", "--white"],
      ["--muted"]
    ),
  ])("%s on %s stands out at 3:1", (mark, surface) => {
    expect(contrast(mark, surface)).toBeGreaterThanOrEqual(3)
  })

  // The bands' inner half lights 8 of the 16 dither cells, which the eye averages in
  // linear light.
  it("keeps what happened at 3:1 over the 5-in-10 band's dither", () => {
    const share = bayer.filter((threshold) => threshold < 8).length / 16
    const [dim, ground] = ["--dim", "--background"].map((n) =>
      linear(channels(hex(n)))
    )
    const band = dim.map((c, i) => share * c + (1 - share) * ground[i])
    expect(linearRatio(linear(channels(hex("--white"))), band)).toBeGreaterThan(
      3
    )
  })

  // The model's gold and the real values' white, as each dichromacy sees them: still apart
  // from each other, and both still standing out from the ground.
  it.each(Object.keys(dichromacies))(
    "keeps the gold path apart from the white real values under simulated %s",
    (kind) => {
      const matrix = dichromacies[kind as keyof typeof dichromacies]
      const [gold, white, ground] = [
        "--forecast",
        "--white",
        "--background",
      ].map((name) => seen(name, matrix))
      expect(distance(gold, white)).toBeGreaterThanOrEqual(0.15)
      expect(linearRatio(gold, ground)).toBeGreaterThanOrEqual(3)
      expect(linearRatio(white, ground)).toBeGreaterThanOrEqual(3)
    }
  )

  // No check between marks that meet: they differ by shade, and a state never rests on it
  // alone (#148): the record's squares are filled or hollow, a caution has its marker.
})

// Off the line from the blue to white, only the one accent, the model's gold.
it("keeps to the blue ground, whites on the line to white, and the one gold accent", () => {
  const accents = [hex("--forecast")]
  expect(accents).toEqual(["#ffc94a"])
  for (const [name, value] of Object.entries(tokens)) {
    if (accents.includes(value)) continue
    const [r, g, b] = channels(value)
    expect(Math.abs(r - g), name).toBeLessThanOrEqual(1)
    expect(b, name).toBeGreaterThanOrEqual(r)
  }
})
