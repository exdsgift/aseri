import { afterEach, expect, it, vi } from "vitest"

import catalog from "@/fixtures/series.json"
import actuals from "@/fixtures/series/ua_drones_downed_claimed/actuals.json"
import latest from "@/fixtures/series/ua_drones_downed_claimed/latest.json"
import replay from "@/fixtures/series/ua_drones_downed_claimed/replay.json"

import { daysAfter, loadSeries, type CatalogEntry } from "./api"

afterEach(() => vi.unstubAllGlobals())

const entry = catalog.series.find(
  (s) => s.series_id === "ua_drones_downed_claimed"
) as CatalogEntry

it("dates a daily series' past forecasts by calendar day, a day its actuals skip left blank", async () => {
  // The oldest forecast of the replay, and the day without a report 3 days after it.
  const made = replay.forecasts[0].reference_date
  const missing = daysAfter(made, 3)
  const skipped = actuals.date.indexOf(missing)
  const files: Record<string, unknown> = {
    [`api/v1/${entry.links.latest}`]: latest,
    [`api/v1/${entry.links.replay}`]: replay,
    [`api/v1/${entry.links.actuals}`]: {
      ...actuals,
      date: actuals.date.filter((_, i) => i !== skipped),
      observation: actuals.observation.filter((_, i) => i !== skipped),
    },
  }
  vi.stubGlobal("fetch", async (url: string) => Response.json(files[url]))

  const drones = await loadSeries(entry, { replay: true })

  const oldest = drones.forecasts[0]
  expect(oldest.dates.at(-1)).toBe(made)
  expect(oldest.targetDates).toEqual(
    [1, 2, 3, 4, 5, 6, 7].map((step) => daysAfter(made, step))
  )
  expect(oldest.actuals).toEqual([
    actuals.observation[skipped - 2],
    actuals.observation[skipped - 1],
    null,
    ...actuals.observation.slice(skipped + 1, skipped + 5),
  ])
})
