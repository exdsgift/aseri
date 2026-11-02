import { describe, expect, it } from "vitest"

import { pixel } from "@/lib/chart"

import { scene, stripes, type Scene } from "./margins"

// The widest column, 1008 px, and the 24 px calm gap beside it (spec 6.9).
const [widest, clearance] = [1008, 24]
// A page whose hero lies far above the rows a test reads.
const open = (width: number, drift = 0) => scene(width, -Infinity, drift)
const inked = (x: number, y: number, s: Scene) => stripes(y, s)(x)
// The inked art pixels of `s` in page rows `from` to `to`, as [column, row].
const inks = (s: Scene, from: number, to: number) => {
  const found: number[][] = []
  for (let y = from; y < to; y++) {
    const row = stripes(y, s)
    for (let x = 0; x < s.columns; x++) if (row(x)) found.push([x, y])
  }
  return found
}
// Where each run of ink starts in row `y`, from column `from` to column `to`.
const starts = (s: Scene, y: number, from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => from + i).filter(
    (x) => inked(x, y, s) && !inked(x - 1, y, s)
  )
const mod = (a: number, n: number) => ((a % n) + n) % n
// One wave of the current: 36 rows a radian.
const wave = Math.ceil(2 * Math.PI * 36)

describe("the op-art margins", () => {
  it.each([1100, 1280, 1344, 1440, 1920, 2560])(
    "keep 24 px clear of the widest column at %i px, and fill both margins",
    (width) => {
      const found = inks(open(width), 0, wave)
      const [left, right] = [
        (width - widest) / 2 - clearance,
        (width + widest) / 2 + clearance,
      ]
      // The whole art pixel, both its CSS pixels, lies outside the calm gap.
      for (const [x] of found)
        expect((x + 1) * pixel <= left || x * pixel >= right).toBe(true)
      expect(found.some(([x]) => x * pixel < left)).toBe(true)
      expect(found.some(([x]) => x * pixel >= right)).toBe(true)
    }
  )

  it("fill the 16 px gutters on a phone, and nothing past the screen", () => {
    const s = open(390)
    const found = inks(s, 0, wave)
    for (const [x] of found)
      expect((x + 1) * pixel <= 16 || x * pixel >= 390 - 16).toBe(true)
    expect(found.some(([x]) => x * pixel < 16)).toBe(true)
    expect(found.some(([x]) => x * pixel >= 390 - 16)).toBe(true)
    expect(s.columns * pixel).toBeLessThan(390 + pixel)
  })

  it("reach into the gaps between sections on a phone, a gutter clear of them", () => {
    // The hero's foot at 900 px, then a gap from 1560 to 1640 px and another from 3720.
    const gaps = [
      [900, 900],
      [1560, 1640],
      [3720, 3800],
    ]
    const s = scene(390, 900, 0, gaps)
    const found = inks(s, 0, 4000 / pixel)
    const within = (x: number) => (x + 1) * pixel <= 16 || x * pixel >= 374
    const reached = found.filter(([x]) => !within(x))
    // Only in the gaps, 16 px from the sections, and a quarter of the screen in at most.
    for (const [x, y] of reached) {
      expect(
        gaps.some(
          ([from, to]) => y * pixel >= from + 16 && (y + 1) * pixel <= to - 16
        )
      ).toBe(true)
      expect(Math.min(x * pixel, 390 - (x + 1) * pixel)).toBeLessThan(
        16 + 390 / 4
      )
    }
    expect(reached.some(([, y]) => y * pixel < 1640)).toBe(true)
    expect(reached.some(([, y]) => y * pixel > 3720)).toBe(true)
    // A desktop keeps its margins: the gaps beside the column stay calm.
    expect(inks(open(1440), 780, 820)).toEqual(
      inks(scene(1440, -Infinity, 0, gaps), 780, 820)
    )
  })

  it("leave a margin narrower than the gap empty", () => {
    expect(inks(open(800), 0, wave)).toEqual([])
    expect(inks(open(widest + 2 * clearance), 0, wave)).toEqual([])
  })

  it("thin out to nothing toward the column", () => {
    const s = open(1920)
    // The share of each band of 12 columns inked over one wave, from the page edge in.
    const shares = Array.from(
      { length: Math.floor(s.left / 12) },
      (_, band) => {
        let lit = 0
        for (let y = 0; y < wave; y++)
          for (let x = 12 * band; x < 12 * band + 12; x++)
            if (inked(x, y, s)) lit++
        return lit / (12 * wave)
      }
    )
    expect(shares[0]).toBeGreaterThan(0.45)
    expect(shares.at(-1)).toBeLessThan(0.05)
    for (let i = 1; i < shares.length; i++)
      expect(shares[i]).toBeLessThanOrEqual(shares[i - 1] + 0.02)
  })

  it("bend the stripes more the nearer the page edge", () => {
    // Where the wave crosses 0, a stripe is straight: it starts on a multiple of 10 columns.
    const row = 400
    const flat = open(1920, -row / 36)
    for (const x of starts(flat, row, 1, flat.left)) expect(mod(x, 10)).toBe(0)
    // On a crest, it is pushed toward the page edge, by up to 8 art pixels at the edge.
    const crest = open(1920, Math.PI / 2 - row / 36)
    const shift = (x: number) => mod(-x, 10)
    const runs = starts(crest, row, 1, crest.left)
    const outer = runs.filter((x) => x < 40)
    const inner = runs.filter((x) => x > crest.left - 60)
    expect(outer.length).toBeGreaterThan(0)
    expect(inner.length).toBeGreaterThan(0)
    for (const x of outer) expect(shift(x)).toBeGreaterThanOrEqual(6)
    for (const x of inner) expect(shift(x)).toBeLessThanOrEqual(3)
  })

  it("drift: the bends travel as time goes on", () => {
    const at = (drift: number) => inks(open(1440, drift), 0, 60)
    expect(at(0)).toEqual(at(0))
    expect(at(0.5)).not.toEqual(at(0))
  })

  // What lets a frame move the picture it has instead of working it all out again.
  it("drift: each 36th of a radian moves the stripes up one whole row", () => {
    for (const width of [390, 1440]) {
      const still = inks(open(width), 3, 3 + wave)
      const moved = inks(open(width, 3 / 36), 0, wave)
      expect(moved).toEqual(still.map(([x, y]) => [x, y - 3]))
    }
  })

  it("start below the hero, from nothing", () => {
    // The hero's foot 1000 px down the page.
    const s = scene(1440, 1000)
    const found = inks(s, 0, 1000 / pixel + 2 * s.margin)
    for (const [, y] of found) expect(y * pixel).toBeGreaterThanOrEqual(1000)
    const lit = (from: number) =>
      found.filter(([, y]) => y >= from && y < from + 10).length
    expect(lit(1000 / pixel)).toBeLessThan(lit(1000 / pixel + s.margin))
    // However wide the screen, they are whole 192 px under the foot.
    const below = 1000 / pixel + 96
    expect(inks(scene(2560, 1000), below, below + wave)).toEqual(
      inks(open(2560), below, below + wave)
    )
    expect(inks(scene(2560, 1000), below - 4, below)).not.toEqual(
      inks(open(2560), below - 4, below)
    )
  })
})
