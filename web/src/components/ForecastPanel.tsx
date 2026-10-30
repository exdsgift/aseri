import { useId } from "react"

import { PixelForecastChart } from "@/components/PixelForecastChart"
import { type Forecast } from "@/lib/api"
import { formatValue, monthDay } from "@/lib/format"

const legend = [
  ["Daily value", "size-1 bg-muted-foreground"],
  ["7-day average", "h-0.5 w-4 bg-primary"],
  ["Most likely", "h-0.5 w-4 bg-gold-pale"],
  ["5 in 10", "h-2.5 w-4 dither-50"],
  ["8 in 10", "h-2.5 w-4 dither-25"],
  ["Forecast made", "h-3 border-l-2 border-dotted border-focus"],
]

// A game sheet: the forecast made today, its pixel chart and where the data comes from.
export function ForecastPanel({ forecast }: { forecast: Forecast }) {
  const title = useId()
  const end = forecast.targetDates.length - 1
  const at = (level: string) => formatValue(forecast.quantiles[level][end])
  const target = monthDay(forecast.targetDates[end])
  const dataTo = monthDay(forecast.dates[forecast.dates.length - 1])
  const average = formatValue(forecast.averages[forecast.averages.length - 1])

  return (
    <section
      aria-labelledby={title}
      className="mx-auto flex max-w-[720px] flex-col gap-3 border-2 border-border px-3 pt-2 pb-3 text-[8px]/[12px] uppercase chip"
    >
      <div className="flex flex-wrap justify-between gap-2 border-b-2 border-border pb-2 text-key">
        <h2 id={title}>[F] {forecast.series} · forecast made today</h2>
        <p>
          {forecast.unit} · data to {dataTo}
        </p>
      </div>
      <p>
        {target}: most likely{" "}
        <b className="font-normal text-gold-pale">{at("0.5")}</b> · 8 in 10:{" "}
        <b className="font-normal text-gold-pale">
          {at("0.1")}-{at("0.9")}
        </b>
      </p>
      <PixelForecastChart
        forecast={forecast}
        summary={`${forecast.series}: daily values and their 7-day average, ${average} on ${dataTo}, then the forecast to ${target}: most likely ${at("0.5")}, 8 in 10 between ${at("0.1")} and ${at("0.9")}.`}
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-muted-foreground">
        {legend.map(([name, swatch]) => (
          <li key={name} className="flex items-center gap-2">
            <span aria-hidden className={swatch} />
            {name}
          </li>
        ))}
      </ul>
      {/* The URLs in it are longer than a phone is wide. */}
      <p className="wrap-anywhere text-muted-foreground">
        Source: {forecast.attribution}
      </p>
    </section>
  )
}
