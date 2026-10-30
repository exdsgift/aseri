import { describe, expect, it } from "vitest"

import { type Forecast } from "./api"
import {
  chartLayout,
  dateTicks,
  forecastAt,
  nudgeApart,
  valueScale,
  valueTicks,
} from "./chart"

describe("chartLayout", () => {
  // `days` daily values, then 28 days ahead.
  const forecast = (days: number): Forecast => ({
    series: "",
    unit: "",
    attribution: "",
    dates: Array(days).fill(""),
    values: Array(days).fill(100),
    averages: Array(days).fill(100),
    targetDates: Array(28).fill(""),
    quantiles: { "0.1": Array(28).fill(80), "0.9": Array(28).fill(120) },
  })

  it("shows 8 weeks when wide, the last 4 of them ahead, from end to end", () => {
    const chart = chartLayout(forecast(400), 692)
    expect([chart.narrow, chart.origin, chart.first]).toEqual([false, 399, 344])
    expect(chart.x(chart.first)).toBe(chart.left)
    expect(chart.x(chart.origin + 28)).toBe(chart.right)
  })

  it("shows 4 weeks of past when narrow", () => {
    const chart = chartLayout(forecast(400), 440)
    expect([chart.narrow, chart.first]).toEqual([true, 372])
  })

  it("starts from the first day when the history is shorter", () => {
    expect(chartLayout(forecast(10), 692).first).toBe(0)
  })

  it("finds each day under its own x, and the nearest end beyond the chart", () => {
    for (const width of [280, 440, 692]) {
      const chart = chartLayout(forecast(400), width)
      for (let day = chart.first; day <= chart.origin + 28; day++)
        expect(chart.dayAt(chart.x(day))).toBe(day)
      expect(chart.dayAt(0)).toBe(chart.first)
      expect(chart.dayAt(chart.art.width)).toBe(chart.origin + 28)
    }
  })
})

describe("valueScale", () => {
  // Fifty quiet days and one spike.
  const daily = [...Array(50).fill(150), 1000]

  it("fits the 7-day line and the bands, with an 8% margin", () => {
    const scale = valueScale([100, 200], daily, 0, 100)
    expect(scale.lo).toBeCloseTo(92)
    expect(scale.hi).toBeCloseTo(208)
  })

  it("leaves out the 2% most extreme daily values, which sit on the edge", () => {
    const scale = valueScale([100, 200], daily, 0, 100)
    expect(scale.y(150)).toBe(50)
    expect(scale.y(1000)).toBe(0)
    expect(scale.y(-1000)).toBe(100)
  })

  it("never goes below zero", () => {
    expect(valueScale([2, 100], [50], 0, 100).lo).toBe(0)
  })
})

describe("valueTicks", () => {
  it("steps by the smallest 1, 2 or 5 times a power of ten that splits the scale in 3 at most", () => {
    expect(valueTicks(92, 208)).toEqual([100, 150, 200])
    expect(valueTicks(0, 34)).toEqual([0, 20])
  })
})

describe("forecastAt", () => {
  // The last daily value, then one quantile for each of 3 days ahead.
  const ahead = [120, 140, 200]

  it("starts from the last daily value", () => {
    expect(forecastAt(100, ahead, 0)).toBe(100)
  })

  it("is the forecast itself on whole days ahead", () => {
    expect(forecastAt(100, ahead, 1)).toBe(120)
    expect(forecastAt(100, ahead, 3)).toBe(200)
  })

  it("interpolates between forecast days", () => {
    expect(forecastAt(100, ahead, 0.5)).toBe(110)
    expect(forecastAt(100, ahead, 2.25)).toBe(155)
  })
})

describe("nudgeApart", () => {
  it("leaves labels that already clear each other where they are", () => {
    expect(nudgeApart([0, 40, 80], 14)).toEqual([0, 40, 80])
  })

  it("pushes each label down until it clears the one above", () => {
    expect(nudgeApart([10, 12, 50], 14)).toEqual([10, 24, 50])
    expect(nudgeApart([10, 12, 20], 14)).toEqual([10, 24, 38])
  })
})

describe("dateTicks", () => {
  const first = { date: "2026-08-31", x: 40 }
  const origin = { date: "2026-10-26", x: 400 }

  it("dates the origin, the first day and the last day", () => {
    const last = { date: "2026-11-23", x: 640 }
    expect(dateTicks(first, origin, last)).toEqual([
      { date: "2026-10-26", x: 400, align: "center" },
      { date: "2026-08-31", x: 40, align: "left" },
      { date: "2026-11-23", x: 640, align: "right" },
    ])
  })

  it("drops an end date whose label would run into the origin's", () => {
    const last = { date: "2026-11-23", x: 460 }
    expect(dateTicks(first, origin, last).map((tick) => tick.date)).toEqual([
      "2026-10-26",
      "2026-08-31",
    ])
  })
})
