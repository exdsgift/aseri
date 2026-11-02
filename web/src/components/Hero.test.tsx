import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { type Today } from "@/lib/api"
import { heroes } from "@/lib/heroes"

import { Hero } from "./Hero"

const today: Today = {
  sevenDayAverage: 181.2,
  baseline: 100,
  baselineLabel: "its 1985-2019 average",
  daysAhead: 28,
  horizonUnit: "day",
  referenceDate: "2026-10-26",
  referenceValue: 165,
  asOf: "2026-10-30",
  targetDate: "2026-11-23",
  low: 111,
  high: 251,
  middleHalf: [136, 207],
  chanceAbove: 0.55,
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
// Every call the art makes on its canvases, by method, and every property it sets: a frame
// starts with clearRect. A 1 x 1 read gives back (1, 2, 3), as a canvas would a colour.
let canvas: Record<string, ReturnType<typeof vi.fn>>
let styles: [string, unknown][]
const drawn = () => canvas.clearRect?.mock.calls.length ?? 0
// Says whether the art is on screen, as an IntersectionObserver would.
let onScreen: (shown: boolean) => void
// Calls the ResizeObserver back, as a resize would.
let resize: () => void
// The two tokens the art paints with.
const tokens = (primary: string, background: string) =>
  (document.head.innerHTML = `<style>canvas { --primary: ${primary}; --background: ${background} }</style>`)

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
        resize = () => this.callback([], this as never)
        resize()
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
  styles = []
  const context = new Proxy(
    {},
    {
      get: (_, method: string) =>
        (canvas[method] ??= vi.fn((width: number, height: number) =>
          // The veil is drawn into image data.
          method === "createImageData"
            ? { width, height, data: new Uint8ClampedArray(width * height * 4) }
            : method === "getImageData"
              ? { data: Uint8ClampedArray.of(1, 2, 3, 255) }
              : undefined
        )),
      set: (_, name: string, value) => {
        styles.push([name, value])
        return true
      },
    }
  )
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as never
  )
  tokens("#f2efe8", "#050505")
  // The art ticks on an interval, and times itself by the clock.
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  prefers(false)
  // Back to jsdom's own visible document, which has no fonts to wait for.
  delete (document as { hidden?: boolean }).hidden
  delete (document as { fonts?: unknown }).fonts
})

// Each hero's art behaves alike: behind the text, in step with the number, calm behind the
// words, paused when unseen, and still under reduced motion.
const engravings = {
  messenger: "mercury.png",
  signal: "hercules.png",
  vortex: "apollo.png",
}
describe.each(heroes)("%s", (hero) => {
  it("draws its text over the art, which stays behind it and out of the way", () => {
    const { container } = render(
      <Hero hero={hero} today={today} failed={false} />
    )

    const art = container.querySelector("canvas")!.parentElement!
    expect(art.getAttribute("aria-hidden")).toBe("true")
    expect(art.className).toMatch(/\babsolute inset-0 -z-10\b/)
    expect(art.className).toContain("pointer-events-none")
    // Clipped to the hero, so the art never widens the page.
    expect(art.className).toContain("overflow-hidden")
    for (const text of [
      screen.getByRole("heading", { level: 1 }),
      screen.getByText("181"),
      screen.getByText(/^Nov 23: likely/),
    ])
      expect(art.contains(text)).toBe(false)
  })

  it("counts the number up over its real value, which is the text all along", () => {
    const { container } = render(
      <Hero hero={hero} today={today} failed={false} />
    )

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

  it("stops the art while the tab is hidden, and starts it again on return", () => {
    render(<Hero hero={hero} today={today} failed={false} />)
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
    render(<Hero hero={hero} today={today} failed={false} />)

    onScreen(false)
    const before = drawn()
    vi.advanceTimersByTime(2600)
    expect(drawn()).toBe(before)
    onScreen(true)
    vi.advanceTimersByTime(100)
    expect(drawn()).toBeGreaterThan(before)
  })

  it("draws smoothly while the art arrives, then once every 200 ms: what moves after is slow", () => {
    render(<Hero hero={hero} today={today} failed={false} />)

    const start = drawn()
    vi.advanceTimersByTime(500)
    expect(drawn() - start).toBeGreaterThanOrEqual(12)
    vi.advanceTimersByTime(1000)
    const settled = drawn()
    vi.advanceTimersByTime(1000)
    expect(drawn() - settled).toBe(5)
  })

  it("sizes the veil to the text and its dithered edge, and rebuilds nothing for a resize to the same size", () => {
    render(<Hero hero={hero} today={today} failed={false} />)

    // The column at (124, 224), 552 x 620: a 20 x 14 px margin, then 48 px of edge, within the hero.
    expect(canvas.createImageData).toHaveBeenLastCalledWith(688, 738)
    expect(canvas.drawImage).toHaveBeenCalledWith(expect.anything(), 56, 162)
    const veils = canvas.createImageData.mock.calls.length
    act(() => resize())
    expect(canvas.createImageData.mock.calls.length).toBe(veils)
  })

  it("keeps everything still when motion is reduced, with the art drawn once, whole", () => {
    prefers(true)
    const { container } = render(
      <Hero hero={hero} today={today} failed={false} />
    )

    expect(screen.getByText("181").dataset.count).toBeUndefined()
    expect(screen.getByRole("heading", { level: 1 }).style.maskImage).toBe("")
    expect(frames.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(drawn()).toBeGreaterThan(0)
    // Nothing moves by CSS either: the art moves only from script.
    expect(container.querySelector("[class*=animate-]")).toBeNull()
  })

  it("loads its own engraving, and no other hero's", () => {
    const loaded: string[] = []
    vi.stubGlobal(
      "Image",
      class {
        set src(url: string) {
          loaded.push(url)
        }
      }
    )
    render(<Hero hero={hero} today={today} failed={false} />)

    expect(loaded).toEqual([expect.stringContaining(engravings[hero])])
  })

  it("keeps its calm veil when today's value arrives", () => {
    const { rerender } = render(<Hero hero={hero} failed={false} />)
    const veils = canvas.createImageData.mock.calls.length
    rerender(<Hero hero={hero} today={today} failed={false} />)
    expect(drawn()).toBeGreaterThan(1)
    expect(canvas.createImageData.mock.calls.length).toBe(veils)
  })

  it("waits for the pixel font only if it letters the canvas, then draws its labels again", async () => {
    prefers(true)
    let arrive!: () => void
    const ready = new Promise<void>((resolve) => (arrive = resolve))
    const asked = vi.fn(() => ready)
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        get ready() {
          return asked()
        },
      },
    })
    render(<Hero hero={hero} today={today} failed={false} />)
    const before = drawn()
    await act(async () => arrive())

    const lettered = hero !== "messenger"
    expect(asked).toHaveBeenCalledTimes(lettered ? 1 : 0)
    expect(drawn() > before).toBe(lettered)
  })
})

describe("messenger", () => {
  const hero = "messenger"

  it("marks the baseline with dashed rays once today's value is in, and draws no rays before", () => {
    prefers(true)
    render(<Hero hero={hero} failed={false} />)
    expect(drawn()).toBeGreaterThan(0)
    expect(canvas.setLineDash).toBeUndefined()
    cleanup()

    render(<Hero hero={hero} today={today} failed={false} />)
    expect(canvas.setLineDash).toHaveBeenCalledWith([3, 5])
  })

  it("paints with its tokens in any CSS syntax, as the canvas reads them", () => {
    tokens("#fff", "rgb(5 5 5)")
    prefers(true)
    render(<Hero hero={hero} today={today} failed={false} />)

    expect(styles).toContainEqual(["strokeStyle", "#fff"])
    // The veil's colour comes from a canvas painting the token, never from parsing it.
    expect(styles).toContainEqual(["fillStyle", "rgb(5 5 5)"])
    const veil = canvas.createImageData.mock.results.at(-1)!.value
    const middle =
      4 * (Math.floor(veil.height / 2) * veil.width + veil.width / 2)
    expect([...veil.data.slice(middle, middle + 4)]).toEqual([1, 2, 3, 232])
  })

  it("dithers the wordmark in, then leaves it whole", () => {
    render(<Hero hero={hero} failed={false} />)

    const wordmark = screen.getByRole("heading", { level: 1 })
    expect(wordmark.style.maskImage).toMatch(/^url\(/)
    advance(300)
    expect(wordmark.style.maskImage).toBe("")
  })

  it("never replays the intro when reduced motion is turned off later", () => {
    prefers(true)
    render(<Hero hero={hero} today={today} failed={false} />)

    act(() => {
      prefers(false).dispatchEvent(new Event("change"))
    })
    advance(100)
    expect(screen.getByText("181").dataset.count).toBeUndefined()
    expect(screen.getByRole("heading", { level: 1 }).style.maskImage).toBe("")
    expect(frames.size).toBe(0)
  })
})

describe("signal", () => {
  const hero = "signal"

  it("frames the baseline small and dotted, and the value large and dashed, each labelled", () => {
    prefers(true)
    render(<Hero hero={hero} failed={false} />)
    expect(canvas.strokeRect).toBeUndefined()
    cleanup()

    render(<Hero hero={hero} today={today} failed={false} />)
    expect(canvas.setLineDash).toHaveBeenCalledWith([6, 4])
    expect(canvas.setLineDash).toHaveBeenCalledWith([2, 3])
    // Each frame is stroked twice: a band of the ground under the dotted line.
    const [value, , baseline] = canvas.strokeRect.mock.calls.map(
      (call) => call[2]
    )
    expect(value / baseline).toBeCloseTo(1.81, 1)
    const labels = canvas.fillText.mock.calls.map((call) => call[0])
    expect(labels).toEqual(["181", "100"])
  })
})

describe("vortex", () => {
  const hero = "vortex"

  it("turns a solid arm out to the value, and labels it and the baseline's tick", () => {
    prefers(true)
    render(<Hero hero={hero} failed={false} />)
    expect(canvas.fillText).toBeUndefined()
    cleanup()

    render(<Hero hero={hero} today={today} failed={false} />)
    expect(canvas.setLineDash).toHaveBeenCalledWith([4, 4])
    const labels = canvas.fillText.mock.calls.map((call) => call[0])
    expect(labels.toSorted()).toEqual(["100", "181"])
  })

  it("draws no arm, tick or label for a baseline that is not a number", () => {
    prefers(true)
    render(
      <Hero
        hero={hero}
        today={{ ...today, baseline: Number.NaN }}
        failed={false}
      />
    )
    expect(drawn()).toBeGreaterThan(0)
    expect(canvas.fillText).toBeUndefined()
    expect(canvas.setLineDash).toBeUndefined()
  })
})

describe("signal, at 4 times the baseline on a phone", () => {
  it("keeps the value's frame and its label inside the hero", () => {
    prefers(true)
    // The phone's hero: 390 px wide, its text from 224 px down.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        return (
          this.tagName === "DIV" && this.querySelector("h1")
            ? new DOMRect(16, 224, 358, 1106)
            : new DOMRect(0, 0, 390, 1400)
        ) as DOMRect
      }
    )
    render(
      <Hero
        hero="signal"
        today={{ ...today, sevenDayAverage: 400 }}
        failed={false}
      />
    )
    for (const [left, top, width] of canvas.strokeRect.mock.calls) {
      expect(top - 15).toBeGreaterThanOrEqual(0)
      expect(left).toBeGreaterThanOrEqual(0)
      expect(left + width).toBeLessThanOrEqual(390)
    }
    // The labels' blocks, and the 1 px probes that read the tokens.
    for (const [x, y] of canvas.fillRect.mock.calls) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
    }
  })
})
