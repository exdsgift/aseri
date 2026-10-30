// Only the fields the page reads from the published API.
type Catalog = {
  series: {
    series_id: string
    title: string
    unit: string
    baseline: number
    baseline_label: string
    horizon_max: number
    interval_steps: number[]
    // Set when the day's run skipped the series and kept its last good files.
    stale_since?: string | null
  }[]
}
type Latest = {
  reference_date: string
  forecast_date: string
  forecast_mode: string
  horizon: number[]
  target_end_date: string[]
  quantiles: Record<string, number[]>
  attribution: string
}
type Actuals = { date: string[]; observation: number[] }
// Today's forecast and the 120 before it, oldest first.
type Replay = {
  horizon: number[]
  forecasts: {
    reference_date: string
    forecast_mode: string
    quantiles: Record<string, number[]>
  }[]
}

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
  // The real daily values of the days ahead observed so far: none yet for today's forecast.
  actuals: number[]
  // Made after the fact, with only the data up to its day.
  backtest: boolean
}

// `forecasts` holds the replay's 120 days, oldest first, then today's forecast.
// `steps` are the days ahead of the intervals block: 7, 14 and 28 for GPR.
// `staleSince` is the day the data fell behind, while the pipeline cannot refresh it.
// `madeOn` is the day today's forecast was made: GPR moves weekly, so often not today.
export type Gpr = {
  today: GprToday
  forecasts: Forecast[]
  steps: number[]
  staleSince: string | null
  madeOn: string
}

// Relative to the page, which Pages serves under /aseri/.
async function read<T>(path: string): Promise<T> {
  const response = await fetch(`api/v1/${path}`)
  if (!response.ok) throw new Error(`api/v1/${path}: HTTP ${response.status}`)
  return response.json()
}

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length

// API dates are calendar days, so the arithmetic stays in UTC.
const daysAfter = (isoDate: string, days: number) =>
  new Date(Date.parse(isoDate) + days * 86_400_000).toISOString().slice(0, 10)

export async function loadGpr(): Promise<Gpr> {
  const [catalog, latest, actuals, replay] = await Promise.all([
    read<Catalog>("series.json"),
    read<Latest>("series/gpr_daily/latest.json"),
    read<Actuals>("series/gpr_daily/actuals.json"),
    // The replay is extra: without it the page still shows today's forecast.
    read<Replay>("series/gpr_daily/replay.json").catch((error) => {
      console.error(error)
      return { horizon: [], forecasts: [] }
    }),
  ])
  const gpr = catalog.series.find((s) => s.series_id === "gpr_daily")
  const days = gpr?.horizon_max
  const reference = actuals.date.indexOf(latest.reference_date)
  // The chart draws every day ahead up to the hero's, at the five levels it reads.
  const everyDay = (horizon: number[], quantiles: Record<string, number[]>) =>
    horizon.length === days &&
    horizon.every((h, i) => h === i + 1) &&
    ["0.1", "0.25", "0.5", "0.75", "0.9"].every(
      (level) => quantiles[level]?.length === days
    )
  // The files are cached separately, so the replay may end a day before or after latest.json;
  // a past forecast the page cannot draw in full is left out rather than failing the page.
  const past = replay.forecasts
    .filter((f) => f.reference_date < latest.reference_date)
    .map((f) => ({ ...f, origin: actuals.date.indexOf(f.reference_date) }))
    .filter((f) => f.origin >= 6 && everyDay(replay.horizon, f.quantiles))
  if (
    !gpr ||
    !everyDay(latest.horizon, latest.quantiles) ||
    reference < 6 ||
    !gpr.interval_steps.every((step) => step >= 1 && step <= gpr.horizon_max)
  ) {
    throw new Error("The published GPR files are incomplete")
  }
  // horizon_max is a whole number of weeks, so the target date falls on the weekday of the last data.
  const step = gpr.horizon_max - 1
  // From the 7th day, so that every day has a full week for its average.
  const dates = actuals.date.slice(6)
  const values = actuals.observation.slice(6)
  const averages = values.map((_, day) =>
    mean(actuals.observation.slice(day, day + 7))
  )
  // A forecast made on day `origin` of the actuals: the days up to it, and the real values after it.
  const madeOn = (
    origin: number,
    targetDates: string[],
    quantiles: Record<string, number[]>,
    mode: string
  ): Forecast => ({
    series: gpr.title,
    unit: gpr.unit,
    attribution: latest.attribution,
    dates: dates.slice(0, origin - 5),
    values: values.slice(0, origin - 5),
    averages: averages.slice(0, origin - 5),
    targetDates,
    quantiles,
    actuals: actuals.observation.slice(
      origin + 1,
      origin + 1 + gpr.horizon_max
    ),
    backtest: mode === "retrospective",
  })
  return {
    today: {
      sevenDayAverage: averages[reference - 6],
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
    forecasts: [
      ...past.map((f) =>
        madeOn(
          f.origin,
          replay.horizon.map((h) => daysAfter(f.reference_date, h)),
          f.quantiles,
          f.forecast_mode
        )
      ),
      {
        ...madeOn(
          reference,
          latest.target_end_date,
          latest.quantiles,
          latest.forecast_mode
        ),
        // Actuals that run ahead of latest.json belong to a forecast not published yet.
        actuals: [],
      },
    ],
    steps: gpr.interval_steps,
    staleSince: gpr.stale_since ?? null,
    madeOn: latest.forecast_date,
  }
}
