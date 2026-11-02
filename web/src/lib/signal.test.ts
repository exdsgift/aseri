import { describe, expect, it } from "vitest"

import { placed, screenAt, selection, signalLayout } from "./signal"

describe("selection", () => {
  it("frames the baseline small and the value as many times as wide as it is the baseline's", () => {
    const at = (value: number) => selection(value, 100, 100)!
    expect(at(100)).toEqual({
      baseline: { width: 100, height: 130 },
      value: { width: 100, height: 130 },
    })
    expect(at(181).value).toEqual({
      width: expect.closeTo(181),
      height: expect.closeTo(235.3),
    })
    expect(at(300).value).toEqual({ width: 300, height: 390 })
    // The baseline's frame stays put whatever the value.
    expect(at(300).baseline).toEqual(at(100).baseline)
  })

  it("stops at 4 times the baseline, as Mercury's fans do, and never turns inside out", () => {
    expect(selection(1000, 100, 50)!.value.width).toBe(200)
    expect(selection(-40, 100, 50)!.value.width).toBe(0)
  })

  it("draws no frame when today's value or its baseline is missing", () => {
    expect(selection(181, 0, 100)).toBeUndefined()
    expect(selection(Number.NaN, 100, 100)).toBeUndefined()
  })
})

describe("signalLayout", () => {
  it("stands Hercules beside the text on a wide screen, at the engraving's own size at most", () => {
    const layout = signalLayout(1440, 930, {
      left: 444,
      top: 224,
      right: 996,
      bottom: 870,
    })
    const { x, y, width, height } = layout.screen
    expect(width).toBe(360)
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x + width).toBeLessThanOrEqual(layout.calm.left)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y + height).toBeLessThanOrEqual(930)
    // The frames hold the middle of his back.
    expect(layout.back[0]).toBeGreaterThan(x + width / 3)
    expect(layout.back[0]).toBeLessThan(x + (2 * width) / 3)
    expect(layout.back[1]).toBeGreaterThan(y + height / 4)
  })

  it("shows only his torso in the band above the text on a phone, inside its width", () => {
    const layout = signalLayout(390, 1400, {
      left: 16,
      top: 224,
      right: 374,
      bottom: 1330,
    })
    const { x, y, width, height, rows } = layout.screen
    expect(rows).toBeLessThan(641)
    expect(y + height).toBeLessThanOrEqual(layout.calm.top)
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x + width).toBeLessThanOrEqual(390)
    expect(x + x + width).toBeCloseTo(390, -1)
    expect(layout.back[1]).toBeLessThan(y + height)
  })
})

describe("placed", () => {
  const hero = { width: 390, height: 1400 }
  // A phone: his torso in the band above the text.
  const layout = signalLayout(390, 1400, {
    left: 16,
    top: 224,
    right: 374,
    bottom: 1330,
  })

  it("centres a frame on his back while it fits", () => {
    const frame = placed(
      layout.back,
      selection(181, 100, layout.small)!.value,
      hero
    )
    expect(frame.left + frame.width / 2).toBeCloseTo(layout.back[0], 0)
    expect(frame.top + frame.height / 2).toBeCloseTo(layout.back[1], 0)
  })

  it("keeps the frame and the label above it inside the hero, however large the value", () => {
    for (const value of [300, 400, 1000]) {
      const size = selection(value, 100, layout.small)!.value
      const frame = placed(layout.back, size, hero)
      // The label's block, 12 px tall, sits 3 px above the frame.
      expect(frame.top - 15).toBeGreaterThanOrEqual(0)
      expect(frame.left).toBeGreaterThanOrEqual(0)
      expect(frame.left + frame.width).toBeLessThanOrEqual(hero.width)
      // Moved, never shrunk: the value stays as many times the baseline.
      expect(frame.width).toBe(Math.round(size.width))
    }
  })
})

describe("screenAt", () => {
  it("warms up through three noisy pictures, then flickers among three settled ones", () => {
    expect(
      [0, 599, 600, 1200, 1799].map((ms) => screenAt(ms, false).picture)
    ).toEqual([0, 0, 1, 2, 2])
    const settled = [1800, 2400, 3000, 3600].map(
      (ms) => screenAt(ms, false).picture
    )
    expect(new Set(settled).size).toBe(3)
    for (const picture of settled) expect(picture).toBeGreaterThanOrEqual(3)
  })

  it("changes the screen under twice a second, slips included, far from the 3 flashes WCAG allows", () => {
    const changes: number[] = []
    let last = ""
    for (let ms = 0; ms <= 60_000; ms += 10) {
      const now = JSON.stringify(screenAt(ms, false))
      if (now !== last) changes.push(ms)
      last = now
    }
    expect(changes.some((ms) => screenAt(ms, false).slip !== undefined)).toBe(
      true
    )
    for (let i = 2; i < changes.length; i++)
      expect(changes[i] - changes[i - 2]).toBeGreaterThan(1000)
  })

  it("holds one settled picture when still, with no slip", () => {
    expect(screenAt(Infinity, true)).toEqual({ picture: 3 })
  })
})
