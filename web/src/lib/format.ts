// en-US writes negatives with an ASCII hyphen: Press Start 2P has no U+2212.
const wholeNumber = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  signDisplay: "negative",
})

export const formatValue = (value: number) => wholeNumber.format(value)

// How far a value sits from its normal, in whole percent: 81 above it, -88 below.
export const percentFrom = (value: number, baseline: number) =>
  Math.round((value / baseline - 1) * 100)

export const awayFromNormal = (percent: number) =>
  percent === 0
    ? "at normal"
    : `${Math.abs(percent)}% ${percent < 0 ? "below" : "above"} normal`

export const versusBaseline = (value: number, baseline: number) =>
  awayFromNormal(percentFrom(value, baseline))

// "110-260": a range's two ends.
export const valueRange = (low: number, high: number) =>
  `${formatValue(low)}-${formatValue(high)}`

// A range in the page's one word for it. The number always travels with the word: readers
// give "likely" very different odds alone.
export const likely = (low: number, high: number) =>
  `likely ${valueRange(low, high)}`

// A headline's range, rounded outward so it always holds the model's: needless precision reads
// as false precision. The step is the largest 1, 2 or 5 times a power of ten within a tenth of
// the range's width, and never under whole units: GPR's 111-251 is 110-260, Brent's 103-147 is
// 102-148. The chart and the numbers keep the exact values.
export function outward(low: number, high: number): [number, number] {
  const tenth = (high - low) / 10
  const power = 10 ** Math.floor(Math.log10(tenth))
  const step =
    tenth < 1 ? 1 : [5, 2, 1].map((m) => m * power).find((s) => s <= tenth)!
  const from = Math.floor(low / step) * step
  // Never a range of one value, even for a forecast all on one count.
  return [from, Math.max(Math.ceil(high / step) * step, from + step)]
}

// API dates are calendar days: read them in UTC, so no time zone moves them to another day.
const inUtc = (isoDate: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    ...options,
    timeZone: "UTC",
  })

export const weekday = (isoDate: string) => inUtc(isoDate, { weekday: "long" })

export const monthDay = (isoDate: string) =>
  `${inUtc(isoDate, { month: "short" })} ${isoDate.slice(8, 10)}`

export const dayLabel = (isoDate: string) =>
  `${weekday(isoDate)} ${monthDay(isoDate)}`

// What a step is, in words: "days", or Brent's "trading days"; "day" for one.
export const dayWord = (horizonUnit: string, count = 2) =>
  `${horizonUnit === "trading_day" ? "trading " : ""}${count === 1 ? "day" : "days"}`

// Steps ahead in words: "1 day", "14 days", or Brent's "14 trading days".
export const daysAhead = (count: number, horizonUnit: string) =>
  `${count} ${dayWord(horizonUnit, count)}`
