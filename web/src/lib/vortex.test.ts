import { describe, expect, it } from "vitest"

import { armDegrees, armPoints, dialTicks, vortexLayout } from "./vortex"

describe("armDegrees", () => {
  it("turns the arm one degree per point", () => {
    expect([100, 181, 300].map(armDegrees)).toEqual([100, 181, 300])
  })

  it("stops at 400, past one turn, and never turns back", () => {
    expect(armDegrees(1000)).toBe(400)
    expect(armDegrees(-40)).toBe(0)
  })

  it("draws no arm when today's value is missing", () => {
    expect(armDegrees(Number.NaN)).toBeUndefined()
  })
})

describe("dialTicks", () => {
  it("ticks the ring every 10 points, longest at the baseline, which alone is labelled", () => {
    const ticks = dialTicks(100)
    expect(ticks.map((t) => t.degrees).toSorted((a, b) => a - b)).toEqual(
      Array.from({ length: 36 }, (_, i) => i * 10)
    )
    const longest = ticks.filter((t) => t.length === 18)
    expect(longest).toEqual([{ degrees: 100, length: 18, label: "100" }])
    expect(ticks.filter((t) => t.label)).toEqual(longest)
    for (const { degrees, length } of ticks)
      if (degrees !== 100) expect(length).toBe(degrees % 90 === 0 ? 10 : 6)
  })
})

describe("armPoints", () => {
  // Degrees clockwise from the top, and the radius, of a point about (200, 300).
  const polar = ([x, y]: number[]) => ({
    degrees: ((Math.atan2(x - 200, 300 - y) * 180) / Math.PI + 360) % 360,
    radius: Math.hypot(x - 200, y - 300),
  })

  it("runs from the top of the head out to the ring, turning the value's degrees on the way", () => {
    for (const degrees of [100, 181, 300]) {
      const points = armPoints([200, 300], 70, 154, degrees).map(polar)
      expect(points[0].radius).toBeCloseTo(70)
      expect(points[0].degrees).toBeCloseTo(0)
      expect(points.at(-1)!.radius).toBeCloseTo(154)
      expect(points.at(-1)!.degrees).toBeCloseTo(degrees)
    }
  })

  it("turns steadily outwards, never back", () => {
    const points = armPoints([200, 300], 70, 154, 300).map(polar)
    for (let i = 1; i < points.length; i++) {
      expect(points[i].radius).toBeGreaterThan(points[i - 1].radius)
      expect(points[i].degrees).toBeGreaterThan(points[i - 1].degrees)
    }
  })
})

describe("vortexLayout", () => {
  // Where the dial and its labels reach, about its centre: ticks of 10 px, and the
  // baseline's label 30 px outside the ring at 100 degrees.
  const reach = ({
    center: [x, y],
    ring,
  }: ReturnType<typeof vortexLayout>) => ({
    left: x - ring - 10,
    top: y - ring - 10,
    right: x + 0.985 * (ring + 30) + 15,
    bottom: y + ring + 10,
  })

  it("sets the vortex beside the text on a wide screen, clear of the calm area's edge", () => {
    const layout = vortexLayout(1440, 930, {
      left: 444,
      top: 224,
      right: 996,
      bottom: 870,
    })
    const dial = reach(layout)
    expect(dial.left).toBeGreaterThanOrEqual(16)
    expect(dial.right).toBeLessThanOrEqual(layout.calm.left - 48)
    expect(dial.top).toBeGreaterThanOrEqual(0)
    expect(dial.bottom).toBeLessThanOrEqual(930)
    expect(layout.ring / layout.head).toBeCloseTo(2.2)
  })

  it("sets it in the band above the text on a phone, inside its width", () => {
    const layout = vortexLayout(390, 1400, {
      left: 16,
      top: 224,
      right: 374,
      bottom: 1330,
    })
    const dial = reach(layout)
    expect(dial.top).toBeGreaterThanOrEqual(0)
    expect(dial.bottom).toBeLessThanOrEqual(layout.calm.top - 48)
    expect(dial.left).toBeGreaterThanOrEqual(0)
    expect(dial.right).toBeLessThanOrEqual(390)
    expect(layout.center[0]).toBe(195)
  })
})
