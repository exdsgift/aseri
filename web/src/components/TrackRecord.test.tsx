import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import scores from "@/fixtures/scores.json"
import catalog from "@/fixtures/series.json"
import { type CatalogEntry, type ScoreRecord } from "@/lib/api"

import { TrackRecord } from "./TrackRecord"

afterEach(cleanup)

// The scoreboard's own model, the one in the code.
const CURRENT = "aseri-timestral209m_c1"
const entries = catalog.series as CatalogEntry[]
type Verdict = "beats" | "ties" | "loses"
const against = (ratio: number, ci: number[], verdict: Verdict) => ({
  ratio,
  ci,
  verdict,
})
// A bucket's scores, as the pipeline writes them: only the fields the page reads.
const bucket = (n: number, rate: number, ci: number[], vs = {}) => ({
  n,
  coverage_80: { rate, ci },
  ae_median: { vs },
})
const weekly = (inside: boolean[]) =>
  inside.map((inside_80, week) => ({
    reference_date: new Date(Date.UTC(2026, 7, 2 + 7 * week))
      .toISOString()
      .slice(0, 10),
    inside_80,
  }))
const none = { n: 0, since: null, buckets: { "1-7": { n: 0 } }, weekly: [] }
// Suez: no live forecast resolved yet, a backtest that ties its 28-day mean.
const suez: ScoreRecord = {
  series_id: "suez_transits",
  n: 0,
  min_n_to_display: 30,
  primary_baseline: "mean28",
  live: none,
  retrospective: {
    n: 105,
    since: "2026-06-27",
    buckets: {
      "1-7": bucket(105, 0.7864, [0.7633, 0.8083], {
        mean28: against(0.9951, [0.9363, 1.0469], "ties"),
      }),
      "8-28": bucket(84, 0.7751, [0.7608, 0.789], {
        mean28: against(0.9912, [0.9025, 1.0919], "ties"),
      }),
    },
    weekly: weekly([true, true, false, true, true, true, false, true]),
  },
}
const titled = (records: ScoreRecord[]) =>
  render(
    <TrackRecord
      model={CURRENT}
      records={records}
      entries={entries}
      onOpen={vi.fn()}
    />
  )
// Read open or shut: "How we score" starts shut.
const cells = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row", { hidden: true })
    .map((row) =>
      [...row.querySelectorAll("th, td")].map((cell) => cell.textContent)
    )
const card = (name: string) =>
  within(screen.getByRole("heading", { name, level: 3 }).closest("li")!)
const title = () =>
  screen.getByRole("region", { name: "Record" }).querySelector("h2 + p")!
    .textContent

it("leads with the verdict on every square, and says once that the backtest stands in for the live record", () => {
  titled([suez, { ...suez, series_id: "hormuz_transits" }])

  expect(title()).toBe(
    "Backtest: 12 of 16 forecasts landed in range, close to the 8 in 10 promised"
  )
  expect(screen.getAllByText(/^Live record starts/)).toHaveLength(1)
  expect(screen.getByText(/^Live record starts/).textContent).toBe(
    "Live record starts after 30 forecasts (0 so far). Until then, backtests made after the fact."
  )
  // The key, once, with how many should miss.
  expect(
    screen.getByText(/squares should be hollow/).parentElement!.textContent
  ).toBe(
    " landed in range  missed About 2 in 10 squares should be hollow if the range is honest."
  )
})

it("draws the last 8 weekly forecasts 7 days ahead as squares, filled in range and hollow when missed", () => {
  const onOpen = vi.fn()
  render(
    <TrackRecord
      model={CURRENT}
      records={[suez]}
      entries={entries}
      onOpen={onOpen}
    />
  )

  const squares = within(
    card("Suez Canal").getByRole("list", {
      name: "Suez Canal: the last 8 weekly forecasts, 7 days ahead",
    })
  ).getAllByRole("button")
  expect(squares.map((square) => square.getAttribute("aria-label"))).toEqual([
    "Aug 02: landed in range 7 days ahead. Open it in the replay",
    "Aug 09: landed in range 7 days ahead. Open it in the replay",
    "Aug 16: missed 7 days ahead. Open it in the replay",
    "Aug 23: landed in range 7 days ahead. Open it in the replay",
    "Aug 30: landed in range 7 days ahead. Open it in the replay",
    "Sep 06: landed in range 7 days ahead. Open it in the replay",
    "Sep 13: missed 7 days ahead. Open it in the replay",
    "Sep 20: landed in range 7 days ahead. Open it in the replay",
  ])
  // By shape, not colour: a filled square, or only its outline.
  expect(
    squares.map(
      (square) => square.className.match(/\b(bg-primary|border-2)\b/)![0]
    )
  ).toEqual([
    "bg-primary",
    "bg-primary",
    "border-2",
    "bg-primary",
    "bg-primary",
    "bg-primary",
    "border-2",
    "bg-primary",
  ])
  // A hover changes only the outline: a hollow square never fills, so it never reads as in range.
  for (const square of squares) {
    expect(square.className).not.toMatch(/hover:(bg|border)-/)
    expect(square.className).toContain("hover:outline-")
  }
  // In words too.
  expect(card("Suez Canal").getByText(/^6 of 8/).textContent).toBe(
    "6 of 8 in range"
  )

  fireEvent.click(squares[2])

  expect(onOpen).toHaveBeenCalledWith("suez_transits", "2026-08-16")
})

it("keeps how it scores one tap away, each bucket in plain words against the series' own simple rule", () => {
  titled([suez])
  const how = screen.getByRole("button", { name: "How we score" })
  const table = screen.getByRole("table", {
    name: "Suez Canal, backtest",
    hidden: true,
  })
  expect(table.closest("[hidden]")).not.toBeNull()

  fireEvent.click(how)

  expect(table.closest("[hidden]")).toBeNull()
  expect(cells(table)).toEqual([
    ["Days ahead", "Forecasts", "In range", "Misses"],
    [
      "1-7",
      "105",
      "79% landed in range · aim 80% (76-81)",
      "About as good as a simple 4-week average (1.00, 0.94-1.05)",
    ],
    [
      "8-28",
      "84",
      "78% landed in range · aim 80% (76-79)",
      "About as good as a simple 4-week average (0.99, 0.90-1.09)",
    ],
  ])
  // The share in range as ten blocks, with a tick after the 8th: for the eye.
  const tenths = table.querySelector("td [aria-hidden]")!
  expect(tenths.querySelectorAll("i.bg-primary")).toHaveLength(8)
  expect(tenths.querySelectorAll("i.border-2")).toHaveLength(2)
})

it("names a 14-day series' longer bucket by its own last day, and its simple rule from its record", () => {
  const hormuz = {
    ...suez,
    series_id: "hormuz_transits",
    primary_baseline: "naive",
    retrospective: {
      ...suez.retrospective,
      buckets: {
        "1-7": bucket(105, 0.86, [0.84, 0.88], {
          naive: against(0.8456, [0.7, 0.98], "beats"),
        }),
        "8-28": { n: 0 },
      },
    },
  }

  titled([hormuz])

  expect(
    cells(screen.getByRole("table", { name: /Strait of Hormuz/, hidden: true }))
  ).toEqual([
    ["Days ahead", "Forecasts", "In range", "Misses"],
    [
      "1-7",
      "105",
      "86% landed in range · aim 80% (84-88)",
      "15% smaller misses than just repeating the last value (0.85, 0.70-0.98)",
    ],
    ["8-14", "None resolved yet"],
  ])
})

it.each([
  ["beats", [0.7, 0.95], "18% smaller misses than a simple 4-week average"],
  ["ties", [0.9, 1.1], "About as good as a simple 4-week average"],
  ["loses", [1.05, 1.3], "18% bigger misses than a simple 4-week average"],
] as const)(
  "says %s against the simple rule as the pipeline's interval decides it",
  (verdict, ci, said) => {
    const record = {
      ...suez,
      retrospective: {
        ...suez.retrospective,
        buckets: {
          "1-7": bucket(105, 0.8, [0.7, 0.9], {
            mean28: against(
              verdict === "loses" ? 1.1789 : 0.8211,
              [...ci],
              verdict
            ),
          }),
        },
      },
    }

    titled([record])

    expect(cells(screen.getByRole("table", { hidden: true }))[1][3]).toMatch(
      new RegExp(`^${said} \\(`)
    )
  }
)

it("gives no verdict and no number where the simple rule had no miss to compare with", () => {
  const record = {
    ...suez,
    retrospective: {
      ...suez.retrospective,
      buckets: {
        "1-7": bucket(105, 0.8, [0.7, 0.9], {
          mean28: { ratio: null, ci: [null, null], verdict: null },
        }),
      },
    },
  }

  titled([record])

  expect(cells(screen.getByRole("table", { hidden: true }))[1]).toEqual([
    "1-7",
    "105",
    "80% landed in range · aim 80% (70-90)",
    "-",
  ])
})

it("shows the live forecasts already resolved after the backtest's, labelled live and openable, while it collects", () => {
  const onOpen = vi.fn()
  const collecting = {
    ...suez,
    n: 2,
    live: {
      ...none,
      n: 2,
      since: "2026-10-31",
      weekly: [
        { reference_date: "2026-10-03", inside_80: true },
        { reference_date: "2026-10-10", inside_80: false },
      ],
    },
  }
  render(
    <TrackRecord
      model={CURRENT}
      records={[collecting]}
      entries={entries}
      onOpen={onOpen}
    />
  )

  const row = card("Suez Canal")
  const live = row.getByRole("list", {
    name: "Suez Canal, live: the last 2 weekly forecasts, 7 days ahead",
  })
  expect(
    within(live)
      .getAllByRole("button")
      .map((square) => square.getAttribute("aria-label"))
  ).toEqual([
    "Oct 03: landed in range 7 days ahead. Open it in the replay",
    "Oct 10: missed 7 days ahead. Open it in the replay",
  ])
  // After the backtest's 8, with one word to tell them apart, and no sum of the two.
  expect(row.getAllByRole("button")).toHaveLength(10)
  expect(row.getByText("live")).toBeTruthy()
  expect(
    row.getAllByText(/ of \d+ in range$/).map((p) => p.textContent)
  ).toEqual(["6 of 8 in range"])
  // The backtest still makes the title, and the banner counts the live ones.
  expect(title()).toMatch(/^Backtest: 6 of 8 /)
  expect(screen.getByText(/^Live record starts/).textContent).toMatch(
    /\(2 so far\)/
  )

  fireEvent.click(within(live).getAllByRole("button")[1])
  expect(onOpen).toHaveBeenCalledWith("suez_transits", "2026-10-10")
})

it("draws a square whose forecast has left the replay without a link, and says so", () => {
  // The replay holds the 120 days to Dec 20: from Aug 22 on.
  const later = entries.map((entry) =>
    entry.series_id === "suez_transits"
      ? { ...entry, latest_reference_date: "2026-12-20" }
      : entry
  )
  render(
    <TrackRecord
      model={CURRENT}
      records={[suez]}
      entries={later}
      onOpen={vi.fn()}
    />
  )

  const squares = within(
    card("Suez Canal").getByRole("list", { name: /^Suez Canal:/ })
  ).getAllByRole("listitem")
  expect(
    squares.map((square) => within(square).queryByRole("button") !== null)
  ).toEqual([false, false, false, true, true, true, true, true])
  expect(within(squares[2]).getByRole("img").getAttribute("aria-label")).toBe(
    "Aug 16: missed 7 days ahead, no longer in the replay"
  )
})

it("counts the live record once 30 live forecasts have resolved, and never adds a backtest to it", () => {
  const live = {
    ...suez.retrospective,
    n: 30,
    since: "2026-11-01",
    buckets: { "1-7": suez.retrospective.buckets["1-7"] },
    weekly: weekly([true, true, true, true, true, true, true, true]),
  }
  const collecting = { ...suez, series_id: "hormuz_transits" }

  titled([{ ...suez, n: 30, live }, collecting])

  // The live series' 8 squares alone, with no "Backtest:".
  expect(title()).toBe(
    "8 of 8 forecasts landed in range, close to the 8 in 10 promised"
  )
  expect(card("Suez Canal").getAllByRole("button")).toHaveLength(8)
  // The one still collecting says it shows a backtest.
  expect(
    screen.getByRole("heading", {
      level: 3,
      name: "Strait of Hormuz, backtest",
    })
  ).toBeTruthy()
  expect(
    screen.getByRole("table", {
      name: "Suez Canal, live, 30 forecasts",
      hidden: true,
    })
  ).toBeTruthy()
  cleanup()

  titled([{ ...suez, n: 30, live }])
  expect(screen.queryByText(/^Live record starts/)).toBeNull()
})

it("says what the brackets hold and how the verdict is read", () => {
  titled([suez])

  expect(screen.getByText(/assume independent days/).textContent).toBe(
    "In brackets, 95% ranges, and the ratio of the misses. Those of the share in range assume independent days, which neighbouring forecasts are not: read them as too narrow."
  )
  expect(screen.getByText(/^Each square/).textContent).toBe(
    "Each square is one weekly forecast, scored 7 days ahead. Misses: how far the middle estimate fell from what happened, on average, against the series' own simple rule. Better or worse only when the whole 95% range of the comparison says so; about as good otherwise."
  )
})

it("counts Brent's days ahead in trading days, from its real backtest", () => {
  const brent = scores.series.find((s) => s.series_id === "brent_spot")!
  titled([brent as ScoreRecord])

  expect(
    card("Brent oil")
      .getByRole("list", { name: /^Brent oil:/ })
      .getAttribute("aria-label")
  ).toBe("Brent oil: the last 8 weekly forecasts, 7 trading days ahead")
  const table = screen.getByRole("table", { hidden: true })
  expect(cells(table)[0][0]).toBe("Trading days ahead")
  expect(cells(table)[1][3]).toMatch(
    /^About as good as just repeating the last value \(/
  )
})

// A record of the model before the scoreboard's, as after a model change.
const previous = (record: ScoreRecord): ScoreRecord => ({
  ...record,
  scored_model_id: "aseri-timestral209m",
})
const hormuz: ScoreRecord = { ...suez, series_id: "hormuz_transits" }
const opening = (name: string) =>
  card(name).queryAllByRole("button", { name: /Open it in the replay/ })

it("says in one line when every record is the previous model's, and counts those alone", () => {
  titled([suez, hormuz])
  expect(screen.queryByText(/previous model/)).toBeNull()
  cleanup()

  titled([previous(suez), previous(hormuz)])

  expect(
    screen.getByText(
      "Scores of the previous model until the new one has its own."
    )
  ).toBeTruthy()
  expect(title()).toBe(
    "Backtest: 12 of 16 forecasts landed in range, close to the 8 in 10 promised"
  )
  expect(screen.queryByRole("heading", { name: /previous model/ })).toBeNull()
  // A square opens the replay, which shows the new model's forecasts: these open nothing.
  expect(opening("Suez Canal")).toHaveLength(0)
  expect(
    card("Suez Canal").getAllByRole("img", { name: /landed in range|missed/ })
  ).toHaveLength(8)
})

it("counts the new model's records alone beside the previous model's, and says so", () => {
  titled([
    { ...previous(suez), n: 0 },
    {
      ...hormuz,
      n: 3,
      retrospective: {
        ...hormuz.retrospective,
        weekly: weekly(Array(8).fill(true)),
      },
    },
  ])

  // Hormuz's 8 squares only, and its 3 live forecasts, never Suez's.
  expect(title()).toMatch(/^Backtest: 8 of 8 forecasts landed in range/)
  expect(screen.getByText(/\(3 so far\)/)).toBeTruthy()
  expect(
    screen.getByText(
      "Counts the new model only. Cards marked previous model show the old one's scores."
    )
  ).toBeTruthy()
  expect(opening("Suez Canal, previous model")).toHaveLength(0)
  expect(opening("Strait of Hormuz")).toHaveLength(8)
})

it("leaves out a series the page has not loaded", () => {
  render(
    <TrackRecord
      model={CURRENT}
      records={[suez]}
      entries={entries.slice(0, 1)}
      onOpen={vi.fn()}
    />
  )

  expect(screen.queryByRole("heading", { level: 3 })).toBeNull()
})
