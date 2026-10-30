// Only the fields the page reads from the published API.
export type CatalogEntry = {
  series_id: string
  title: string
  unit: string
  baseline: number
  baseline_label: string
  horizon_max: number
  interval_steps: number[]
  // Set when the day's run skipped the series and kept its last good files.
  stale_since?: string | null
  // What a reader must know about the data, such as Taiwan's tracking dropouts.
  note?: string | null
  links: { latest: string; actuals: string; replay: string }
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
type Actuals = { as_of: string; date: string[]; observation: number[] }
// Today's forecast and the 120 before it, oldest first.
type Replay = {
  horizon: number[]
  forecasts: {
    reference_date: string
    forecast_mode: string
    quantiles: Record<string, number[]>
  }[]
}

export type Today = {
  sevenDayAverage: number
  baseline: number
  baselineLabel: string
  // The horizon, a whole number of weeks.
  daysAhead: number
  referenceDate: string
  // The daily value on the reference date, the same weekday as the target date.
  referenceValue: number
  // The day the data was read from its source, which may revise it later.
  asOf: string
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

// `forecasts` holds the replay's 120 days, oldest first, then today's forecast:
// today's alone until the replay is loaded.
// `steps` are the days ahead of the intervals block: 7, 14 and 28 for GPR.
// `staleSince` is the day the data fell behind, while the pipeline cannot refresh it.
// `madeOn` is the day today's forecast was made: GPR moves weekly, so often not today.
export type Series = {
  id: string
  today: Today
  forecasts: Forecast[]
  steps: number[]
  staleSince: string | null
  madeOn: string
  note: string | null
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

// `generated_at` is when the daily run last wrote the site.
export const loadCatalog = () =>
  read<{ generated_at: string; series: CatalogEntry[] }>("series.json")

// A series' forecast and daily values, and the replay's past forecasts when asked for:
// a card needs only today's.
export async function loadSeries(
  entry: CatalogEntry,
  { replay: withReplay }: { replay: boolean }
): Promise<Series> {
  const none: Replay = { horizon: [], forecasts: [] }
  const [latest, actuals, replay] = await Promise.all([
    read<Latest>(entry.links.latest),
    read<Actuals>(entry.links.actuals),
    // The replay is extra: without it the page still shows today's forecast.
    withReplay
      ? read<Replay>(entry.links.replay).catch((error) => {
          console.error(error)
          return none
        })
      : none,
  ])
  const days = entry.horizon_max
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
    !everyDay(latest.horizon, latest.quantiles) ||
    reference < 6 ||
    !entry.interval_steps.every((step) => step >= 1 && step <= days)
  ) {
    throw new Error(`The published ${entry.series_id} files are incomplete`)
  }
  // horizon_max is a whole number of weeks, so the target date falls on the weekday of the last data.
  const step = days - 1
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
    series: entry.title,
    unit: entry.unit,
    attribution: latest.attribution,
    dates: dates.slice(0, origin - 5),
    values: values.slice(0, origin - 5),
    averages: averages.slice(0, origin - 5),
    targetDates,
    quantiles,
    actuals: actuals.observation.slice(origin + 1, origin + 1 + days),
    backtest: mode === "retrospective",
  })
  return {
    id: entry.series_id,
    today: {
      sevenDayAverage: averages[reference - 6],
      baseline: entry.baseline,
      baselineLabel: entry.baseline_label,
      daysAhead: days,
      referenceDate: latest.reference_date,
      referenceValue: actuals.observation[reference],
      asOf: actuals.as_of,
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
    steps: entry.interval_steps,
    staleSince: entry.stale_since ?? null,
    madeOn: latest.forecast_date,
    note: entry.note ?? null,
  }
}
