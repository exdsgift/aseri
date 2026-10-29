// Only the fields the page reads from the published API.
type Catalog = { series: { series_id: string; baseline: number }[] }
type Latest = {
  reference_date: string
  horizon: number[]
  target_end_date: string[]
  quantiles: Record<string, number[]>
}
type Actuals = { date: string[]; observation: number[] }

export type GprToday = {
  sevenDayAverage: number
  baseline: number
  referenceDate: string
  // The daily value on the reference date, the same weekday as the target date.
  referenceValue: number
  targetDate: string
  mostLikely: number
  low: number
  high: number
}

// 4 weeks, so the target date falls on the weekday of the last data.
const HORIZON = 28

// Relative to the page, which Pages serves under /aseri/.
async function read<T>(path: string): Promise<T> {
  const response = await fetch(`api/v1/${path}`)
  if (!response.ok) throw new Error(`api/v1/${path}: HTTP ${response.status}`)
  return response.json()
}

export async function loadGprToday(): Promise<GprToday> {
  const [catalog, latest, actuals] = await Promise.all([
    read<Catalog>("series.json"),
    read<Latest>("series/gpr_daily/latest.json"),
    read<Actuals>("series/gpr_daily/actuals.json"),
  ])
  const gpr = catalog.series.find((s) => s.series_id === "gpr_daily")
  const step = latest.horizon.indexOf(HORIZON)
  const reference = actuals.date.indexOf(latest.reference_date)
  const lastWeek = actuals.observation.slice(-7)
  if (!gpr || step < 0 || reference < 0 || lastWeek.length < 7) {
    throw new Error("The published GPR files are incomplete")
  }
  return {
    sevenDayAverage: lastWeek.reduce((sum, value) => sum + value, 0) / 7,
    baseline: gpr.baseline,
    referenceDate: latest.reference_date,
    referenceValue: actuals.observation[reference],
    targetDate: latest.target_end_date[step],
    mostLikely: latest.quantiles["0.5"][step],
    low: latest.quantiles["0.1"][step],
    high: latest.quantiles["0.9"][step],
  }
}
