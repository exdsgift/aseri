import { describe, expect, it } from "vitest"

import { type Forecast } from "./api"
import {
  chartLayout,
  dateTicks,
  forecastAt,
  miniChartLayout,
  nudgeApart,
  paintChart,
  valueScale,
  valueTicks,
} from "./chart"

describe("paintChart", () => {
  // A weekly cycle, so the last day (110) sits well below its 7-day average (about 150).
  const values = Array.from({ length: 60 }, (_, day) =>
    day % 7 === 3 ? 110 : 160
  )
  const forecast: Forecast = {
    series: "",
    unit: "",
    attribution: "",
    dates: Array(60).fill(""),
    values,
    averages: values.map((_, day) => {
      const week = values.slice(Math.max(0, day - 6), day + 1)
      return week.reduce((sum, value) => sum + value, 0) / week.length
    }),
    targetDates: Array(28).fill(""),
    quantiles: Object.fromEntries(
      [
        ["0.1", 120],
        ["0.25", 140],
        ["0.5", 155],
        ["0.75", 170],
        ["0.9", 190],
      ].map(([level, value]) => [level, Array(28).fill(value)])
    ),
    actuals: [],
    backtest: false,
  }
  const colors = {
    gold: "gold",
    pale: "pale",
    muted: "muted",
    frame: "frame",
    focus: "focus",
    label: "label",
    real: "real",
  }
  const chart = chartLayout(forecast, 692)
  const calls: { x: number; y: number; color: string }[] = []
  paintChart(
    (x, y, color) => calls.push({ x, y, color }),
    chart,
    forecast,
    colors
  )
  // What the reader sees: the last colour painted on each pixel.
  const seen = new Map(calls.map(({ x, y, color }) => [`${x},${y}`, color]))
  const now = { x: chart.x(chart.origin), y: chart.y(values[chart.origin]) }

  it("starts the forecast on the point it marks as now: the last daily value, the quantity forecast", () => {
    expect(forecast.averages[chart.origin]).toBeGreaterThan(145)
    expect(seen.get(`${now.x},${now.y}`)).toBe("gold")
    const median = calls.find(({ color }) => color === "pale")
    expect(median).toMatchObject(now)
    // The history's main line runs through every daily value it shows.
    for (let day = chart.first; day <= chart.origin; day++)
      expect(calls).toContainEqual({
        x: chart.x(day),
        y: chart.y(values[day]),
        color: "gold",
      })
  })

  it("starts the bands on the first day ahead, never pinched to the last value", () => {
    const band = calls.filter(({ color }) => color === "muted")
    const firstDay = chart.x(chart.origin + 1)
    expect(Math.min(...band.map(({ x }) => x))).toBe(firstDay)
    // The 8-in-10 range of that day, edge to edge.
    for (const value of [120, 190])
      expect(band).toContainEqual({
        x: firstDay,
        y: chart.y(value),
        color: "muted",
      })
  })

  it("keeps the 7-day average as a dimmer line that stops at the origin", () => {
    const average = calls.filter(({ color }) => color === "label")
    expect(average).toContainEqual({
      x: now.x,
      y: chart.y(forecast.averages[chart.origin]),
      color: "label",
    })
    expect(Math.max(...average.map(({ x }) => x))).toBe(now.x)
  })
})

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
    actuals: [],
    backtest: false,
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

  it("fits every daily value it shows, so the main line is never clipped", () => {
    const spiky = forecast(400)
    spiky.values = spiky.values.map((value, day) => (day === 390 ? 900 : value))
    const chart = chartLayout(spiky, 692)
    expect(chart.y(900)).toBeGreaterThan(chart.top)
    expect(chart.hi).toBeGreaterThanOrEqual(900)
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

describe("miniChartLayout", () => {
  // 400 days with a spike, then `ahead` days with the five levels the chart draws.
  const forecast = (ahead: number): Forecast => {
    const values = Array.from({ length: 400 }, (_, day) =>
      day === 390 ? 300 : day % 7 === 3 ? 20 : 40
    )
    return {
      series: "",
      unit: "",
      attribution: "",
      dates: Array(400).fill(""),
      values,
      averages: values,
      targetDates: Array(ahead).fill(""),
      quantiles: Object.fromEntries(
        [
          ["0.1", 0],
          ["0.25", 30],
          ["0.5", 38],
          ["0.75", 45],
          ["0.9", 60],
        ].map(([level, value]) => [level, Array(ahead).fill(value)])
      ),
      actuals: [],
      backtest: false,
    }
  }
  const colors = {
    gold: "gold",
    pale: "pale",
    muted: "muted",
    frame: "frame",
    focus: "focus",
    label: "label",
    real: "real",
  }

  it("fills a card's 64 px canvas edge to edge, and paints nothing outside it", () => {
    const shown = forecast(28)
    const chart = miniChartLayout(shown, 300)
    expect(chart.art).toEqual({ width: 150, height: 32 })
    const calls: { x: number; y: number; color: string }[] = []
    paintChart(
      (x, y, color) => calls.push({ x, y, color }),
      chart,
      shown,
      colors
    )

    const xs = calls.map(({ x }) => x)
    const ys = calls.map(({ y }) => y)
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([1, 149])
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...ys)).toBe(31)
    // Like the panel's chart, the forecast starts on the last daily value, its main mark.
    const now = { x: chart.x(chart.origin), y: chart.y(shown.values[399]) }
    expect(calls.find(({ color }) => color === "pale")).toMatchObject(now)
  })

  it("shows the days of the panel's wide chart", () => {
    expect(miniChartLayout(forecast(28), 300).first).toBe(400 - 56)
    expect(miniChartLayout(forecast(14), 300).first).toBe(400 - 28)
  })
})

describe("valueScale", () => {
  it("fits every value it must show, with an 8% margin", () => {
    const scale = valueScale([100, 150, 200], 0, 100)
    expect(scale.lo).toBeCloseTo(92)
    expect(scale.hi).toBeCloseTo(208)
    expect(scale.y(150)).toBe(50)
  })

  it("keeps anything beyond it on the edge", () => {
    const scale = valueScale([100, 200], 0, 100)
    expect(scale.y(1000)).toBe(0)
    expect(scale.y(-1000)).toBe(100)
  })

  it("never goes below zero", () => {
    expect(valueScale([2, 100], 0, 100).lo).toBe(0)
  })
})

describe("valueTicks", () => {
  it("steps by the smallest 1, 2 or 5 times a power of ten that splits the scale in 3 at most", () => {
    expect(valueTicks(92, 208)).toEqual([100, 150, 200])
    expect(valueTicks(0, 34)).toEqual([0, 20])
  })

  it("splits the scale in more parts when asked", () => {
    expect(valueTicks(63, 374)).toEqual([200])
    expect(valueTicks(63, 374, 4)).toEqual([100, 200, 300])
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
