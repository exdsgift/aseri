import { describe, expect, it } from "vitest"

import latest from "@/fixtures/series/gpr_daily/latest.json"

import { type Forecast } from "./api"
import { chanceAbove, path, ranked } from "./paths"
import { direction } from "./takeaways"

// Today's GPR forecast, at its 21 published levels, made from a last daily value of 165.
const gpr: Forecast = {
  series: "Geopolitical risk",
  unit: "",
  attribution: "",
  normal: 100,
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

describe("ranked", () => {
  // Each day's own log-density in normal scores. On the standard forecast a path's values are
  // its normal scores, give or take the straight lines between published levels.
  const logDensity = (values: number[]) =>
    values.slice(1).reduce((sum, value) => sum - (value * value) / 2, 0)

  it("gives the 20 paths, the most likely first: the one whose days are each the likeliest", () => {
    const paths = ranked(standard, 0.45)
    expect(paths).toHaveLength(20)
    const scores = paths.map((p) => p.logLikelihood)
    expect(scores).toEqual(scores.toSorted((a, b) => b - a))
    // Within 15%: a value past q0.01 or q0.99 is held there, and the lines between levels bend.
    for (const p of paths)
      expect(Math.abs(logDensity(p.values) - p.logLikelihood)).toBeLessThan(
        0.15 * Math.abs(p.logLikelihood)
      )
  })

  it("keeps the most likely path in the band, even under a strong day-to-day tie", () => {
    // A tie of 0.85, as Wikipedia's views have: a smooth path may drift and stay high.
    const inside = (values: number[]) =>
      values
        .slice(1)
        .filter(
          (value, day) =>
            value >= gpr.quantiles["0.1"][day] &&
            value <= gpr.quantiles["0.9"][day]
        ).length
    const counts = ranked(gpr, 0.85).map((p) => inside(p.values))
    expect(counts[0]).toBe(Math.max(...counts))
  })

  it("is the same 20 paths, in the same order, every time", () => {
    const paths = ranked(gpr, 0.45).map((p) => p.values)
    const drawn = Array.from({ length: 20 }, (_, index) =>
      path(gpr, 0.45, index)
    )
    expect(paths.toSorted()).toEqual(drawn.toSorted())
    expect(ranked(gpr, 0.45).map((p) => p.values)).toEqual(paths)
  })

  it("starts every path on the last daily value", () => {
    for (const p of ranked(gpr, 0)) expect(p.values[0]).toBe(165)
  })
})

describe("chanceAbove", () => {
  it("reads the chance that a day lands above a value off its levels", () => {
    expect(chanceAbove(standard.quantiles, 0, 0)).toBeCloseTo(0.5, 3)
    expect(chanceAbove(standard.quantiles, 0, 1.282)).toBeCloseTo(0.1, 3)
    expect(chanceAbove(standard.quantiles, 0, -1.282)).toBeCloseTo(0.9, 3)
  })

  it("is certain either way past the outermost levels", () => {
    expect(chanceAbove(standard.quantiles, 0, 10)).toBeCloseTo(0, 6)
    expect(chanceAbove(standard.quantiles, 0, -10)).toBeCloseTo(1, 6)
  })

  // A count's forecast puts whole levels on one value: a tie counts half above and half below,
  // as the PIT does (public-api.md).
  const counts = (at: Record<string, number>) =>
    Object.fromEntries(Object.entries(at).map(([level, v]) => [level, [v]]))

  it("counts a tie at the value half above and half below", () => {
    // Hormuz on a closed day: every level at 0 ships, the last value 0.
    const closed = counts({
      "0.01": 0,
      "0.1": 0,
      "0.5": 0,
      "0.9": 0,
      "0.99": 0,
    })
    expect(chanceAbove(closed, 0, 0)).toBeCloseTo(0.5, 3)
    expect(direction(chanceAbove(closed, 0, 0))).toBe("about where it is now")
    // Ties from the 25% to the 75% level: as likely above as below.
    const middle = counts({
      "0.01": 0,
      "0.25": 3,
      "0.5": 3,
      "0.75": 3,
      "0.99": 6,
    })
    expect(chanceAbove(middle, 0, 3)).toBeCloseTo(0.5, 3)
    // Ties from the lowest level to the median: never below, above half the time, so with the
    // tie halved 0.25 + 0.5.
    const floor = counts({
      "0.01": 0,
      "0.25": 0,
      "0.5": 0,
      "0.75": 1,
      "0.99": 4,
    })
    expect(chanceAbove(floor, 0, 0)).toBeCloseTo(0.75, 3)
  })

  it("puts GPR's Nov 23 about evenly either side of last Monday's 165", () => {
    const above = chanceAbove(gpr.quantiles, 27, 165)
    expect(above).toBeGreaterThan(0.5)
    expect(above).toBeLessThan(0.6)
  })
})
