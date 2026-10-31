// Only the fields the page reads from the published API.
export type CatalogEntry = {
  series_id: string
  title: string
  unit: string
  baseline: number
  baseline_label: string
  // "trading_day" for Brent, whose steps skip weekends and market holidays, else "day".
  horizon_unit: string
  horizon_max: number
  interval_steps: number[]
  // Where the replay ends: it holds this day's forecast and those of the 120 days before.
  latest_reference_date: string
  // Set when the day's run skipped the series and kept its last good files.
  stale_since?: string | null
  // What a reader must know about the data, such as Taiwan's tracking dropouts.
  note?: string | null
  // Whether its values follow the week: GPR's and Wikipedia's do.
  weekly?: boolean
  // How the real days moved together within a forecast: the possible paths follow it.
  day_to_day_tie?: { rho: number; n: number }
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
  // The horizon, in steps of `horizonUnit`: a whole number of weeks, but for Brent's trading days.
  daysAhead: number
  horizonUnit: string
  referenceDate: string
  // The daily value on the reference date: for GPR, the same weekday as the target date.
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
  // Null on a day with no value, such as the drones' day without a report.
  actuals: (number | null)[]
  // Made after the fact, with only the data up to its day.
  backtest: boolean
  // "trading_day" for Brent, whose days ahead skip weekends and holidays; "day" when absent.
  horizonUnit?: string
}

// `forecasts` holds the replay's 120 days, oldest first, then today's forecast:
// today's alone until the replay is loaded.
// `steps` are the days ahead of the intervals block: 7, 14 and 28 for GPR.
// `staleSince` is the day the data fell behind, while the pipeline cannot refresh it.
// `madeOn` is the day today's forecast was made: GPR moves weekly, so often not today.
// `weekly` says its values follow the week.
// `rho` ties each day of a possible path to the day before.
export type Series = {
  id: string
  today: Today
  forecasts: Forecast[]
  steps: number[]
  staleSince: string | null
  madeOn: string
  note: string | null
  weekly: boolean
  rho: number
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
const day = 86_400_000
export const daysAfter = (isoDate: string, days: number) =>
  new Date(Date.parse(isoDate) + days * day).toISOString().slice(0, 10)

// `generated_at` is when the daily run last wrote the site.
export const loadCatalog = () =>
  read<{ generated_at: string; series: CatalogEntry[] }>("series.json")

// A bucket of days ahead ("1-7", "8-28"): `n` forecasts with every day of it resolved, and
// their scores once there is one. A ratio's verdict is the pipeline's, from its interval.
export type Bucket = {
  n: number
  coverage_80?: { rate: number; ci: number[] }
  ae_median?: {
    vs: Record<
      string,
      // All null when the baseline had no error to compare with.
      {
        ratio: number | null
        ci: (number | null)[]
        verdict: string | null
      }
    >
  }
}
// The live or the retrospective forecasts of one series, never combined. `weekly` holds
// the last 8 forecasts from the series' weekday, oldest first, scored 7 days ahead.
type Scored = {
  n: number
  since: string | null
  buckets: Record<string, Bucket>
  weekly: { reference_date: string; inside_80: boolean }[]
}
// One series' track record: `n` live forecasts resolved 7 days ahead, shown from
// `min_n_to_display`; its errors compare with `primary_baseline`.
export type ScoreRecord = {
  series_id: string
  n: number
  min_n_to_display: number
  primary_baseline: string
  live: Scored
  retrospective: Scored
}

export const loadScores = () => read<{ series: ScoreRecord[] }>("scores.json")

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
  const time = actuals.date.map((date) => Date.parse(date))
  // From the first day with a whole week of actuals before it, so that every day has a full
  // week for its average: the 7th day, or Brent's 5th or so, as it has no weekend prices.
  const first = time.findIndex((t) => t >= time[0] + 6 * day)
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
    .filter((f) => f.origin >= first && everyDay(replay.horizon, f.quantiles))
  if (
    !everyDay(latest.horizon, latest.quantiles) ||
    first < 0 ||
    reference < first ||
    !entry.interval_steps.every((step) => step >= 1 && step <= days)
  ) {
    throw new Error(`The published ${entry.series_id} files are incomplete`)
  }
  // The hero's step, the last.
  const step = days - 1
  const dates = actuals.date.slice(first)
  const values = actuals.observation.slice(first)
  // Each day's average of the values of the 7 calendar days that end on it.
  const averages = values.map((_, i) => {
    const end = first + i
    const from = Math.max(0, end - 6)
    return mean(
      actuals.observation
        .slice(from, end + 1)
        .filter((_, k) => time[from + k] > time[end] - 7 * day)
    )
  })
  const newest = actuals.date.at(-1)!
  const byDate = new Map(
    actuals.date.map((date, i) => [date, actuals.observation[i]])
  )
  // The days a past forecast's steps fall on, and their real values so far. A calendar-day
  // series counts calendar days, a day its actuals lack null. Brent counts its prices by
  // position, the actuals' then today's forecast's, as a step is scored: the next price.
  const calendar = [
    ...actuals.date,
    ...latest.target_end_date.filter((date) => date > newest),
  ]
  const ahead = (origin: number) => {
    if (entry.horizon_unit === "trading_day")
      return {
        targetDates: calendar.slice(origin + 1, origin + 1 + days),
        real: actuals.observation.slice(origin + 1, origin + 1 + days),
      }
    const targetDates = Array.from({ length: days }, (_, k) =>
      daysAfter(actuals.date[origin], k + 1)
    )
    return {
      targetDates,
      real: targetDates
        .filter((date) => date <= newest)
        .map((date) => byDate.get(date) ?? null),
    }
  }
  // A forecast made on day `origin` of the actuals: the days up to it, and the real values after it.
  const madeOn = (
    origin: number,
    { targetDates, real }: ReturnType<typeof ahead>,
    quantiles: Record<string, number[]>,
    mode: string
  ): Forecast => ({
    series: entry.title,
    unit: entry.unit,
    attribution: latest.attribution,
    dates: dates.slice(0, origin - first + 1),
    values: values.slice(0, origin - first + 1),
    averages: averages.slice(0, origin - first + 1),
    targetDates,
    quantiles,
    actuals: real,
    backtest: mode === "retrospective",
    horizonUnit: entry.horizon_unit,
  })
  return {
    id: entry.series_id,
    today: {
      sevenDayAverage: averages[reference - first],
      baseline: entry.baseline,
      baselineLabel: entry.baseline_label,
      daysAhead: days,
      horizonUnit: entry.horizon_unit,
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
        madeOn(f.origin, ahead(f.origin), f.quantiles, f.forecast_mode)
      ),
      {
        ...madeOn(
          reference,
          { targetDates: latest.target_end_date, real: [] },
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
    weekly: entry.weekly ?? false,
    // A catalog cached from before the tie was published draws independent days.
    rho: entry.day_to_day_tie?.rho ?? 0,
  }
}
