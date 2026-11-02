import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import catalog from "@/fixtures/series.json"
import actuals from "@/fixtures/series/suez_transits/actuals.json"
import latest from "@/fixtures/series/suez_transits/latest.json"
import { loadSeries, type CatalogEntry, type Series } from "@/lib/api"

import { SignalCard } from "./SignalCard"

afterEach(cleanup)

const suez = catalog.series.find(
  (entry) => entry.series_id === "suez_transits"
) as CatalogEntry
const published: Record<string, unknown> = {
  "api/v1/series/suez_transits/latest.json": latest,
  "api/v1/series/suez_transits/actuals.json": actuals,
}

beforeEach(() => {
  // jsdom lays nothing out: the card's chart draws nothing.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal("fetch", async (url: string) => Response.json(published[url]))
})

const card = (series: Series) => {
  render(
    <SignalCard
      series={series}
      icon="ship"
      hint="4"
      picked={false}
      onPick={() => {}}
    />
  )
  return screen.getByRole("button")
}

it("shows which way from normal with an arrow before the words, in line with them", async () => {
  const arrow = card(
    await loadSeries(suez, { replay: false })
  ).querySelectorAll("svg")[1]
  expect(arrow.getAttribute("class")!.split(/\s+/)).toEqual(
    expect.arrayContaining(["inline-block", "mr-1.5"])
  )
})

it("says at normal, with no arrow, when the 7-day average is on it", async () => {
  const { today } = await loadSeries(suez, { replay: false })
  const button = card(
    await loadSeries(
      { ...suez, baseline: today.sevenDayAverage },
      { replay: false }
    )
  )

  expect(button.textContent!.replace(/\s+/g, " ")).toMatch(
    /· 7-day avg at normal Nov 22/
  )
  // The pictogram alone: no arrow says a way the value does not go.
  expect(button.querySelectorAll("svg")).toHaveLength(1)
})
