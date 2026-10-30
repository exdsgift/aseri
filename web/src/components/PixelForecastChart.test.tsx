import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import catalog from "@/fixtures/series.json"
import actuals from "@/fixtures/series/gpr_daily/actuals.json"
import latest from "@/fixtures/series/gpr_daily/latest.json"
import replay from "@/fixtures/series/gpr_daily/replay.json"
import { loadSeries, type Forecast } from "@/lib/api"

import { PixelForecastChart } from "./PixelForecastChart"

let resize: (width: number) => void
let forecast: Forecast
// The oldest of the replay, made on Jun 28: every day of it is known.
let backtest: Forecast
// Made 10 days before today's: its chart shows most of the same days, shifted.
let older: Forecast

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
    "api/v1/series/gpr_daily/latest.json": latest,
    "api/v1/series/gpr_daily/actuals.json": actuals,
    "api/v1/series/gpr_daily/replay.json": replay,
  }
  vi.stubGlobal("fetch", async (url: string) => Response.json(published[url]))
  const { forecasts } = await loadSeries(catalog.series[0], { replay: true })
  forecast = forecasts.at(-1)!
  backtest = forecasts[0]
  older = forecasts.at(-11)!
})
afterEach(cleanup)

it("labels what happened on the last day, and on any day of a replay", () => {
  render(<PixelForecastChart forecast={backtest} summary="" />)
  resize(692)

  // The end values, top to bottom: what happened, 8 in 10's top, most likely, 8 in 10's bottom.
  const tops = ["168", "167", "104", "59"].map((value) =>
    parseFloat(screen.getByText(value).style.top)
  )
  expect(tops).toEqual(tops.toSorted((a, b) => a - b))
  expect(screen.queryByText("28 days after")).not.toBeNull()
  // The last day ahead, at the right end.
  fireEvent.pointerDown(screen.getByRole("img"), { clientX: 692 })
  expect(screen.queryByText("What happened 168")).not.toBeNull()
})

it("has nothing to say about what happened ahead of today", () => {
  render(<PixelForecastChart forecast={forecast} summary="" />)
  resize(692)

  fireEvent.pointerDown(screen.getByRole("img"), { clientX: 692 })
  expect(screen.queryByText(/^What happened/)).toBeNull()
})

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

it("drops a tap's readout past the end of an older forecast the replay moves to", () => {
  const { rerender } = render(
    <PixelForecastChart forecast={forecast} summary="" />
  )
  resize(692)

  // Today's last day ahead, months after the oldest forecast's.
  fireEvent.pointerDown(screen.getByRole("img"), { clientX: 692 })
  expect(screen.queryByText(/^Most likely \d/)).not.toBeNull()
  rerender(<PixelForecastChart forecast={backtest} summary="" />)
  expect(screen.queryByText(/^Most likely \d/)).toBeNull()
})

it("drops a tap's readout once the replay moves to another forecast, even on a day both show", () => {
  const { rerender } = render(
    <PixelForecastChart forecast={forecast} summary="" />
  )
  resize(692)

  // A day of history in the middle of today's chart.
  fireEvent.pointerDown(screen.getByRole("img"), { clientX: 300 })
  expect(screen.queryByText(/^Daily value \d/)).not.toBeNull()
  rerender(<PixelForecastChart forecast={older} summary="" />)
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
