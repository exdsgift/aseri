import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import actuals from "@/fixtures/actuals.json"
import latest from "@/fixtures/latest.json"
import catalog from "@/fixtures/series.json"
import { loadGpr, type Forecast } from "@/lib/api"

import { PixelForecastChart } from "./PixelForecastChart"

let resize: (width: number) => void
let forecast: Forecast

// jsdom lays nothing out and has no canvas: the test sets the width and drops the drawing.
beforeEach(async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = (width) =>
          act(() =>
            callback(
              [{ contentRect: { width } } as ResizeObserverEntry],
              this as never
            )
          )
      }
      observe() {}
      disconnect() {}
    }
  )
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect() {},
    fillRect() {},
  } as never)
  const published: Record<string, unknown> = {
    "api/v1/series.json": catalog,
    "api/v1/series/gpr_daily/latest.json": latest,
    "api/v1/series/gpr_daily/actuals.json": actuals,
  }
  vi.stubGlobal("fetch", async (url: string) => Response.json(published[url]))
  forecast = (await loadGpr()).forecast
})
afterEach(cleanup)

it("names the forecast zone only where the name clears the label on the left", () => {
  render(<PixelForecastChart forecast={forecast} summary="" />)

  resize(440)
  expect(screen.queryByText("Next 28 days")).not.toBeNull()
  // A 340 px phone: the two names would overlap.
  resize(280)
  expect(screen.queryByText("Next 28 days")).toBeNull()
})

it("drops the readout of a day the chart no longer shows", () => {
  render(<PixelForecastChart forecast={forecast} summary="" />)
  resize(692)

  // The left end of the chart, the first day it shows.
  fireEvent.pointerDown(screen.getByRole("img"), { clientX: 40 })
  expect(screen.queryByText(/^Daily value \d/)).not.toBeNull()
  // Narrower, the chart starts 4 weeks later.
  resize(440)
  expect(screen.queryByText(/^Daily value \d/)).toBeNull()
})

it("drops the readout when a mouse or a pen leaves, but keeps a tap's", () => {
  render(<PixelForecastChart forecast={forecast} summary="" />)
  resize(692)
  const chart = screen.getByRole("img")

  for (const [pointerType, kept] of [
    ["touch", true],
    ["mouse", false],
    ["pen", false],
  ] as const) {
    fireEvent.pointerDown(chart, { clientX: 40, pointerType })
    fireEvent.pointerLeave(chart, { pointerType })
    expect(screen.queryByText(/^Daily value \d/) !== null).toBe(kept)
  }
})
