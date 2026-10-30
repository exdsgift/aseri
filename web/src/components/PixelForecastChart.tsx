import {
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
  dateTicks,
  nudgeApart,
  paintChart,
  pixel,
  textWidth,
  valueTicks,
  type ChartLayout,
} from "@/lib/chart"
import { formatValue, monthDay } from "@/lib/format"

export function PixelForecastChart({
  forecast,
  summary,
}: {
  forecast: Forecast
  summary: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const [hovered, setHovered] = useState<number>()
  const chart = useMemo(
    () => (width ? chartLayout(forecast, width) : undefined),
    [forecast, width]
  )

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width))
    )
    observer.observe(box.current!)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!chart) return
    const context = canvas.current!.getContext("2d")!
    const css = getComputedStyle(canvas.current!)
    const token = (name: string) => css.getPropertyValue(name)
    context.clearRect(0, 0, chart.art.width, chart.art.height)
    paintChart(
      (x, y, color) => {
        context.fillStyle = color
        context.fillRect(x, y, 1, 1)
      },
      chart,
      forecast,
      {
        gold: token("--primary"),
        pale: token("--gold-pale"),
        muted: token("--secondary"),
        frame: token("--border"),
        focus: token("--focus"),
        label: token("--muted-foreground"),
      }
    )
  }, [chart, forecast])

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
        width={chart?.art.width ?? 0}
        height={chart?.art.height ?? 0}
        className="block [image-rendering:pixelated]"
        style={
          chart && {
            width: chart.art.width * pixel,
            height: chart.art.height * pixel,
          }
        }
        onPointerMove={point}
        onPointerDown={point}
        // A tap's tooltip stays up: touch fires pointerleave as the finger lifts.
        onPointerLeave={(event) =>
          event.pointerType !== "touch" && setHovered(undefined)
        }
      />
      {chart && <ChartLabels chart={chart} forecast={forecast} />}
      {/* A narrower chart starts later, past the day a tap may have left up. */}
      {chart && hovered !== undefined && hovered >= chart.first && (
        <DayTip chart={chart} forecast={forecast} day={hovered} width={width} />
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
  const ends = [
    { value: end("0.9"), className: "" },
    { value: end("0.5"), className: "text-[12px] text-gold-pale" },
    { value: end("0.1"), className: "" },
  ]
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
  const future = `Next ${ahead} days`
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
          <span className="block">Most likely {at("0.5")}</span>
          <span className="block">
            8 in 10: {at("0.1")}-{at("0.9")}
          </span>
        </>
      )}
    </div>
  )
}
