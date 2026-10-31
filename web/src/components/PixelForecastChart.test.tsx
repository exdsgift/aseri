import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import catalog from "@/fixtures/series.json"
import actuals from "@/fixtures/series/gpr_daily/actuals.json"
import latest from "@/fixtures/series/gpr_daily/latest.json"
import replay from "@/fixtures/series/gpr_daily/replay.json"
import { loadSeries, type Forecast } from "@/lib/api"
import { chartLayout } from "@/lib/chart"
import { path } from "@/lib/paths"

import { MiniForecastChart, PixelForecastChart } from "./PixelForecastChart"

const drawn = (shown: Forecast, index = 0) => (
  <PixelForecastChart
    forecast={shown}
    path={path(shown, 0, index)}
    summary=""
  />
)

// What each canvas holds: the art pixels painted on it, each with its token, and those of the
// canvases drawn onto it, as far right as the part drawn. The tokens of the frame and the
// origin are named, the marks' left empty.
let pixels: Map<HTMLCanvasElement, { x: number; color: string }[]>
// Every pixel painted, on any canvas, and the canvases painted on.
let fills: number
let painted: Set<HTMLCanvasElement>
const shown = () => pixels.get(document.querySelector("canvas")!) ?? []
const frame = () => shown().filter(({ color }) => color)
// How far right the marks on screen reach, in art pixels.
const reach = () =>
  Math.max(...shown().flatMap(({ x, color }) => (color ? [] : [x])))
// Brings the chart into view, as an IntersectionObserver would.
let show: () => void
// The page reads the one list jsdom's stand-in gives for the query (see test-setup.ts).
const prefers = (reduce: boolean) =>
  Object.assign(matchMedia("(prefers-reduced-motion: reduce)"), {
    matches: reduce,
  })
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms))

let resize: (width: number) => void
let tests = 0
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
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        show = () =>
          act(() =>
            callback(
              [{ isIntersecting: true } as IntersectionObserverEntry],
              this as never
            )
          )
      }
      observe() {}
      disconnect() {}
    }
  )
  pixels = new Map()
  fills = 0
  painted = new Set()
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      const own = () => pixels.get(this) ?? pixels.set(this, []).get(this)!
      let fill = ""
      return {
        clearRect: () => pixels.set(this, []),
        fillRect: (x: number) => {
          fills++
          painted.add(this)
          own().push({ x, color: fill })
        },
        // The whole canvas, or its part `width` art pixels wide from the left.
        drawImage: (from: HTMLCanvasElement, ...at: number[]) =>
          own().push(
            ...(pixels.get(from) ?? []).filter(
              ({ x }) => x < (at[2] ?? Infinity)
            )
          ),
        set fillStyle(color: string) {
          fill = color
        },
      } as never
    } as never
  )
  document.head.innerHTML =
    "<style>canvas { --border: frame; --secondary: origin }</style>"
  const published: Record<string, unknown> = {
    "api/v1/series/gpr_daily/latest.json": latest,
    "api/v1/series/gpr_daily/actuals.json": actuals,
    "api/v1/series/gpr_daily/replay.json": replay,
  }
  vi.stubGlobal("fetch", async (url: string) => Response.json(published[url]))
  const { forecasts } = await loadSeries(catalog.series[0], { replay: true })
  // Each test its own series: once a chart of a series has scanned in, no other does again.
  const series = `${forecasts[0].series} ${++tests}`
  forecast = { ...forecasts.at(-1)!, series }
  backtest = { ...forecasts[0], series }
  older = { ...forecasts.at(-11)!, series }
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

it("scans its marks in from the left once in view, a step at a time with the hero's count-up, over a frame and labels there from the start", () => {
  render(drawn(forecast))
  resize(692)
  const { left, right } = chartLayout(forecast, 692)

  // The first frame reads at rest: the labels and the frame, and no mark yet.
  expect(screen.queryByText("Next 28 days")).not.toBeNull()
  expect(frame().length).toBeGreaterThan(0)
  expect(reach()).toBe(-Infinity)
  // Below the fold, it waits for the reader, asking for no frame.
  wait(2000)
  expect(reach()).toBe(-Infinity)
  expect(vi.getTimerCount()).toBe(0)
  show()
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

it("paints the chart once, then only reveals it", () => {
  render(drawn(forecast))
  resize(692)
  show()
  const once = fills

  wait(700)
  expect(reach()).toBe(chartLayout(forecast, 692).right)
  // The whole chart and its frame alone, painted off screen before the scan, and nothing since.
  expect(fills).toBe(once)
  expect(painted.size).toBe(2)
  expect(painted.has(document.querySelector("canvas")!)).toBe(false)
})

it("draws its marks whole from the start under reduced motion", () => {
  prefers(true)
  render(drawn(forecast))
  resize(692)

  expect(reach()).toBe(chartLayout(forecast, 692).right)
  // The whole chart only: no frame alone to scan over.
  expect(painted.size).toBe(1)
  show()
  expect(vi.getTimerCount()).toBe(0)
})

it("never scans a series in again, in a chart mounted anew as the panel is when its replay arrives", () => {
  const { unmount } = render(drawn(forecast))
  resize(692)
  show()
  wait(200)
  expect(reach()).toBeLessThan(chartLayout(forecast, 692).right)

  unmount()
  render(drawn(older))
  resize(692)
  expect(reach()).toBe(chartLayout(older, 692).right)
  show()
  expect(vi.getTimerCount()).toBe(0)
  cleanup()
  // A card's chart of the same series is another view: it scans in on its own.
  render(<MiniForecastChart forecast={forecast} path={path(forecast, 0, 0)} />)
  resize(300)
  expect(reach()).toBe(-Infinity)
  show()
  wait(700)
  expect(reach()).toBeGreaterThan(0)
})

it("scans once a mount, never again for another path or a replay step", () => {
  const { rerender } = render(drawn(forecast))
  resize(692)
  show()
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
