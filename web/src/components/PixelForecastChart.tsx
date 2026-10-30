import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react"

import { type Forecast } from "@/lib/api"
import {
  chartLayout,
  chartTokens,
  dateTicks,
  miniChartLayout,
  nudgeApart,
  paintChart,
  pixel,
  textWidth,
  valueTicks,
  type ChartLayout,
  type Colors,
  type Layout,
} from "@/lib/chart"
import { formatValue, monthDay } from "@/lib/format"

// Lays the chart out to the width of its box, and paints it a pixel at a time in the page's tokens.
function usePixelChart<L extends Layout>(
  forecast: Forecast,
  layout: (forecast: Forecast, width: number) => L
) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const chart = useMemo(
    () => (width ? layout(forecast, width) : undefined),
    [forecast, width, layout]
  )
  const box = useCallback((element: HTMLElement | null) => {
    if (!element) return
    // At once too, before the first paint: a chart mounted as a new series opens would
    // otherwise show a frame with no height, and everything under it would jump.
    setWidth(Math.floor(element.getBoundingClientRect().width))
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width))
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!chart) return
    const context = canvas.current!.getContext("2d")!
    const css = getComputedStyle(canvas.current!)
    context.clearRect(0, 0, chart.art.width, chart.art.height)
    paintChart(
      (x, y, color) => {
        context.fillStyle = color
        context.fillRect(x, y, 1, 1)
      },
      chart,
      forecast,
      Object.fromEntries(
        Object.entries(chartTokens).map(([mark, name]) => [
          mark,
          css.getPropertyValue(name),
        ])
      ) as Colors
    )
  }, [chart, forecast])

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

// A card's chart: the same drawing, small and silent, since the card says it in words.
// A span, as a button may hold only phrasing content.
export function MiniForecastChart({ forecast }: { forecast: Forecast }) {
  const { box, canvas, size } = usePixelChart(forecast, miniChartLayout)
  return (
    <span ref={box} className="block">
      <canvas
        ref={canvas}
        aria-hidden
        {...size}
        className="block [image-rendering:pixelated]"
      />
    </span>
  )
}

export function PixelForecastChart({
  forecast,
  summary,
}: {
  forecast: Forecast
  summary: string
}) {
  const { box, canvas, width, chart, size } = usePixelChart(
    forecast,
    chartLayout
  )
  const [hovered, setHovered] = useState<number>()

  const point = (event: PointerEvent<HTMLCanvasElement>) =>
    chart &&
    setHovered(
      chart.dayAt(
        (event.clientX - event.currentTarget.getBoundingClientRect().left) /
          pixel
      )
    )

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
      {chart && <ChartLabels chart={chart} forecast={forecast} />}
      {/* A narrower chart starts later, and an older forecast of the replay ends earlier,
          than the day a tap may have left up. */}
      {chart &&
        hovered !== undefined &&
        hovered >= chart.first &&
        hovered <= chart.origin + chart.ahead && (
          <DayTip
            chart={chart}
            forecast={forecast}
            day={hovered}
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
  align?: "left" | "center" | "right"
  className?: string
  children: ReactNode
}) {
  const shift = { left: undefined, center: "-50%", right: "-100%" }[align]
  return (
    <span
      className={`absolute whitespace-nowrap ${className}`}
      style={{ left: x, top, translate: shift }}
    >
      {children}
    </span>
  )
}

// Real text over the canvas: the value ticks, the dates, the zone names and the end values.
function ChartLabels({
  chart,
  forecast,
}: {
  chart: ChartLayout
  forecast: Forecast
}) {
  const { left, right, bottom, x, y, first, origin, ahead } = chart
  const xo = x(origin)
  const end = (level: string) => forecast.quantiles[level][ahead - 1]
  const real = forecast.actuals[ahead - 1]
  // Top to bottom, so that each label clears the one above.
  const ends = [
    { value: end("0.9"), className: "" },
    { value: end("0.5"), className: "text-[12px] text-gold-pale" },
    { value: end("0.1"), className: "" },
    ...(real === undefined
      ? []
      : [{ value: real, className: "text-[12px] text-white" }]),
  ].toSorted((a, b) => b.value - a.value)
  const tops = nudgeApart(
    ends.map(({ value }) => y(value) * pixel - 6),
    14
  )
  const ticks = dateTicks(
    { date: forecast.dates[first], x: left * pixel },
    { date: forecast.dates[origin], x: xo * pixel },
    { date: forecast.targetDates[ahead - 1], x: (right + 1) * pixel }
  )
  const past = chart.narrow ? "Daily · 7d avg" : "Daily values · 7-day avg"
  // A forecast with days already known is a past one.
  const future = forecast.actuals.length
    ? `${ahead} days after`
    : `Next ${ahead} days`
  // The forecast zone's name, right-aligned, past the origin and clear of the label on the left.
  const futureFits =
    (right + 1) * pixel - textWidth(future) >=
    Math.max(xo * pixel, left * pixel + textWidth(past) + 8)
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 text-[8px]/[12px] text-muted-foreground uppercase"
    >
      {valueTicks(chart.lo, chart.hi).map((tick) => (
        <Label
          key={tick}
          x={(left - 3) * pixel}
          top={y(tick) * pixel - 6}
          align="right"
        >
          {formatValue(tick)}
        </Label>
      ))}
      {ticks.map((tick) => (
        <Label
          key={tick.date}
          x={tick.x}
          top={(bottom + 3) * pixel}
          align={tick.align}
          className={tick.date === forecast.dates[origin] ? "text-focus" : ""}
        >
          {monthDay(tick.date)}
        </Label>
      ))}
      <Label x={left * pixel} top={0}>
        {past}
      </Label>
      {futureFits && (
        <Label
          x={(right + 1) * pixel}
          top={0}
          align="right"
          className="text-primary"
        >
          {future}
        </Label>
      )}
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
    </div>
  )
}

// The hover or tap readout for one day: its daily value and 7-day average, or the forecast.
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
  const at = (level: string) => formatValue(forecast.quantiles[level][step])
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
          <span className="block text-key">
            {monthDay(forecast.dates[day])}
          </span>
          <span className="block">
            Daily value {formatValue(forecast.values[day])}
          </span>
          <span className="block">
            7-day avg {formatValue(forecast.averages[day])}
          </span>
        </>
      ) : (
        <>
          <span className="block text-key">
            {monthDay(forecast.targetDates[step])}
          </span>
          <span className="block">
            8 in 10: {at("0.1")}-{at("0.9")}
          </span>
          <span className="block">Most likely {at("0.5")}</span>
          {forecast.actuals[step] !== undefined && (
            <span className="block text-white">
              What happened {formatValue(forecast.actuals[step])}
            </span>
          )}
        </>
      )}
    </div>
  )
}
