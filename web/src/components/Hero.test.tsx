import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { type Today } from "@/lib/api"

import { Hero } from "./Hero"

const today: Today = {
  sevenDayAverage: 181.2,
  baseline: 100,
  baselineLabel: "its 1985-2019 average",
  daysAhead: 28,
  referenceDate: "2026-10-26",
  referenceValue: 165,
  asOf: "2026-10-30",
  targetDate: "2026-11-23",
  mostLikely: 168,
  low: 111,
  high: 251,
}

// The page reads the one list jsdom's stand-in gives for the query (see test-setup.ts).
const prefers = (reduce: boolean) =>
  Object.assign(matchMedia("(prefers-reduced-motion: reduce)"), {
    matches: reduce,
  })

// The animation frames the page asks for, run by hand, 16 ms apart.
let frames: Map<number, FrameRequestCallback>
let now: number
function advance(ms: number) {
  for (const end = now + ms; now < end;) {
    now += 16
    const due = [...frames.values()]
    frames.clear()
    act(() => due.forEach((frame) => frame(now)))
  }
}
// Every call the art makes on its canvases, by method: a frame starts with clearRect.
let canvas: Record<string, ReturnType<typeof vi.fn>>
const drawn = () => canvas.clearRect?.mock.calls.length ?? 0
// Says whether the art is on screen, as an IntersectionObserver would.
let onScreen: (shown: boolean) => void

// jsdom lays nothing out and has no canvas: the test sets the sizes and records the drawing.
beforeEach(() => {
  frames = new Map()
  now = 0
  let id = 0
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => {
    frames.set(++id, frame)
    return id
  })
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id))
  vi.stubGlobal(
    "ResizeObserver",
    class {
      callback: ResizeObserverCallback
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }
      observe() {
        this.callback([], this as never)
      }
      disconnect() {}
    }
  )
  // An 800 x 900 hero, its text in a column from 224 px down.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return (
        this.tagName === "DIV" && this.querySelector("h1")
          ? new DOMRect(124, 224, 552, 620)
          : new DOMRect(0, 0, 800, 900)
      ) as DOMRect
    }
  )
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
  canvas = {}
  const context = new Proxy(
    {},
    {
      get: (_, method: string) =>
        (canvas[method] ??= vi.fn((width: number, height: number) =>
          // The veil is drawn into image data.
          method === "createImageData"
            ? { width, height, data: new Uint8ClampedArray(width * height * 4) }
            : undefined
        )),
      set: () => true,
    }
  )
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as never
  )
  // The two tokens the art paints with, as index.css gives them.
  document.head.innerHTML =
    "<style>canvas { --primary: #f2efe8; --background: #050505 }</style>"
  // The art ticks on an interval.
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  prefers(false)
  // Back to jsdom's own visible document.
  delete (document as { hidden?: boolean }).hidden
})

it("draws its text over the art, which stays behind it and out of the way", () => {
  const { container } = render(<Hero today={today} failed={false} />)

  const art = container.querySelector("canvas")!.parentElement!
  expect(art.getAttribute("aria-hidden")).toBe("true")
  expect(art.className).toMatch(/\babsolute inset-0 -z-10\b/)
  expect(art.className).toContain("pointer-events-none")
  // Clipped to the hero, so the art never widens the page.
  expect(art.className).toContain("overflow-hidden")
  for (const text of [
    screen.getByRole("heading", { level: 1 }),
    screen.getByText("181"),
    screen.getByText(/^Monday Nov 23/),
  ])
    expect(art.contains(text)).toBe(false)
})

it("counts the number up over its real value, which is the text all along", () => {
  const { container } = render(<Hero today={today} failed={false} />)

  const number = screen.getByText("181")
  expect(number.dataset.count).toBe("0")
  advance(300)
  expect(Number(number.dataset.count)).toBeGreaterThan(0)
  expect(number.textContent).toBe("181")
  advance(1000)
  expect(number.dataset.count).toBeUndefined()
  expect(number.textContent).toBe("181")
  expect(frames.size).toBe(0)
  // The art keeps moving, out of the screen reader's way.
  const before = drawn()
  vi.advanceTimersByTime(100)
  expect(drawn()).toBeGreaterThan(before)
  expect(
    container.querySelector("canvas")!.closest("[aria-hidden]")
  ).not.toBeNull()
})

it("marks the baseline with dashed rays once today's value is in, and draws no rays before", () => {
  prefers(true)
  render(<Hero failed={false} />)
  expect(drawn()).toBeGreaterThan(0)
  expect(canvas.setLineDash).toBeUndefined()
  cleanup()

  render(<Hero today={today} failed={false} />)
  expect(canvas.setLineDash).toHaveBeenCalledWith([3, 5])
})

it("stops the art while the tab is hidden, and starts it again on return", () => {
  render(<Hero today={today} failed={false} />)
  const hide = (hidden: boolean) => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: hidden,
    })
    document.dispatchEvent(new Event("visibilitychange"))
  }

  hide(true)
  const before = drawn()
  vi.advanceTimersByTime(2600)
  expect(drawn()).toBe(before)
  hide(false)
  vi.advanceTimersByTime(100)
  expect(drawn()).toBeGreaterThan(before)
})

it("stops the art while the hero is scrolled off screen", () => {
  render(<Hero today={today} failed={false} />)

  onScreen(false)
  const before = drawn()
  vi.advanceTimersByTime(2600)
  expect(drawn()).toBe(before)
  onScreen(true)
  vi.advanceTimersByTime(100)
  expect(drawn()).toBeGreaterThan(before)
})

it("dithers the wordmark in, then leaves it whole", () => {
  render(<Hero failed={false} />)

  const wordmark = screen.getByRole("heading", { level: 1 })
  expect(wordmark.style.maskImage).toMatch(/^url\(/)
  advance(300)
  expect(wordmark.style.maskImage).toBe("")
})

it("keeps everything still when motion is reduced, with the art drawn once, whole", () => {
  prefers(true)
  const { container } = render(<Hero today={today} failed={false} />)

  expect(screen.getByText("181").dataset.count).toBeUndefined()
  expect(screen.getByRole("heading", { level: 1 }).style.maskImage).toBe("")
  expect(frames.size).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
  expect(drawn()).toBeGreaterThan(0)
  // The rays at their full length: the baseline's dashed rays are drawn.
  expect(canvas.setLineDash).toHaveBeenCalledWith([3, 5])
  // Nothing moves by CSS either: the art moves only from script.
  expect(container.querySelector("[class*=animate-]")).toBeNull()
})

it("never replays the intro when reduced motion is turned off later", () => {
  prefers(true)
  render(<Hero today={today} failed={false} />)

  act(() => {
    prefers(false).dispatchEvent(new Event("change"))
  })
  advance(100)
  expect(screen.getByText("181").dataset.count).toBeUndefined()
  expect(screen.getByRole("heading", { level: 1 }).style.maskImage).toBe("")
  expect(frames.size).toBe(0)
})
