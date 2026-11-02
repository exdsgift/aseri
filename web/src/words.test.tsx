import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import catalog from "@/fixtures/series.json"

import { App } from "./App"

// A word, as a reader counts one: a run between spaces with a letter or a digit in it, so
// "·" and "[‹][›]" are none, and "110-250" and "(8" are one each.
const words = (text: string) =>
  text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length

// The text a reader sees before opening anything: not a closed disclosure's body, nor
// what is hidden, held invisible or kept for screen readers alone.
function seen(root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const shown: string[] = []
  const hidden = (element: Element | null): boolean =>
    !!element &&
    element !== root &&
    (element.hasAttribute("hidden") ||
      (element as HTMLElement).style?.visibility === "hidden" ||
      ["sr-only", "invisible"].some((name) =>
        element.classList.contains(name)
      ) ||
      (element.parentElement?.tagName === "DETAILS" &&
        !element.parentElement.hasAttribute("open") &&
        element.tagName !== "SUMMARY") ||
      hidden(element.parentElement))
  while (walker.nextNode())
    if (!hidden(walker.currentNode.parentElement))
      shown.push((walker.currentNode as Text).data)
  return shown.join(" ")
}

describe("words", () => {
  it("counts the runs between spaces that hold a letter or a digit", () => {
    expect(
      words("Nov 23: likely 110-250 (8 in 10), about where it is now")
    ).toBe(12)
    expect(words("[‹][›] 1 day · [T] today")).toBe(4)
    expect(words("焦り あせり · aseri")).toBe(3)
  })

  it("leaves out a closed disclosure's body, but not its summary", () => {
    const page = document.createElement("main")
    page.innerHTML = `<p>Shown here</p><details><summary>How to read this</summary><p>Not shown</p></details><p hidden>Gone</p><span class="sr-only">For readers</span><button style="visibility: hidden">Back</button>`
    expect(seen(page)).toBe("Shown here How to read this")
    page.querySelector("details")!.open = true
    expect(seen(page)).toBe("Shown here How to read this Not shown")
  })
})

const published: Record<string, unknown> = Object.fromEntries(
  Object.entries(
    import.meta.glob("./fixtures/**/*.json", { eager: true, import: "default" })
  ).map(([path, file]) => [path.replace("./fixtures/", "api/v1/"), file])
)
const everySeries = catalog.series.map((entry) => entry.series_id)

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

beforeEach(() => {
  // A desktop's panel, so the chart draws its labels; jsdom lays nothing out.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      callback: ResizeObserverCallback
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }
      observe() {
        this.callback(
          [{ contentRect: { width: 692 } } as ResizeObserverEntry],
          this as never
        )
      }
      disconnect() {}
    }
  )
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect() {},
    fillRect() {},
    drawImage() {},
  } as never)
  vi.useFakeTimers({ now: new Date("2026-10-31T12:00:00Z"), toFake: ["Date"] })
})

// The words of the page as it opens with the catalog cut to `ids`, in all and by block, the
// blocks to say where the words went when a budget fails.
async function defaultView(ids: string[]) {
  const files = {
    ...published,
    "api/v1/series.json": {
      ...catalog,
      series: catalog.series.filter((entry) => ids.includes(entry.series_id)),
    },
  }
  vi.stubGlobal("fetch", async (url: string) =>
    Response.json(files[url as keyof typeof files])
  )
  render(<App />)
  await screen.findByRole("region", { name: /^Record/ })
  const signals = screen.getByRole("region", { name: /^Signals/ })
  await waitFor(() =>
    expect(
      within(signals).getAllByRole("button", { pressed: false })
    ).toHaveLength(ids.length - 1)
  )
  await screen.findByRole("img", { name: /^Geopolitical risk:/ })
  const main = document.querySelector("main")!
  const blocks = Object.fromEntries(
    [...main.querySelectorAll(":scope > *")].map((block) => [
      block.id,
      words(seen(block)),
    ])
  )
  return { total: words(seen(main)), blocks: JSON.stringify(blocks) }
}

// The study's budget (docs/research/reports/Comunicare le previsioni con meno testo.md, change
// 8), as the prototype measured it: GPR and three sea lanes, in under 300 words.
const prototype = [
  "gpr_daily",
  "suez_transits",
  "hormuz_transits",
  "bab_el_mandeb_transits",
]
it("keeps the default view under 300 words with the prototype's four series", async () => {
  const { total, blocks } = await defaultView(prototype)
  expect(total, blocks).toBeLessThan(300)
})

// A card and a row of the record each: no new series may bring the words back.
it("adds at most 30 words for each further series", async () => {
  expect(everySeries).toHaveLength(9)
  const { total, blocks } = await defaultView(everySeries)
  expect(total, blocks).toBeLessThan(300 + 30 * (everySeries.length - 4))
})
