// Only the fields the page reads from the published API.
type Catalog = {
  series: {
    series_id: string
    title: string
    unit: string
    baseline: number
    baseline_label: string
    horizon_max: number
  }[]
}
type Latest = {
  reference_date: string
  horizon: number[]
  target_end_date: string[]
  quantiles: Record<string, number[]>
  attribution: string
}
type Actuals = { date: string[]; observation: number[] }

export type GprToday = {
  sevenDayAverage: number
  baseline: number
  baselineLabel: string
  weeksAhead: number
  referenceDate: string
  // The daily value on the reference date, the same weekday as the target date.
  referenceValue: number
  targetDate: string
  mostLikely: number
  low: number
  high: number
}

export type Forecast = {
  series: string
  unit: string
  attribution: string
  // The days up to the reference date, the forecast's origin, each with its 7-day average.
  dates: string[]
  values: number[]
  averages: number[]
  // The days ahead, with one value per day for each published quantile level ("0.01" to "0.99").
  targetDates: string[]
  quantiles: Record<string, number[]>
}

export type Gpr = { today: GprToday; forecast: Forecast }

// Relative to the page, which Pages serves under /aseri/.
async function read<T>(path: string): Promise<T> {
  const response = await fetch(`api/v1/${path}`)
  if (!response.ok) throw new Error(`api/v1/${path}: HTTP ${response.status}`)
  return response.json()
}

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length

export async function loadGpr(): Promise<Gpr> {
  const [catalog, latest, actuals] = await Promise.all([
    read<Catalog>("series.json"),
    read<Latest>("series/gpr_daily/latest.json"),
    read<Actuals>("series/gpr_daily/actuals.json"),
  ])
  const gpr = catalog.series.find((s) => s.series_id === "gpr_daily")
  // horizon_max is a whole number of weeks, so the target date falls on the weekday of the last data.
  const step = gpr ? latest.horizon.indexOf(gpr.horizon_max) : -1
  const reference = actuals.date.indexOf(latest.reference_date)
  if (!gpr || step < 0 || reference < 6) {
    throw new Error("The published GPR files are incomplete")
  }
  // Up to the reference date: the files are cached separately, so actuals may run ahead.
  // From the 7th day, so that every day has a full week for its average.
  const dates = actuals.date.slice(6, reference + 1)
  const values = actuals.observation.slice(6, reference + 1)
  const averages = values.map((_, day) =>
    mean(actuals.observation.slice(day, day + 7))
  )
  return {
    today: {
      sevenDayAverage: averages[averages.length - 1],
      baseline: gpr.baseline,
      baselineLabel: gpr.baseline_label,
      weeksAhead: gpr.horizon_max / 7,
      referenceDate: latest.reference_date,
      referenceValue: actuals.observation[reference],
      targetDate: latest.target_end_date[step],
      mostLikely: latest.quantiles["0.5"][step],
      low: latest.quantiles["0.1"][step],
      high: latest.quantiles["0.9"][step],
    },
    forecast: {
      series: gpr.title,
      unit: gpr.unit,
      attribution: latest.attribution,
      dates,
      values,
      averages,
      targetDates: latest.target_end_date,
      quantiles: latest.quantiles,
    },
  }
}
