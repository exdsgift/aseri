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
    daily: "daily",
    path: "path",
    average: "average",
    band: "band",
    frame: "frame",
    origin: "origin",
    real: "real",
  }
  const chart = chartLayout(forecast, 692)
  // One possible path, well above the most likely value (155), from the last daily value.
  const path = [values[chart.origin], ...Array(28).fill(185)]
  const paint = (drawn: number[]) => {
    const calls: { x: number; y: number; color: string }[] = []
    paintChart(
      (x, y, color) => calls.push({ x, y, color }),
      chart,
      forecast,
      colors,
      drawn
    )
    return calls
  }
  const calls = paint(path)
  // What the reader sees: the last colour painted on each pixel.
  const seen = new Map(calls.map(({ x, y, color }) => [`${x},${y}`, color]))
  const now = { x: chart.x(chart.origin), y: chart.y(values[chart.origin]) }

  it("starts the possible path on the point it marks as now: the last daily value, the quantity forecast", () => {
    expect(forecast.averages[chart.origin]).toBeGreaterThan(145)
    expect(seen.get(`${now.x},${now.y}`)).toBe("daily")
    const start = calls.find(({ color }) => color === "path")
    expect(start).toMatchObject(now)
    // The history's main line runs through every daily value it shows.
    for (let day = chart.first; day <= chart.origin; day++)
      expect(calls).toContainEqual({
        x: chart.x(day),
        y: chart.y(values[day]),
        color: "daily",
      })
  })

  it("draws the possible path through every day ahead, in a grey apart from the daily values' white", () => {
    for (let day = 1; day <= 28; day++)
      expect(calls).toContainEqual({
        x: chart.x(chart.origin + day),
        y: chart.y(185),
        color: "path",
      })
    // No most likely line and no mark at its end: past the first day, only the path is in its grey.
    const ahead = calls.filter(
      ({ x, color }) => color === "path" && x > chart.x(chart.origin + 1)
    )
    expect(new Set(ahead.map(({ y }) => y))).toEqual(new Set([chart.y(185)]))
  })

  it("draws the same bands whatever path it draws", () => {
    const bands = (drawn: typeof calls) =>
      drawn.filter(({ color }) => color === "band")
    const low = [values[chart.origin], ...Array(28).fill(125)]
    expect(bands(calls)).toEqual(bands(paint(low)))
  })

  it("starts the bands on the first day ahead, never pinched to the last value", () => {
    const band = calls.filter(({ color }) => color === "band")
    const firstDay = chart.x(chart.origin + 1)
    expect(Math.min(...band.map(({ x }) => x))).toBe(firstDay)
    // The 8-in-10 range of that day, edge to edge.
    for (const value of [120, 190])
      expect(band).toContainEqual({
        x: firstDay,
        y: chart.y(value),
        color: "band",
      })
  })

  // Whole or 10 days in, what happened carries the daily values' line on from the origin, and
  // ends on a hollow ring: apart by shape from the filled square at the origin and from the
  // path's unmarked end, as the two lines differ only by shade.
  it.each([28, 10])(
    "carries the daily values' line on through what happened, %i days known, to a hollow ring",
    (known) => {
      const happened = { ...forecast, actuals: Array(known).fill(150) }
      const calls: { x: number; y: number; color: string }[] = []
      paintChart(
        (x, y, color) => calls.push({ x, y, color }),
        chart,
        happened,
        colors,
        path
      )
      const seen = new Map(calls.map(({ x, y, color }) => [`${x},${y}`, color]))
      const end = { x: chart.x(chart.origin + known), y: chart.y(150) }
      // From the last daily value, in its colour, through every known day short of the ring.
      expect(
        calls.some(
          ({ x, color }) =>
            color === "daily" && x > now.x + 1 && x < chart.x(chart.origin + 1)
        )
      ).toBe(true)
      for (let day = 1; day < known; day++)
        expect(calls).toContainEqual({
          x: chart.x(chart.origin + day),
          y: chart.y(150),
          color: "daily",
        })
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          expect(seen.get(`${end.x + dx},${end.y + dy}`) === "real").toBe(
            dx !== 0 || dy !== 0
          )
      // Hollow: nothing lights the ring's middle.
      expect(seen.has(`${end.x},${end.y}`)).toBe(false)
      // A line, not dots: the ring's 8 pixels are the only ones in white.
      expect(calls.filter(({ color }) => color === "real")).toHaveLength(8)
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          expect(seen.get(`${now.x + dx},${now.y + dy}`)).toBe("daily")
    }
  )

  it("keeps the ring hollow where the band and the path run through it", () => {
    // The path's value, well inside the 8-in-10 band, on the 10th day.
    const happened = { ...forecast, actuals: Array(10).fill(185) }
    const end = { x: chart.x(chart.origin + 10), y: chart.y(185) }
    const lit: { x: number; y: number; color: string }[] = []
    paintChart(
      (x, y, color) => lit.push({ x, y, color }),
      chart,
      happened,
      colors,
      path
    )
    const around = (color: string) =>
      lit.some(
        (p) =>
          p.color === color &&
          Math.abs(p.x - end.x) <= 2 &&
          Math.abs(p.y - end.y) <= 2
      )
    expect(around("band") && around("path")).toBe(true)
    expect(lit.filter(({ x, y }) => x === end.x && y === end.y)).toEqual([])
  })

  it("leaves out a ring that would touch the origin's square, as on a phone with one day known", () => {
    // A 360 px chart: under 3 art pixels a day.
    const narrow = chartLayout(forecast, 360)
    expect((narrow.right - narrow.left) / narrow.span).toBeLessThan(3)
    // A value next to the last daily value (110): its ring would touch the origin's square.
    const happened = { ...forecast, actuals: [112] }
    const seen = new Map<string, string>()
    paintChart(
      (x, y, color) => seen.set(`${x},${y}`, color),
      narrow,
      happened,
      colors,
      [values[narrow.origin], ...Array(28).fill(185)]
    )
    expect([...seen.values()]).not.toContain("real")
    // The line to that day still shows, past the square.
    const day = { x: narrow.x(narrow.origin + 1), y: narrow.y(112) }
    expect(day.x - narrow.x(narrow.origin)).toBeLessThanOrEqual(3)
    expect(Math.abs(day.y - narrow.y(110))).toBeLessThanOrEqual(3)
    expect(day.x).toBeGreaterThan(narrow.x(narrow.origin) + 1)
    expect(seen.get(`${day.x},${day.y}`)).toBe("daily")
  })

  it("paints the frame alone when asked, for the marks to scan in over it", () => {
    const happened = { ...forecast, actuals: Array(10).fill(150) }
    const lit = new Set<string>()
    paintChart(
      (_x, _y, color) => lit.add(color),
      chart,
      happened,
      colors,
      path,
      false
    )
    expect([...lit].toSorted()).toEqual(["frame", "origin"])
  })

  it("keeps the 7-day average as a dimmer line that stops at the origin", () => {
    const average = calls.filter(({ color }) => color === "average")
    expect(average).toContainEqual({
      x: now.x,
      y: chart.y(forecast.averages[chart.origin]),
      color: "average",
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

  it("fits the published levels nearest 5% and 95%, so a skewed tail cannot squash the past", () => {
    // Like Hormuz: 0 to 8 ships, and a 1-in-100 chance of a reopening near 37.
    const tails = forecast(400)
    tails.quantiles = {
      ...tails.quantiles,
      "0.01": Array(28).fill(60),
      "0.05": Array(28).fill(70),
      "0.95": Array(28).fill(130),
      "0.99": Array(28).fill(500),
    }
    const chart = chartLayout(tails, 692)
    expect(chart.lo).toBeLessThanOrEqual(70)
    expect(chart.hi).toBeGreaterThanOrEqual(130)
    expect(chart.hi).toBeLessThan(200)
    // A path beyond them runs along the frame.
    expect(chart.y(500)).toBe(chart.top)
    expect(miniChartLayout(tails, 300).hi).toBeLessThan(130)
  })

  it("falls back to the outermost levels a forecast has, as an older replay has only 0.1 to 0.9", () => {
    const chart = chartLayout(forecast(400), 692)
    expect(chart.hi).toBeGreaterThanOrEqual(120)
    expect(Number.isFinite(chart.hi)).toBe(true)
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
    daily: "daily",
    path: "path",
    average: "average",
    band: "band",
    frame: "frame",
    origin: "origin",
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
      colors,
      // A path, as the cards draw: from the last daily value on.
      [shown.values.at(-1)!, ...Array(28).fill(38)]
    )

    const xs = calls.map(({ x }) => x)
    const ys = calls.map(({ y }) => y)
    // The path ends on the last column but one: the margin keeps room for what happened's 3x3 end.
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([1, 148])
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...ys)).toBe(31)
    // Like the panel's chart, the forecast starts on the last daily value, its main mark.
    const now = { x: chart.x(chart.origin), y: chart.y(shown.values[399]) }
    expect(calls.find(({ color }) => color === "path")).toMatchObject(now)
    // As on the panel, the path it is given, with no mark at its end.
    for (let day = 1; day <= 28; day++)
      expect(calls).toContainEqual({
        x: chart.x(chart.origin + day),
        y: chart.y(38),
        color: "path",
      })
    expect(calls).not.toContainEqual({
      x: chart.right + 1,
      y: chart.y(38) + 1,
      color: "path",
    })
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

  it("goes below zero as far as a negative value, such as a drone correction", () => {
    expect(valueScale([-50, 1500], 0, 100).lo).toBe(-50)
  })
})

describe("a day with no value", () => {
  const forecast: Forecast = {
    series: "",
    unit: "",
    attribution: "",
    dates: Array(40).fill(""),
    values: Array(40).fill(1500),
    averages: Array(40).fill(1500),
    targetDates: Array(7).fill(""),
    quantiles: Object.fromEntries(
      [
        ["0.05", 1200],
        ["0.1", 1300],
        ["0.25", 1400],
        ["0.5", 1500],
        ["0.75", 1600],
        ["0.9", 1700],
        ["0.95", 1800],
      ].map(([level, value]) => [level, Array(7).fill(value)])
    ),
    // The drones' day without a report, on the second day ahead.
    actuals: [1600, null, 1700],
    backtest: true,
  }

  it("is left out of the scale, which never falls to 0 for it", () => {
    expect(chartLayout(forecast, 692).lo).toBeGreaterThan(1000)
  })

  it("breaks the line of what happened there, and shows a day alone between two gaps as a dot", () => {
    // Known on days 1, 3 and 5.
    const gaps = { ...forecast, actuals: [1600, null, 1700, null, 1650] }
    const chart = chartLayout(gaps, 692)
    const at = (day: number) => chart.x(chart.origin + day)
    const lit: { x: number; y: number; color: string }[] = []
    paintChart(
      (x, y, color) => lit.push({ x, y, color }),
      chart,
      gaps,
      {
        daily: "daily",
        path: "path",
        average: "average",
        band: "band",
        frame: "frame",
        origin: "origin",
        real: "real",
      },
      Array(8).fill(1500)
    )
    const line = lit.filter(({ color }) => color === "daily")
    expect(line).toContainEqual({ x: at(1), y: chart.y(1600), color: "daily" })
    // The day alone, 2 art pixels wide where the days are far enough apart, as the dots were.
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ])
      expect(line).toContainEqual({
        x: at(3) + dx,
        y: chart.y(1700) + dy,
        color: "daily",
      })
    // Nothing bridges a gap, up to the ring on the last known day.
    expect(line.filter(({ x }) => x > at(1) && x < at(3))).toEqual([])
    expect(line.filter(({ x }) => x > at(3) + 1 && x < at(5) - 1)).toEqual([])
    expect(lit).toContainEqual({
      x: at(5) - 1,
      y: chart.y(1650),
      color: "real",
    })
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
