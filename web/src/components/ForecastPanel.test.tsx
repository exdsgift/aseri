import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import actuals from "@/fixtures/actuals.json"
import latest from "@/fixtures/latest.json"
import replay from "@/fixtures/replay.json"
import catalog from "@/fixtures/series.json"
import { loadGpr, type Gpr } from "@/lib/api"

import { ForecastPanel } from "./ForecastPanel"

let gpr: Gpr

// jsdom lays nothing out and has no canvas: the chart draws nothing.
beforeEach(async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  const published: Record<string, unknown> = {
    "api/v1/series.json": catalog,
    "api/v1/series/gpr_daily/latest.json": latest,
    "api/v1/series/gpr_daily/actuals.json": actuals,
    "api/v1/series/gpr_daily/replay.json": replay,
  }
  vi.stubGlobal("fetch", async (url: string) => Response.json(published[url]))
  gpr = await loadGpr()
})
afterEach(cleanup)

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

it("replays the forecast of the day before with ←, then today's with → or T", () => {
  render(<ForecastPanel gpr={gpr} />)
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
  render(<ForecastPanel gpr={gpr} />)

  press("ArrowRight")
  expect(title()).toBe("[F] Geopolitical risk · forecast made today")
  fireEvent.change(slider(), { target: { value: "0" } })
  expect(title()).toBe("[F] Geopolitical risk · backtest from Jun 28")
  press("ArrowLeft")
  expect(title()).toBe("[F] Geopolitical risk · backtest from Jun 28")
  expect(slider().getAttribute("max")).toBe("120")
})

it("leaves the keys to a focused input, which moves itself", () => {
  render(<ForecastPanel gpr={gpr} />)
  fireEvent.change(slider(), { target: { value: "0" } })
  slider().focus()

  fireEvent.keyDown(slider(), { key: "ArrowRight" })
  fireEvent.keyDown(slider(), { key: "t" })
  expect(title()).toBe("[F] Geopolitical risk · backtest from Jun 28")
})

it("offers Back to today only in replay, and leaves the focus on the slider", () => {
  render(<ForecastPanel gpr={gpr} />)
  const back = () => screen.queryByRole("button", { name: /Back to today/ })
  expect(back()).toBeNull()

  fireEvent.change(slider(), { target: { value: "0" } })
  fireEvent.click(back()!)
  expect(title()).toBe("[F] Geopolitical risk · forecast made today")
  expect(back()).toBeNull()
  expect(document.activeElement).toBe(slider())
})

it("reads out the target day and, in replay, what happened and how many days so far landed inside", () => {
  render(<ForecastPanel gpr={gpr} />)
  expect(readout()).toEqual([
    "Nov 23: most likely 168 · 8 in 10: 111-251",
    "Real value on Nov 23: not known yet",
    "Scored as each real value comes in",
  ])

  press("ArrowLeft")
  expect(readout()).toEqual([
    "Nov 22: most likely 101 · 8 in 10: 56-163",
    "Real value on Nov 22: not known yet",
    "So far 1 of 1 day inside the range",
  ])

  fireEvent.change(slider(), { target: { value: "0" } })
  expect(readout()).toEqual([
    "Jul 26: most likely 104 · 8 in 10: 59-167",
    "Real value: 168 · outside the range",
    "So far 19 of 28 days inside the range",
  ])
})

it("lists that day's value, then each step's ranges as text and, once known, its real value", () => {
  render(<ForecastPanel gpr={gpr} />)
  expect(intervals()).toEqual([
    "Today · Oct 26 · that day 165",
    "In 7 days · Nov 02 most likely 173 5 in 10: 143-207 8 in 10: 119-243",
    "In 14 days · Nov 09 most likely 170 5 in 10: 140-207 8 in 10: 115-247",
    "In 28 days · Nov 23 most likely 168 5 in 10: 136-207 8 in 10: 111-251",
  ])
  expect(screen.getByText(/^Thin line/).textContent).toBe(
    "Thin line: the 1-year range of the daily value, 22 to 501. Dotted: the day the forecast was made."
  )

  fireEvent.change(slider(), { target: { value: "0" } })
  expect(intervals()).toEqual([
    "Forecast made · Jun 28 · that day 113",
    "In 7 days · Jul 05 most likely 106 5 in 10: 84-132 8 in 10: 65-159 Real 36 · outside",
    "In 14 days · Jul 12 most likely 106 5 in 10: 84-133 8 in 10: 64-164 Real 163 · inside",
    "In 28 days · Jul 26 most likely 104 5 in 10: 80-133 8 in 10: 59-167 Real 168 · outside",
  ])
})

it("says on the source line when the forecast shown is a backtest", () => {
  render(<ForecastPanel gpr={gpr} />)
  expect(source()).toBe(`Source: ${latest.attribution}`)

  fireEvent.change(slider(), { target: { value: "0" } })
  expect(source()).toBe(
    `Source: ${latest.attribution} Backtest: made after the fact, with only the data up to Jun 28, but as published later: it may have been revised since. The model's training cutoff is not published, so backtests may be optimistic.`
  )
})

it("calls a past live forecast a forecast, not a backtest", () => {
  // Once the site has run a while, the replay holds live forecasts too.
  gpr.forecasts[119].backtest = false
  render(<ForecastPanel gpr={gpr} />)

  press("ArrowLeft")
  expect(title()).toBe("[F] Geopolitical risk · forecast made Oct 25")
  expect(slider().getAttribute("aria-valuetext")).toBe("Oct 25")
  expect(source()).toBe(`Source: ${latest.attribution}`)
})

it("announces nothing as a live region, so slider steps never pile up", () => {
  render(<ForecastPanel gpr={gpr} />)
  expect(screen.queryByRole("status")).toBeNull()
  expect(screen.queryByRole("log")).toBeNull()
})

it("fits a real value far outside the 1-year range on the lanes, instead of pinning it to the edge", () => {
  const spike = gpr.forecasts[0]
  spike.actuals = spike.actuals.map((value, k) => (k === 6 ? 5000 : value))
  const { container } = render(<ForecastPanel gpr={gpr} />)
  fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } })

  const reals = [...container.querySelectorAll<HTMLElement>("i.bg-white")]
  expect(reals.length).toBeGreaterThan(0)
  for (const mark of reals)
    expect(parseFloat(mark.style.left)).toBeLessThan(100)
})
