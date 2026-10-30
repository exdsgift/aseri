import { describe, expect, it } from "vitest"

import {
  dayLabel,
  daysAhead,
  formatValue,
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
  it("says how far above or below the baseline a value is, in whole percent", () => {
    expect(versusBaseline(181.4155, 100)).toBe("81% above")
    expect(versusBaseline(88.2, 100)).toBe("12% below")
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
