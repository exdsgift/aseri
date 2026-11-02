import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { Margins } from "./Margins"

// The page reads the one list jsdom's stand-in gives for the query (see test-setup.ts).
const prefers = (reduce: boolean) =>
  Object.assign(matchMedia("(prefers-reduced-motion: reduce)"), {
    matches: reduce,
  })
const hide = (hidden: boolean) => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: hidden,
  })
  document.dispatchEvent(new Event("visibilitychange"))
}

// Every frame the layer puts on its canvas, as its pixel words.
let frames: Uint32Array[]
const inked = (frame: Uint32Array) => frame.some((word) => word !== 0)

// jsdom lays nothing out and has no canvas: a 1440 x 900 screen, its hero scrolled away.
beforeEach(() => {
  frames = []
  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    value: 1440,
  })
  vi.stubGlobal("innerHeight", 900)
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    createImageData: (width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(4 * width * height),
    }),
    // A frame puts the left margin, then the right: kept once both are in.
    putImageData: (pixels: ImageData, _x: number, _y: number, from: number) => {
      if (from) frames.push(new Uint32Array(pixels.data.buffer).slice())
    },
    fillRect() {},
    getImageData: () => ({ data: Uint8ClampedArray.of(84, 84, 245, 255) }),
  } as never)
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  prefers(false)
  delete (document as { hidden?: boolean }).hidden
  delete (document.documentElement as { clientWidth?: number }).clientWidth
})

it("lies behind the page, out of its way: fixed, clipped, and hidden from screen readers", () => {
  const { container } = render(<Margins />)

  const layer = container.querySelector("canvas")!.parentElement!
  expect(layer.getAttribute("aria-hidden")).toBe("true")
  expect(layer.className).toMatch(/\bfixed inset-0 -z-10\b/)
  expect(layer.className).toContain("pointer-events-none")
  // Clipped to the screen, so the canvas never widens the page.
  expect(layer.className).toContain("overflow-hidden")
})

it("draws the margins in the frame's ink, at half the screen's resolution", () => {
  const { container } = render(<Margins />)

  const canvas = container.querySelector("canvas")!
  expect([canvas.width, canvas.height]).toEqual([720, 451])
  expect(canvas.style.width).toBe("1440px")
  expect(inked(frames[0])).toBe(true)
  // Little-endian #5454f5, opaque.
  expect(new Set(frames[0])).toEqual(new Set([0, 0xfff55454]))
})

it("draws one still, whole frame under reduced motion, and nothing after", () => {
  prefers(true)
  render(<Margins />)

  expect(frames).toHaveLength(1)
  expect(inked(frames[0])).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
  vi.advanceTimersByTime(5000)
  expect(frames).toHaveLength(1)
})

it("redraws its drift slowly, and never while the tab is hidden", () => {
  render(<Margins />)

  vi.advanceTimersByTime(1000)
  expect(frames).toHaveLength(1 + 5)
  // The current has moved.
  expect(frames.at(-1)).not.toEqual(frames[0])
  hide(true)
  vi.advanceTimersByTime(3000)
  expect(frames).toHaveLength(6)
  hide(false)
  vi.advanceTimersByTime(200)
  expect(frames).toHaveLength(7)
})

it("draws nothing beside the hero", () => {
  prefers(true)
  render(<section id="today" />)
  vi.spyOn(
    document.getElementById("today")!,
    "getBoundingClientRect"
  ).mockReturnValue(new DOMRect(0, 0, 1440, 900))
  render(<Margins />)

  expect(frames).toHaveLength(1)
  expect(inked(frames[0])).toBe(false)
})
