import { describe, expect, it } from "vitest"

import { engraving, fan, messengerLayout } from "./messenger"

describe("fan", () => {
  const spread = (value: number) => {
    const { rays } = fan(value, 100)!
    return rays.at(-1)! - rays[0]
  }
  const count = (value: number) => fan(value, 100)!.rays.length

  it("opens a full fan at the baseline, as the study's did at 181: 15 rays over 40 degrees", () => {
    expect(count(100)).toBe(15)
    expect(spread(100)).toBeCloseTo(40)
  })

  it("opens further and adds rays above it: the study's 300 opening at 300, and denser", () => {
    expect([count(181), spread(181)]).toEqual([20, expect.closeTo(50.53)])
    expect([count(300), spread(300)]).toEqual([27, expect.closeTo(66)])
  })

  it("never closes or thins as the value grows", () => {
    for (let value = 0; value < 600; value += 5) {
      expect(spread(value + 5)).toBeGreaterThanOrEqual(spread(value))
      expect(count(value + 5)).toBeGreaterThanOrEqual(count(value))
    }
  })

  it("stays full at and under the baseline", () => {
    for (const value of [99, 50, 0, -40])
      expect(fan(value, 100)).toEqual(fan(100, 100))
  })

  it("stops opening at 4 times the baseline", () => {
    expect(fan(1000, 100)).toEqual(fan(400, 100))
    expect([count(400), spread(400)]).toEqual([33, expect.closeTo(79)])
  })

  it("spaces the rays evenly about the fan's axis", () => {
    const { rays } = fan(181, 100)!
    expect(rays[0]).toBeCloseTo(-rays.at(-1)!)
    const gaps = rays.slice(1).map((ray, i) => ray - rays[i])
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0])
  })

  it("marks the baseline with two rays at the full fan's edges, whatever the value", () => {
    for (const value of [50, 181, 300])
      expect(fan(value, 100)!.baseline).toEqual([-20, 20])
    const { rays, baseline } = fan(100, 100)!
    expect([rays[0], rays.at(-1)]).toEqual(
      baseline.map((b) => expect.closeTo(b))
    )
  })

  it("draws no fan when today's value or its baseline is missing", () => {
    expect(fan(181, 0)).toBeUndefined()
    expect(fan(Number.NaN, 100)).toBeUndefined()
    expect(fan(181, undefined as never)).toBeUndefined()
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
