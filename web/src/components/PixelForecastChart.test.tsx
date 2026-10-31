import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import catalog from "@/fixtures/series.json"
import actuals from "@/fixtures/series/gpr_daily/actuals.json"
import latest from "@/fixtures/series/gpr_daily/latest.json"
import replay from "@/fixtures/series/gpr_daily/replay.json"
import { loadSeries, type Forecast } from "@/lib/api"
import { chartLayout } from "@/lib/chart"
import { path } from "@/lib/paths"

import { PixelForecastChart } from "./PixelForecastChart"

const drawn = (shown: Forecast, index = 0) => (
  <PixelForecastChart
    forecast={shown}
    path={path(shown, 0, index)}
    summary=""
  />
)

// Each paint, as the art pixels it fills and the token each is filled with. The tokens of the
// frame and the origin are named, the marks' left empty.
let paints: { x: number; color: string }[][]
const last = () => paints.at(-1)!
const frame = () => last().filter(({ color }) => color)
// How far right the marks reach in the last paint, in art pixels.
const reach = () =>
  Math.max(...last().flatMap(({ x, color }) => (color ? [] : [x])))
// The page reads the one list jsdom's stand-in gives for the query (see test-setup.ts).
const prefers = (reduce: boolean) =>
  Object.assign(matchMedia("(prefers-reduced-motion: reduce)"), {
    matches: reduce,
  })
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms))

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
  paints = []
  let fill = ""
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: () => paints.push([]),
    fillRect: (x: number) => last().push({ x, color: fill }),
    set fillStyle(color: string) {
      fill = color
    },
  } as never)
  document.head.innerHTML =
    "<style>canvas { --border: frame; --secondary: origin }</style>"
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
  // The scan steps on animation frames, timed by the frames' own clock.
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
  })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  prefers(false)
})

it("scans its marks in from the left, a step at a time with the hero's count-up, over a frame and labels there from the start", () => {
  render(drawn(forecast))
  resize(692)
  const { left, right } = chartLayout(forecast, 692)

  // The first frame reads at rest: the labels and the frame, and no mark yet.
  expect(screen.queryByText("Next 28 days")).not.toBeNull()
  expect(frame().length).toBeGreaterThan(0)
  expect(reach()).toBe(-Infinity)
  const reached = [reach()]
  for (let ms = 0; ms < 600; ms += 40) {
    wait(40)
    reached.push(reach())
  }
  // Never back, never all at once: column by column, then slowing into the end.
  expect(reached).toEqual(reached.toSorted((a, b) => a - b))
  expect(new Set(reached).size).toBeGreaterThan(8)
  expect(reached[3]).toBeGreaterThan(left)
  expect(reached[3]).toBeLessThan(right)
  // Done with the count-up, 640 ms in: the whole chart, and no frame asked for any more.
  wait(80)
  expect(reach()).toBe(right)
  expect(vi.getTimerCount()).toBe(0)
})

it("draws its marks whole from the start under reduced motion", () => {
  prefers(true)
  render(drawn(forecast))
  resize(692)

  expect(paints).toHaveLength(1)
  expect(reach()).toBe(chartLayout(forecast, 692).right)
  expect(vi.getTimerCount()).toBe(0)
})

it("scans once a mount, never again for another path or a replay step", () => {
  const { rerender } = render(drawn(forecast))
  resize(692)
  wait(200)
  const midway = reach()

  // Another path midway carries the scan on.
  rerender(drawn(forecast, 1))
  expect(reach()).toBe(midway)
  wait(600)
  expect(vi.getTimerCount()).toBe(0)
  // After it, each change is drawn whole at once.
  rerender(drawn(forecast, 2))
  expect(reach()).toBe(chartLayout(forecast, 692).right)
  rerender(drawn(older))
  expect(reach()).toBe(chartLayout(older, 692).right)
  expect(vi.getTimerCount()).toBe(0)
})

it("labels what happened on the last day, and on any day of a replay", () => {
  render(drawn(backtest))
  resize(692)

  // The end values, top to bottom: what happened, 8 in 10's top, 8 in 10's bottom.
  const tops = ["168", "167", "59"].map((value) =>
    parseFloat(screen.getByText(value).style.top)
  )
  expect(tops).toEqual(tops.toSorted((a, b) => a - b))
  // Not the most likely value: the chart draws a possible path in its place.
  expect(screen.queryByText("104")).toBeNull()
  expect(screen.queryByText("28 days after")).not.toBeNull()
  // The last day ahead, at the right end.
  fireEvent.pointerDown(screen.getByRole("img"), { clientX: 692 })
  expect(screen.queryByText("What happened 168")).not.toBeNull()
})

it("has nothing to say about what happened ahead of today", () => {
  render(drawn(forecast))
  resize(692)

  fireEvent.pointerDown(screen.getByRole("img"), { clientX: 692 })
  expect(screen.queryByText(/^What happened/)).toBeNull()
})

it("names the forecast zone only where the name clears the label on the left", () => {
  render(drawn(forecast))

  resize(440)
  expect(screen.queryByText("Next 28 days")).not.toBeNull()
  // A 340 px phone: the two names would overlap.
  resize(280)
  expect(screen.queryByText("Next 28 days")).toBeNull()
})

it("counts Brent's zone in trading days", () => {
  render(drawn({ ...forecast, horizonUnit: "trading_day" }))

  resize(692)
  expect(screen.queryByText("Next 28 trading days")).not.toBeNull()
})

it("drops the readout of a day the chart no longer shows", () => {
  render(drawn(forecast))
  resize(692)

  // The left end of the chart, the first day it shows.
  fireEvent.pointerDown(screen.getByRole("img"), { clientX: 40 })
  expect(screen.queryByText(/^Daily value \d/)).not.toBeNull()
  // Narrower, the chart starts 4 weeks later.
  resize(440)
  expect(screen.queryByText(/^Daily value \d/)).toBeNull()
})

it("drops a tap's readout past the end of an older forecast the replay moves to", () => {
  const { rerender } = render(drawn(forecast))
  resize(692)

  // Today's last day ahead, months after the oldest forecast's.
  fireEvent.pointerDown(screen.getByRole("img"), { clientX: 692 })
  expect(screen.queryByText(/^Most likely \d/)).not.toBeNull()
  rerender(drawn(backtest))
  expect(screen.queryByText(/^Most likely \d/)).toBeNull()
})

it("drops a tap's readout once the replay moves to another forecast, even on a day both show", () => {
  const { rerender } = render(drawn(forecast))
  resize(692)

  // A day of history in the middle of today's chart.
  fireEvent.pointerDown(screen.getByRole("img"), { clientX: 300 })
  expect(screen.queryByText(/^Daily value \d/)).not.toBeNull()
  rerender(drawn(older))
  expect(screen.queryByText(/^Daily value \d/)).toBeNull()
})

it("drops the readout when a mouse or a pen leaves, but keeps a tap's", () => {
  render(drawn(forecast))
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
