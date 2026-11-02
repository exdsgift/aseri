import { describe, expect, it } from "vitest"

import {
  dayLabel,
  daysAhead,
  formatValue,
  likely,
  outward,
  percentFrom,
  valueRange,
  versusBaseline,
  weekday,
} from "./format"

describe("formatValue", () => {
  it("rounds to a whole number with thousands separators", () => {
    expect(formatValue(181.4155)).toBe("181")
    expect(formatValue(1046.2)).toBe("1,046")
  })

  it("writes negatives with an ASCII hyphen, which Press Start 2P has", () => {
    expect(formatValue(-12.6)).toBe("-13")
  })

  it("never writes a negative zero", () => {
    expect(formatValue(-0.4)).toBe("0")
  })
})

describe("versusBaseline", () => {
  it("says how far above or below normal a value is, in whole percent", () => {
    expect(versusBaseline(181.4155, 100)).toBe("81% above normal")
    expect(versusBaseline(88.2, 100)).toBe("12% below normal")
    expect(percentFrom(3.2, 26.92)).toBe(-88)
  })

  it("says at normal, with no way to go, when it rounds to 0%", () => {
    expect(versusBaseline(100.4, 100)).toBe("at normal")
  })
})

describe("likely", () => {
  it("says a range as likely, low to high", () => {
    expect(likely(119.4, 243)).toBe("likely 119-243")
    expect(valueRange(119.4, 243)).toBe("119-243")
  })
})

describe("outward", () => {
  it("rounds a headline's range outward, to a step a tenth of its width at most", () => {
    // GPR: 140 wide, so tens. Brent: 44 wide, so twos, never $10 for a price.
    expect(outward(111.2, 251.4)).toEqual([110, 260])
    expect(outward(103.4, 146.6)).toEqual([102, 148])
    expect(outward(1454.6, 5423.2)).toEqual([1400, 5600])
    // Never under whole units: Hormuz's 0 to 6 ships, Suez's 33 to 51.
    expect(outward(0.3, 5.8)).toEqual([0, 6])
    expect(outward(33.4, 50.2)).toEqual([33, 51])
    expect(outward(-153, -12)).toEqual([-160, -10])
  })

  it("always holds the model's range, and never collapses it", () => {
    for (const [low, high] of [
      [111.2, 251.4],
      [149.6, 150.4],
      [0, 0.2],
      [99.99, 100.01],
      [-7.5, 3.25],
      [1158.3, 1968.9],
      [0.01, 37.9],
      // Hormuz closed: every level at 0.
      [0, 0],
    ]) {
      const [from, to] = outward(low, high)
      expect(from, `${low}`).toBeLessThanOrEqual(low)
      expect(to, `${high}`).toBeGreaterThanOrEqual(high)
      expect(to, `${low}-${high}`).toBeGreaterThan(from)
    }
  })
})

describe("dates", () => {
  it("names the weekday of a date", () => {
    expect(weekday("2026-10-26")).toBe("Monday")
  })

  it("labels a date as weekday, month and two-digit day", () => {
    expect(dayLabel("2026-11-23")).toBe("Monday Nov 23")
    expect(dayLabel("2027-03-07")).toBe("Sunday Mar 07")
  })

  it("counts days ahead, and Brent's in trading days", () => {
    expect(daysAhead(1, "day")).toBe("1 day")
    expect(daysAhead(14, "day")).toBe("14 days")
    expect(daysAhead(1, "trading_day")).toBe("1 trading day")
    expect(daysAhead(14, "trading_day")).toBe("14 trading days")
  })
})
