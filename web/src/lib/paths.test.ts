import { describe, expect, it } from "vitest"

import latest from "@/fixtures/series/gpr_daily/latest.json"

import { type Forecast } from "./api"
import { path } from "./paths"

// Today's GPR forecast, at its 21 published levels, made from a last daily value of 165.
const gpr: Forecast = {
  series: "Geopolitical risk",
  unit: "",
  attribution: "",
  dates: ["2026-10-26"],
  values: [165],
  averages: [181],
  targetDates: latest.target_end_date,
  quantiles: latest.quantiles,
  actuals: [],
  backtest: false,
}

// A forecast whose every day is a standard normal: a path's values are its normal scores.
const levels = [
  0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65,
  0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99,
]
const z = [
  -2.326, -1.645, -1.282, -1.036, -0.842, -0.674, -0.524, -0.385, -0.253,
  -0.126, 0, 0.126, 0.253, 0.385, 0.524, 0.674, 0.842, 1.036, 1.282, 1.645,
  2.326,
]
const standard: Forecast = {
  ...gpr,
  series: "Standard",
  quantiles: Object.fromEntries(
    levels.map((level, i) => [String(level), Array(28).fill(z[i])])
  ),
}

const many = (forecast: Forecast, rho: number) =>
  Array.from({ length: 2000 }, (_, k) => path(forecast, rho, k))

// Pearson's correlation of each day's value with the next day's, over every path.
function lagOne(paths: number[][]) {
  const pairs = paths.flatMap((p) =>
    p.slice(2).map((value, h) => [p[h + 1], value])
  )
  const mean = (i: number) =>
    pairs.reduce((sum, pair) => sum + pair[i], 0) / pairs.length
  const [ma, mb] = [mean(0), mean(1)]
  let ab = 0
  let aa = 0
  let bb = 0
  for (const [a, b] of pairs) {
    ab += (a - ma) * (b - mb)
    aa += (a - ma) ** 2
    bb += (b - mb) ** 2
  }
  return ab / Math.sqrt(aa * bb)
}

describe("path", () => {
  const paths = many(gpr, 0.45)

  it("lands each day in its 8 in 10 range 8 times in 10, and in its 5 in 10 range 5 in 10", () => {
    // In whole paths, so 0.8 ± 0.03 of 2000 is exact: 1540 to 1660.
    const inside = (day: number, low: string, high: string) =>
      paths.filter(
        (p) =>
          p[day + 1] >= gpr.quantiles[low][day] &&
          p[day + 1] <= gpr.quantiles[high][day]
      ).length
    for (let day = 0; day < 28; day++) {
      expect(Math.abs(inside(day, "0.1", "0.9") - 1600)).toBeLessThanOrEqual(60)
      expect(Math.abs(inside(day, "0.25", "0.75") - 1000)).toBeLessThanOrEqual(
        60
      )
    }
  })

  it("stays within the outer published levels, where it holds", () => {
    for (const p of paths)
      p.slice(1).forEach((value, day) => {
        expect(value).toBeGreaterThanOrEqual(gpr.quantiles["0.01"][day])
        expect(value).toBeLessThanOrEqual(gpr.quantiles["0.99"][day])
      })
  })

  it("starts on the last daily value, then gives one value a day ahead", () => {
    expect(paths[0][0]).toBe(165)
    expect(paths[0]).toHaveLength(29)
  })

  it("is the same path for the same series, day and index, and another otherwise", () => {
    expect(path(gpr, 0.45, 3)).toEqual(paths[3])
    expect(path(gpr, 0.45, 4)).not.toEqual(paths[3])
    expect(path({ ...gpr, series: "Suez Canal" }, 0.45, 3)).not.toEqual(
      paths[3]
    )
    expect(path({ ...gpr, dates: ["2026-10-25"] }, 0.45, 3)).not.toEqual(
      paths[3]
    )
  })

  it("ties each day to the day before by rho", () => {
    expect(Math.abs(lagOne(many(standard, 0)))).toBeLessThan(0.03)
    expect(Math.abs(lagOne(many(standard, 0.5)) - 0.5)).toBeLessThan(0.03)
  })
})
