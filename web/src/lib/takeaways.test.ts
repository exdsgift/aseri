import { describe, expect, it } from "vitest"

import {
  coverage,
  direction,
  recordTitle,
  signalsTitle,
  skill,
} from "./takeaways"

describe("direction", () => {
  it("calls a day likely higher or lower only past 65 in 100 either way", () => {
    expect(direction(0.66)).toBe("likely higher than now")
    expect(direction(0.65)).toBe("about where it is now")
    expect(direction(0.5)).toBe("about where it is now")
    expect(direction(0.35)).toBe("about where it is now")
    expect(direction(0.34)).toBe("likely lower than now")
  })
})

describe("signalsTitle", () => {
  const gpr = { name: "Geopolitical risk", percent: 81 }
  const suez = { name: "Suez Canal", kind: "lanes", percent: 1 }
  const hormuz = { name: "Strait of Hormuz", kind: "lanes", percent: -88 }
  const bab = { name: "Bab el-Mandeb", kind: "lanes", percent: -14 }

  it("names the signal furthest from normal, and how far the others of its kind stay", () => {
    expect(signalsTitle([gpr, suez, hormuz, bab])).toBe(
      "Strait of Hormuz 88% below normal; other lanes within 15%"
    )
  })

  it("names it alone when it has no kind to compare with", () => {
    expect(signalsTitle([gpr, suez, bab])).toBe(
      "Geopolitical risk 81% above normal"
    )
  })

  it("says all are near normal when none is 25% off", () => {
    expect(signalsTitle([suez, bab])).toBe("All signals within 15% of normal")
    expect(signalsTitle([suez])).toBe("All signals within 5% of normal")
  })
})

describe("recordTitle", () => {
  const squares = (hits: number, of: number) =>
    Array.from({ length: of }, (_, i) => i < hits)

  it("counts the squares that landed in range against the 8 in 10 promised", () => {
    expect(recordTitle(squares(56, 72), true)).toBe(
      "Backtest: 56 of 72 forecasts landed in range, close to the 8 in 10 promised"
    )
    expect(recordTitle(squares(33, 40), false)).toBe(
      "33 of 40 forecasts landed in range, close to the 8 in 10 promised"
    )
  })

  it("calls it fewer or more only past two standard errors of 8 in 10", () => {
    // 40 forecasts: 8 in 10 give or take 2 x 6.3%, so 27 to 37 are close.
    expect(recordTitle(squares(27, 40), false)).toMatch(/close to/)
    expect(recordTitle(squares(26, 40), false)).toMatch(/fewer than/)
    expect(recordTitle(squares(37, 40), false)).toMatch(/close to/)
    expect(recordTitle(squares(38, 40), false)).toMatch(/more than/)
  })

  it("says so when nothing has been scored yet", () => {
    expect(recordTitle([], true)).toBe("No forecast scored yet")
  })
})

describe("skill", () => {
  it("says how much smaller or bigger the misses are than the series' own simple rule", () => {
    expect(skill({ ratio: 0.7739, verdict: "beats" }, "mean28")).toBe(
      "23% smaller misses than a simple 4-week average"
    )
    expect(skill({ ratio: 1.0536, verdict: "loses" }, "mean28")).toBe(
      "5% bigger misses than a simple 4-week average"
    )
    expect(skill({ ratio: 0.9944, verdict: "ties" }, "mean28")).toBe(
      "About as good as a simple 4-week average"
    )
  })

  it("names each simple rule in plain words, whichever the series is compared with", () => {
    expect(skill({ ratio: 0.85, verdict: "beats" }, "naive")).toBe(
      "15% smaller misses than just repeating the last value"
    )
    expect(skill({ ratio: 0.7, verdict: "ties" }, "snaive7")).toBe(
      "About as good as the same weekday a week back"
    )
  })

  it("never says 0% when the interval says better or worse", () => {
    expect(skill({ ratio: 0.997, verdict: "beats" }, "naive")).toMatch(/^1% /)
  })

  it("says nothing where the simple rule had no miss to compare with", () => {
    expect(skill({ ratio: null, verdict: null }, "mean28")).toBe("-")
  })
})

describe("coverage", () => {
  it("says how often the range held what happened, against its aim", () => {
    expect(coverage(0.7789)).toBe("78% landed in range · aim 80%")
  })
})
