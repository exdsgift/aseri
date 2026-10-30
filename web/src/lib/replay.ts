import { type Forecast } from "@/lib/api"

// Edges count as inside.
const within = (value: number, low: number, high: number) =>
  value >= low && value <= high

// How many of the days observed so far landed inside the 8-in-10 range.
export function insideSoFar({ actuals, quantiles }: Forecast) {
  return {
    inside: actuals.filter((value, k) =>
      within(value, quantiles["0.1"][k], quantiles["0.9"][k])
    ).length,
    of: actuals.length,
  }
}

// The daily value's range over the last year, the backdrop of every interval row:
// the rows forecast daily values, so the range is of the same quantity.
export function yearRange(values: number[]) {
  const year = values.slice(-365)
  return [Math.min(...year), Math.max(...year)]
}

// One value scale for all the interval rows: what they must show, with 4% to spare.
// `at` places a value in percent of the width; a value beyond the scale sits on its edge.
export function intervalScale(shown: number[]) {
  const low = Math.min(...shown)
  const high = Math.max(...shown)
  const margin = (high - low || 1) * 0.04
  const lo = Math.max(0, low - margin)
  const hi = high + margin
  const at = (value: number) =>
    Math.max(0, Math.min(100, ((value - lo) / (hi - lo)) * 100))
  return { lo, hi, at }
}

// One row per step ahead (7, 14 and 28 days for GPR), with the real value once it is observed.
export function stepRows(
  { targetDates, quantiles, actuals }: Forecast,
  steps: number[]
) {
  return steps.map((step) => {
    const at = (level: string) => quantiles[level][step - 1]
    const real = actuals[step - 1]
    return {
      step,
      date: targetDates[step - 1],
      mostLikely: at("0.5"),
      fiveInTen: [at("0.25"), at("0.75")],
      eightInTen: [at("0.1"), at("0.9")],
      ...(real !== undefined && {
        real,
        inside: within(real, at("0.1"), at("0.9")),
      }),
    }
  })
}
