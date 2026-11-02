import { describe, expect, it } from "vitest"

import { type Box } from "@/lib/art"
import { pixel } from "@/lib/chart"

import { clearance, inked, scene, widest, type Scene } from "./margins"

// A page whose hero lies far above the rows a test reads.
const open = (width: number, nav?: Box, drift = 0) =>
  scene(width, -Infinity, nav, drift)
// The inked art pixels of `s` in page rows `from` to `to`, as [column, row].
const inks = (s: Scene, from: number, to: number) => {
  const found: number[][] = []
  for (let y = from; y < to; y++)
    for (let x = 0; x < s.columns; x++) if (inked(x, y, s)) found.push([x, y])
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
    const s = scene(390, 900, undefined, 0, gaps)
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
      inks(scene(1440, -Infinity, undefined, 0, gaps), 780, 820)
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
    const flat = open(1920, undefined, -row / 36)
    for (const x of starts(flat, row, 1, flat.left)) expect(mod(x, 10)).toBe(0)
    // On a crest, it is pushed toward the page edge, by up to 8 art pixels at the edge.
    const crest = open(1920, undefined, Math.PI / 2 - row / 36)
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
    const at = (drift: number) => inks(open(1440, undefined, drift), 0, 60)
    expect(at(0)).toEqual(at(0))
    expect(at(0.5)).not.toEqual(at(0))
  })

  it("start below the hero, from nothing", () => {
    // The hero's foot 1000 px down the page.
    const s = scene(1440, 1000)
    const found = inks(s, 0, 1000 / pixel + 2 * s.margin)
    for (const [, y] of found) expect(y * pixel).toBeGreaterThanOrEqual(1000)
    const lit = (from: number) =>
      found.filter(([, y]) => y >= from && y < from + 10).length
    expect(lit(1000 / pixel)).toBeLessThan(lit(1000 / pixel + s.margin))
  })

  it("keep 24 px clear of the side navigation", () => {
    // The navigation at 1440 px, its right edge 24 px in from the page's.
    const nav = { left: 1306, top: 352, right: 1416, bottom: 548 }
    const found = inks(open(1440, nav), 0, 450)
    for (const [x, y] of found) {
      const dx = Math.max(nav.left - (x + 1) * pixel, 0, x * pixel - nav.right)
      const dy = Math.max(nav.top - (y + 1) * pixel, 0, y * pixel - nav.bottom)
      expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(clearance)
    }
    // Still drawn above and below it, at the page edge.
    const beside = (row: (y: number) => boolean) =>
      found.some(([x, y]) => x * pixel > nav.left && row(y * pixel))
    expect(beside((y) => y < 150)).toBe(true)
    expect(beside((y) => y > 750)).toBe(true)
  })
})
