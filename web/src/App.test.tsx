import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import actuals from "@/fixtures/actuals.json"
import latest from "@/fixtures/latest.json"
import replay from "@/fixtures/replay.json"
import catalog from "@/fixtures/series.json"

import { App } from "./App"

// What a real daily run published on 2026-10-29, at the URLs the page reads.
const published: Record<string, unknown> = {
  "api/v1/series.json": catalog,
  "api/v1/series/gpr_daily/latest.json": latest,
  "api/v1/series/gpr_daily/actuals.json": actuals,
  "api/v1/series/gpr_daily/replay.json": replay,
}

// jsdom lays nothing out, so the chart never learns its width and draws nothing.
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
})
afterEach(cleanup)

it("shows the GPR 7-day average and the forecast for the same weekday 4 weeks on", async () => {
  vi.stubGlobal("fetch", async (url: string) => Response.json(published[url]))

  render(<App />)

  await screen.findByText("181")
  const wordmark = screen.getByRole("heading", { level: 1 })
  expect(wordmark.textContent).toBe("焦りあせり · aseri")
  const hero = within(wordmark.closest("section")!)
  expect(hero.getAllByRole("paragraph").map((p) => p.textContent)).toEqual([
    "Geopolitical risk · today",
    "181",
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
      forecasts: [
        { ...replay.forecasts[0], reference_date: "2025-01-06" },
        ...replay.forecasts,
      ],
    },
  ],
])("refuses a replay file with %s", async (_, broken) => {
  vi.stubGlobal("fetch", async (url: string) =>
    Response.json(
      { ...published, "api/v1/series/gpr_daily/replay.json": broken }[url]
    )
  )
  vi.spyOn(console, "error").mockImplementation(() => {})

  render(<App />)

  expect(await screen.findByRole("alert")).toBeTruthy()
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
  expect(fetch.mock.calls.map(([url]) => url).toSorted()).toEqual(
    Object.keys(published).toSorted()
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

  expect(await screen.findByText("181")).toBeTruthy()
})
