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
  `${Math.abs(percent)}% ${percent < 0 ? "below" : "above"} normal`

export const versusBaseline = (value: number, baseline: number) =>
  awayFromNormal(percentFrom(value, baseline))

// A range in the page's one word for it. The number always travels with the word: readers
// give "likely" very different odds alone.
export const likely = (low: number, high: number) =>
  `likely ${formatValue(low)}-${formatValue(high)}`

// A headline's values, to tens from 100 up: needless precision reads as false precision.
// The chart and the numbers keep the exact values.
export const roughly = (value: number) =>
  Math.abs(value) >= 100 ? Math.round(value / 10) * 10 : value

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
