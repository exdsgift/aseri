import { describe, expect, it } from "vitest"

import { type Forecast } from "./api"
import { insideSoFar, intervalScale, stepRows, yearRange } from "./replay"

// Three days ahead, with the real values of the days already observed.
const forecast = (actuals: number[]): Forecast => ({
  series: "",
  unit: "",
  attribution: "",
  dates: [],
  values: [],
  averages: [],
  targetDates: ["2026-07-01", "2026-07-02", "2026-07-03"],
  quantiles: {
    "0.1": [80, 70, 60],
    "0.25": [90, 85, 80],
    "0.5": [100, 100, 100],
    "0.75": [110, 115, 120],
    "0.9": [120, 130, 140],
  },
  actuals,
  backtest: true,
})

describe("insideSoFar", () => {
  it("counts the observed days that landed inside the 8-in-10 range, edges included", () => {
    expect(insideSoFar(forecast([80, 131, 60]))).toEqual({ inside: 2, of: 3 })
  })

  it("counts only the days observed so far", () => {
    expect(insideSoFar(forecast([79]))).toEqual({ inside: 0, of: 1 })
    expect(insideSoFar(forecast([]))).toEqual({ inside: 0, of: 0 })
  })
})

describe("stepRows", () => {
  it("reads each step's day: its most likely value and its two ranges", () => {
    expect(stepRows(forecast([]), [1, 3])).toEqual([
      {
        step: 1,
        date: "2026-07-01",
        mostLikely: 100,
        fiveInTen: [90, 110],
        eightInTen: [80, 120],
      },
      {
        step: 3,
        date: "2026-07-03",
        mostLikely: 100,
        fiveInTen: [80, 120],
        eightInTen: [60, 140],
      },
    ])
  })

  it("adds the real value, inside or outside the 8-in-10 range, once it is observed", () => {
    const [first, second, third] = stepRows(forecast([130, 70]), [1, 2, 3])
    expect([first.real, first.inside]).toEqual([130, false])
    expect([second.real, second.inside]).toEqual([70, true])
    expect(third).not.toHaveProperty("real")
  })
})

describe("yearRange", () => {
  it("is the lowest and the highest of the last 365 days", () => {
    // 366 days: the first one is more than a year old.
    const values = [5, ...Array(362).fill(100), 50, 300, 120]
    const dates = values.map((_, i) =>
      new Date(Date.UTC(2025, 9, 30 + i)).toISOString().slice(0, 10)
    )
    expect(yearRange(dates, values)).toEqual([50, 300])
  })

  it("reads 365 days, not 365 values, for Brent's trading days", () => {
    // A price a year and a day old, then a few up to the newest.
    const dates = ["2025-10-22", "2025-10-24", "2026-06-01", "2026-10-23"]
    expect(yearRange(dates, [50, 80, 120, 100])).toEqual([80, 120])
  })
})

describe("intervalScale", () => {
  it("spans every value it must show, with 4% to spare", () => {
    const scale = intervalScale([150, 100, 200])
    expect([scale.lo, scale.hi]).toEqual([96, 204])
    expect(scale.at(150)).toBe(50)
  })

  it("never goes below zero", () => {
    expect(intervalScale([1, 100]).lo).toBe(0)
  })

  it("pins a value beyond the scale to its edge", () => {
    const scale = intervalScale([100, 200])
    expect(scale.at(1000)).toBe(100)
    expect(scale.at(10)).toBe(0)
  })
})
