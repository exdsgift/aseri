import { describe, expect, it } from "vitest"

import { paintSun, stillSun, sunFrame, sunRadius, tick } from "./sun"

describe("sunRadius", () => {
  it("draws the prototype's sun: 6 art pixels, and 3 more for each multiple of the baseline", () => {
    expect(sunRadius(181, 100)).toBe(11)
    expect(sunRadius(100, 100)).toBe(9)
  })

  it("stops growing at three times the baseline", () => {
    expect(sunRadius(300, 100)).toBe(15)
    expect(sunRadius(1000, 100)).toBe(15)
  })

  it("draws no sun when today's value or its baseline is missing", () => {
    expect(sunRadius(181, 0)).toBeUndefined()
    expect(sunRadius(Number.NaN, 100)).toBeUndefined()
    expect(sunRadius(181, undefined as never)).toBeUndefined()
  })
})

describe("sunFrame", () => {
  const at = (ms: number) => sunFrame(Math.floor(ms / tick))

  it("cycles the glow through 6 densities about every 2.6 s", () => {
    const cycle = Array.from(
      { length: 2600 / tick },
      (_, k) => sunFrame(k).glow
    )
    expect(new Set(cycle).size).toBe(6)
    expect(at(2600 + 3 * tick).glow).toBe(cycle[3])
  })

  it("turns the halo", () => {
    expect(at(1000).angle).toBeGreaterThan(at(0).angle)
  })
})

describe("paintSun", () => {
  const colors = { sun: "sun", halo: "halo", star: "star", faint: "faint" }
  // What the reader sees on art 80 pixels wide: the last colour painted on each pixel.
  function paint(radius: number | undefined, frame = stillSun) {
    const seen = new Map<string, string>()
    const plots: string[] = []
    paintSun(
      (x, y, color) => {
        seen.set(`${x},${y}`, color)
        plots.push(color)
      },
      80,
      radius,
      frame,
      colors
    )
    const at = (color: string) =>
      [...seen].filter(([, c]) => c === color).map(([xy]) => xy.split(","))
    return { at, plots }
  }
  const noGlow = { glow: 0, angle: 0 }

  it("centres a solid sun of the radius on (40, 34) of art 80 wide", () => {
    const sun = paint(11, noGlow).at("sun")
    const xs = sun.map(([x]) => Number(x))
    const ys = sun.map(([, y]) => Number(y))
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([29, 50])
    expect([Math.min(...ys), Math.max(...ys)]).toEqual([23, 44])
  })

  it("dashes the halo at radius 26, about half of the ring, and turns it", () => {
    const halo = (angle: number) =>
      paint(11, { glow: 0, angle })
        .at("halo")
        .map((xy) => xy.join())
    const ring = halo(0).length + halo(Math.PI / 10).length
    expect(halo(0).length / ring).toBeCloseTo(0.5, 1)
    for (const xy of halo(0)) {
      const [x, y] = xy.split(",").map(Number)
      expect(
        Math.abs(Math.hypot(x + 0.5 - 40, y + 0.5 - 34) - 26)
      ).toBeLessThan(0.6)
    }
    expect(halo(Math.PI / 36)).not.toEqual(halo(0))
  })

  it("draws only the stars before the data, all 20 lit at rest and fewer on a tick", () => {
    const { plots } = paint(undefined)
    expect(new Set(plots)).toEqual(new Set(["star", "faint"]))
    expect(plots).toHaveLength(20)
    expect(paint(undefined, sunFrame(0)).plots.length).toBeLessThan(20)
  })
})
