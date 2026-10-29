import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import actuals from "@/fixtures/actuals.json"
import latest from "@/fixtures/latest.json"
import catalog from "@/fixtures/series.json"

import { Hero } from "./Hero"

// What a real daily run published on 2026-10-29, at the URLs the page reads.
const published: Record<string, unknown> = {
  "api/v1/series.json": catalog,
  "api/v1/series/gpr_daily/latest.json": latest,
  "api/v1/series/gpr_daily/actuals.json": actuals,
}

afterEach(cleanup)

it("shows the GPR 7-day average and the forecast for the same weekday 4 weeks on", async () => {
  vi.stubGlobal("fetch", async (url: string) => Response.json(published[url]))

  render(<Hero />)

  await screen.findByText("181")
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "焦りあせり · aseri"
  )
  expect(screen.getAllByRole("paragraph").map((p) => p.textContent)).toEqual([
    "Geopolitical risk · today",
    "181",
    "81% above its 1985-2019 average",
    "Monday Nov 23, 4 weeks from the last data: most likely 168. 8 in 10 between 111 and 251. (Last Monday: 165)",
  ])
})

it("says so in one plain line when the data cannot be loaded", async () => {
  vi.stubGlobal("fetch", async () => new Response("", { status: 404 }))
  vi.spyOn(console, "error").mockImplementation(() => {})

  render(<Hero />)

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Couldn't load today's data. Refresh to try again."
  )
})
