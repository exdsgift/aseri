import { type Forecast } from "@/lib/api"

// CSS pixels per art pixel: the chart is drawn small and scaled up without smoothing.
export const pixel = 2

// The scale fits every value the chart shows, so no line is clipped into looking like
// the chart's edge. y runs from top to bottom, in art pixels.
export function valueScale(fitted: number[], top: number, bottom: number) {
  const low = Math.min(...fitted)
  const high = Math.max(...fitted)
  const margin = (high - low || 1) * 0.08
  // Not below 0 but for a value under it: a drone correction is negative.
  const lo = Math.max(Math.min(0, low), low - margin)
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

// Press Start 2P draws every character 8 px wide at the labels' 8 px size.
export const textWidth = (text: string) => text.length * 8

// A label's size in CSS pixels: its longest line, a pixel of ground each side, 12 px a line.
export const labelSize = (text: string) => {
  const lines = text.split("\n")
  return {
    width: Math.max(...lines.map(textWidth)) + 2,
    height: 12 * lines.length,
  }
}

type Spot = { x: number; y: number; align?: "left" | "right" }
type Box = { left: number; top: number; width: number; height: number }
const overlap = (a: Box, b: Box) =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height

// Direct labels, in CSS pixels, each a line of text or two on a pixel of ground each side: each
// takes the first of its spots that stays in `bounds` and clear of the labels placed before it,
// and covers as little of the lines' `points` as it can, each point weighing 1 unless it says.
export function placeLabels(
  labels: { text: string; at: Spot[] }[],
  bounds: { left: number; top: number; right: number; bottom: number },
  points: [x: number, y: number, weight?: number][]
) {
  const placed: Box[] = []
  for (const { text, at } of labels) {
    const { width, height } = labelSize(text)
    const cost = (box: Box) =>
      (box.left < bounds.left ||
      box.top < bounds.top ||
      box.left + width > bounds.right ||
      box.top + height > bounds.bottom
        ? 1e4
        : 0) +
      1e3 * placed.filter((other) => overlap(box, other)).length +
      points.reduce(
        (sum, [x, y, weight = 1]) =>
          x >= box.left &&
          x <= box.left + width &&
          y >= box.top &&
          y <= box.top + height
            ? sum + weight
            : sum,
        0
      )
    const boxes = at.map(({ x, y, align }) => ({
      left: Math.round(align === "right" ? x - width : x),
      top: Math.round(y),
      width,
      height,
    }))
    const costs = boxes.map(cost)
    placed.push(boxes[costs.indexOf(Math.min(...costs))])
  }
  return placed
}

// The normal joins the scale when it widens the data's span by half at most. Further off, the
// chart leaves it out and marks it at the edge: Hormuz's 27 ships over a forecast of 0 to 6
// would squash the chart into a fifth of its height.
export const fitsNormal = (low: number, high: number, normal: number) =>
  Math.max(high, normal) - Math.min(low, normal) <= 1.5 * (high - low)

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
  const data = [
    ...forecast.values.slice(first),
    ...forecast.averages.slice(first),
    ...fitted.flatMap((level) => forecast.quantiles[level]),
    // A day with no value has no place on the scale.
    ...forecast.actuals.filter((value) => value !== null),
  ]
  const { normal } = forecast
  const scale = valueScale(
    fitsNormal(Math.min(...data), Math.max(...data), normal)
      ? [...data, normal]
      : data,
    top,
    bottom
  )
  return {
    // A line on the chart, or a mark at the edge it lies past.
    normal:
      normal > scale.hi
        ? ("above" as const)
        : normal < scale.lo
          ? ("below" as const)
          : ("inside" as const),
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
export type Point = [number, number]

// The page's token behind each mark of the chart: the real values white, the model's path
// in the one gold accent, the 7-day average and the bands dim.
export const chartTokens = {
  daily: "--primary",
  path: "--forecast",
  average: "--dim",
  band: "--dim",
  frame: "--border",
  origin: "--secondary",
  normal: "--secondary",
  real: "--white",
}
export type Colors = Record<keyof typeof chartTokens, string>

// The thresholds of a 4x4 Bayer matrix, the dither of the bands.
export const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

// Bresenham through each point in turn, `weight` art pixels heavy, with no smoothing.
function polyline(plot: Plot, points: Point[], color: string, weight = 1) {
  for (let i = 1; i < points.length; i++) {
    let [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    let error = dx + dy
    for (;;) {
      square(plot, x0, y0, weight, color)
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

// A 3x3 square without its middle.
function ring(plot: Plot, x: number, y: number, color: string) {
  for (let dx = 0; dx < 3; dx++)
    for (let dy = 0; dy < 3; dy++)
      if (dx !== 1 || dy !== 1) plot(x + dx, y + dy, color)
}

// `path`, the last daily value then one value a day ahead: one of the model's paths, never a
// median line, which reads as an average. Without `marks`, the frame and the origin alone,
// for the marks to scan in over. Every line is solid: none is dashed or dotted.
export function paintChart(
  plot: Plot,
  chart: Layout,
  forecast: Forecast,
  color: Colors,
  path: number[],
  marks = true
) {
  const { left, right, top, bottom, x, y, first, origin } = chart
  const { values, averages, quantiles, actuals } = forecast
  const xo = x(origin)
  const last = values[origin]
  // What happened's last known day gets a hollow ring, whose middle nothing lights, but not
  // where it would touch the origin's filled square, as on a phone with a single day known:
  // the two would read as one blot over the line between them.
  const end = actuals.findLastIndex((value) => value !== null)
  const ex = x(origin + 1 + end)
  const ey = y(actuals[end]!)
  const ringed =
    end >= 0 && (Math.abs(ex - xo) > 3 || Math.abs(ey - y(last)) > 3)
  const lit: Plot = (px, py, c) => {
    if (!ringed || px !== ex || py !== ey) plot(px, py, c)
  }

  // The lines and marks, laid out first so that everything else keeps clear of them. Inside the
  // plot: a 2 art px line on its last column or row would cover the frame's.
  const laid: [number, number, string][] = []
  const lay: Plot = (px, py, markColor) => void laid.push([px, py, markColor])
  const mark: Plot = (px, py, markColor) => {
    if (px <= right && py <= bottom) lay(px, py, markColor)
  }
  if (marks) {
    // The normal first, under every line that crosses it.
    if (chart.normal === "inside")
      for (let px = left; px <= right; px++)
        mark(px, y(forecast.normal), color.normal)
    polyline(
      mark,
      path.map((value, k): Point => [x(origin + k), y(value)]),
      color.path
    )
    // The 7-day average, dimmer: context only, since the forecast is of the daily value.
    polyline(
      mark,
      averages
        .slice(first)
        .map((average, i): Point => [x(first + i), y(average)]),
      color.average
    )
    // The daily values, the quantity forecast, so the forecast carries on from where they end.
    // Twice the path's weight: the real values stand apart from it by weight as well as tint.
    polyline(
      mark,
      values.slice(first).map((value, i): Point => [x(first + i), y(value)]),
      color.daily,
      2
    )
    square(mark, xo - 1, y(last) - 1, 3, color.daily)

    // What happened after the forecast was made: the daily values' line carried on over the
    // bands, at their weight, to compare line with line against the path. A day with no value
    // (the drones' day without a report) breaks it; a day alone between two gaps is a dot, 2 art
    // pixels wide where the days are far enough apart. The ring sets its end apart by shape
    // from the path's unmarked end and the filled square at the origin.
    if (end >= 0) {
      const dot = (right - left) / chart.span >= 3 ? 2 : 1
      const runs: Point[][] = [[[xo, y(last)]]]
      actuals.forEach((value, k) => {
        if (value === null) runs.push([])
        else runs.at(-1)!.push([x(origin + 1 + k), y(value)])
      })
      for (const run of runs)
        if (run.length === 1) square(mark, ...run[0], dot, color.daily)
        else polyline(mark, run, color.daily, 2)
      // Whole, in the margin kept for it: cut, it would no longer read as a ring.
      if (ringed) ring(lay, ex - 1, ey - 1, color.real)
    }
  }
  // An art pixel of the ground round every mark: over the 50% band, the gold path would
  // average 2.2:1, and beside each band pixel it is 1.35:1. One cell per art pixel, as the
  // slider repaints on every step.
  const { width, height } = chart.art
  const keyline = new Uint8Array(width * height)
  for (const [px, py] of laid)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (px + dx >= 0 && px + dx < width && py + dy >= 0 && py + dy < height)
          keyline[(py + dy) * width + px + dx] = 1
  const clear = (px: number, py: number) => !keyline[py * width + px]

  // The forecast zone gets a diagonal hatch, like the empty slots in the game.
  for (let py = top; py <= bottom; py++)
    for (let px = xo + 1; px <= right; px++)
      if ((px + py) % 4 === 0 && clear(px, py)) lit(px, py, color.frame)
  // The value ticks, short, left of the plot where there is room for them.
  if (left >= 3)
    for (const tick of valueTicks(chart.lo, chart.hi))
      for (const px of [left - 3, left - 2]) lit(px, y(tick), color.frame)
  for (let py = top; py <= bottom; py++)
    if (clear(xo, py)) lit(xo, py, color.origin)
  for (let px = left; px <= right; px++) lit(px, bottom + 1, color.frame)
  if (!marks) return

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
        (py === y90 ||
          py === y10 ||
          bayer[(py % 4) * 4 + (px % 4)] < (inner ? 8 : 4)) &&
        clear(px, py)
      )
        lit(px, py, color.band)
    }
  }
  for (const [px, py, markColor] of laid) lit(px, py, markColor)
}
