import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { type GprToday } from "@/lib/api"

import { Hero } from "./Hero"

const today: GprToday = {
  sevenDayAverage: 181.2,
  baseline: 100,
  baselineLabel: "its 1985-2019 average",
  weeksAhead: 4,
  referenceDate: "2026-10-26",
  referenceValue: 165,
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
let fillRect: ReturnType<typeof vi.fn>

// jsdom lays nothing out and has no canvas: the test sets the size and counts the drawing.
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
        this.callback(
          [{ contentRect: { width: 800 } } as ResizeObserverEntry],
          this as never
        )
      }
      disconnect() {}
    }
  )
  fillRect = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect() {},
    fillRect,
  } as never)
  // The sun ticks on an interval.
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  prefers(false)
  // Back to jsdom's own visible document.
  delete (document as { hidden?: boolean }).hidden
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
  const drawn = fillRect.mock.calls.length
  vi.advanceTimersByTime(260)
  expect(fillRect.mock.calls.length).toBeGreaterThan(drawn)
  expect(
    container.querySelector("canvas")!.closest("[aria-hidden]")
  ).not.toBeNull()
})

it("stops the sun while the tab is hidden, and starts it again on return", () => {
  render(<Hero today={today} failed={false} />)
  const hide = (hidden: boolean) => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: hidden,
    })
    document.dispatchEvent(new Event("visibilitychange"))
  }

  hide(true)
  const drawn = fillRect.mock.calls.length
  vi.advanceTimersByTime(2600)
  expect(fillRect.mock.calls.length).toBe(drawn)
  hide(false)
  vi.advanceTimersByTime(260)
  expect(fillRect.mock.calls.length).toBeGreaterThan(drawn)
})

it("dithers the wordmark in, then leaves it whole", () => {
  render(<Hero failed={false} />)

  const wordmark = screen.getByRole("heading", { level: 1 })
  expect(wordmark.style.maskImage).toMatch(/^url\(/)
  advance(300)
  expect(wordmark.style.maskImage).toBe("")
})

it("keeps everything still when motion is reduced, with the sun drawn once", () => {
  prefers(true)
  const { container } = render(<Hero today={today} failed={false} />)

  expect(screen.getByText("181").dataset.count).toBeUndefined()
  expect(screen.getByRole("heading", { level: 1 }).style.maskImage).toBe("")
  expect(container.querySelector("[class*=animate-]")).toBeNull()
  expect(frames.size).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
  expect(fillRect).toHaveBeenCalled()
})
