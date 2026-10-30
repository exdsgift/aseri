import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import catalog from "@/fixtures/series.json"
import { type CatalogEntry, type ScoreRecord } from "@/lib/api"

import { TrackRecord } from "./TrackRecord"

afterEach(cleanup)

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
  render(<TrackRecord records={records} entries={entries} onOpen={vi.fn()} />)
const cells = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) =>
      [...row.querySelectorAll("th, td")].map((cell) => cell.textContent)
    )
const card = (name: string) =>
  within(screen.getByRole("heading", { name, level: 3 }).closest("li")!)

it("collects the live record until 30 live forecasts have resolved, with the backtest apart and labelled", () => {
  titled([suez])

  const suezCard = card("Suez Canal")
  expect(suezCard.getByText(/^Collecting live record/).textContent).toBe(
    "Collecting live record: 0 of 30"
  )
  const backtest = suezCard.getByRole("group", {
    name: "Backtest, not the live record",
  })
  // The live part holds no score; every number below sits in the backtest.
  expect(suezCard.getAllByRole("table")).toEqual([
    within(backtest).getByRole("table"),
  ])
})

it("draws the last 8 weekly forecasts 7 days ahead as squares, green inside the 8 in 10 range and red outside", () => {
  const onOpen = vi.fn()
  render(<TrackRecord records={[suez]} entries={entries} onOpen={onOpen} />)

  const squares = within(
    card("Suez Canal").getByRole("list", {
      name: "Last 8 weekly forecasts, 7 days ahead",
    })
  ).getAllByRole("button")
  expect(squares.map((square) => square.getAttribute("aria-label"))).toEqual([
    "Aug 02: inside its 8 in 10 range 7 days ahead. Open it in the replay",
    "Aug 09: inside its 8 in 10 range 7 days ahead. Open it in the replay",
    "Aug 16: outside its 8 in 10 range 7 days ahead. Open it in the replay",
    "Aug 23: inside its 8 in 10 range 7 days ahead. Open it in the replay",
    "Aug 30: inside its 8 in 10 range 7 days ahead. Open it in the replay",
    "Sep 06: inside its 8 in 10 range 7 days ahead. Open it in the replay",
    "Sep 13: outside its 8 in 10 range 7 days ahead. Open it in the replay",
    "Sep 20: inside its 8 in 10 range 7 days ahead. Open it in the replay",
  ])
  expect(
    squares.map(
      (square) => square.className.match(/\bbg-(inside|destructive)\b/)![0]
    )
  ).toEqual([
    "bg-inside",
    "bg-inside",
    "bg-destructive",
    "bg-inside",
    "bg-inside",
    "bg-inside",
    "bg-destructive",
    "bg-inside",
  ])
  // In words too, so the record never rests on colour alone.
  expect(card("Suez Canal").getByText(/^6 of 8/).textContent).toBe(
    "6 of 8 inside the 8 in 10 range"
  )

  fireEvent.click(squares[2])

  expect(onOpen).toHaveBeenCalledWith("suez_transits", "2026-08-16")
})

it("tables each bucket's 8 in 10 coverage and error against the series' primary baseline", () => {
  titled([suez])

  expect(cells(card("Suez Canal").getByRole("table"))).toEqual([
    [
      "Days ahead",
      "Forecasts",
      "Inside the 8 in 10 range",
      "Error vs 28-day mean",
    ],
    ["1-7", "105", "79% (76-81)", "ties 1.00 (0.94-1.05)"],
    ["8-28", "84", "78% (76-79)", "ties 0.99 (0.90-1.09)"],
  ])
})

it("names a 14-day series' longer bucket by its own last day", () => {
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

  expect(cells(card("Strait of Hormuz").getByRole("table"))).toEqual([
    [
      "Days ahead",
      "Forecasts",
      "Inside the 8 in 10 range",
      "Error vs last value",
    ],
    ["1-7", "105", "86% (84-88)", "beats 0.85 (0.70-0.98)"],
    ["8-14", "None resolved yet"],
  ])
})

it.each([
  ["beats", [0.7, 0.95], "beats 0.82 (0.70-0.95)"],
  ["ties", [0.9, 1.1], "ties 0.82 (0.90-1.10)"],
  ["loses", [1.05, 1.3], "loses 0.82 (1.05-1.30)"],
] as const)(
  "says %s against the baseline as the pipeline's interval decides it",
  (verdict, ci, said) => {
    const record = {
      ...suez,
      retrospective: {
        ...suez.retrospective,
        buckets: {
          "1-7": bucket(105, 0.8, [0.7, 0.9], {
            mean28: against(0.8211, [...ci], verdict),
          }),
        },
      },
    }

    titled([record])

    expect(cells(card("Suez Canal").getByRole("table"))[1][3]).toBe(said)
  }
)

it("gives no verdict and no number where the baseline had no error to compare with", () => {
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

  expect(cells(card("Suez Canal").getByRole("table"))[1]).toEqual([
    "1-7",
    "105",
    "80% (70-90)",
    "-",
  ])
})

it("draws a square whose forecast has left the replay without a link, and says so", () => {
  // The replay holds the 120 days to Dec 20: from Aug 22 on.
  const later = entries.map((entry) =>
    entry.series_id === "suez_transits"
      ? { ...entry, latest_reference_date: "2026-12-20" }
      : entry
  )
  render(<TrackRecord records={[suez]} entries={later} onOpen={vi.fn()} />)

  const squares = within(
    card("Suez Canal").getByRole("list", {
      name: "Last 8 weekly forecasts, 7 days ahead",
    })
  ).getAllByRole("listitem")
  expect(
    squares.map((square) => within(square).queryByRole("button") !== null)
  ).toEqual([false, false, false, true, true, true, true, true])
  expect(within(squares[2]).getByRole("img").getAttribute("aria-label")).toBe(
    "Aug 16: outside its 8 in 10 range 7 days ahead, no longer in the replay"
  )
})

it("shows the live record once 30 live forecasts have resolved, and no backtest", () => {
  const live = {
    ...suez.retrospective,
    n: 30,
    since: "2026-11-01",
    buckets: { "1-7": suez.retrospective.buckets["1-7"] },
  }

  titled([{ ...suez, n: 30, live }])

  const suezCard = card("Suez Canal")
  expect(suezCard.queryByText(/^Collecting/)).toBeNull()
  expect(suezCard.queryByRole("group")).toBeNull()
  expect(suezCard.getByText(/^Live record/).textContent).toBe(
    "Live record: 30 forecasts since Nov 01"
  )
  expect(suezCard.getByRole("table")).toBeTruthy()
})

it("says what the ranges in brackets assume and how the verdict is read", () => {
  titled([suez])

  const notes = screen.getByText(/assume independent days/)
  expect(notes.textContent).toBe(
    "In brackets, 95% ranges. Those of the 8 in 10 coverage assume independent days, which neighbouring forecasts are not: read them as too narrow. Error: the most likely value's mean miss over the baseline's. Beats only when its whole range is under 1, loses when over 1, ties otherwise."
  )
})

it("leaves out a series the page has not loaded", () => {
  render(
    <TrackRecord
      records={[suez]}
      entries={entries.slice(0, 1)}
      onOpen={vi.fn()}
    />
  )

  expect(screen.queryByRole("heading", { level: 3 })).toBeNull()
})
