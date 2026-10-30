import { cleanup, render } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"

import { type Forecast } from "@/lib/api"

import { Intervals } from "./Intervals"

afterEach(cleanup)

// Wikipedia's "World War III" views: about 2,000 a day, after a spike to 171,260 in the year.
const forecast: Forecast = {
  series: '"World War III"',
  unit: "Wikipedia views a day",
  attribution: "",
  dates: ["2026-10-28", "2026-10-29"],
  values: [2122, 2699],
  averages: [1700, 1833],
  targetDates: ["2026-10-30", "2026-10-31", "2026-11-01"],
  quantiles: {
    "0.1": [1871, 1700, 1608],
    "0.25": [2100, 1900, 1786],
    "0.5": [2400, 2200, 2095],
    "0.75": [2900, 2700, 2696],
    "0.9": [3721, 3900, 4136],
  },
  actuals: [],
  backtest: false,
}

const lanes = (spiky: number[]) =>
  render(
    <Intervals
      forecast={forecast}
      today
      steps={[1, 3]}
      horizonUnit="day"
      year={spiky}
      baseline={4744}
      baselineLabel="its 365-day mean"
    />
  ).container

const percent = (element: Element, property: "left" | "width") =>
  parseFloat((element as HTMLElement).style[property])

it("fits the lanes to the ranges, the day's value and the baseline, not to a spiky year", () => {
  const container = lanes([1208, 171260])

  // Each 8-in-10 band takes a readable share of its lane, not a sliver at its left end.
  const bands = container.querySelectorAll("i.dither-25")
  expect(bands).toHaveLength(2)
  for (const band of bands) expect(percent(band, "width")).toBeGreaterThan(30)
  // The year's thin line runs from edge to edge, with a mark at each end where it runs on.
  for (const line of container.querySelectorAll("i.h-0\\.5.bg-border")) {
    expect(percent(line, "left")).toBe(0)
    expect(percent(line, "width")).toBe(100)
  }
  expect(container.querySelectorAll('[data-runs-on="low"]')).toHaveLength(3)
  expect(container.querySelectorAll('[data-runs-on="high"]')).toHaveLength(3)
  // Its numbers stay in the text under the lanes.
  expect(container.textContent).toContain(
    "Thin line: the 1-year range of the daily value, 1,208 to 171,260."
  )
  // The baseline, 4,744, now ends the scale: its label ends on it, inside the panel.
  const label = [...container.querySelectorAll("span")].find(
    (span) => span.textContent === "365-day mean"
  )!
  expect(label.className).toContain("-translate-x-full")
})

it("starts the baseline's label on it when the baseline sits in the lanes' left half", () => {
  const { container } = render(
    <Intervals
      forecast={forecast}
      today
      steps={[1, 3]}
      horizonUnit="day"
      year={[1208, 171260]}
      baseline={1500}
      baselineLabel="its 365-day mean"
    />
  )
  const label = [...container.querySelectorAll("span")].find(
    (span) => span.textContent === "365-day mean"
  )!
  expect(label.className).not.toContain("-translate-x-full")
})

it("marks no run-on where the year ends inside the lanes", () => {
  // A low of 2,000 sits inside the scale; a high of 9,000 runs past it.
  const container = lanes([2000, 9000])

  expect(container.querySelectorAll('[data-runs-on="low"]')).toHaveLength(0)
  expect(container.querySelectorAll('[data-runs-on="high"]')).toHaveLength(3)
  for (const line of container.querySelectorAll("i.h-0\\.5.bg-border"))
    expect(percent(line, "left")).toBeGreaterThan(0)
})
