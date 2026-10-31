import { describe, expect, it } from "vitest"

import { screenAt, selection, signalLayout } from "./signal"

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

describe("screenAt", () => {
  it("warms up through three noisy pictures, then flickers among three settled ones, a new one each tick", () => {
    expect([0, 299, 300, 600, 899].map((ms) => screenAt(ms, false))).toEqual([
      0, 0, 1, 2, 2,
    ])
    const settled = [900, 1100, 1300, 1500].map((ms) => screenAt(ms, false))
    expect(new Set(settled).size).toBe(3)
    for (const picture of settled) expect(picture).toBeGreaterThanOrEqual(3)
  })

  it("holds one settled picture when still", () => {
    expect(screenAt(Infinity, true)).toBe(3)
  })
})
