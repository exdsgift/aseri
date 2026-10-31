import { describe, expect, it } from "vitest"

import { chartTokens } from "@/lib/chart"

import css from "./index.css?raw"

// The page's colours as index.css ships them, so the test reads the real tokens.
const tokens: Record<string, string> = Object.fromEntries(
  [
    ...css
      .match(/:root\s*{([^}]*)}/)![1]
      .matchAll(/(--[\w-]+):\s*(#[\da-f]{6})\b/gi),
  ].map(([, name, hex]) => [name, hex])
)

// WCAG 2's relative luminance, then the contrast ratio of two tokens.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const hex = (name: string) => {
  if (!tokens[name])
    throw new Error(`${name} is not a 6-digit hex in index.css's :root`)
  return tokens[name]
}
const contrast = (a: string, b: string) => {
  const [high, low] = [hex(a), hex(b)].map(luminance).toSorted((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}
const on = (colors: string[], surfaces: string[]) =>
  surfaces.flatMap((surface) => colors.map((color) => [color, surface]))

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
    // Back to today, and the panel's controls.
    ["--background", "--secondary"],
  ])("%s on %s reads at 4.5:1", (color, surface) => {
    expect(contrast(color, surface)).toBeGreaterThanOrEqual(4.5)
  })
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
      ["--dim", "--muted-foreground", "--secondary", "--primary", "--white"],
      ["--muted"]
    ),
  ])("%s on %s stands out at 3:1", (mark, surface) => {
    expect(contrast(mark, surface)).toBeGreaterThanOrEqual(3)
  })

  // No check between marks that meet: they differ by shade, and a state never rests on it
  // alone (#148): the record's squares are filled or hollow, a caution has its marker.
})

it("leaves no gold and no navy: every token is a grey", () => {
  for (const [name, value] of Object.entries(tokens)) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16))
    // A warm paper white at most: 16 levels between the channels.
    expect(Math.max(r, g, b) - Math.min(r, g, b), name).toBeLessThanOrEqual(16)
  }
})
