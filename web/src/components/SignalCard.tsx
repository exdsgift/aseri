import { useMemo } from "react"

import { Glyph, Pictogram, type PictogramName } from "@/components/Pictogram"
import { MiniForecastChart } from "@/components/PixelForecastChart"
import { type Series } from "@/lib/api"
import {
  formatValue,
  likely,
  monthDay,
  percentFrom,
  roughly,
  versusBaseline,
} from "@/lib/format"
import { ranked } from "@/lib/paths"

// One series at a glance, like the game's title cards: pick it to open it in the forecast panel.
// Like with like: the 7-day value against normal, then one day's range, each said as what it is.
export function SignalCard({
  series,
  icon,
  hint,
  picked,
  onPick,
}: {
  series: Series
  icon: PictogramName
  hint: string
  picked: boolean
  onPick: () => void
}) {
  const { today, staleSince } = series
  // Today's forecast: the last one.
  const forecast = series.forecasts.at(-1)!
  // The same array until the forecast changes, so other renders do not repaint the chart.
  const likeliest = useMemo(
    () => ranked(forecast, series.rho)[0].values,
    [forecast, series.rho]
  )
  // The panel gives the unit in full: "index (1985-2019 average = 100)" is "index" here.
  const unit = forecast.unit.replace(/ \(.*\)$/, "")
  // "a day", "a barrel": the forecast line's unit, short.
  const per = forecast.unit.match(/ a \w+/)?.[0] ?? ""
  // Spans only, with spaces between them: a button holds phrasing content, and its text is its name.
  // Picked reads by shape too, an inner frame 2 px inside the border, where a hover only lightens it.
  return (
    <button
      type="button"
      aria-pressed={picked}
      aria-keyshortcuts={hint}
      onClick={onPick}
      className="group flex w-full cursor-pointer flex-col gap-2 border-2 border-border px-2.5 pt-2 pb-2.5 text-left text-[8px]/[12px] uppercase chip hover:border-muted-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:bg-accent aria-pressed:border-secondary aria-pressed:bg-accent aria-pressed:shadow-[inset_0_0_0_2px_var(--accent),inset_0_0_0_4px_var(--secondary)] motion-safe:transition-colors motion-safe:duration-160"
    >
      <span className="flex items-center gap-2">
        <span className="text-primary">
          <Pictogram name={icon} />
        </span>
        <span className="min-w-0 flex-1">{forecast.series}</span>{" "}
        {/* The key, only while the card is hovered or has the keyboard's focus. */}
        <span
          aria-hidden
          className="invisible text-secondary group-hover:visible group-focus-visible:visible"
        >
          [{hint}]
        </span>
      </span>{" "}
      <span className="flex flex-wrap items-baseline gap-x-2">
        <b className="text-[16px]/[16px] font-normal text-primary">
          {formatValue(today.sevenDayAverage)}
        </b>{" "}
        <span className="text-muted-foreground">
          {unit} <span className="whitespace-nowrap">· 7-day avg</span>
        </span>
      </span>{" "}
      {/* Said in words too, so the warning never rests on its marker alone. */}
      {staleSince && (
        <>
          <span className="caution">
            data to {monthDay(today.referenceDate)}, stale since{" "}
            {monthDay(staleSince)}
          </span>{" "}
        </>
      )}
      {/* The way from normal by shape as well as words, never by colour alone. */}
      <span>
        <Glyph
          name={
            percentFrom(today.sevenDayAverage, today.baseline) < 0
              ? "down"
              : "up"
          }
        />
        {versusBaseline(today.sevenDayAverage, today.baseline)}
      </span>{" "}
      {/* The panel's opening line: the most likely of the model's paths. */}
      <MiniForecastChart forecast={forecast} path={likeliest} />{" "}
      {/* The forecast is of the daily value: a range for one day, not for the days up to it. */}
      <span className="text-primary">
        {monthDay(today.targetDate)}:{" "}
        {likely(roughly(today.low), roughly(today.high))}
        {per}
      </span>
    </button>
  )
}
