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
const define = (target: object, name: string, value: number) =>
  Object.defineProperty(target, name, { configurable: true, value })

// Every picture each canvas puts, as its pixel words.
let puts: Map<HTMLCanvasElement, Uint32Array[]>
const of = (canvas: HTMLCanvasElement) => puts.get(canvas) ?? []
const counted = () => [...puts.values()].map((pictures) => pictures.length)
const inked = (words: Uint32Array) => words.some((word) => word !== 0)
// Rows `from` to `to` of a picture 96 art pixels wide.
const rows = (words: Uint32Array, from: number, to: number) =>
  words.subarray(96 * from, 96 * to)
// Whether two runs of pixel words are the same: a deep comparison of 100,000 is slow.
const same = (a: Uint32Array, b: Uint32Array) =>
  a.length === b.length && a.every((word, i) => word === b[i])

// jsdom lays nothing out and has no canvas: a 1440 x 900 screen on a 3000 px page, the hero's
// foot 900 px down it.
beforeEach(() => {
  puts = new Map()
  define(document.documentElement, "clientWidth", 1440)
  define(document.documentElement, "scrollHeight", 3000)
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      return {
        createImageData: (width: number, height: number) => ({
          width,
          height,
          data: new Uint8ClampedArray(4 * width * height),
        }),
        putImageData: (pixels: ImageData) =>
          puts.set(this, [
            ...of(this),
            new Uint32Array(pixels.data.buffer).slice(),
          ]),
        fillRect() {},
        getImageData: () => ({ data: Uint8ClampedArray.of(84, 84, 245, 255) }),
      } as never
    }
  )
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  prefers(false)
  delete (document as { hidden?: boolean }).hidden
  const root = document.documentElement as {
    clientWidth?: number
    scrollHeight?: number
  }
  delete root.clientWidth
  delete root.scrollHeight
})

// The hero, its foot 900 px down the page, and the side navigation where it shows.
function page(nav?: DOMRect) {
  return render(
    <>
      <section
        id="today"
        ref={(hero) => {
          if (hero)
            hero.getBoundingClientRect = () => new DOMRect(0, 0, 1440, 900)
        }}
      />
      <nav
        aria-label="Sections"
        ref={(element) => {
          if (element)
            element.getBoundingClientRect = () => nav ?? new DOMRect()
        }}
      />
      <Margins />
    </>
  )
}

it("lies behind the page, down its whole length, out of its way", () => {
  const { container } = page()

  const layer = container.querySelector("canvas")!.parentElement!
  expect(layer.getAttribute("aria-hidden")).toBe("true")
  // In the page, not the screen: the stripes scroll with it, as smoothly as it does.
  expect(layer.className).toMatch(/\babsolute inset-0 -z-10\b/)
  expect(layer.className).toContain("pointer-events-none")
  // Clipped to the page, so the canvases never lengthen or widen it.
  expect(layer.className).toContain("overflow-hidden")
  // Never the scroll anchor, which would keep it still instead of what the reader reads.
  expect(layer.className).toContain("[overflow-anchor:none]")
})

it("draws each margin on its own canvas, from the hero's foot down, at half the resolution", () => {
  const { container } = page()

  const [left, right] = container.querySelectorAll("canvas")
  // 96 art pixels a side at 1440 px, 1050 rows from 900 px down to 3000.
  expect([left.width, left.height, right.width, right.height]).toEqual([
    96, 1050, 96, 1050,
  ])
  expect([left.style.left, left.style.top, left.style.width]).toEqual([
    "0px",
    "900px",
    "192px",
  ])
  expect([right.style.left, right.style.height]).toEqual(["1248px", "2100px"])
  // Whole, in the frame's ink, little-endian #5454f5, opaque, and nothing else.
  for (const canvas of [left, right]) {
    const [first] = of(canvas)
    expect(inked(first)).toBe(true)
    expect(new Set(first)).toEqual(new Set([0, 0xfff55454]))
  }
})

it("draws once, still and whole, under reduced motion", () => {
  prefers(true)
  page()

  expect(counted()).toEqual([1, 1])
  expect(vi.getTimerCount()).toBe(0)
  vi.advanceTimersByTime(5000)
  expect(counted()).toEqual([1, 1])
})

// The drift moves the stripes up a row at a time, about 7 rows a second.
it("redraws only for the drift, moving the stripes up a row at a time, and never while the tab is hidden", () => {
  const { container } = page()
  const [left] = container.querySelectorAll("canvas")

  vi.advanceTimersByTime(1000)
  // Five ticks, each a step: 1, 2, 4, 5 and 7 rows of drift. Under the hero's fade, each
  // picture is the last one moved up by its step.
  const pictures = of(left)
  expect(pictures).toHaveLength(6)
  for (const [i, moved] of [1, 1, 2, 1, 2].entries()) {
    const [now, last] = [pictures[i + 1], pictures[i]]
    expect(
      same(rows(now, 98, 1050 - moved), rows(last, 98 + moved, 1050))
    ).toBe(true)
    expect(same(now, last)).toBe(false)
  }
  // A scroll draws nothing: the canvases scroll with the page.
  window.dispatchEvent(new Event("scroll"))
  hide(true)
  vi.advanceTimersByTime(3000)
  expect(counted()).toEqual([6, 6])
  // Back, the stripes have moved on: 3,200 ms more of drift, 23 rows, in one step.
  hide(false)
  vi.advanceTimersByTime(200)
  expect(
    same(rows(of(left)[6], 98, 1050 - 23), rows(pictures[5], 98 + 23, 1050))
  ).toBe(true)
})

it("keeps 24 px of the ground round the side navigation, where it shows", () => {
  const { container, unmount } = page(new DOMRect(1306, 352, 110, 196))

  const halo = container.querySelector<HTMLElement>("[data-halo]")!
  expect(halo.hidden).toBe(false)
  expect(halo.className).toMatch(/\bfixed\b.*\bbg-background\b/)
  expect([
    halo.style.left,
    halo.style.top,
    halo.style.width,
    halo.style.height,
  ]).toEqual(["1282px", "328px", "158px", "244px"])
  unmount()

  // Under 1344 px the navigation is hidden, and so is the halo.
  const narrow = page()
  expect(
    narrow.container.querySelector<HTMLElement>("[data-halo]")!.hidden
  ).toBe(true)
})
