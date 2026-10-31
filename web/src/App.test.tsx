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

import page from "../index.html?raw"
import { App } from "./App"

// What the daily runs published, at the URLs the page reads: GPR's of 2026-10-30,
// and the four sea lanes of the prototype's run of 2026-10-29.
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
  vi.useFakeTimers({ now: new Date("2026-10-30T12:00:00Z"), toFake: ["Date"] })
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

  await screen.findByText("181", { selector: "p" })
  const wordmark = screen.getByRole("heading", { level: 1 })
  expect(wordmark.textContent).toBe("焦りあせり · aseri")
  const hero = within(wordmark.closest("section")!)
  expect(hero.getAllByRole("paragraph").map((p) => p.textContent)).toEqual([
    "Geopolitical risk · today",
    "181",
    "7-day average to Oct 26",
    "81% above its 1985-2019 average",
    "Monday Nov 23, 4 weeks from the last data: 8 in 10 between 111 and 251, 2 in 10 outside. Most likely 168. (Last Monday: 165)",
    `GPR runs on a weekly cycle: compare Monday with Monday. Data as of ${monthDay(actuals.as_of)}, preliminary for about 4 weeks.`,
  ])
})

it("credits the engraving behind the hero, with its source", () => {
  serve(published)
  render(<App />)

  const commons =
    "https://commons.wikimedia.org/wiki/File:Hendrik_Goltzius_after_Polidoro_da_Caravaggio,_Mercury,_probably_1592,_NGA_60693.jpg"
  const credit = screen.getByText(/^Engraving:/)
  expect(credit.textContent).toBe(
    `Engraving: Hendrick Goltzius after Polidoro da Caravaggio, Mercury, probably 1592, National Gallery of Art, CC0. ${commons.slice(8)}`
  )
  expect(within(credit).getByRole("link").getAttribute("href")).toBe(commons)
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
it("keeps the copy honest, today and in replay, and in index.html's tags", async () => {
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
  } as never)
  serve(published)
  render(<App />)
  const chart = await screen.findByRole("img")
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
      // Where the page says "most likely": the block around the words, or the alternative.
      medians: [
        ...nodes
          .filter((node) => /most likely/i.test(node.data))
          .map(
            (node) => node.parentElement!.closest("p, li, div")!.textContent!
          ),
        ...alternatives.filter((text) => /most likely/i.test(text)),
      ],
    }
  }
  const seen = [copy()]
  fireEvent.pointerDown(chart, { clientX: 692 })
  seen.push(copy())
  fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } })
  fireEvent.pointerDown(chart, { clientX: 692 })
  seen.push(copy())
  const text = [...seen.map((s) => s.text), page].join(" ")
  const medians = [...seen.flatMap((s) => s.medians), page]

  expect(text).not.toMatch(/\bwill\b/i)
  expect(text).not.toMatch(/%\s*confidence/i)
  // The replay's tap readout is up, so every place a median shows was read.
  expect(text).toMatch(/What happened \d/)
  expect(medians.filter((block) => bareMedians(block).length)).toEqual([])
})

// The text before each "most likely" value, back to the one before it, that gives no
// "n in 10" range.
const bareMedians = (block: string) =>
  block
    .split(/most likely:? (?=\d)/i)
    .slice(0, -1)
    .filter((before) => !/\d+ in 10\b.*?\d+(?:-| and )\d/i.test(before))

it("finds a most likely value given without its range first", () => {
  expect(bareMedians("Nov 23: most likely 168 · 8 in 10: 111-251")).toEqual([
    "Nov 23: ",
  ])
  expect(bareMedians("8 in 10 between 111 and 251. Most likely 168")).toEqual(
    []
  )
  expect(bareMedians("Most likely")).toEqual([])
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
    screen.getByRole("region", { name: /forecast made today/ })
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

  expect(
    await screen.findByText(/^Real value on Nov 23: not known yet/)
  ).toBeTruthy()
  expect(screen.queryByText(/^So far/)).toBeNull()
})

it("shows today's GPR forecast in the panel, from one load of each file", async () => {
  const fetch = vi.fn(async (url: string) => Response.json(published[url]))
  vi.stubGlobal("fetch", fetch)

  render(<App />)

  const panel = within(
    await screen.findByRole("region", {
      name: "[F] Geopolitical risk · forecast made today",
    })
  )
  const paragraphs = panel.getAllByRole("paragraph").map((p) => p.textContent)
  expect(paragraphs.slice(0, 3)).toEqual([
    "index (1985-2019 average = 100) · data to Oct 26",
    `Data as of ${monthDay(actuals.as_of)}, preliminary for about 4 weeks.`,
    "Nov 23 · 8 in 10: 111-251 · most likely 168",
  ])
  expect(paragraphs.at(-1)).toBe(`Source: ${latest.attribution}`)
  const legend = within(panel.getAllByRole("list")[0])
  expect(legend.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
    "Daily value",
    "7-day average",
    "What happened",
    "8 in 10",
    "5 in 10",
    "Model path",
    "Forecast made",
  ])
  // Text beside the chart, not the legend, says what the band is and is not.
  expect(panel.getByText(/^The 8 in 10 band/).textContent).toBe(
    "The 8 in 10 band: where the daily value should land 8 days in 10, outside it about 2 in 10. Not a high and a low, nor volatility: it widens because later days are harder to call. Daily values can follow the week: compare a day with the same weekday."
  )
  expect(panel.getByRole("img").getAttribute("aria-label")).toBe(
    "Geopolitical risk: daily values, 165 on Oct 26 (7-day average 181), then the forecast of the daily value to Nov 23: 8 in 10 between 111 and 251, most likely 168. The line ahead is path 1 of 20 drawn from the forecast, the most likely first."
  )
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

it("groups a card for each series in the catalog, with its 7-day average, its change and one day's range", async () => {
  serve(published)

  render(<App />)

  const cards = await signals(9)
  expect(
    cards.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
  ).toEqual(["Risk, attention and oil", "Sea lanes", "War in Ukraine"])
  expect(cards.getAllByRole("button").map((b) => b.textContent)).toEqual([
    "Geopolitical risk [1] 181 index (1985-2019 average = 100) 7-day average to Oct 26 81% above its 1985-2019 average In 28 days: 111-251 8 in 10 for Nov 23 alone",
    '"World War III" [2] 1,833 Wikipedia views a day 7-day average to Oct 29 61% below its 365-day mean In 14 days: 1,456-4,571 8 in 10 for Nov 12 alone',
    // Brent's week has 5 prices, and its 14 steps are trading days: Nov 16 is 20 days on.
    "Brent oil [3] 124 $ a barrel 7-day average to Oct 27 38% above its 365-day mean In 14 trading days: 102-145 8 in 10 for Nov 16 alone",
    "Suez Canal [4] 41 ships a day 7-day average to Oct 25 1% above its 365-day mean In 28 days: 33-51 8 in 10 for Nov 22 alone",
    "Strait of Hormuz [5] 3 ships a day 7-day average to Oct 25 88% below its 365-day mean In 14 days: 0-6 8 in 10 for Nov 08 alone",
    "Bab el-Mandeb [6] 29 ships a day 7-day average to Oct 25 14% below its 365-day mean In 14 days: 20-36 8 in 10 for Nov 08 alone",
    "Taiwan Strait [7] 190 ships a day 7-day average to Oct 25 18% below its 365-day mean In 28 days: 183-268 8 in 10 for Nov 22 alone",
    "Air-raid alerts [8] 66 alert hours a day, all regions 7-day average to Oct 29 6% above its 365-day mean In 7 days: 49-88 8 in 10 for Nov 05 alone",
    "Drones downed [9] 1,684 drones a day, claimed by Ukraine's General Staff, one side's figures 7-day average to Oct 30 20% above its 365-day mean In 7 days: 1,158-1,968 8 in 10 for Nov 06 alone",
  ])
  // The key hint is for the eye: the button says it as a shortcut.
  const suez = cards.getByRole("button", { name: /^Suez Canal 41 ships/ })
  expect(suez.getAttribute("aria-keyshortcuts")).toBe("4")
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
  const dataTo = within(suez).getByText(/^7-day average to/)
  expect(dataTo.textContent).toBe("7-day average to Oct 25, stale since Nov 04")
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
const panelTitle = () =>
  screen.getAllByRole("heading", { level: 2 })[0].textContent

it("opens a picked card's series in the panel and brings it into view, then loads its replay, while the hero stays on GPR", async () => {
  const fetch = vi.fn(async (url: string) => Response.json(published[url]))
  vi.stubGlobal("fetch", fetch)
  render(<App />)
  await signals(9)

  fireEvent.click(card(/^Suez Canal/))

  expect(panelTitle()).toBe("[F] Suez Canal · forecast made today")
  expect(card(/^Suez Canal/).getAttribute("aria-pressed")).toBe("true")
  expect(card(/^Geopolitical risk/).getAttribute("aria-pressed")).toBe("false")
  // Picked reads by shape too, an inner frame, and a hover never draws one.
  expect(card(/^Suez Canal/).className).toMatch(
    /\baria-pressed:shadow-\[inset_/
  )
  expect(card(/^Suez Canal/).className).not.toMatch(/\bhover:shadow-/)
  const panel = screen.getByRole("region", { name: /^\[F\] Suez Canal/ })
  expect(scrollIntoView.mock.contexts.at(-1)).toContain(panel)
  expect(fetch).toHaveBeenCalledWith("api/v1/series/suez_transits/replay.json")
  // The replay's 120 past forecasts, then today's.
  expect((await screen.findByRole("slider")).getAttribute("max")).toBe("120")
  expect(screen.getByText("181", { selector: "p" })).toBeTruthy()
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
  expect(panelTitle()).toBe("[F] Strait of Hormuz · forecast made today")
})

it("opens a square of the record in the panel's replay, loading that series' replay first", async () => {
  serve(published)
  render(<App />)
  const record = within(await screen.findByRole("region", { name: "Record" }))
  // The record of the run of 2026-10-31: no live forecast resolved yet, the backtest apart.
  const suez = within(
    record.getByRole("heading", { name: "Suez Canal" }).closest("li")!
  )
  expect(suez.getByText(/^Collecting live record/).textContent).toBe(
    "Collecting live record: 0 of 30"
  )
  const backtest = within(
    suez.getByRole("group", { name: "Backtest, not the live record" })
  )
  const squares = backtest.getAllByRole("button")
  expect(squares).toHaveLength(8)

  fireEvent.click(squares[0])

  // Opened once Suez's replay is in, which today's panel did not have.
  expect(
    await screen.findByRole("heading", {
      level: 2,
      name: "[F] Suez Canal · backtest from Aug 16",
    })
  ).toBeTruthy()
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
  const opened = "[F] Suez Canal · backtest from Aug 16"
  fireEvent.click(square())
  await screen.findByRole("heading", { level: 2, name: opened })

  fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } })
  expect(panelTitle()).toBe("[F] Suez Canal · backtest from Jun 27")
  fireEvent.click(square())

  expect(panelTitle()).toBe(opened)
})

it("opens a square's forecast on its most likely path, with nothing playing", async () => {
  serve(published)
  render(<App />)
  const record = within(await screen.findByRole("region", { name: "Record" }))
  const panel = () =>
    within(screen.getByRole("region", { name: /^\[F\] Geopolitical risk/ }))
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

  expect(panelTitle()).toBe("[F] Geopolitical risk · backtest from Jul 27")
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
  expect(panelTitle()).toBe("[F] Strait of Hormuz · forecast made today")
  expect(scrollIntoView).toHaveBeenCalled()

  // The slider takes its own keys.
  const slider = await screen.findByRole("slider")
  slider.focus()
  press("1", slider)
  expect(panelTitle()).toBe("[F] Strait of Hormuz · forecast made today")

  // No tenth card, and no shortcut with a modifier.
  press("0")
  press("1", document.body)
  fireEvent.keyDown(document.body, { key: "2", ctrlKey: true })
  expect(panelTitle()).toBe("[F] Geopolitical risk · forecast made today")
})

it("jumps to the record with R, unless a field has the focus", async () => {
  serve(published)
  render(<App />)
  const record = await screen.findByRole("region", { name: "Record" })
  const slider = await screen.findByRole("slider")

  slider.focus()
  fireEvent.keyDown(slider, { key: "r" })
  // Ctrl+R reloads the page: never a shortcut.
  fireEvent.keyDown(document.body, { key: "r", ctrlKey: true })
  expect(scrollIntoView).not.toHaveBeenCalled()

  fireEvent.keyDown(document.body, { key: "R" })
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
    within(section(1)).getByRole("region", { name: /^\[F\] Geopolitical/ })
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
  const spy = spies.findLast(({ seen }) => seen.includes(record))!
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

  // Inactive at 30%, and whole when lit, hovered or focused.
  expect(links[0].className.split(" ")).toEqual(
    expect.arrayContaining([
      "opacity-30",
      "aria-[current=location]:opacity-100",
      "hover:opacity-100",
      "focus-visible:opacity-100",
    ])
  )
})

// Every control shows the focus ring's 2 px outline when the keyboard reaches it, and every
// canvas chart has words: its own label, or the text of the card or hero it is drawn in.
it("rings every control on keyboard focus, and gives every chart a text equivalent", async () => {
  serve(published)
  render(<App />)
  await screen.findByRole("region", { name: "Record" })
  await signals(9)

  const controls = [
    ...document.querySelectorAll(
      "a[href], button, input, select, textarea, [tabindex]"
    ),
  ]
  // The side navigation's 4, the panel's 3, the 9 cards, the record's squares and the credit.
  expect(controls.length).toBeGreaterThan(17)
  const unringed = controls.filter(
    (control) =>
      !["focus-visible:outline-2", "focus-visible:outline-primary"].every(
        (name) => control.classList.contains(name)
      )
  )
  expect(
    unringed.map((c) => c.getAttribute("aria-label") ?? c.textContent)
  ).toEqual([])

  const canvases = [...document.querySelectorAll("canvas")]
  // The hero's art, the panel's chart and the 9 cards' charts.
  expect(canvases).toHaveLength(11)
  const words = (canvas: HTMLCanvasElement) =>
    canvas.closest("[aria-hidden]")
      ? canvas.closest("button, section")!.textContent
      : canvas.getAttribute("role") === "img" &&
        canvas.getAttribute("aria-label")
  expect(
    canvases.filter((canvas) => !/8 in 10/.test(words(canvas) || ""))
  ).toEqual([])
})
