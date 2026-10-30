import { Pictogram, type PictogramName } from "@/components/Pictogram"
import { MiniForecastChart } from "@/components/PixelForecastChart"
import { type Series } from "@/lib/api"
import {
  daysAhead,
  formatValue,
  monthDay,
  versusBaseline,
} from "@/lib/format"

// One series at a glance, like the game's title cards: pick it to open it in the forecast panel.
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
  // Spans only, with spaces between them: a button holds phrasing content, and its text is its name.
  return (
    <button
      type="button"
      aria-pressed={picked}
      aria-keyshortcuts={hint}
      onClick={onPick}
      className="flex w-full cursor-pointer flex-col gap-2 border-2 border-border px-2.5 pt-2 pb-2.5 text-left text-[8px]/[12px] uppercase chip hover:border-muted-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:bg-accent aria-pressed:border-focus aria-pressed:bg-accent motion-safe:transition-colors motion-safe:duration-160"
    >
      <span className="flex items-center gap-2">
        <span className="text-primary">
          <Pictogram name={icon} />
        </span>
        <span className="min-w-0 flex-1">{forecast.series}</span>{" "}
        <span aria-hidden className="text-key">
          [{hint}]
        </span>
      </span>{" "}
      <span className="flex flex-wrap items-baseline gap-x-2">
        <b className="text-[16px]/[16px] font-normal text-primary">
          {formatValue(today.sevenDayAverage)}
        </b>{" "}
        <span className="text-muted-foreground">{forecast.unit}</span>
      </span>{" "}
      {/* Said in words too, so the warning never rests on colour alone. */}
      <span
        className={staleSince ? "text-destructive" : "text-muted-foreground"}
      >
        7-day average to {monthDay(today.referenceDate)}
        {staleSince && `, stale since ${monthDay(staleSince)}`}
      </span>{" "}
      <span>
        {versusBaseline(today.sevenDayAverage, today.baseline)}{" "}
        {today.baselineLabel}
      </span>{" "}
      <MiniForecastChart forecast={forecast} />
      {/* The forecast is of the daily value: a range for one day, not for the days up to it. */}
      <span className="text-gold-pale">
        In {daysAhead(today.daysAhead, today.horizonUnit)}:{" "}
        {formatValue(today.low)}-
        {formatValue(today.high)}
      </span>{" "}
      <span className="text-muted-foreground">
        8 in 10 for {monthDay(today.targetDate)} alone
      </span>
    </button>
  )
}
