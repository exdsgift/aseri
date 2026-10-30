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

import { App } from "./App"

// What the daily runs published, at the URLs the page reads: GPR's of 2026-10-30,
// and the four sea lanes of the prototype's run of 2026-10-29.
const published: Record<string, unknown> = Object.fromEntries(
  Object.entries(
    import.meta.glob("./fixtures/**/*.json", { eager: true, import: "default" })
  ).map(([path, file]) => [path.replace("./fixtures/", "api/v1/"), file])
)
const serve = (files: Record<string, unknown>) =>
  vi.stubGlobal("fetch", async (url: string) => Response.json(files[url]))

// jsdom lays nothing out, so the chart never learns its width and draws nothing,
// and it cannot scroll.
let scrollIntoView: ReturnType<typeof vi.fn<Element["scrollIntoView"]>>
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  scrollIntoView = vi.fn()
  Element.prototype.scrollIntoView = scrollIntoView
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
// The day latest.json's forecast was made, so the panel calls it today.
beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-30T12:00:00Z"), toFake: ["Date"] })
})

it("shows the GPR 7-day average and the forecast for the same weekday 4 weeks on", async () => {
  vi.stubGlobal("fetch", async (url: string) => Response.json(published[url]))

  render(<App />)

  await screen.findByText("181", { selector: "p" })
  const wordmark = screen.getByRole("heading", { level: 1 })
  expect(wordmark.textContent).toBe("焦りあせり · aseri")
  const hero = within(wordmark.closest("section")!)
  expect(hero.getAllByRole("paragraph").map((p) => p.textContent)).toEqual([
    "Geopolitical risk · today",
    "181",
    "7-day average to Oct 26",
    "81% above its 1985-2019 average",
    "Monday Nov 23, 4 weeks from the last data: most likely 168. 8 in 10 between 111 and 251. (Last Monday: 165)",
  ])
})

it("says so in one plain line when the data cannot be loaded", async () => {
  vi.stubGlobal("fetch", async () => new Response("", { status: 404 }))
  vi.spyOn(console, "error").mockImplementation(() => {})

  render(<App />)

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Couldn't load today's data. Refresh to try again."
  )
  expect(screen.queryByRole("region")).toBeNull()
})

// The chart draws one forecast per day up to the hero's step, at five levels.
const pick = (rows: number[], at: number[]) => at.map((i) => rows[i])
it.each([
  [
    "only the 7, 14 and 28-day steps",
    {
      ...latest,
      horizon: [7, 14, 28],
      target_end_date: pick(latest.target_end_date as never, [6, 13, 27]),
      quantiles: Object.fromEntries(
        Object.entries(latest.quantiles).map(([level, rows]) => [
          level,
          pick(rows, [6, 13, 27]),
        ])
      ),
    },
  ],
  [
    "days past the catalog's horizon",
    {
      ...latest,
      horizon: [...latest.horizon, 29],
      target_end_date: [...latest.target_end_date, "2026-11-24"],
      quantiles: Object.fromEntries(
        Object.entries(latest.quantiles).map(([level, rows]) => [
          level,
          [...rows, rows.at(-1)],
        ])
      ),
    },
  ],
  [
    "no 5-in-10 range",
    {
      ...latest,
      quantiles: { ...latest.quantiles, "0.25": undefined },
    },
  ],
])("refuses a forecast file with %s", async (_, broken) => {
  vi.stubGlobal("fetch", async (url: string) =>
    Response.json(
      { ...published, "api/v1/series/gpr_daily/latest.json": broken }[url]
    )
  )
  vi.spyOn(console, "error").mockImplementation(() => {})

  render(<App />)

  expect(await screen.findByRole("alert")).toBeTruthy()
})

it.each([
  [
    "a past forecast without its 5-in-10 range",
    {
      ...replay,
      forecasts: replay.forecasts.map((f, i) =>
        i === 3 ? { ...f, quantiles: { ...f.quantiles, "0.25": undefined } } : f
      ),
    },
  ],
  [
    "a past forecast made before the actuals start",
    {
      ...replay,
      forecasts: replay.forecasts.map((f, i) =>
        i === 0 ? { ...f, reference_date: "2025-01-06" } : f
      ),
    },
  ],
])(
  "drops %s from the replay, and keeps today's forecast",
  async (_, broken) => {
    vi.stubGlobal("fetch", async (url: string) =>
      Response.json(
        { ...published, "api/v1/series/gpr_daily/replay.json": broken }[url]
      )
    )

    render(<App />)

    await screen.findByText("181", { selector: "p" })
    // 120 past forecasts and today's, less the broken one.
    expect(screen.getByRole("slider").getAttribute("max")).toBe("119")
  }
)

it("shows today's forecast without the replay when the replay file is missing", async () => {
  vi.stubGlobal("fetch", async (url: string) =>
    url.endsWith("replay.json")
      ? new Response("", { status: 404 })
      : Response.json(published[url])
  )
  vi.spyOn(console, "error").mockImplementation(() => {})

  render(<App />)

  await screen.findByText("181", { selector: "p" })
  expect(
    screen.getByRole("region", { name: /forecast made today/ })
  ).toBeTruthy()
  expect(screen.queryByRole("slider")).toBeNull()
})

it("never scores today's forecast, even when the actuals run ahead of it", async () => {
  const aheadByTwoDays = {
    ...actuals,
    date: [...actuals.date, "2026-10-27", "2026-10-28"],
    observation: [...actuals.observation, 150, 160],
  }
  vi.stubGlobal("fetch", async (url: string) =>
    Response.json(
      { ...published, "api/v1/series/gpr_daily/actuals.json": aheadByTwoDays }[
        url
      ]
    )
  )

  render(<App />)

  expect(
    await screen.findByText(/^Real value on Nov 23: not known yet/)
  ).toBeTruthy()
  expect(screen.queryByText(/^So far/)).toBeNull()
})

it("shows today's GPR forecast in the panel, from one load of each file", async () => {
  const fetch = vi.fn(async (url: string) => Response.json(published[url]))
  vi.stubGlobal("fetch", fetch)

  render(<App />)

  const panel = within(
    await screen.findByRole("region", {
      name: "[F] Geopolitical risk · forecast made today",
    })
  )
  const paragraphs = panel.getAllByRole("paragraph").map((p) => p.textContent)
  expect(paragraphs.slice(0, 2)).toEqual([
    "index (1985-2019 average = 100) · data to Oct 26",
    "Nov 23: most likely 168 · 8 in 10: 111-251",
  ])
  expect(paragraphs.at(-1)).toBe(`Source: ${latest.attribution}`)
  const legend = within(panel.getAllByRole("list")[0])
  expect(legend.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
    "Daily value",
    "7-day average",
    "What happened",
    "Most likely",
    "5 in 10",
    "8 in 10",
    "Forecast made",
  ])
  expect(panel.getByRole("img").getAttribute("aria-label")).toBe(
    "Geopolitical risk: daily values, 165 on Oct 26 (7-day average 181), then the forecast of the daily value to Nov 23: most likely 168, 8 in 10 between 111 and 251."
  )
  // Every file but the other series' replays, which wait for their card to be picked.
  expect(fetch.mock.calls.map(([url]) => url).toSorted()).toEqual(
    Object.keys(published)
      .filter(
        (url) => url.includes("gpr_daily") || !url.endsWith("replay.json")
      )
      .toSorted()
  )
})

it("averages the 7 days that end on the forecast's reference date, even when the actuals run a day ahead", async () => {
  const aheadByOneDay = {
    ...actuals,
    date: [...actuals.date, "2026-10-27"],
    observation: [...actuals.observation, 1000],
  }
  vi.stubGlobal("fetch", async (url: string) =>
    Response.json(
      { ...published, "api/v1/series/gpr_daily/actuals.json": aheadByOneDay }[
        url
      ]
    )
  )

  render(<App />)

  expect(await screen.findByText("181", { selector: "p" })).toBeTruthy()
})

it("groups a card for each series in the catalog, with its 7-day average, its change and one day's range", async () => {
  serve(published)

  render(<App />)

  const signals = within(await screen.findByRole("region", { name: "Signals" }))
  expect(
    signals.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
  ).toEqual(["Risk, attention and oil", "Sea lanes"])
  expect(signals.getAllByRole("button").map((b) => b.textContent)).toEqual([
    "Geopolitical risk [1] 181 index (1985-2019 average = 100) 7-day average to Oct 26 81% above its 1985-2019 average In 28 days: 111-251 8 in 10 for Nov 23 alone",
    "Suez Canal [2] 41 ships a day 7-day average to Oct 25 1% above its 365-day mean In 28 days: 33-51 8 in 10 for Nov 22 alone",
    "Strait of Hormuz [3] 3 ships a day 7-day average to Oct 25 88% below its 365-day mean In 14 days: 0-6 8 in 10 for Nov 08 alone",
    "Bab el-Mandeb [4] 29 ships a day 7-day average to Oct 25 14% below its 365-day mean In 14 days: 20-36 8 in 10 for Nov 08 alone",
    "Taiwan Strait [5] 190 ships a day 7-day average to Oct 25 18% below its 365-day mean In 28 days: 183-268 8 in 10 for Nov 22 alone",
  ])
  // The key hint is for the eye: the button says it as a shortcut.
  const suez = signals.getByRole("button", { name: /^Suez Canal 41 ships/ })
  expect(suez.getAttribute("aria-keyshortcuts")).toBe("2")
})

it("cautions on a stale series' card, in words as well as in colour", async () => {
  serve({
    ...published,
    "api/v1/series.json": {
      ...catalog,
      series: catalog.series.map((entry) =>
        entry.series_id === "suez_transits"
          ? { ...entry, stale_since: "2026-11-04" }
          : entry
      ),
    },
  })

  render(<App />)

  const suez = await screen.findByRole("button", { name: /^Suez Canal/ })
  const dataTo = within(suez).getByText(/^7-day average to/)
  expect(dataTo.textContent).toBe("7-day average to Oct 25, stale since Nov 04")
  expect(dataTo.className).toContain("text-destructive")
})

it("leaves out the card of a series whose files are broken, and keeps the page", async () => {
  vi.stubGlobal("fetch", async (url: string) =>
    url.includes("hormuz_transits")
      ? new Response("", { status: 404 })
      : Response.json(published[url])
  )
  vi.spyOn(console, "error").mockImplementation(() => {})

  render(<App />)

  const signals = within(await screen.findByRole("region", { name: "Signals" }))
  expect(
    signals
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-keyshortcuts"))
  ).toEqual(["1", "2", "3", "4"])
  expect(
    signals.queryByRole("button", { name: /^Strait of Hormuz/ })
  ).toBeNull()
})

it("draws no group without a series in the catalog", async () => {
  serve({
    ...published,
    "api/v1/series.json": { ...catalog, series: catalog.series.slice(0, 1) },
  })

  render(<App />)

  const signals = within(await screen.findByRole("region", { name: "Signals" }))
  expect(
    signals.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
  ).toEqual(["Risk, attention and oil"])
  expect(signals.getAllByRole("button")).toHaveLength(1)
})

const card = (name: RegExp) => screen.getByRole("button", { name })
const panelTitle = () =>
  screen.getAllByRole("heading", { level: 2 })[0].textContent

it("opens a picked card's series in the panel and brings it into view, then loads its replay, while the hero stays on GPR", async () => {
  const fetch = vi.fn(async (url: string) => Response.json(published[url]))
  vi.stubGlobal("fetch", fetch)
  render(<App />)
  await screen.findByRole("region", { name: "Signals" })

  fireEvent.click(card(/^Suez Canal/))

  expect(panelTitle()).toBe("[F] Suez Canal · forecast made Oct 29")
  expect(card(/^Suez Canal/).getAttribute("aria-pressed")).toBe("true")
  expect(card(/^Geopolitical risk/).getAttribute("aria-pressed")).toBe("false")
  const panel = screen.getByRole("region", { name: /^\[F\] Suez Canal/ })
  expect(scrollIntoView.mock.contexts.at(-1)).toContain(panel)
  expect(fetch).toHaveBeenCalledWith("api/v1/series/suez_transits/replay.json")
  // The replay's 120 past forecasts, then today's.
  expect((await screen.findByRole("slider")).getAttribute("max")).toBe("120")
  expect(screen.getByText("181", { selector: "p" })).toBeTruthy()
})

it("opens a series with its card's key, unless a field has the focus", async () => {
  serve(published)
  render(<App />)
  await screen.findByRole("region", { name: "Signals" })
  const press = (key: string, target: Element = document.body) =>
    fireEvent.keyDown(target, { key })

  press("3")
  expect(panelTitle()).toBe("[F] Strait of Hormuz · forecast made Oct 29")
  expect(scrollIntoView).toHaveBeenCalled()

  // The slider takes its own keys.
  const slider = await screen.findByRole("slider")
  slider.focus()
  press("1", slider)
  expect(panelTitle()).toBe("[F] Strait of Hormuz · forecast made Oct 29")

  // No sixth card, and no shortcut with a modifier.
  press("6")
  press("1", document.body)
  fireEvent.keyDown(document.body, { key: "2", ctrlKey: true })
  expect(panelTitle()).toBe("[F] Geopolitical risk · forecast made today")
})
