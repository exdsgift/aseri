import { useEffect, useId, useMemo, useRef, useState } from "react"

import { control, Disclosure } from "@/components/Disclosure"
import { PixelForecastChart } from "@/components/PixelForecastChart"
import { ReplaySlider } from "@/components/ReplaySlider"
import { type Series } from "@/lib/api"
import {
  daysAhead,
  formatValue,
  likely,
  monthDay,
  outward,
  valueRange,
  weekday,
} from "@/lib/format"
import { tickWhileShown, useReducedMotion } from "@/lib/motion"
import { PATHS, ranked } from "@/lib/paths"
import { insideSoFar, stepRows, yearRange } from "@/lib/replay"
import { direction } from "@/lib/takeaways"

// A game sheet: today's forecast or a past one from the replay, titled with its takeaway, its
// pixel chart labelled on its marks, and one tap away each, how to read it, its numbers and its
// sources. `opened` is the reference date of a past forecast to start on, as the record's
// squares ask; today's otherwise.
export function ForecastPanel({
  series,
  opened,
}: {
  series: Series
  opened?: string
}) {
  const title = useId()
  const name = useId()
  const { id, forecasts, steps, today, staleSince, note, weekly, rho } = series
  const last = forecasts.length - 1
  const [shown, setShown] = useState(() => {
    const start = forecasts.findIndex((f) => f.dates.at(-1) === opened)
    return start < 0 ? last : start
  })
  const forecast = forecasts[shown]
  const live = shown === last
  const end = forecast.targetDates.length - 1
  const [low, high] = [
    forecast.quantiles["0.1"][end],
    forecast.quantiles["0.9"][end],
  ]
  const target = monthDay(forecast.targetDates[end])
  const made = monthDay(forecast.dates.at(-1)!)
  const lastValue = forecast.values.at(-1)!
  const range = valueRange(...outward(low, high))
  const sofar = insideSoFar(forecast)
  // The chart draws only the model's own paths, never an average: the most likely of the
  // 20 first and, played, the others in order, the next every 1.2 s. None turns under
  // reduced motion, nor while nobody can see the panel.
  const ordered = useMemo(() => ranked(forecast, rho), [forecast, rho])
  const [drawn, setDrawn] = useState(0)
  const [playing, setPlaying] = useState(false)
  const next = () => setDrawn((k) => (k + 1) % PATHS)
  // Another forecast opens on its own most likely path, still.
  const show: typeof setShown = (action) => {
    setShown(action)
    setDrawn(0)
    setPlaying(false)
  }
  const reduced = useReducedMotion()
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    if (reduced || !playing) return
    return tickWhileShown(panel.current!, 1200, () => next())
  }, [reduced, playing])

  return (
    <section
      ref={panel}
      aria-labelledby={`${name} ${title}`}
      className="mx-auto flex max-w-[720px] flex-col gap-3 border-2 border-border px-3 pt-2.5 pb-3 text-[8px]/[12px] uppercase chip"
    >
      <div className="flex flex-col gap-1">
        {/* The takeaway first: today's range and which way it leans against the like-for-like
            day, worked out as the series loaded; in a replay, what that forecast said. */}
        <h2 id={title} className="text-[12px]/[18px] text-primary">
          {live
            ? `Likely ${range} by ${target}, ${direction(today.chances)}`
            : `${forecast.backtest ? "Backtest" : "Forecast"} made ${made}: likely ${range} by ${target}`}
        </h2>
        <p className="text-secondary">
          <span id={name}>{forecast.series}</span> · {forecast.unit}
          {!live && ` · what happened as of ${monthDay(today.asOf)}`}
        </p>
      </div>
      {/* Said in words too, so the warning never rests on its marker alone. */}
      {staleSince && (
        <p className="caution">
          data to {monthDay(forecasts[last].dates.at(-1)!)}, stale since{" "}
          {monthDay(staleSince)}
        </p>
      )}
      {/* Such as Taiwan's tracking dropouts, or a newest value under review. */}
      {note && <p className="text-secondary">Note: {note}</p>}
      <PixelForecastChart
        forecast={forecast}
        path={ordered[drawn].values}
        likeliest={ordered[0].values}
        summary={`${forecast.series}: daily values to ${made}, the last ${formatValue(lastValue)} (7-day average ${formatValue(forecast.averages.at(-1)!)}), then the ${forecast.backtest ? "backtest" : "forecast"}: ${likely(low, high)} by ${target}, where 8 in 10 days land. The gold line is path ${drawn + 1} of ${PATHS} drawn from the forecast, the most likely first.${sofar.of ? ` What happened: ${sofar.inside} of ${sofar.of} days in range.` : ""}`}
      />
      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
        {!reduced && (
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            // As wide as either word, so the controls after it never move.
            className={`min-w-14 ${control}`}
          >
            {playing ? "Pause" : "Play"}
          </button>
        )}
        <button type="button" onClick={next} className={control}>
          Next path
        </button>
        <span>{`Path ${drawn + 1} of ${PATHS}${drawn ? "" : ", the most likely"}`}</span>
      </div>
      {last > 0 && (
        <ReplaySlider forecasts={forecasts} shown={shown} setShown={show} />
      )}
      <div className="flex flex-wrap items-start gap-2">
        {/* What the band is and is not, and what the line ahead is: the misreadings the band's
            own words cannot stop. */}
        <Disclosure label="How to read this">
          <p>
            The shaded range is where 8 in 10 days should land; 2 in 10 land
            outside. It is not a high and a low.
          </p>
          <p>The darker core: half the days land there.</p>
          <p>
            The gold line is one of {PATHS} possible paths drawn from the
            forecast, the most likely first. Play shows the others, one at a
            time. No one knows which days turn out high.
          </p>
          {/* The catalog says which series follow the week: GPR and Wikipedia views do. */}
          {weekly && (
            <p>
              Values follow the week: compare a{" "}
              {weekday(forecast.dates.at(-1)!)} with a{" "}
              {weekday(forecast.dates.at(-1)!)}.
            </p>
          )}
          <p>
            Normal: {today.baselineLabel}, {formatValue(today.baseline)}. In a
            replay, the white line carries on with what happened.
          </p>
        </Disclosure>
        <Disclosure label="Show the numbers">
          <p>
            {made}, last data: {formatValue(lastValue)}
          </p>
          {stepRows(forecast, steps).map((row) => (
            <p key={row.step}>
              {monthDay(row.date)} ({daysAhead(row.step, today.horizonUnit)}):{" "}
              {likely(row.eightInTen[0], row.eightInTen[1])} · middle half{" "}
              {formatValue(row.fiveInTen[0])}-{formatValue(row.fiveInTen[1])} ·
              middle estimate {formatValue(row.mostLikely)}
              {row.real !== undefined &&
                ` · what happened ${formatValue(row.real)}, ${row.inside ? "in range" : "outside"}`}
            </p>
          ))}
          <p>
            1-year range of the daily value to{" "}
            {monthDay(forecasts[last].dates.at(-1)!)}:{" "}
            {yearRange(forecasts[last].dates, forecasts[last].values)
              .map(formatValue)
              .join("-")}
          </p>
        </Disclosure>
        <Disclosure label="Sources">
          {/* The URLs in it are longer than a phone is wide. */}
          <p className="wrap-anywhere">
            {/^Sources?:/.test(forecast.attribution) ? "" : "Source: "}
            {forecast.attribution}
          </p>
          {/* The real values of a replay are as read that day; GPR's source revises its last
              month. shortcut: the note keys on GPR's id, the one source that calls its recent
              weeks preliminary; make it a catalog flag if another source ever does. */}
          <p>
            Data as of {monthDay(today.asOf)}
            {id === "gpr_daily" && ", preliminary for about 4 weeks"}.
          </p>
          {forecast.backtest && (
            <p>
              Backtest: made after the fact, with only the data up to {made},
              but as published later: it may have been revised since. The
              model&apos;s training cutoff is not published, so backtests may be
              optimistic.
            </p>
          )}
        </Disclosure>
      </div>
    </section>
  )
}
