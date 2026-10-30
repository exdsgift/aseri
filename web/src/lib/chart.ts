import { type Forecast } from "@/lib/api"

// CSS pixels per art pixel: the chart is drawn small and scaled up without smoothing.
export const pixel = 2

// The scale fits every value the chart shows, so no line is clipped into looking like
// the chart's edge. y runs from top to bottom, in art pixels.
export function valueScale(fitted: number[], top: number, bottom: number) {
  const low = Math.min(...fitted)
  const high = Math.max(...fitted)
  const margin = (high - low || 1) * 0.08
  const lo = Math.max(0, low - margin)
  const hi = high + margin
  const y = (value: number) =>
    Math.max(
      top,
      Math.min(
        bottom,
        top + Math.round(((hi - value) / (hi - lo)) * (bottom - top))
      )
    )
  return { lo, hi, y }
}

// The bands fan out from the last daily value: between forecast days, read the
// quantile on the straight line joining them. `ahead` holds one value per day ahead.
export function forecastAt(last: number, ahead: number[], daysAhead: number) {
  const day = Math.min(ahead.length - 1, Math.floor(daysAhead))
  const from = day === 0 ? last : ahead[day - 1]
  return from + (ahead[day] - from) * Math.min(1, daysAhead - day)
}

// The value labels at the right end, top to bottom: each one moves down until it clears the one above.
export function nudgeApart(tops: number[], gap: number) {
  const out: number[] = []
  for (const top of tops)
    out.push(Math.max(top, (out.at(-1) ?? -Infinity) + gap))
  return out
}

type Day = { date: string; x: number }

// Press Start 2P draws every character 8 px wide at the labels' 8 px size.
export const textWidth = (text: string) => text.length * 8

const dateWidth = textWidth("Mmm DD")

// The dates under the chart, in CSS pixels: the origin centred on its day, and the
// first and last days flush with the ends when their labels clear the origin's.
export function dateTicks(first: Day, origin: Day, last: Day) {
  const room = dateWidth * 1.5 + 8
  return [
    { ...origin, align: "center" as const },
    ...(origin.x - first.x >= room
      ? [{ ...first, align: "left" as const }]
      : []),
    ...(last.x - origin.x >= room
      ? [{ ...last, align: "right" as const }]
      : []),
  ]
}

// Round values for an axis: the smallest step of 1, 2 or 5 times a power of ten
// that splits the scale in `parts` at most.
export function valueTicks(lo: number, hi: number, parts = 3) {
  const raw = (hi - lo) / parts
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].find((m) => m * power >= raw)! * power
  const ticks = []
  for (let n = Math.ceil(lo / step); n * step <= hi; n++) ticks.push(n * step)
  return ticks
}

// Where the panel's chart puts everything, in art pixels.
export function chartLayout(forecast: Forecast, width: number) {
  const narrow = width < 480
  const ahead = forecast.targetDates.length
  const levels = Object.keys(forecast.quantiles).map(Number)
  const nearest = (to: number) =>
    String(
      levels.reduce((a, b) => (Math.abs(b - to) < Math.abs(a - to) ? b : a))
    )
  return {
    narrow,
    // Room for the value ticks on the left, the end values on the right and the dates below.
    ...layout(
      forecast,
      { width: Math.floor(width / pixel), height: narrow ? 130 : 160 },
      narrow ? Math.max(21, ahead) : Math.max(28, 2 * ahead),
      { left: 20, right: 27, top: 10, bottom: 13 },
      // The published levels nearest 5% and 95%. A path past them, about a day in ten, runs
      // along the frame: fitting q0.01 to q0.99 squashed Hormuz's 0 to 8 ships into a fifth.
      [nearest(0.05), nearest(0.95)]
    ),
  }
}

// A card's chart: the days of the panel's wide chart, 64 px tall, with no labels to make room for.
export function miniChartLayout(forecast: Forecast, width: number) {
  return layout(
    forecast,
    { width: Math.floor(width / pixel), height: 32 },
    Math.max(28, 2 * forecast.targetDates.length),
    // Just enough for the 3x3 marks at the ends and the base line.
    { left: 1, right: 2, top: 1, bottom: 2 },
    ["0.1", "0.9"]
  )
}

// Days count from the first of the daily values: the origin is the last one, and the
// forecast days follow it. `shown` days of history, then the days ahead, fill the art
// less its margins. The scale fits the forecast between the `fitted` levels.
function layout(
  forecast: Forecast,
  art: { width: number; height: number },
  shown: number,
  margin: { left: number; right: number; top: number; bottom: number },
  fitted: [string, string]
) {
  const ahead = forecast.targetDates.length
  const origin = forecast.values.length - 1
  const first = Math.max(0, origin + 1 - shown)
  const span = origin + ahead - first
  const left = margin.left
  const right = art.width - margin.right
  const top = margin.top
  const bottom = art.height - margin.bottom
  const x = (day: number) =>
    left + Math.round(((day - first) * (right - left)) / span)
  const dayAt = (artX: number) =>
    Math.max(
      first,
      Math.min(
        origin + ahead,
        first + Math.round(((artX - left) * span) / (right - left))
      )
    )
  const scale = valueScale(
    [
      ...forecast.values.slice(first),
      ...forecast.averages.slice(first),
      ...fitted.flatMap((level) => forecast.quantiles[level]),
      ...forecast.actuals,
    ],
    top,
    bottom
  )
  return {
    ahead,
    origin,
    first,
    span,
    art,
    left,
    right,
    top,
    bottom,
    x,
    dayAt,
    ...scale,
  }
}

export type ChartLayout = ReturnType<typeof chartLayout>
export type Layout = ReturnType<typeof layout>
type Plot = (x: number, y: number, color: string) => void
type Point = [number, number]

// The page's token behind each mark of the chart, in black and white: the daily values white,
// the model's path a grey apart from them, the 7-day average and the bands dim.
export const chartTokens = {
  daily: "--primary",
  path: "--muted-foreground",
  average: "--dim",
  band: "--dim",
  frame: "--border",
  origin: "--secondary",
  real: "--white",
}
export type Colors = Record<keyof typeof chartTokens, string>

// The thresholds of a 4x4 Bayer matrix, the dither of the bands.
export const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

// Bresenham through each point in turn: lines stay one art pixel thick, with no smoothing.
function polyline(plot: Plot, points: Point[], color: string) {
  for (let i = 1; i < points.length; i++) {
    let [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    let error = dx + dy
    for (;;) {
      plot(x0, y0, color)
      if (x0 === x1 && y0 === y1) break
      const twice = 2 * error
      if (twice >= dy) {
        error += dy
        x0 += x0 < x1 ? 1 : -1
      }
      if (twice <= dx) {
        error += dx
        y0 += y0 < y1 ? 1 : -1
      }
    }
  }
}

function square(plot: Plot, x: number, y: number, size: number, color: string) {
  for (let dx = 0; dx < size; dx++)
    for (let dy = 0; dy < size; dy++) plot(x + dx, y + dy, color)
}

// `path`, the last daily value then one value a day ahead: one of the model's paths, never a
// median line, which reads as an average.
export function paintChart(
  plot: Plot,
  chart: Layout,
  forecast: Forecast,
  color: Colors,
  path: number[]
) {
  const { left, right, top, bottom, x, y, first, origin } = chart
  const { values, averages, quantiles, actuals } = forecast
  const xo = x(origin)
  const last = values[origin]

  // The forecast zone gets a diagonal hatch, like the empty slots in the game.
  for (let py = top; py <= bottom; py++)
    for (let px = xo + 1; px <= right; px++)
      if ((px + py) % 4 === 0) plot(px, py, color.frame)
  for (const tick of valueTicks(chart.lo, chart.hi))
    for (let px = left; px <= right; px += 2) plot(px, y(tick), color.frame)

  // The bands, column by column: 5 in 10 at 50% of the dither, 8 in 10 at 25%, with solid edges.
  // From the first day ahead: the last value may still be revised, so no width-zero pinch.
  for (let px = x(origin + 1); px <= right; px++) {
    const daysAhead = Math.max(1, ((px - xo) / (right - xo)) * chart.ahead)
    const [y90, y75, y25, y10] = ["0.9", "0.75", "0.25", "0.1"].map((level) =>
      y(forecastAt(last, quantiles[level], daysAhead))
    )
    for (let py = y90; py <= y10; py++) {
      const inner = py >= y75 && py <= y25
      if (
        py === y90 ||
        py === y10 ||
        bayer[(py % 4) * 4 + (px % 4)] < (inner ? 8 : 4)
      )
        plot(px, py, color.band)
    }
  }
  polyline(
    plot,
    path.map((value, k): Point => [x(origin + k), y(value)]),
    color.path
  )

  // The 7-day average, dimmer: context only, since the forecast is of the daily value.
  polyline(
    plot,
    averages
      .slice(first)
      .map((average, i): Point => [x(first + i), y(average)]),
    color.average
  )
  // The daily values, the quantity forecast, so the forecast carries on from where they end.
  polyline(
    plot,
    values.slice(first).map((value, i): Point => [x(first + i), y(value)]),
    color.daily
  )
  // What happened after the forecast was made, in white over the bands,
  // as dots 2 art pixels wide when the days are far enough apart.
  const dot = (right - left) / chart.span >= 3 ? 2 : 1
  actuals.forEach((value, k) =>
    square(plot, x(origin + 1 + k), y(value), dot, color.real)
  )

  for (let py = top; py <= bottom; py += 2) plot(xo, py, color.origin)
  for (let px = left; px <= right; px++) plot(px, bottom + 1, color.frame)
  square(plot, xo - 1, y(last) - 1, 3, color.daily)
  if (actuals.length === chart.ahead)
    square(plot, right - 1, y(actuals[chart.ahead - 1]) - 1, 3, color.real)
}
