import { describe, expect, it } from "vitest"

import { engraving, fan, fanRays, messengerLayout } from "./messenger"

describe("fan", () => {
  const angles = (value: number) => fan(value, 100)!.rays.map((r) => r.angle)
  const spread = (value: number) => angles(value).at(-1)! - angles(value)[0]
  const count = (value: number) => angles(value).length

  it("opens a full fan at the baseline, fuller than the study's at 181: 19 rays over 40 degrees", () => {
    expect(count(100)).toBe(19)
    expect(spread(100)).toBeCloseTo(40)
  })

  it("opens further above it and adds rays at its edges, to the study's 300 opening at 300", () => {
    expect([count(181), spread(181)]).toEqual([23, expect.closeTo(48.89)])
    // The opening, 66 degrees, holds 29 rays a slot apart: denser than the study's 27.
    expect([count(300), spread(300)]).toEqual([29, expect.closeTo(62.22)])
  })

  it("never closes or thins as the value grows", () => {
    for (let value = 0; value < 600; value += 5) {
      expect(spread(value + 5)).toBeGreaterThanOrEqual(spread(value))
      expect(count(value + 5)).toBeGreaterThanOrEqual(count(value))
    }
  })

  it("keeps each ray in its slot as the fan opens, so a ray never jumps while the number counts up", () => {
    for (let value = 100; value < 450; value += 7) {
      const wider = fan(value + 7, 100)!.rays
      for (const ray of fan(value, 100)!.rays) expect(wider).toContainEqual(ray)
    }
  })

  it("stays full at and under the baseline", () => {
    for (const value of [99, 50, 0, -40])
      expect(fan(value, 100)).toEqual(fan(100, 100))
  })

  it("stops opening at 4 times the baseline", () => {
    expect(fan(1000, 100)).toEqual(fan(400, 100))
    expect([count(400), spread(400)]).toEqual([35, expect.closeTo(75.56)])
  })

  it("spaces the rays evenly about the fan's axis", () => {
    const rays = angles(181)
    expect(rays[0]).toBeCloseTo(-rays.at(-1)!)
    const gaps = rays.slice(1).map((ray, i) => ray - rays[i])
    for (const gap of gaps) expect(gap).toBeCloseTo(40 / 18)
  })

  it("marks the baseline with two rays at the full fan's edges, whatever the value", () => {
    for (const value of [50, 181, 300])
      expect(fan(value, 100)!.baseline).toEqual([-20, 20])
    expect([angles(100)[0], angles(100).at(-1)]).toEqual(
      [-20, 20].map((b) => expect.closeTo(b))
    )
  })

  it("draws no fan when today's value or its baseline is missing", () => {
    expect(fan(181, 0)).toBeUndefined()
    expect(fan(Number.NaN, 100)).toBeUndefined()
    expect(fan(181, undefined as never)).toBeUndefined()
  })
})

describe("fanRays", () => {
  const point = { x: 200, y: 300, angle: -25 }
  const frame = { grow: 1, reach: 1500, held: 300, sway: 4321 }
  const drawn = (value: number) =>
    new Map(
      fanRays(point, 1, fan(value, 100)!.rays, frame).map((ray) => [
        ray.slot,
        ray,
      ])
    )

  it("draws a ray at a lower value with the same angle and length at a higher one", () => {
    const wider = drawn(300)
    for (const [slot, ray] of drawn(181)) expect(wider.get(slot)).toEqual(ray)
    expect(wider.size).toBeGreaterThan(drawn(181).size)
  })

  it("runs each ray from behind the point that holds it out to its own length", () => {
    for (const { from, to } of drawn(181).values()) {
      const back = Math.hypot(from[0] - point.x, from[1] - point.y)
      const out = Math.hypot(to[0] - point.x, to[1] - point.y)
      expect(back).toBeCloseTo(300)
      expect(out).toBeGreaterThanOrEqual(0.75 * 1500)
      expect(out).toBeLessThanOrEqual(1500)
    }
  })

  it("sways each ray by a fraction of a degree, and none at rest", () => {
    const still = fanRays(point, 1, fan(181, 100)!.rays, {
      ...frame,
      sway: undefined,
    })
    for (const [i, { slot, to }] of still.entries()) {
      const angle =
        (Math.atan2(to[1] - point.y, to[0] - point.x) * 180) / Math.PI
      expect(angle).toBeCloseTo(-25 + (slot * 40) / 18)
      const swayed = [...drawn(181).values()][i].to
      const moved =
        (Math.atan2(swayed[1] - point.y, swayed[0] - point.x) * 180) / Math.PI -
        angle
      expect(Math.abs(moved)).toBeLessThanOrEqual(0.3 + 1e-9)
    }
  })
})

describe("messengerLayout", () => {
  // Where a figure of the layout's scale sits, in CSS pixels.
  const figureBox = (layout: ReturnType<typeof messengerLayout>) => ({
    left: layout.figure.x,
    top: layout.figure.y,
    right: layout.figure.x + engraving.width * layout.figure.scale,
    bottom: layout.figure.y + engraving.height * layout.figure.scale,
  })

  it("stands Mercury beside the text on a wide screen, at the engraving's own size", () => {
    // The hero's 46ch column at 1440 px, from the 224 px band down.
    const layout = messengerLayout(1440, 930, {
      left: 444,
      top: 224,
      right: 996,
      bottom: 870,
    })
    const figure = figureBox(layout)
    expect(layout.figure.scale).toBe(1)
    expect(figure.left).toBeGreaterThanOrEqual(0)
    expect(figure.right).toBeLessThanOrEqual(layout.calm.left)
    // The calm area holds the text with a margin.
    expect(layout.calm).toEqual({
      left: 424,
      top: 210,
      right: 1016,
      bottom: 884,
    })
  })

  it("shrinks him beside a narrower column, never past his own size", () => {
    const layout = messengerLayout(1180, 930, {
      left: 314,
      top: 224,
      right: 866,
      bottom: 870,
    })
    expect(layout.figure.scale).toBeLessThan(1)
    expect(figureBox(layout).right).toBeLessThanOrEqual(layout.calm.left)
  })

  it("stands him in the band above the text on a phone, inside its width", () => {
    // 390 px: the column fills the width less the 16 px gutters.
    const layout = messengerLayout(390, 1400, {
      left: 16,
      top: 224,
      right: 374,
      bottom: 1330,
    })
    const figure = figureBox(layout)
    expect(figure.bottom).toBeLessThanOrEqual(layout.calm.top)
    expect(figure.left).toBeGreaterThanOrEqual(0)
    expect(figure.right).toBeLessThanOrEqual(390)
    // Centred.
    expect(figure.left + figure.right).toBeCloseTo(390, 0)
    // The disc stays above the text too.
    expect(layout.chest[1] + layout.disc[1]).toBeLessThanOrEqual(
      layout.calm.top
    )
  })

  it("hangs the fans on the figure, pointing out from it", () => {
    const layout = messengerLayout(1440, 930, {
      left: 444,
      top: 224,
      right: 996,
      bottom: 870,
    })
    const figure = figureBox(layout)
    expect(layout.bundles).toHaveLength(5)
    for (const { x, y } of layout.bundles) {
      expect(x).toBeGreaterThanOrEqual(figure.left)
      expect(x).toBeLessThanOrEqual(figure.right)
      expect(y).toBeGreaterThanOrEqual(figure.top)
      expect(y).toBeLessThanOrEqual(figure.bottom)
    }
  })
})
