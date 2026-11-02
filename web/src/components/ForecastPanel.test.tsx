import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import catalog from "@/fixtures/series.json"
import actuals from "@/fixtures/series/gpr_daily/actuals.json"
import latest from "@/fixtures/series/gpr_daily/latest.json"
import replay from "@/fixtures/series/gpr_daily/replay.json"
import brentActuals from "@/fixtures/series/brent_spot/actuals.json"
import brentLatest from "@/fixtures/series/brent_spot/latest.json"
import brentReplay from "@/fixtures/series/brent_spot/replay.json"
import hormuzActuals from "@/fixtures/series/hormuz_transits/actuals.json"
import hormuzLatest from "@/fixtures/series/hormuz_transits/latest.json"
import hormuzReplay from "@/fixtures/series/hormuz_transits/replay.json"
import dronesActuals from "@/fixtures/series/ua_drones_downed_claimed/actuals.json"
import dronesLatest from "@/fixtures/series/ua_drones_downed_claimed/latest.json"
import dronesReplay from "@/fixtures/series/ua_drones_downed_claimed/replay.json"
import viewsActuals from "@/fixtures/series/wiki_ww3_views/actuals.json"
import viewsLatest from "@/fixtures/series/wiki_ww3_views/latest.json"
import viewsReplay from "@/fixtures/series/wiki_ww3_views/replay.json"
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
  "api/v1/series/brent_spot/latest.json": brentLatest,
  "api/v1/series/brent_spot/actuals.json": brentActuals,
  "api/v1/series/brent_spot/replay.json": brentReplay,
  "api/v1/series/wiki_ww3_views/latest.json": viewsLatest,
  "api/v1/series/wiki_ww3_views/actuals.json": viewsActuals,
  "api/v1/series/wiki_ww3_views/replay.json": viewsReplay,
  "api/v1/series/ua_drones_downed_claimed/latest.json": dronesLatest,
  "api/v1/series/ua_drones_downed_claimed/actuals.json": dronesActuals,
  "api/v1/series/ua_drones_downed_claimed/replay.json": dronesReplay,
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
  prefers(false)
  // Back to jsdom's own visible document.
  delete (document as { hidden?: boolean }).hidden
})

// The page reads the one list jsdom's stand-in gives for the query (see test-setup.ts).
const prefers = (reduce: boolean) =>
  Object.assign(matchMedia("(prefers-reduced-motion: reduce)"), {
    matches: reduce,
  })

// latest.json's forecast was made on 2026-10-31: that day, the page calls it today.
beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-31T12:00:00Z"), toFake: ["Date"] })
})

const title = () => screen.getByRole("heading", { level: 2 }).textContent
const subtitle = () =>
  screen.getByRole("heading", { level: 2 }).nextElementSibling!.textContent
const slider = () =>
  screen.getByRole("slider", { name: "Replay a past forecast" })
const press = (key: string) => fireEvent.keyDown(document.body, { key })
// A disclosure's lines, whether it is open or shut.
const layer = (name: string) =>
  [
    ...document.getElementById(
      screen.getByRole("button", { name }).getAttribute("aria-controls")!
    )!.children,
  ].map((p) => p.textContent)

it("titles today's forecast with its takeaway, the series and its unit under it", () => {
  render(<ForecastPanel series={gpr} />)

  // Rounded outward, so it holds the model's 111-251.
  expect(title()).toBe("Likely 110-260 by Nov 23, about where it is now")
  expect(subtitle()).toBe("Geopolitical risk · index (1985-2019 average = 100)")
  // The landmark says which series it is, then what it says.
  expect(
    screen.getByRole("region", {
      name: "Geopolitical risk Likely 110-260 by Nov 23, about where it is now",
    })
  ).toBeTruthy()
  expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
    "Geopolitical risk: daily values to Oct 26, the last 165 (7-day average 181), then the forecast: likely 111-251 by Nov 23, where 8 in 10 days land. The gold line is path 1 of 20 drawn from the forecast, the most likely first."
  )
})

// The hero's chance, worked out once as the series loads.
it("leans today's title the way the series' chance above the last value says", () => {
  gpr.today.chances = { above: 0.9, below: 0.1 }
  render(<ForecastPanel series={gpr} />)
  expect(title()).toBe("Likely 110-260 by Nov 23, likely higher than now")
})

it("keeps how to read it, its numbers and its sources one tap away each, all shut at first", () => {
  render(<ForecastPanel series={gpr} />)

  const shut = ["How to read this", "Show the numbers", "Sources"].map((name) =>
    screen.getByRole("button", { name })
  )
  expect(shut.map((b) => b.getAttribute("aria-expanded"))).toEqual([
    "false",
    "false",
    "false",
  ])
  // No legend and no paragraph under the chart: the chart's labels say it on the marks.
  expect(screen.queryByRole("list")).toBeNull()
  expect(layer("How to read this")).toEqual([
    "The shaded range is where 8 in 10 days should land; 2 in 10 land outside. It is not a high and a low.",
    "The darker core: half the days land there.",
    "The gold line is one of 20 possible paths drawn from the forecast, the most likely first. Play shows the others, one at a time. No one knows which days turn out high.",
    "Values follow the week: compare a Monday with a Monday.",
    "Normal: its 1985-2019 average, 100. In a replay, the white line carries on with what happened.",
  ])

  fireEvent.click(shut[1])
  expect(shut[1].getAttribute("aria-expanded")).toBe("true")
  expect(screen.getByText(/^Nov 02 \(7 days\)/)).toBeTruthy()
})

it("replays the forecast of the day before with ←, then today's with → or T", () => {
  render(<ForecastPanel series={gpr} />)

  press("ArrowLeft")
  expect(title()).toBe("Backtest made Oct 25: likely 50-170 by Nov 22")
  expect(slider().getAttribute("aria-valuetext")).toBe("Oct 25, backtest")
  // The replay says which data what happened is, as read that day.
  expect(subtitle()).toBe(
    `Geopolitical risk · index (1985-2019 average = 100) · what happened as of ${monthDay(actuals.as_of)}`
  )
  press("ArrowRight")
  expect(title()).toBe("Likely 110-260 by Nov 23, about where it is now")
  expect(slider().getAttribute("aria-valuetext")).toBe("Today")

  press("ArrowLeft")
  press("ArrowLeft")
  press("t")
  expect(title()).toBe("Likely 110-260 by Nov 23, about where it is now")
})

it("starts on the past forecast the record opened, or on today's when the replay lacks it", () => {
  render(<ForecastPanel series={gpr} opened="2026-08-03" />)
  expect(title()).toMatch(/^Backtest made Aug 03: likely/)
  expect(slider().getAttribute("aria-valuetext")).toBe("Aug 03, backtest")
  cleanup()

  render(<ForecastPanel series={gpr} opened="2025-08-03" />)
  expect(title()).toMatch(/^Likely/)
})

it("goes 120 days back and no further, and no further than today", () => {
  render(<ForecastPanel series={gpr} />)

  press("ArrowRight")
  expect(title()).toMatch(/^Likely/)
  fireEvent.change(slider(), { target: { value: "0" } })
  expect(title()).toMatch(/^Backtest made Jun 28:/)
  press("ArrowLeft")
  expect(title()).toMatch(/^Backtest made Jun 28:/)
  expect(slider().getAttribute("max")).toBe("120")
})

it("leaves the keys to a focused input, which moves itself", () => {
  render(<ForecastPanel series={gpr} />)
  fireEvent.change(slider(), { target: { value: "0" } })
  slider().focus()

  fireEvent.keyDown(slider(), { key: "ArrowRight" })
  fireEvent.keyDown(slider(), { key: "t" })
  expect(title()).toMatch(/^Backtest made Jun 28:/)
})

it("offers Back to today only in replay, and leaves the focus on the slider", () => {
  render(<ForecastPanel series={gpr} />)
  const back = () => screen.queryByRole("button", { name: /Back to today/ })
  expect(back()).toBeNull()

  fireEvent.change(slider(), { target: { value: "0" } })
  fireEvent.click(back()!)
  expect(title()).toMatch(/^Likely/)
  expect(back()).toBeNull()
  expect(document.activeElement).toBe(slider())
})

it("shows the numbers: that day's value, each step's range, middle half and middle estimate, and once known what happened", () => {
  render(<ForecastPanel series={gpr} />)
  expect(layer("Show the numbers")).toEqual([
    "Oct 26, last data: 165",
    "Nov 02 (7 days): likely 119-243 · middle half 143-207 · middle estimate 173",
    "Nov 09 (14 days): likely 115-247 · middle half 140-207 · middle estimate 170",
    "Nov 23 (28 days): likely 111-251 · middle half 136-207 · middle estimate 168",
    "1-year range of the daily value to Oct 26: 22-501",
  ])

  fireEvent.change(slider(), { target: { value: "0" } })
  expect(layer("Show the numbers").slice(0, 4)).toEqual([
    "Jun 28, last data: 113",
    "Jul 05 (7 days): likely 65-159 · middle half 84-132 · middle estimate 106 · what happened 36, outside",
    "Jul 12 (14 days): likely 64-164 · middle half 84-133 · middle estimate 106 · what happened 163, in range",
    "Jul 26 (28 days): likely 59-167 · middle half 80-133 · middle estimate 104 · what happened 168, outside",
  ])
  // In the chart's words for screen readers too.
  expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(
    / What happened: 19 of 28 days in range\.$/
  )
})

it("says in its sources when the data was read, and when the forecast shown is a backtest", () => {
  render(<ForecastPanel series={gpr} />)
  expect(layer("Sources")).toEqual([
    `Source: ${latest.attribution}`,
    `Data as of ${monthDay(actuals.as_of)}, preliminary for about 4 weeks.`,
  ])

  fireEvent.change(slider(), { target: { value: "0" } })
  expect(layer("Sources")[2]).toBe(
    "Backtest: made after the fact, with only the data up to Jun 28, but as published later: it may have been revised since. The model's training cutoff is not published, so backtests may be optimistic."
  )
})

it("calls a past live forecast a forecast, not a backtest", () => {
  // Once the site has run a while, the replay holds live forecasts too.
  gpr.forecasts[119].backtest = false
  render(<ForecastPanel series={gpr} />)

  press("ArrowLeft")
  expect(title()).toMatch(/^Forecast made Oct 25:/)
  expect(slider().getAttribute("aria-valuetext")).toBe("Oct 25")
  expect(layer("Sources")).toHaveLength(2)
})

it("cautions in words, with a caution's marker, while the series is stale", async () => {
  render(<ForecastPanel series={gpr} />)
  expect(screen.queryByText(/stale since/)).toBeNull()
  cleanup()

  // A run that skipped GPR keeps its last files and dates the staleness in the catalog.
  const stale = { ...entry("gpr_daily"), stale_since: "2026-11-04" }
  render(<ForecastPanel series={await loadSeries(stale, { replay: true })} />)
  const caution = screen.getByText(/stale since/)
  expect(caution.textContent).toBe("data to Oct 26, stale since Nov 04")
  expect(caution.className).toContain("caution")
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

it("shows a sea lane with its own horizon, steps and baseline", async () => {
  const hormuz = await loadSeries(entry("hormuz_transits"), { replay: true })
  render(<ForecastPanel series={hormuz} />)

  // Rounded outward: the model's 0.x to 6.x ships.
  expect(title()).toMatch(/^Likely 0-7 by Nov 08, /)
  expect(subtitle()).toBe("Strait of Hormuz · ships a day")
  // Only GPR's source revises its last month.
  expect(layer("Sources")[1]).toBe(
    `Data as of ${monthDay(hormuzActuals.as_of)}.`
  )
  // No weekday line: the sea lanes have no weekly cycle.
  expect(layer("How to read this")).toHaveLength(4)
  expect(layer("How to read this")[3]).toMatch(
    /^Normal: its 365-day mean, 27\./
  )
  expect(layer("Show the numbers").slice(1, 4)).toEqual([
    "Oct 28 (3 days): likely 1-6 · middle half 2-4 · middle estimate 3",
    "Nov 01 (7 days): likely 1-6 · middle half 2-4 · middle estimate 3",
    "Nov 08 (14 days): likely 0-6 · middle half 1-4 · middle estimate 3",
  ])
  expect(slider().getAttribute("max")).toBe("120")
  // PortWatch's own citation starts with "Sources:": no second label before it.
  expect(layer("Sources")[0]).toBe(hormuzLatest.attribution)
})

const weekend = (date: string) =>
  [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())

it("shows Brent on trading days, today and in every replay, with no weekend date", async () => {
  const brent = await loadSeries(entry("brent_spot"), { replay: true })
  render(<ForecastPanel series={brent} />)

  expect(
    layer("Show the numbers")
      .slice(1, 4)
      .map((row) => row!.match(/\((.*?)\)/)![1])
  ).toEqual(["3 trading days", "7 trading days", "14 trading days"])
  expect(brent.forecasts.length).toBeGreaterThan(60)
  for (const forecast of brent.forecasts)
    expect(forecast.targetDates.filter(weekend)).toEqual([])
  // A past forecast's steps are the prints after it, as it is scored: holidays have none.
  const past = brent.forecasts[0]
  const made = brentActuals.date.indexOf(past.dates.at(-1)!)
  expect(past.targetDates).toEqual(
    brentActuals.date.slice(made + 1, made + 1 + 14)
  )
  // The average of a week of prices: the prints of the 7 days to the reference date.
  const reference = Date.parse(brentLatest.reference_date)
  const week = brentActuals.observation.filter((_, i) => {
    const t = Date.parse(brentActuals.date[i])
    return t > reference - 7 * 86_400_000 && t <= reference
  })
  expect(week.length).toBeLessThanOrEqual(5)
  expect(brent.today.sevenDayAverage).toBeCloseTo(
    week.reduce((sum, v) => sum + v, 0) / week.length
  )
  expect(screen.getByText(/^Note:/).textContent).toMatch(/trading days only/)
  expect(layer("How to read this").join(" ")).not.toMatch(/week/)
})

it("tells to compare a weekday with the same weekday where the catalog says the values follow the week", async () => {
  const views = await loadSeries(entry("wiki_ww3_views"), { replay: true })
  render(<ForecastPanel series={views} />)

  expect(subtitle()).toBe('"World War III" · Wikipedia views a day')
  const day = new Date(
    `${viewsLatest.reference_date}T00:00:00Z`
  ).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
  expect(layer("How to read this")[3]).toBe(
    `Values follow the week: compare a ${day} with a ${day}.`
  )
  expect(screen.getByText(/^Note:/).textContent).toBe(
    "Note: Counts attention, not events: views of the English Wikipedia article by people, not bots."
  )
})

it("labels the drones as one side's claims wherever their unit shows", async () => {
  const drones = await loadSeries(entry("ua_drones_downed_claimed"), {
    replay: true,
  })
  render(<ForecastPanel series={drones} />)

  expect(subtitle()).toBe(
    "Drones downed · drones a day, claimed by Ukraine's General Staff, one side's figures"
  )
  expect(layer("Sources")[0]).toBe(`Source: ${dronesLatest.attribution}`)
  expect(layer("Sources")[0]).toMatch(
    /claimed by Ukraine's General Staff, one side's figures/
  )
  expect(layer("How to read this").join(" ")).not.toMatch(/week/)
})

// The possible paths turn on an interval, which these tests advance by hand.
const turning = () =>
  vi.useFakeTimers({
    now: new Date("2026-10-31T12:00:00Z"),
    toFake: ["Date", "setInterval", "clearInterval"],
  })
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const pathShown = () => screen.getByText(/^Path \d+ of 20/).textContent
const button = (name: string) => screen.getByRole("button", { name })

it("opens on the most likely of the model's 20 paths, and turns none until asked", () => {
  turning()
  render(<ForecastPanel series={gpr} />)

  wait(6000)
  expect(pathShown()).toBe("Path 1 of 20, the most likely")
  expect(screen.queryByRole("button", { name: "Most likely" })).toBeNull()
})

it("plays the other paths in order, one every 1.2 s, until paused", () => {
  turning()
  render(<ForecastPanel series={gpr} />)
  const play = button("Play")
  play.focus()

  fireEvent.click(play)
  expect(document.activeElement).toBe(play)
  expect(play.textContent).toBe("Pause")
  wait(1200)
  expect(pathShown()).toBe("Path 2 of 20")
  wait(18 * 1200)
  expect(pathShown()).toBe("Path 20 of 20")
  wait(1200)
  expect(pathShown()).toBe("Path 1 of 20, the most likely")

  fireEvent.click(play)
  wait(6000)
  expect(pathShown()).toBe("Path 1 of 20, the most likely")
  fireEvent.click(button("Next path"))
  expect(pathShown()).toBe("Path 2 of 20")
})

it("turns no path while the tab is hidden or the panel is off screen", () => {
  let onScreen: (shown: boolean) => void = () => {}
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        onScreen = (shown) =>
          callback(
            [{ isIntersecting: shown } as IntersectionObserverEntry],
            this as never
          )
      }
      observe() {}
      disconnect() {}
    }
  )
  const hide = (hidden: boolean) => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: hidden,
    })
    document.dispatchEvent(new Event("visibilitychange"))
  }
  turning()
  render(<ForecastPanel series={gpr} />)
  fireEvent.click(button("Play"))

  hide(true)
  wait(6000)
  expect(pathShown()).toBe("Path 1 of 20, the most likely")
  hide(false)
  wait(1200)
  expect(pathShown()).toBe("Path 2 of 20")

  act(() => onScreen(false))
  wait(6000)
  expect(pathShown()).toBe("Path 2 of 20")
  act(() => onScreen(true))
  wait(1200)
  expect(pathShown()).toBe("Path 3 of 20")
})

it("turns no path under reduced motion, and still steps through them on demand", () => {
  prefers(true)
  turning()
  render(<ForecastPanel series={gpr} />)

  wait(6000)
  expect(vi.getTimerCount()).toBe(0)
  expect(screen.queryByRole("button", { name: /^(Pause|Play)$/ })).toBeNull()
  expect(pathShown()).toBe("Path 1 of 20, the most likely")
  fireEvent.click(button("Next path"))
  expect(pathShown()).toBe("Path 2 of 20")
})

it("labels the slider's handle with the day it picks, Today for today's, on the side with room", () => {
  render(<ForecastPanel series={gpr} />)
  const handle = () => screen.getByTestId("handle-label")
  // Today's forecast, at the right end: its label sits left of the handle, and the end of the
  // track does not say it twice.
  expect(handle().textContent).toBe("Today")
  expect(handle().style.translate).toMatch(/^calc\(-100%/)
  expect(
    screen.getByText("Today", { selector: "p > span" }).style.visibility
  ).toBe("hidden")

  fireEvent.change(slider(), { target: { value: "0" } })
  expect(handle().textContent).toBe("Jun 28")
  expect(handle().style.translate).toBe("12px")
  // Its words are for the eye: the slider says the day itself.
  expect(handle().closest("[aria-hidden]")).not.toBeNull()
  expect(slider().getAttribute("aria-valuetext")).toBe("Jun 28, backtest")
})
