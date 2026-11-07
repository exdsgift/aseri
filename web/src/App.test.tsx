import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import catalog from "@/fixtures/series.json"
import actuals from "@/fixtures/series/gpr_daily/actuals.json"
import latest from "@/fixtures/series/gpr_daily/latest.json"
import replay from "@/fixtures/series/gpr_daily/replay.json"
import { monthDay } from "@/lib/format"

import apiPage from "../api/index.html?raw"
import page from "../index.html?raw"
import { App } from "./App"

// What a daily run published on 2026-10-31, at the URLs the page reads (the fixtures
// are its files, as the pipeline wrote them).
const published: Record<string, unknown> = Object.fromEntries(
  Object.entries(
    import.meta.glob("./fixtures/**/*.json", { eager: true, import: "default" })
  ).map(([path, file]) => [path.replace("./fixtures/", "api/v1/"), file])
)
const serve = (files: Record<string, unknown>) =>
  vi.stubGlobal("fetch", async (url: string) => Response.json(files[url]))

// jsdom lays nothing out, so the chart never learns its width and draws nothing,
// and it cannot scroll.
let scrollIntoView: ReturnType<typeof vi.fn<Element["scrollIntoView"]>>
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  scrollIntoView = vi.fn()
  Element.prototype.scrollIntoView = scrollIntoView
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
// The day latest.json's forecast was made, so the panel calls it today.
beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-31T12:00:00Z"), toFake: ["Date"] })
})

// The cards fill in as each series loads, so a test waits for the last one it expects.
const signals = async (cards: number) => {
  const region = await screen.findByRole("region", { name: "Signals" })
  await waitFor(() =>
    expect(within(region).getAllByRole("button")).toHaveLength(cards)
  )
  return within(region)
}

it("shows the GPR 7-day average and the forecast for the same weekday 4 weeks on", async () => {
  vi.stubGlobal("fetch", async (url: string) => Response.json(published[url]))

  render(<App />)

  // The first render of the file pays for the page's modules: under a full parallel run it can pass 1 s.
  await screen.findByText("181", { selector: "p" }, { timeout: 5000 })
  const wordmark = screen.getByRole("heading", { level: 1 })
  expect(wordmark.textContent).toBe("焦りあせり · aseri")
  const hero = within(wordmark.closest("section")!)
  // Like with like: the average against normal, then one day against the same weekday.
  expect(hero.getAllByRole("paragraph").map((p) => p.textContent)).toEqual([
    "Geopolitical risk",
    "181",
    "81% above normal · 7-day average to Oct 26",
    "Nov 23: likely 110-260 (8 in 10), about where it is now",
  ])
  // The range bar: the range, a tick for normal and a marker on last Monday.
  const bar = hero.getByRole("img", { name: /^Nov 23:/ })
  // Its ends as the sentence rounds them.
  expect(bar.getAttribute("aria-label")).toBe(
    "Nov 23: likely 110-260, normal 100, Last Monday 165"
  )
  expect(bar.textContent).toBe("Last Monday 165110260normal 100")
  // The rest of the data's story, one tap away.
  const about = hero.getByRole("button", { name: "About this data" })
  expect(about.getAttribute("aria-expanded")).toBe("false")
  expect(
    [
      ...document.getElementById(about.getAttribute("aria-controls")!)!
        .children,
    ].map((p) => p.textContent)
  ).toEqual([
    "GPR runs on a weekly cycle: compare Monday with Monday.",
    "The big number averages the 7 days to Oct 26. The outlook is for one day, Monday Nov 23, against the last Monday, 165.",
    `Normal: its 1985-2019 average, 100. Data as of ${monthDay(actuals.as_of)}, preliminary for about 4 weeks.`,
  ])
})

it("shows the hero the reader picks at the foot of the page, and remembers it", () => {
  serve(published)
  localStorage.clear()
  const shown = () => document.getElementById("today")!.dataset.hero
  const pick = (name: string) =>
    fireEvent.click(
      within(screen.getByRole("group", { name: "Hero" })).getByRole("button", {
        name,
      })
    )
  const pressed = () =>
    screen.getAllByRole("button", { pressed: true }).map((b) => b.textContent)

  render(<App />)
  // On rotation by default: this load's turn.
  expect(pressed()).toEqual(["Rotate"])
  const turn = shown()
  pick("Vortex")
  expect(shown()).toBe("vortex")
  cleanup()

  render(<App />)
  expect(pressed()).toEqual(["Vortex"])
  expect(shown()).toBe("vortex")
  pick("Rotate")
  expect(shown()).toBe(turn)
  expect(localStorage.getItem("aseri.hero")).toBe("rotate")
})

// GitHub pauses an idle repository's schedule, and nothing else would say the files stopped.
it("cautions when the site was last updated more than 2 days ago", async () => {
  serve(published)
  const day = 86_400_000
  const updated = Date.parse(catalog.generated_at)
  const caution = () => screen.queryByText(/^Site last updated/)

  vi.setSystemTime(updated + 2 * day)
  render(<App />)
  await screen.findByText("181", { selector: "p" })
  expect(caution()).toBeNull()
  cleanup()

  vi.setSystemTime(updated + 3 * day)
  render(<App />)
  await screen.findByText("181", { selector: "p" })
  expect(caution()!.textContent).toBe(
    `Site last updated ${monthDay(catalog.generated_at.slice(0, 10))}: the daily update may have stopped.`
  )
  expect(caution()!.className).toContain("caution")
})

// The words beside the numbers prevent the known misreadings: a median read as a promise,
// a range read as false precision. Each "most likely" value comes after its range.
it("keeps the copy honest, today and in replay, in index.html's tags and on the API's page", async () => {
  // A chart with a width draws its labels, and a tap on it opens a day's readout.
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
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect() {},
    fillRect() {},
    drawImage() {},
  } as never)
  serve(published)
  render(<App />)
  const chart = await screen.findByRole("img", { name: /^Geopolitical risk:/ })
  // The record too, with its verdicts and its notes.
  await screen.findByRole("region", { name: "Record" })
  // The text nodes, and the text alternatives a screen reader gets instead.
  const copy = () => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    )
    const nodes: Text[] = []
    while (walker.nextNode()) nodes.push(walker.currentNode as Text)
    const alternatives = [
      ...document.querySelectorAll("[aria-label], [aria-valuetext]"),
    ].flatMap((element) =>
      ["aria-label", "aria-valuetext"].flatMap(
        (name) => element.getAttribute(name) ?? []
      )
    )
    return {
      text: [...nodes.map((node) => node.data), ...alternatives].join(" "),
      // Where the page gives a middle value: the block around the words, or the alternative.
      // The value may be a text node of its own, so the words find the block.
      medians: [
        ...nodes
          .filter((node) => /most likely|middle estimate/i.test(node.data))
          .map(
            (node) => node.parentElement!.closest("p, li, div")!.textContent!
          )
          .filter((block) => middle.test(block)),
        ...alternatives.filter((text) => middle.test(text)),
      ],
    }
  }
  const seen = [copy()]
  fireEvent.pointerDown(chart, { clientX: 692 })
  seen.push(copy())
  fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } })
  fireEvent.pointerDown(chart, { clientX: 692 })
  seen.push(copy())
  const text = [...seen.map((s) => s.text), page, apiPage].join(" ")
  const medians = [...seen.flatMap((s) => s.medians), page, apiPage]

  expect(text).not.toMatch(/\bwill\b/i)
  expect(text).not.toMatch(/%\s*confidence/i)
  // No em dash anywhere: a colon or a comma does its work.
  expect(text).not.toContain(String.fromCharCode(0x2014))
  // The replay's tap readout is up, so every place a median shows was read.
  expect(text).toMatch(/What happened\s+\d/)
  // The tap readout's and the numbers' middle estimates, at least.
  expect(medians.length).toBeGreaterThan(3)
  expect(medians.filter((block) => bareMedians(block).length)).toEqual([])
})

// "Most likely" or "middle estimate" before a value: the median's words, old and new.
const middle = /(?:most likely|middle estimate):? \d/i

// The text before each middle value, back to the one before it, that gives no range: "likely
// 119-243" or "8 in 10 between 111 and 251".
const bareMedians = (block: string) =>
  block
    .split(/(?:most likely|middle estimate):? (?=\d)/i)
    .slice(0, -1)
    .filter(
      (before) =>
        !/(?:\d+ in 10\b.*?|likely )\d[\d,]*(?:-| and )\d/i.test(before)
    )

// For dataset search engines: schema.org's Dataset, with what Google asks of one.
it("describes the API's data as a schema.org Dataset, under aseri's licence", () => {
  const block = apiPage.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
  )
  const dataset = JSON.parse(block![1])

  expect(dataset["@type"]).toBe("Dataset")
  expect(dataset.name).toMatch(/^aseri/)
  expect(dataset.description.length).toBeGreaterThanOrEqual(50)
  expect(dataset.description.length).toBeLessThanOrEqual(5000)
  expect(dataset.license).toBe(
    "https://creativecommons.org/licenses/by-nc/4.0/"
  )
  expect(dataset.creditText).toBe(
    "Forecasts: aseri (model aseri-timestral209m_c1, Timestral-209M by Mistral AI)"
  )
  expect(dataset.variableMeasured).toHaveLength(9)
  expect(dataset.distribution[0].contentUrl).toBe(
    "https://exdsgift.github.io/aseri/api/v1/series.json"
  )
})

it("finds a middle value given without its range first", () => {
  expect(bareMedians("Nov 23: most likely 168 · 8 in 10: 111-251")).toEqual([
    "Nov 23: ",
  ])
  expect(bareMedians("8 in 10 between 111 and 251. Most likely 168")).toEqual(
    []
  )
  expect(
    bareMedians("Nov 02 (7 days): likely 1,119-1,243 · middle estimate 1,173")
  ).toEqual([])
  expect(bareMedians("Nov 02: middle estimate 173 · likely 119-243")).toEqual([
    "Nov 02: ",
  ])
  expect(bareMedians("Path 1 of 20, the most likely")).toEqual([])
})

it("says so in one plain line when the data cannot be loaded", async () => {
  vi.stubGlobal("fetch", async () => new Response("", { status: 404 }))
  vi.spyOn(console, "error").mockImplementation(() => {})

  render(<App />)

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Couldn't load today's data. Refresh to try again."
  )
  expect(screen.queryByRole("region")).toBeNull()
})

// The chart draws one forecast per day up to the hero's step, at five levels.
const pick = (rows: number[], at: number[]) => at.map((i) => rows[i])
it.each([
  [
    "only the 7, 14 and 28-day steps",
    {
      ...latest,
      horizon: [7, 14, 28],
      target_end_date: pick(latest.target_end_date as never, [6, 13, 27]),
      quantiles: Object.fromEntries(
        Object.entries(latest.quantiles).map(([level, rows]) => [
          level,
          pick(rows, [6, 13, 27]),
        ])
      ),
    },
  ],
  [
    "days past the catalog's horizon",
    {
      ...latest,
      horizon: [...latest.horizon, 29],
      target_end_date: [...latest.target_end_date, "2026-11-24"],
      quantiles: Object.fromEntries(
        Object.entries(latest.quantiles).map(([level, rows]) => [
          level,
          [...rows, rows.at(-1)],
        ])
      ),
    },
  ],
  [
    "no 5-in-10 range",
    {
      ...latest,
      quantiles: { ...latest.quantiles, "0.25": undefined },
    },
  ],
])("refuses a forecast file with %s", async (_, broken) => {
  vi.stubGlobal("fetch", async (url: string) =>
    Response.json(
      { ...published, "api/v1/series/gpr_daily/latest.json": broken }[url]
    )
  )
  vi.spyOn(console, "error").mockImplementation(() => {})

  render(<App />)

  expect(await screen.findByRole("alert")).toBeTruthy()
})

it.each([
  [
    "a past forecast without its 5-in-10 range",
    {
      ...replay,
      forecasts: replay.forecasts.map((f, i) =>
        i === 3 ? { ...f, quantiles: { ...f.quantiles, "0.25": undefined } } : f
      ),
    },
  ],
  [
    "a past forecast made before the actuals start",
    {
      ...replay,
      forecasts: replay.forecasts.map((f, i) =>
        i === 0 ? { ...f, reference_date: "2025-01-06" } : f
      ),
    },
  ],
])(
  "drops %s from the replay, and keeps today's forecast",
  async (_, broken) => {
    vi.stubGlobal("fetch", async (url: string) =>
      Response.json(
        { ...published, "api/v1/series/gpr_daily/replay.json": broken }[url]
      )
    )

    render(<App />)

    await screen.findByText("181", { selector: "p" })
    // 120 past forecasts and today's, less the broken one.
    expect(screen.getByRole("slider").getAttribute("max")).toBe("119")
  }
)

it("shows today's forecast without the replay when the replay file is missing", async () => {
  vi.stubGlobal("fetch", async (url: string) =>
    url.endsWith("replay.json")
      ? new Response("", { status: 404 })
      : Response.json(published[url])
  )
  vi.spyOn(console, "error").mockImplementation(() => {})

  render(<App />)

  await screen.findByText("181", { selector: "p" })
  expect(
    screen.getByRole("region", { name: /^Geopolitical risk Likely/ })
  ).toBeTruthy()
  expect(screen.queryByRole("slider")).toBeNull()
})

it("never scores today's forecast, even when the actuals run ahead of it", async () => {
  const aheadByTwoDays = {
    ...actuals,
    date: [...actuals.date, "2026-10-27", "2026-10-28"],
    observation: [...actuals.observation, 150, 160],
  }
  vi.stubGlobal("fetch", async (url: string) =>
    Response.json(
      { ...published, "api/v1/series/gpr_daily/actuals.json": aheadByTwoDays }[
        url
      ]
    )
  )

  render(<App />)

  const chart = await screen.findByRole("img", { name: /^Geopolitical risk:/ })
  expect(chart.getAttribute("aria-label")).not.toMatch(/what happened/i)
  const numbers = screen.getByRole("button", { name: "Show the numbers" })
  expect(
    document.getElementById(numbers.getAttribute("aria-controls")!)!.textContent
  ).not.toMatch(/what happened/i)
})

it("shows today's GPR forecast in the panel, from one load of each file", async () => {
  const fetch = vi.fn(async (url: string) => Response.json(published[url]))
  vi.stubGlobal("fetch", fetch)

  render(<App />)

  const panel = within(
    await screen.findByRole("region", {
      name: "Geopolitical risk Likely 110-260 by Nov 23, about where it is now",
    })
  )
  // The takeaway, the series and its unit, then the chart: nothing between them to read.
  expect(panel.getAllByRole("paragraph").map((p) => p.textContent)).toEqual([
    "Geopolitical risk · index (1985-2019 average = 100)",
    "Replay a past forecast",
    "Jun 28 [‹][›] 1 day · [T] today Today",
  ])
  expect(panel.queryByRole("list")).toBeNull()
  expect(panel.getByText(`Source: ${latest.attribution}`)).toBeTruthy()
  // Every file but the other series' replays, which wait for their card to be picked.
  expect(fetch.mock.calls.map(([url]) => url).toSorted()).toEqual(
    Object.keys(published)
      .filter(
        (url) => url.includes("gpr_daily") || !url.endsWith("replay.json")
      )
      .toSorted()
  )
})

it("averages the 7 days that end on the forecast's reference date, even when the actuals run a day ahead", async () => {
  const aheadByOneDay = {
    ...actuals,
    date: [...actuals.date, "2026-10-27"],
    observation: [...actuals.observation, 1000],
  }
  vi.stubGlobal("fetch", async (url: string) =>
    Response.json(
      { ...published, "api/v1/series/gpr_daily/actuals.json": aheadByOneDay }[
        url
      ]
    )
  )

  render(<App />)

  expect(await screen.findByText("181", { selector: "p" })).toBeTruthy()
})

it("groups a card for each series in the catalog, with its 7-day average against normal and one day's range", async () => {
  serve(published)

  render(<App />)

  const cards = await signals(9)
  expect(
    cards.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
  ).toEqual(["Risk, attention and oil", "Sea lanes", "War in Ukraine"])
  // The takeaway: the signal furthest from normal, against the others of its kind.
  expect(
    screen.getByRole("region", { name: "Signals" }).querySelector("h2 + p")!
      .textContent
  ).toBe("Strait of Hormuz 88% below normal; other lanes within 20%")
  expect(
    cards.getAllByRole("button").map((b) => b.textContent!.replace(/\s+/g, " "))
  ).toEqual([
    // Each range rounded outward from the model's: GPR's 110.8-251.0, Brent's 102.3-145.1.
    "Geopolitical risk [1] 181 index · 7-day avg Data to Oct 26 81% above normal Nov 23: likely 110-260",
    '"World War III" [2] 2,053 Wikipedia views a day · 7-day avg Data to Oct 30 57% below normal Nov 13: likely 1,400-5,600 a day',
    // Brent's week has 5 prices, and its 14 steps are trading days: Nov 16 is 20 days on.
    "Brent oil [3] 124 $ a barrel · 7-day avg Data to Oct 27 38% above normal Nov 16: likely 102-146 a barrel",
    "Suez Canal [4] 41 ships a day · 7-day avg Data to Oct 25 1% above normal Nov 22: likely 33-51 a day",
    "Strait of Hormuz [5] 3 ships a day · 7-day avg Data to Oct 25 88% below normal Nov 08: likely 0-7 a day",
    "Bab el-Mandeb [6] 29 ships a day · 7-day avg Data to Oct 25 14% below normal Nov 08: likely 20-36 a day",
    "Taiwan Strait [7] 190 ships a day · 7-day avg Data to Oct 25 18% below normal Nov 22: likely 180-270 a day",
    "Air-raid alerts [8] 62 alert hours a day, all regions · 7-day avg Data to Oct 30 1% below normal Nov 06: likely 48-88 a day",
    "Drones downed [9] 1,684 drones a day, claimed by Ukraine's General Staff, one side's figures · 7-day avg Data to Oct 30 20% above normal Nov 06: likely 1,150-2,000 a day",
  ])
  // The key hint is for the eye, and only on hover or focus: the button says it as a shortcut.
  const suez = cards.getByRole("button", { name: /^Suez Canal 41 ships/ })
  expect(suez.getAttribute("aria-keyshortcuts")).toBe("4")
  expect(within(suez).getByText("[4]").className).toContain("invisible")
  // Which way from normal, by shape as well as words.
  expect(suez.querySelectorAll("svg")).toHaveLength(2)
})

it("cautions on a stale series' card, in words and with a caution's marker", async () => {
  serve({
    ...published,
    "api/v1/series.json": {
      ...catalog,
      series: catalog.series.map((entry) =>
        entry.series_id === "suez_transits"
          ? { ...entry, stale_since: "2026-11-04" }
          : entry
      ),
    },
  })

  render(<App />)

  const suez = await screen.findByRole("button", { name: /^Suez Canal/ })
  const dataTo = within(suez).getByText(/stale since/)
  expect(dataTo.textContent).toBe("stale since Nov 04")
  expect(dataTo.className).toContain("caution")
})

it("leaves out the card of a series whose files are broken, and keeps the page", async () => {
  vi.stubGlobal("fetch", async (url: string) =>
    url.includes("hormuz_transits")
      ? new Response("", { status: 404 })
      : Response.json(published[url])
  )
  vi.spyOn(console, "error").mockImplementation(() => {})

  render(<App />)

  const cards = await signals(8)
  expect(
    cards.getAllByRole("button").map((b) => b.getAttribute("aria-keyshortcuts"))
  ).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"])
  expect(cards.queryByRole("button", { name: /^Strait of Hormuz/ })).toBeNull()
})

it("shows GPR as soon as it loads, while another series' files are still on their way", async () => {
  vi.stubGlobal("fetch", (url: string) =>
    url.includes("taiwan_strait_transits")
      ? new Promise(() => {})
      : Promise.resolve(Response.json(published[url]))
  )

  render(<App />)

  await screen.findByText("181", { selector: "p" })
  const cards = await signals(8)
  expect(cards.getAllByRole("button")).toHaveLength(8)
  expect(cards.queryByRole("button", { name: /^Taiwan Strait/ })).toBeNull()
})

it("draws no group without a series in the catalog", async () => {
  serve({
    ...published,
    "api/v1/series.json": { ...catalog, series: catalog.series.slice(0, 1) },
  })

  render(<App />)

  const cards = await signals(1)
  expect(
    cards.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
  ).toEqual(["Risk, attention and oil"])
  expect(cards.getAllByRole("button")).toHaveLength(1)
})

const card = (name: RegExp) => screen.getByRole("button", { name })
// The series the panel shows, then its title.
const panelTitle = () => {
  const title = document.querySelector("#forecast h2")!
  return `${title.nextElementSibling!.querySelector("span")!.textContent} · ${title.textContent}`
}

it("opens a picked card's series in the panel and brings it into view, then loads its replay, while the hero stays on GPR", async () => {
  const fetch = vi.fn(async (url: string) => Response.json(published[url]))
  vi.stubGlobal("fetch", fetch)
  render(<App />)
  await signals(9)

  fireEvent.click(card(/^Suez Canal/))

  expect(panelTitle()).toMatch(/^Suez Canal · Likely 33-51 by Nov 22, /)
  expect(card(/^Suez Canal/).getAttribute("aria-pressed")).toBe("true")
  expect(card(/^Geopolitical risk/).getAttribute("aria-pressed")).toBe("false")
  // Picked reads by shape too, an inner frame, and a hover never draws one.
  expect(card(/^Suez Canal/).className).toMatch(
    /\baria-pressed:shadow-\[inset_/
  )
  expect(card(/^Suez Canal/).className).not.toMatch(/\bhover:shadow-/)
  await waitFor(() =>
    expect(scrollIntoView.mock.contexts.at(-1)).toContain(
      screen.getByRole("region", { name: /^Suez Canal Likely/ })
    )
  )
  expect(fetch).toHaveBeenCalledWith("api/v1/series/suez_transits/replay.json")
  // The replay's 120 past forecasts, then today's.
  const slider = await screen.findByRole("slider")
  expect(slider.getAttribute("max")).toBe("120")
  // A sideways drag moves its handle; a swipe up or down still scrolls the page.
  expect(slider.className.split(" ")).toContain("touch-pan-y")
  expect(screen.getByText("181", { selector: "p" })).toBeTruthy()
})

// Suez's replay, held back until the test lets it through.
function holdReplay() {
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  vi.stubGlobal("fetch", async (url: string) => {
    if (url === "api/v1/series/suez_transits/replay.json") await held
    return Response.json(published[url])
  })
  return release
}
const anchoring = () => document.documentElement.style.overflowAnchor

// A smooth scroll asked from the click began while the panel still showed GPR, and scroll
// anchoring, keeping the card still as the panel above it changed height, cut it short.
it("scrolls to the panel once it shows the picked series, focuses its heading, and scrolls no more when the replay arrives", async () => {
  const release = holdReplay()
  const focus = vi.spyOn(HTMLElement.prototype, "focus")
  // What the panel showed when it was scrolled to.
  const shown: string[] = []
  scrollIntoView.mockImplementation(() => shown.push(panelTitle()))
  render(<App />)
  await signals(9)

  fireEvent.click(card(/^Suez Canal/))

  // Anchoring off from the pick, before the panel changes height.
  expect(anchoring()).toBe("none")
  expect(scrollIntoView).not.toHaveBeenCalled()
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))
  expect(scrollIntoView.mock.contexts[0]).toBe(
    document.getElementById("forecast")
  )
  expect(shown).toEqual([expect.stringMatching(/^Suez Canal · Likely/)])
  expect(document.activeElement).toBe(document.querySelector("#forecast h2"))
  expect(focus).toHaveBeenLastCalledWith({ preventScroll: true })
  // On again once the scroll has ended, for the reader's own scrolling.
  window.dispatchEvent(new Event("scrollend"))
  expect(anchoring()).toBe("")

  release()
  await screen.findByRole("slider")
  expect(scrollIntoView).toHaveBeenCalledTimes(1)
})

it("turns scroll anchoring back on where there is no scrollend, once the page is still", async () => {
  serve(published)
  render(<App />)
  await signals(9)

  fireEvent.click(card(/^Brent oil/))

  expect(anchoring()).toBe("none")
  await waitFor(() => expect(anchoring()).toBe(""), { timeout: 1000 })
})

// Drawn anew, the panel drops the focus it held, and only that.
it.each([
  [
    "back on the panel's heading, where it was",
    () => {},
    () => document.querySelector("#forecast h2"),
  ],
  [
    "on the page, where the reader left it",
    () => (document.activeElement as HTMLElement).blur(),
    () => document.body,
  ],
  [
    "on a card, where the reader moved it",
    () => card(/^Brent oil/).focus(),
    () => card(/^Brent oil/),
  ],
])("leaves the focus %s when the replay arrives", async (_, move, focused) => {
  const release = holdReplay()
  render(<App />)
  await signals(9)
  fireEvent.click(card(/^Suez Canal/))
  await waitFor(() =>
    expect(document.activeElement).toBe(document.querySelector("#forecast h2"))
  )
  move()

  release()
  await screen.findByRole("slider")
  await act(async () => {})

  expect(document.activeElement).toBe(focused())
})

it("asks for a series' replay once, however often its card is picked, even when the replay is missing", async () => {
  const replayUrl = "api/v1/series/hormuz_transits/replay.json"
  const fetch = vi.fn(async (url: string) =>
    url === replayUrl
      ? new Response("", { status: 404 })
      : Response.json(published[url])
  )
  vi.stubGlobal("fetch", fetch)
  vi.spyOn(console, "error").mockImplementation(() => {})
  render(<App />)
  await screen.findByRole("button", { name: /^Strait of Hormuz/ })
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

  fireEvent.click(card(/^Strait of Hormuz/))
  fireEvent.click(card(/^Strait of Hormuz/))
  await settle()
  fireEvent.click(card(/^Geopolitical risk/))
  fireEvent.click(card(/^Strait of Hormuz/))
  await settle()

  expect(fetch.mock.calls.filter(([url]) => url === replayUrl)).toHaveLength(1)
  expect(panelTitle()).toMatch(/^Strait of Hormuz · Likely/)
})

it("opens a square of the record in the panel's replay, loading that series' replay first", async () => {
  serve(published)
  render(<App />)
  const record = within(await screen.findByRole("region", { name: "Record" }))
  // The record of the run of 2026-10-31: no live forecast resolved yet, so the backtest, said once.
  expect(record.getByText(/^Live record starts/).textContent).toBe(
    "Live record starts after 30 forecasts (0 so far). Until then, backtests made after the fact."
  )
  expect(record.getByText(/forecasts landed in range/).textContent).toBe(
    "Backtest: 56 of 72 forecasts landed in range, close to the 8 in 10 promised"
  )
  const squares = within(
    record.getByRole("heading", { name: "Suez Canal" }).closest("li")!
  ).getAllByRole("button")
  expect(squares).toHaveLength(8)

  fireEvent.click(squares[0])

  // Opened once Suez's replay is in, which today's panel did not have.
  expect(
    await screen.findByRole("heading", {
      level: 2,
      name: /^Backtest made Aug 16: likely/,
    })
  ).toBeTruthy()
  expect(panelTitle()).toMatch(/^Suez Canal · /)
  expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe(
    "Aug 16, backtest"
  )
  expect(scrollIntoView).toHaveBeenCalled()
})

it("reopens a square's forecast on a second tap, after the reader has moved the replay", async () => {
  serve(published)
  render(<App />)
  const record = within(await screen.findByRole("region", { name: "Record" }))
  const square = () =>
    within(
      record.getByRole("heading", { name: "Suez Canal" }).closest("li")!
    ).getAllByRole("button")[0]
  fireEvent.click(square())
  await screen.findByRole("heading", {
    level: 2,
    name: /^Backtest made Aug 16:/,
  })
  const opened = panelTitle()

  fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } })
  expect(panelTitle()).toMatch(/^Suez Canal · Backtest made Jun 27:/)
  fireEvent.click(square())

  expect(panelTitle()).toBe(opened)
})

it("opens a square's forecast on its most likely path, with nothing playing", async () => {
  serve(published)
  render(<App />)
  const record = within(await screen.findByRole("region", { name: "Record" }))
  const panel = () =>
    within(screen.getByRole("region", { name: /^Geopolitical risk / }))
  // Today's GPR forecast, playing, on its third path.
  fireEvent.click(panel().getByRole("button", { name: "Play" }))
  fireEvent.click(panel().getByRole("button", { name: "Next path" }))
  fireEvent.click(panel().getByRole("button", { name: "Next path" }))
  expect(panel().getByText(/^Path \d+ of 20/).textContent).toBe("Path 3 of 20")

  fireEvent.click(
    within(
      record.getByRole("heading", { name: "Geopolitical risk" }).closest("li")!
    ).getAllByRole("button")[0]
  )

  expect(panelTitle()).toMatch(
    /^Geopolitical risk · Backtest made Jul 27: likely/
  )
  expect(panel().getByText(/^Path \d+ of 20/).textContent).toBe(
    "Path 1 of 20, the most likely"
  )
  expect(panel().getByRole("button", { name: "Play" })).toBeTruthy()
})

it("shows the page without the record when the scores cannot be loaded", async () => {
  vi.stubGlobal("fetch", async (url: string) =>
    url === "api/v1/scores.json"
      ? new Response("", { status: 404 })
      : Response.json(published[url])
  )
  vi.spyOn(console, "error").mockImplementation(() => {})

  render(<App />)

  await signals(9)
  expect(screen.queryByRole("region", { name: "Record" })).toBeNull()
})

it("opens a series with its card's key, unless a field has the focus", async () => {
  serve(published)
  render(<App />)
  await signals(9)
  const press = (key: string, target: Element = document.body) =>
    fireEvent.keyDown(target, { key })

  press("5")
  expect(panelTitle()).toMatch(/^Strait of Hormuz · Likely/)
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())

  // The slider takes its own keys.
  const slider = await screen.findByRole("slider")
  slider.focus()
  press("1", slider)
  expect(panelTitle()).toMatch(/^Strait of Hormuz · Likely/)

  // No tenth card, and no shortcut with a modifier.
  press("0")
  press("1", document.body)
  fireEvent.keyDown(document.body, { key: "2", ctrlKey: true })
  expect(panelTitle()).toMatch(/^Geopolitical risk · Likely/)
})

// As its link in the side navigation does: the address says #record, and the next Tab goes
// on from the record.
it("jumps to the record with R, unless a field has the focus", async () => {
  history.replaceState(null, "", location.pathname)
  serve(published)
  render(<App />)
  const record = await screen.findByRole("region", { name: "Record" })
  const slider = await screen.findByRole("slider")

  slider.focus()
  fireEvent.keyDown(slider, { key: "r" })
  // Ctrl+R reloads the page: never a shortcut.
  fireEvent.keyDown(document.body, { key: "r", ctrlKey: true })
  expect(scrollIntoView).not.toHaveBeenCalled()
  expect(location.hash).toBe("")
  expect(document.activeElement).toBe(slider)

  fireEvent.keyDown(document.body, { key: "R" })
  expect(location.hash).toBe("#record")
  expect(document.activeElement).toBe(record)
  // Focused for the keyboard's sake, the section draws no ring of its own.
  expect(record.getAttribute("tabindex")).toBe("-1")
  expect(record.className.split(" ")).toContain("outline-none")
  // Again once the reader has scrolled away: the hash is the same, the jump is not.
  fireEvent.keyDown(document.body, { key: "r" })
  expect(scrollIntoView.mock.contexts).toEqual([record, record])
})

it("links every section from the side navigation, lit while it crosses the middle of the screen", async () => {
  // The scroll-spy's observer, to say which section the middle of the screen crosses.
  const spies: { callback: IntersectionObserverCallback; seen: Element[] }[] =
    []
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      seen: Element[] = []
      constructor(callback: IntersectionObserverCallback) {
        spies.push({ callback, seen: this.seen })
      }
      observe(target: Element) {
        this.seen.push(target)
      }
      disconnect() {}
    }
  )
  serve(published)
  render(<App />)
  const record = await screen.findByRole("region", { name: "Record" })

  const nav = within(screen.getByRole("navigation", { name: "Sections" }))
  const links = nav.getAllByRole("link")
  expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
    ["Risk today", "#today"],
    ["The forecast", "#forecast"],
    ["All signals", "#signals"],
    ["The record", "#record"],
  ])
  const section = (link: number) =>
    document.getElementById(links[link].getAttribute("href")!.slice(1))!
  expect(section(0)).toBe(
    screen.getByRole("heading", { level: 1 }).closest("section")
  )
  expect(
    within(section(1)).getByRole("region", { name: /^Geopolitical risk / })
  ).toBeTruthy()
  expect(section(2)).toBe(screen.getByRole("region", { name: "Signals" }))
  expect(section(3)).toBe(record)
  expect(links[3].getAttribute("aria-keyshortcuts")).toBe("R")

  // The hero first; then whichever section crosses the middle of the screen.
  const lit = () =>
    links
      .filter((a) => a.getAttribute("aria-current") === "location")
      .map((a) => a.textContent)
  expect(lit()).toEqual(["Risk today"])
  // Set up again once the record is drawn, by an effect that runs after it shows.
  const spy = await waitFor(() => {
    const watching = spies.findLast(({ seen }) => seen.includes(record))
    expect(watching).toBeDefined()
    return watching!
  })
  expect(spy.seen).toEqual([0, 1, 2, 3].map(section))
  const cross = (entries: [Element, boolean][]) =>
    act(() =>
      spy.callback(
        entries.map(
          ([target, isIntersecting]) => ({ target, isIntersecting }) as never
        ),
        spy as never
      )
    )
  cross([
    [section(0), false],
    [section(2), true],
  ])
  expect(lit()).toEqual(["All signals"])
  cross([
    [section(2), false],
    [record, true],
  ])
  expect(lit()).toEqual(["The record"])
  // Past the record, in the footer, the record stays lit.
  cross([[record, false]])
  expect(lit()).toEqual(["The record"])

  // Dimmed when inactive (how far: contrast.test.ts), whole when lit, hovered or focused.
  // Lit reads by shape too, a 2 px bar on the outer edge, where a hover draws none.
  const classes = links[0].className.split(" ")
  expect(classes).toEqual(
    expect.arrayContaining([
      "aria-[current=location]:opacity-100",
      "hover:opacity-100",
      "focus-visible:opacity-100",
      "border-r-2",
      "border-transparent",
      "aria-[current=location]:border-primary",
    ])
  )
  expect(classes.filter((name) => name.startsWith("hover:border"))).toEqual([])
})

// Every control shows the focus ring's 2 px outline when the keyboard reaches it, and every
// canvas chart has words: its own label, or the text of the card or hero it is drawn in.
it("rings every control on keyboard focus, and gives every chart a text equivalent", async () => {
  serve(published)
  render(<App />)
  await screen.findByRole("region", { name: "Record" })
  await signals(9)

  // Not the record's section: focused only from script, by R, it is no control.
  const controls = [
    ...document.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ),
  ]
  // The side navigation's 4, the panel's 3 and its disclosures, the 9 cards, the record's
  // squares and its disclosure, and the credit.
  expect(controls.length).toBeGreaterThan(22)
  const unringed = controls.filter(
    (control) =>
      !["focus-visible:outline-2", "focus-visible:outline-primary"].every(
        (name) => control.classList.contains(name)
      )
  )
  expect(
    unringed.map((c) => c.getAttribute("aria-label") ?? c.textContent)
  ).toEqual([])

  // The margins, a decoration behind the page that says nothing, then the hero's art, the
  // panel's chart and the 9 cards' charts.
  const [left, right, ...canvases] = [...document.querySelectorAll("canvas")]
  for (const margin of [left, right])
    expect(margin.closest("[aria-hidden]")!.className).toContain(
      "absolute inset-0"
    )
  expect(canvases).toHaveLength(11)
  const words = (canvas: HTMLCanvasElement) =>
    canvas.closest("[aria-hidden]")
      ? canvas.closest("button, section")!.textContent
      : canvas.getAttribute("role") === "img" &&
        canvas.getAttribute("aria-label")
  expect(
    canvases.filter((canvas) => !/likely \d/.test(words(canvas) || ""))
  ).toEqual([])
})
