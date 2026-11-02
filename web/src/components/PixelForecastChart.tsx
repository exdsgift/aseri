import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react"

import { Glyph } from "@/components/Pictogram"
import { type Forecast } from "@/lib/api"
import {
  chartLayout,
  chartTokens,
  labelSize,
  miniChartLayout,
  nudgeApart,
  paintChart,
  pixel,
  placeLabels,
  valueTicks,
  type ChartLayout,
  type Colors,
  type Layout,
  type Point,
} from "@/lib/chart"
import { formatValue, likely, monthDay } from "@/lib/format"
import { countMs, countSteps, easeOut, useSteps } from "@/lib/motion"

// The series each kind of chart, by its layout, has begun to scan in since the page loaded. A
// chart mounted again for one of them, as the panel is when its replay arrives or a square of
// the record opens it, is drawn whole.
const scannedIn = new Map<unknown, Set<string>>()

// Lays the chart out to the width of its box, and paints it a pixel at a time in the page's tokens,
// with `path`, one of the model's paths, on the forecast side. The first time a series' chart of
// this kind comes into view, never under reduced motion, its marks scan in from the left, stepping
// with the hero's count-up and slowing into the end a column at a time; the frame and the labels
// are there from the first frame.
function usePixelChart<L extends Layout>(
  forecast: Forecast,
  layout: (forecast: Forecast, width: number) => L,
  path: number[]
) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const [seen, setSeen] = useState(false)
  const chart = useMemo(
    () => (width ? layout(forecast, width) : undefined),
    [forecast, width, layout]
  )
  const [fresh] = useState(() => !scannedIn.get(layout)?.has(forecast.series))
  const step = useSteps(countSteps, countMs, fresh && seen)
  const revealed = !fresh || step === undefined ? 1 : easeOut(step / countSteps)
  useEffect(() => {
    if (fresh && seen)
      scannedIn.set(
        layout,
        (scannedIn.get(layout) ?? new Set<string>()).add(forecast.series)
      )
  }, [fresh, seen, layout, forecast.series])
  const box = useCallback((element: HTMLElement | null) => {
    if (!element) return
    // At once too, before the first paint: a chart mounted as a new series opens would
    // otherwise show a frame with no height, and everything under it would jump.
    setWidth(Math.floor(element.getBoundingClientRect().width))
    const resized = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width))
    )
    // The scan waits for the chart to show, if only in part.
    const shown = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setSeen(true)
    })
    resized.observe(element)
    shown.observe(element)
    return () => {
      resized.disconnect()
      shown.disconnect()
    }
  }, [])

  // The chart painted whole off screen, once for each drawing, and its frame alone while the
  // marks have still to scan in over it: each step of the scan only reveals more of the whole.
  // The colours are read once.
  const layers = useRef<{
    drawn?: unknown[]
    colors?: Colors
    whole?: HTMLCanvasElement
    frame?: HTMLCanvasElement
  }>({})
  useEffect(() => {
    if (!chart) return
    const at = layers.current
    if (!at.colors) {
      const css = getComputedStyle(canvas.current!)
      at.colors = Object.fromEntries(
        Object.entries(chartTokens).map(([mark, name]) => [
          mark,
          css.getPropertyValue(name),
        ])
      ) as Colors
    }
    const layer = (marks: boolean) => {
      const painted = document.createElement("canvas")
      painted.width = chart.art.width
      painted.height = chart.art.height
      const context = painted.getContext("2d")!
      paintChart(
        (x, y, color) => {
          context.fillStyle = color
          context.fillRect(x, y, 1, 1)
        },
        chart,
        forecast,
        at.colors!,
        path,
        marks
      )
      return painted
    }
    const drawing = [chart, forecast, path]
    if (!at.drawn || at.drawn.some((part, i) => part !== drawing[i])) {
      at.drawn = drawing
      at.whole = layer(true)
      at.frame = undefined
    }
    const { width, height } = chart.art
    // Up to the column past the right end, where what happened's ring ends.
    const shown =
      revealed < 1
        ? Math.ceil(chart.left + revealed * (chart.right + 2 - chart.left))
        : width
    const context = canvas.current!.getContext("2d")!
    context.clearRect(0, 0, width, height)
    if (shown < width) context.drawImage((at.frame ??= layer(false)), 0, 0)
    if (shown > 0)
      context.drawImage(at.whole!, 0, 0, shown, height, 0, 0, shown, height)
  }, [chart, forecast, path, revealed])

  // Nothing until the box is measured: the canvas's default 300 px would widen it.
  const size = {
    width: chart?.art.width ?? 0,
    height: chart?.art.height ?? 0,
    style: chart && {
      width: chart.art.width * pixel,
      height: chart.art.height * pixel,
    },
  }
  return { box, canvas, width, chart, size }
}

// A card's chart: the same drawing, small and silent, since the card says it in words. A normal
// too far off its scale is marked at the edge it lies past, with its value.
// Spans only, as a button may hold only phrasing content.
export function MiniForecastChart({
  forecast,
  path,
}: {
  forecast: Forecast
  path: number[]
}) {
  const { box, canvas, chart, size } = usePixelChart(
    forecast,
    miniChartLayout,
    path
  )
  return (
    <span ref={box} className="relative block">
      <canvas
        ref={canvas}
        aria-hidden
        {...size}
        className="block [image-rendering:pixelated]"
      />
      {chart && chart.normal !== "inside" && (
        <span
          aria-hidden
          className={`absolute left-0.5 bg-background px-px text-secondary ${chart.normal === "above" ? "top-0.5" : "bottom-1"}`}
        >
          <Glyph name={chart.normal === "above" ? "up" : "down"} />
          normal {formatValue(forecast.normal)}
        </span>
      )}
    </span>
  )
}

// `likeliest`, the first of the paths, places the labels, so they hold still as the others play.
export function PixelForecastChart({
  forecast,
  path,
  likeliest,
  summary,
}: {
  forecast: Forecast
  path: number[]
  likeliest: number[]
  summary: string
}) {
  const { box, canvas, width, chart, size } = usePixelChart(
    forecast,
    chartLayout,
    path
  )
  // A day is an index into the forecast's days, so it holds only for the forecast it was picked on.
  const [hovered, setHovered] = useState<{ forecast: Forecast; day: number }>()

  const point = (event: PointerEvent<HTMLCanvasElement>) =>
    chart &&
    setHovered({
      forecast,
      day: chart.dayAt(
        (event.clientX - event.currentTarget.getBoundingClientRect().left) /
          pixel
      ),
    })

  return (
    <div ref={box} className="relative touch-pan-y">
      <canvas
        ref={canvas}
        role="img"
        aria-label={summary}
        {...size}
        className="block [image-rendering:pixelated]"
        onPointerMove={point}
        onPointerDown={point}
        // A tap's tooltip stays up: touch fires pointerleave as the finger lifts.
        onPointerLeave={(event) =>
          event.pointerType !== "touch" && setHovered(undefined)
        }
      />
      {chart && (
        <ChartLabels chart={chart} forecast={forecast} likeliest={likeliest} />
      )}
      {/* A narrower chart starts later than the day a tap may have left up. */}
      {chart &&
        hovered?.forecast === forecast &&
        hovered.day >= chart.first && (
          <DayTip
            chart={chart}
            forecast={forecast}
            day={hovered.day}
            width={width}
          />
        )}
    </div>
  )
}

function Label({
  x,
  top,
  align = "left",
  className = "",
  children,
}: {
  x: number
  top: number
  align?: "left" | "right"
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={`absolute whitespace-nowrap ${className}`}
      style={{
        left: x,
        top,
        translate: align === "right" ? "-100%" : undefined,
      }}
    >
      {children}
    </span>
  )
}

// A point every 3 px along a line, for the direct labels to keep off.
const along = (points: Point[]) =>
  points.flatMap(([x1, y1], i): Point[] => {
    if (!i) return [[x1, y1]]
    const [x0, y0] = points[i - 1]
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3))
    return Array.from({ length: steps }, (_, j) => [
      x0 + ((x1 - x0) * (j + 1)) / steps,
      y0 + ((y1 - y0) * (j + 1)) / steps,
    ])
  })

// The first wording that fits `room`, on one line or broken over more.
const fitting = (room: number, ...wordings: string[]) =>
  wordings.find((text) => labelSize(text).width <= room) ?? wordings.at(-1)!

// Real text over the canvas: the value ticks, the first and last days and the forecast's end
// values, then the direct labels that stand in for a legend, each on its own mark and clear of
// the lines. The band says once, on itself, what it counts.
function ChartLabels({
  chart,
  forecast,
  likeliest,
}: {
  chart: ChartLayout
  forecast: Forecast
  likeliest: number[]
}) {
  const { left, right, top, bottom, x, y, first, origin, ahead } = chart
  const { values, averages, actuals, quantiles, normal } = forecast
  const X = (day: number) => x(day) * pixel
  const Y = (value: number) => y(value) * pixel
  const xo = X(origin)
  const end = (level: string) => quantiles[level][ahead - 1]
  // Undefined until observed, null on a day with no value.
  const real = actuals[ahead - 1] ?? undefined
  // Top to bottom, so that each label clears the one above. No label on the path's end:
  // it would read as the forecast.
  const ends = [
    { value: end("0.9"), className: "" },
    { value: end("0.1"), className: "" },
    ...(real === undefined
      ? []
      : [{ value: real, className: "text-[12px] text-white" }]),
  ].toSorted((a, b) => b.value - a.value)
  const tops = nudgeApart(
    ends.map(({ value }) => Y(value) - 6),
    14
  )
  const known = actuals.findLastIndex((value) => value !== null)
  const lines = [
    ...along(values.slice(first).map((v, i): Point => [X(first + i), Y(v)])),
    ...along(averages.slice(first).map((v, i): Point => [X(first + i), Y(v)])),
    ...along(likeliest.map((v, k): Point => [X(origin + k), Y(v)])),
    ...along(
      actuals.flatMap((v, k): Point[] =>
        v === null ? [] : [[X(origin + 1 + k), Y(v)]]
      )
    ),
    ...(chart.normal === "inside"
      ? along([
          [left * pixel, Y(normal)],
          [(right + 1) * pixel, Y(normal)],
        ])
      : []),
  ]
  const plot = {
    left: left * pixel,
    top: top * pixel,
    right: (right + 1) * pixel,
    bottom: bottom * pixel,
  }

  // The forecast side: the band's meaning inside it and its complement at its edge, where the
  // first path crosses least, and in a replay what happened by its end.
  const future = { ...plot, left: xo + 3 }
  const room = future.right - future.left
  const xr = plot.right - 2
  const [y90, y10] = [Y(end("0.9")), Y(end("0.1"))]
  const band = fitting(
    room,
    "8 in 10 days land here",
    "8 in 10 days\nland here",
    "8 in 10\ndays land\nhere"
  )
  // Two characters' room for the glyph before it.
  const outside = fitting(room, "  2 in 10 outside", "  2 in 10\noutside")
  const happened = fitting(room, "what happened", "what\nhappened")
  const [bandBox, outsideBox, happenedBox] = placeLabels(
    [
      {
        text: band,
        at: [0.5, 0.3, 0.7, 0.15, 0.85].map((share) => ({
          x: xr,
          y: y90 + (y10 - y90) * share - labelSize(band).height / 2,
          align: "right" as const,
        })),
      },
      {
        text: outside,
        at: [
          { x: xr, y: y90 - labelSize(outside).height - 3, align: "right" },
          { x: xr, y: y10 + 4, align: "right" },
        ],
      },
      ...(known < 0
        ? []
        : [
            {
              text: happened,
              at: [-30, 6, -54, 30].flatMap((dy) => {
                const [ex, ey] = [X(origin + 1 + known), Y(actuals[known]!)]
                return [
                  { x: ex - 6, y: ey + dy, align: "right" as const },
                  { x: ex + 6, y: ey + dy },
                ]
              }),
            },
          ]),
    ],
    future,
    lines
  )

  // The history: each line named at its end, and the normal on its line, or at the edge it
  // lies past when it is too far off the scale to draw.
  const past = { ...plot, left: plot.left + 2, right: xo - 3 }
  const atEnd = (value: number) =>
    [0, 24, 48].flatMap((shift) => [
      { x: xo - 6 - shift, y: Y(value) - 15, align: "right" as const },
      { x: xo - 6 - shift, y: Y(value) + 4, align: "right" as const },
    ])
  const named = `normal ${formatValue(normal)}`
  const onEdge = chart.normal === "above" ? plot.top + 2 : plot.bottom - 14
  const [dailyBox, averageBox, normalBox] = placeLabels(
    [
      { text: "daily", at: atEnd(values[origin]) },
      { text: "7-day avg", at: atEnd(averages[origin]) },
      chart.normal === "inside"
        ? {
            text: named,
            at: [
              { x: past.left, y: Y(normal) - 14 },
              { x: past.left, y: Y(normal) + 4 },
              { x: xo - 6, y: Y(normal) - 14, align: "right" as const },
              { x: xo - 6, y: Y(normal) + 4, align: "right" as const },
            ],
          }
        : {
            text: `  ${named}`,
            at: [
              { x: past.left, y: onEdge },
              { x: xo - 6, y: onEdge, align: "right" as const },
            ],
          },
    ],
    past,
    lines
  )
  const direct = (
    box: { left: number; top: number },
    className: string,
    children: ReactNode
  ) => (
    <span
      className={`absolute bg-background px-px whitespace-pre ${className}`}
      style={{ left: box.left, top: box.top }}
    >
      {children}
    </span>
  )
  const dataTo = `data to ${monthDay(forecast.dates[origin])}`

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 text-[8px]/[12px] text-muted-foreground uppercase"
    >
      {valueTicks(chart.lo, chart.hi).map((tick) => (
        <Label
          key={tick}
          x={(left - 4) * pixel}
          top={Y(tick) - 6}
          align="right"
        >
          {formatValue(tick)}
        </Label>
      ))}
      <Label x={plot.left} top={(bottom + 3) * pixel}>
        {monthDay(forecast.dates[first])}
      </Label>
      <Label x={plot.right} top={(bottom + 3) * pixel} align="right">
        {monthDay(forecast.targetDates[ahead - 1])}
      </Label>
      {/* The one date anchor, on the line where the data ends. */}
      <Label x={xo - 3} top={2} align="right" className="text-secondary">
        {dataTo}
      </Label>
      {ends.map(({ value, className }, i) => (
        <Label
          key={i}
          x={(right + 4) * pixel}
          top={tops[i]}
          className={className}
        >
          {formatValue(value)}
        </Label>
      ))}
      {direct(bandBox, "text-secondary", band)}
      {direct(
        outsideBox,
        "text-secondary",
        <>
          <Glyph name="out" />
          {outside.trimStart()}
        </>
      )}
      {happenedBox && direct(happenedBox, "text-white", happened)}
      {direct(dailyBox, "text-primary", "daily")}
      {direct(averageBox, "", "7-day avg")}
      {direct(
        normalBox,
        "text-secondary",
        chart.normal === "inside" ? (
          named
        ) : (
          <>
            <Glyph name={chart.normal === "above" ? "up" : "down"} />
            {named}
          </>
        )
      )}
    </div>
  )
}

// The hover or tap readout for one day: its daily value and 7-day average, or the forecast, in
// the page's words: the range first, then the middle estimate.
function DayTip({
  chart,
  forecast,
  day,
  width,
}: {
  chart: ChartLayout
  forecast: Forecast
  day: number
  width: number
}) {
  const x = chart.x(day) * pixel
  const step = day - chart.origin - 1
  const at = (level: string) => forecast.quantiles[level][step]
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-4 z-10 border-2 border-border bg-background/90 px-2 py-1.5 text-[8px]/[14px] uppercase"
      style={
        // On the side with more room, so it never runs off the chart.
        x < width / 2 ? { left: x + 12 } : { right: width - x + 12 }
      }
    >
      {step < 0 ? (
        <>
          <span className="block text-secondary">
            {monthDay(forecast.dates[day])}
          </span>
          <span className="block">
            daily {formatValue(forecast.values[day])}
          </span>
          <span className="block">
            7-day avg {formatValue(forecast.averages[day])}
          </span>
        </>
      ) : (
        <>
          <span className="block text-secondary">
            {monthDay(forecast.targetDates[step])}
          </span>
          <span className="block">{likely(at("0.1"), at("0.9"))}</span>
          <span className="block">
            middle estimate {formatValue(at("0.5"))}
          </span>
          {forecast.actuals[step] != null && (
            <span className="block text-white">
              What happened {formatValue(forecast.actuals[step]!)}
            </span>
          )}
        </>
      )}
    </div>
  )
}
