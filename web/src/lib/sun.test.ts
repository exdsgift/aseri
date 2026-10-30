import { describe, expect, it } from "vitest"

import { paintSun, sunFrame, sunRadius, tick } from "./sun"

describe("sunRadius", () => {
  const area = (value: number) => sunRadius(value, 100) ** 2

  it("gives the sun an area in proportion to today's value over its baseline", () => {
    expect(area(181) / area(100)).toBeCloseTo(1.81)
    expect(area(50) / area(100)).toBeCloseTo(0.5)
  })

  it("keeps the sun between a quarter and four times the baseline's area", () => {
    expect(area(1000) / area(100)).toBeCloseTo(4)
    expect(area(10) / area(100)).toBeCloseTo(0.25)
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

  it("pulses the sun from 1 to 1.04 times its size over 3.2 s, and back", () => {
    expect(at(0).scale).toBe(1)
    expect(at(3200).scale).toBeCloseTo(1.04, 3)
    expect(at(6400).scale).toBeCloseTo(1, 2)
  })

  it("turns the halo", () => {
    expect(at(1000).angle).toBeGreaterThan(at(0).angle)
  })
})

describe("paintSun", () => {
  const art = { width: 80, height: 56 }
  const radius = sunRadius(181, 100)
  const densest = Array.from({ length: 10 }, (_, k) => sunFrame(k)).reduce(
    (a, b) => (b.glow > a.glow ? b : a)
  )
  const lit = new Set<string>()
  paintSun(
    (x, y, color) => color === "sun" && lit.add(`${x},${y}`),
    art,
    radius,
    densest,
    { sun: "sun", halo: "halo", star: "star", faint: "faint" }
  )

  it("keeps the disc's edge readable, as the size is the reading: solid inside, the glow well under solid just outside", () => {
    const r = radius * densest.scale
    let inside = 0
    let band = 0
    let glowing = 0
    for (let y = 0; y < art.height; y++)
      for (let x = 0; x < art.width; x++) {
        const d = Math.hypot(x + 0.5 - art.width / 2, y + 0.5 - art.height / 2)
        if (d <= r) inside += lit.has(`${x},${y}`) ? 0 : 1
        else if (d <= r + 2) {
          band++
          if (lit.has(`${x},${y}`)) glowing++
        }
      }
    expect(inside).toBe(0)
    expect(glowing / band).toBeLessThan(0.65)
  })
})
