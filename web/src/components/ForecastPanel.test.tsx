import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import catalog from "@/fixtures/series.json"
import actuals from "@/fixtures/series/gpr_daily/actuals.json"
import latest from "@/fixtures/series/gpr_daily/latest.json"
import replay from "@/fixtures/series/gpr_daily/replay.json"
import hormuzActuals from "@/fixtures/series/hormuz_transits/actuals.json"
import hormuzLatest from "@/fixtures/series/hormuz_transits/latest.json"
import hormuzReplay from "@/fixtures/series/hormuz_transits/replay.json"
import { loadSeries, type Series } from "@/lib/api"
import { monthDay } from "@/lib/format"

import { ForecastPanel } from "./ForecastPanel"

let gpr: Series

const entry = (id: string) =>
  catalog.series.find((series) => series.series_id === id)!
const published: Record<string, unknown> = {
  "api/v1/series/gpr_daily/latest.json": latest,
  "api/v1/series/gpr_daily/actuals.json": actuals,
  "api/v1/series/gpr_daily/replay.json": replay,
  "api/v1/series/hormuz_transits/latest.json": hormuzLatest,
  "api/v1/series/hormuz_transits/actuals.json": hormuzActuals,
  "api/v1/series/hormuz_transits/replay.json": hormuzReplay,
}
const serve = (files: Record<string, unknown>) =>
  vi.stubGlobal("fetch", async (url: string) => Response.json(files[url]))

// jsdom lays nothing out and has no canvas: the chart draws nothing.
beforeEach(async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  serve(published)
  gpr = await loadSeries(entry("gpr_daily"), { replay: true })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// latest.json's forecast was made on 2026-10-30: that day, the page calls it today.
beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-30T12:00:00Z"), toFake: ["Date"] })
})

const title = () => screen.getByRole("heading", { level: 2 }).textContent
const slider = () =>
  screen.getByRole("slider", { name: "Replay a past forecast" })
const press = (key: string) => fireEvent.keyDown(document.body, { key })
const lines = (element: HTMLElement) =>
  within(element)
    .getAllByRole("paragraph")
    .map((p) => p.textContent)
const readout = () => lines(screen.getByTestId("readout"))
const intervals = () =>
  within(screen.getByRole("list", { name: /Intervals/ }))
    .getAllByRole("listitem")
    .map((li) => lines(li).join(" "))
const source = () => screen.getByText(/^Source:/).textContent

it("names the day today's forecast was made, unless it is today", () => {
  vi.setSystemTime(new Date("2026-11-02T12:00:00Z"))
  render(<ForecastPanel series={gpr} />)
  expect(title()).toBe("[F] Geopolitical risk · forecast made Oct 30")
})

it("replays the forecast of the day before with ←, then today's with → or T", () => {
  render(<ForecastPanel series={gpr} />)
  expect(title()).toBe("[F] Geopolitical risk · forecast made today")

  press("ArrowLeft")
  expect(title()).toBe("[F] Geopolitical risk · backtest from Oct 25")
  expect(slider().getAttribute("aria-valuetext")).toBe("Oct 25, backtest")
  press("ArrowRight")
  expect(title()).toBe("[F] Geopolitical risk · forecast made today")
  expect(slider().getAttribute("aria-valuetext")).toBe("Today")

  press("ArrowLeft")
  press("ArrowLeft")
  press("t")
  expect(title()).toBe("[F] Geopolitical risk · forecast made today")
})

it("goes 120 days back and no further, and no further than today", () => {
  render(<ForecastPanel series={gpr} />)

  press("ArrowRight")
  expect(title()).toBe("[F] Geopolitical risk · forecast made today")
  fireEvent.change(slider(), { target: { value: "0" } })
  expect(title()).toBe("[F] Geopolitical risk · backtest from Jun 28")
  press("ArrowLeft")
  expect(title()).toBe("[F] Geopolitical risk · backtest from Jun 28")
  expect(slider().getAttribute("max")).toBe("120")
})

it("leaves the keys to a focused input, which moves itself", () => {
  render(<ForecastPanel series={gpr} />)
  fireEvent.change(slider(), { target: { value: "0" } })
  slider().focus()

  fireEvent.keyDown(slider(), { key: "ArrowRight" })
  fireEvent.keyDown(slider(), { key: "t" })
  expect(title()).toBe("[F] Geopolitical risk · backtest from Jun 28")
})

it("offers Back to today only in replay, and leaves the focus on the slider", () => {
  render(<ForecastPanel series={gpr} />)
  const back = () => screen.queryByRole("button", { name: /Back to today/ })
  expect(back()).toBeNull()

  fireEvent.change(slider(), { target: { value: "0" } })
  fireEvent.click(back()!)
  expect(title()).toBe("[F] Geopolitical risk · forecast made today")
  expect(back()).toBeNull()
  expect(document.activeElement).toBe(slider())
})

it("reads out the target day and, in replay, what happened and how many days so far landed inside", () => {
  render(<ForecastPanel series={gpr} />)
  expect(readout()).toEqual([
    "Nov 23 · 8 in 10: 111-251 · most likely 168",
    "Real value on Nov 23: not known yet",
    "Scored as each real value comes in",
  ])

  press("ArrowLeft")
  expect(readout()).toEqual([
    "Nov 22 · 8 in 10: 56-163 · most likely 101",
    "Real value on Nov 22: not known yet",
    "So far 1 of 1 day inside the range",
  ])

  fireEvent.change(slider(), { target: { value: "0" } })
  expect(readout()).toEqual([
    "Jul 26 · 8 in 10: 59-167 · most likely 104",
    "Real value: 168 · outside the range",
    "So far 19 of 28 days inside the range",
  ])
})

it("lists that day's value, then each step's ranges as text and, once known, its real value", () => {
  render(<ForecastPanel series={gpr} />)
  expect(intervals()).toEqual([
    "Today · Oct 26 · that day 165",
    "In 7 days · Nov 02 5 in 10: 143-207 8 in 10: 119-243 most likely 173",
    "In 14 days · Nov 09 5 in 10: 140-207 8 in 10: 115-247 most likely 170",
    "In 28 days · Nov 23 5 in 10: 136-207 8 in 10: 111-251 most likely 168",
  ])
  expect(screen.getByText(/^Thin line/).textContent).toBe(
    "Thin line: the 1-year range of the daily value, 22 to 501. Dotted: the day the forecast was made."
  )

  fireEvent.change(slider(), { target: { value: "0" } })
  expect(intervals()).toEqual([
    "Forecast made · Jun 28 · that day 113",
    "In 7 days · Jul 05 5 in 10: 84-132 8 in 10: 65-159 most likely 106 Real 36 · outside",
    "In 14 days · Jul 12 5 in 10: 84-133 8 in 10: 64-164 most likely 106 Real 163 · inside",
    "In 28 days · Jul 26 5 in 10: 80-133 8 in 10: 59-167 most likely 104 Real 168 · outside",
  ])
})

it("says on the source line when the forecast shown is a backtest", () => {
  render(<ForecastPanel series={gpr} />)
  expect(source()).toBe(`Source: ${latest.attribution}`)

  fireEvent.change(slider(), { target: { value: "0" } })
  expect(source()).toBe(
    `Source: ${latest.attribution} Backtest: made after the fact, with only the data up to Jun 28, but as published later: it may have been revised since. The model's training cutoff is not published, so backtests may be optimistic.`
  )
})

it("calls a past live forecast a forecast, not a backtest", () => {
  // Once the site has run a while, the replay holds live forecasts too.
  gpr.forecasts[119].backtest = false
  render(<ForecastPanel series={gpr} />)

  press("ArrowLeft")
  expect(title()).toBe("[F] Geopolitical risk · forecast made Oct 25")
  expect(slider().getAttribute("aria-valuetext")).toBe("Oct 25")
  expect(source()).toBe(`Source: ${latest.attribution}`)
})

it("puts the data date in the caution colour, and says so, while the series is stale", async () => {
  const dataTo = () => screen.getByText(/^data to/)
  render(<ForecastPanel series={gpr} />)
  expect(dataTo().textContent).toBe("data to Oct 26")
  expect(dataTo().className).not.toContain("text-destructive")
  cleanup()

  // A run that skipped GPR keeps its last files and dates the staleness in the catalog.
  const stale = { ...entry("gpr_daily"), stale_since: "2026-11-04" }
  render(<ForecastPanel series={await loadSeries(stale, { replay: true })} />)
  expect(dataTo().textContent).toBe("data to Oct 26, stale since Nov 04")
  expect(dataTo().className).toContain("text-destructive")
})

it("shows the catalog's note on the data, when it has one", async () => {
  render(<ForecastPanel series={gpr} />)
  expect(screen.queryByText(/^Note:/)).toBeNull()
  cleanup()

  const note =
    "The value of 2026-10-26 is under review, far outside its previous 28 days, so the latest forecast starts from the day before."
  const noted = { ...entry("gpr_daily"), note }
  render(<ForecastPanel series={await loadSeries(noted, { replay: true })} />)
  expect(screen.getByText(/^Note:/).textContent).toBe(`Note: ${note}`)
})

it("announces nothing as a live region, so slider steps never pile up", () => {
  render(<ForecastPanel series={gpr} />)
  expect(screen.queryByRole("status")).toBeNull()
  expect(screen.queryByRole("log")).toBeNull()
})

it("fits a real value far outside the 1-year range on the lanes, instead of pinning it to the edge", () => {
  const spike = gpr.forecasts[0]
  spike.actuals = spike.actuals.map((value, k) => (k === 6 ? 5000 : value))
  const { container } = render(<ForecastPanel series={gpr} />)
  fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } })

  const reals = [...container.querySelectorAll<HTMLElement>("i.plus")]
  expect(reals.length).toBeGreaterThan(0)
  for (const mark of reals)
    expect(parseFloat(mark.style.left)).toBeLessThan(100)
})

it("shows a sea lane with its own horizon, steps and baseline", async () => {
  const hormuz = await loadSeries(entry("hormuz_transits"), { replay: true })
  render(<ForecastPanel series={hormuz} />)

  expect(title()).toBe("[F] Strait of Hormuz · forecast made today")
  expect(screen.getByText(/^ships a day/).textContent).toBe(
    "ships a day · data to Oct 25"
  )
  // Only GPR's source revises its last month.
  expect(screen.getByText(/^Data as of/).textContent).toBe(
    `Data as of ${monthDay(hormuzActuals.as_of)}.`
  )
  expect(readout()[0]).toBe("Nov 08 · 8 in 10: 0-6 · most likely 3")
  expect(intervals()).toEqual([
    "Today · Oct 25 · that day 2",
    "In 3 days · Oct 28 5 in 10: 2-4 8 in 10: 1-6 most likely 3",
    "In 7 days · Nov 01 5 in 10: 2-4 8 in 10: 1-6 most likely 3",
    "In 14 days · Nov 08 5 in 10: 1-4 8 in 10: 0-6 most likely 3",
  ])
  expect(screen.getByText("365-day mean")).toBeTruthy()
  expect(slider().getAttribute("max")).toBe("120")
  // PortWatch's own citation starts with "Sources:": no second label before it.
  expect(screen.getByText(/^Sources?:/).textContent).toBe(
    hormuzLatest.attribution
  )
})
