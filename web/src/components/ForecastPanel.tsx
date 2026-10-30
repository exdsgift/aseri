import { useEffect, useId, useRef, useState } from "react"

import { Intervals } from "@/components/Intervals"
import { PixelForecastChart } from "@/components/PixelForecastChart"
import { ReplaySlider } from "@/components/ReplaySlider"
import { type Series } from "@/lib/api"
import { formatValue, monthDay } from "@/lib/format"
import { tickWhileShown, useReducedMotion } from "@/lib/motion"
import { path } from "@/lib/paths"
import { insideSoFar, stepRows, yearRange } from "@/lib/replay"

const legend = [
  ["Daily value", "h-0.5 w-4 bg-primary"],
  ["7-day average", "h-0.5 w-4 bg-muted-foreground"],
  ["What happened", "size-1 bg-white"],
  ["8 in 10", "h-2.5 w-4 dither-25"],
  ["5 in 10", "h-2.5 w-4 dither-50"],
  ["One possible path", "h-0.5 w-4 bg-gold-pale"],
  ["Forecast made", "h-3 border-l-2 border-dotted border-focus"],
]

// The chart draws one of these at a time, never several: overlapping paths read as nothing.
const paths = 20

// Flat blocks that turn white on hover, like Back to today.
const control =
  "cursor-pointer bg-secondary px-2 py-1.5 text-background uppercase hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors motion-safe:duration-160"

// A game sheet: today's forecast or a past one from the replay, its pixel chart,
// its intervals and where the data comes from.
export function ForecastPanel({ series }: { series: Series }) {
  const title = useId()
  const { id, forecasts, steps, today, staleSince, madeOn, note, rho } = series
  // UTC, like every date the pipeline writes.
  const madeToday = madeOn === new Date().toISOString().slice(0, 10)
  const last = forecasts.length - 1
  const [shown, setShown] = useState(last)
  const forecast = forecasts[shown]
  const live = shown === last
  const end = forecast.targetDates.length - 1
  const at = (level: string) => formatValue(forecast.quantiles[level][end])
  const target = monthDay(forecast.targetDates[end])
  const made = monthDay(forecast.dates.at(-1)!)
  const dataTo = monthDay(forecasts[last].dates.at(-1)!)
  const lastValue = formatValue(forecast.values.at(-1)!)
  const average = formatValue(forecast.averages.at(-1)!)
  // The target day is the hero's step, the last one.
  const [targetDay] = stepRows(forecast, [end + 1])
  const sofar = insideSoFar(forecast)
  // Which possible path the chart draws, the next one every 1.2 s: none turns under reduced
  // motion, nor while nobody can see the panel.
  const [drawn, setDrawn] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduced = useReducedMotion()
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    if (reduced || paused) return
    return tickWhileShown(panel.current!, 1200, () =>
      setDrawn((k) => (k + 1) % paths)
    )
  }, [reduced, paused])

  return (
    <section
      ref={panel}
      aria-labelledby={title}
      className="mx-auto flex max-w-[720px] flex-col gap-3 border-2 border-border px-3 pt-2 pb-3 text-[8px]/[12px] uppercase chip"
    >
      <div className="flex flex-wrap justify-between gap-2 border-b-2 border-border pb-2 text-key">
        {/* As long today as in replay, so it wraps the same way on a phone. */}
        <h2 id={title}>
          [F] {forecast.series} ·{" "}
          {live
            ? `forecast made ${madeToday ? "today" : monthDay(madeOn)}`
            : `${forecast.backtest ? "backtest from" : "forecast made"} ${made}`}
        </h2>
        <p>
          {forecast.unit} ·{" "}
          {/* Said in words too, so the warning never rests on colour alone. */}
          <span className={staleSince ? "text-destructive" : undefined}>
            data to {dataTo}
            {staleSince && `, stale since ${monthDay(staleSince)}`}
          </span>
        </p>
      </div>
      {/* The real values of a replay are as read that day; GPR's source revises its last month.
          shortcut: GPR's notes key on its id; read catalog flags (revised, weekly) once #133 adds
          Wikipedia views, which follow the week. */}
      <p className="text-muted-foreground">
        Data as of {monthDay(today.asOf)}
        {id === "gpr_daily" && ", preliminary for about 4 weeks"}.
      </p>
      {/* Such as Taiwan's tracking dropouts, or a newest value under review. */}
      {note && <p className="text-key">Note: {note}</p>}
      {/* The same lines whatever the day, each short enough not to wrap on a 360 px phone,
          so that the chart and the slider never move under a finger dragging the replay. */}
      {/* Not a live region: re-read on every slider step, it would pile up announcements;
          the slider itself announces the day. */}
      <div data-testid="readout" className="flex flex-col gap-1.5">
        {/* The range first: a median alone reads as a promise. */}
        <p>
          {target} · 8 in 10:{" "}
          <b className="font-normal text-gold-pale">
            {at("0.1")}-{at("0.9")}
          </b>
          <span className="max-[480px]:hidden"> ·</span>{" "}
          <span className="max-[480px]:block">
            most likely{" "}
            <b className="font-normal text-gold-pale">{at("0.5")}</b>
          </span>
        </p>
        <p>
          {targetDay.real === undefined ? (
            `Real value on ${target}: not known yet`
          ) : (
            <>
              Real value:{" "}
              <b className="font-normal text-white">
                {formatValue(targetDay.real)}
              </b>{" "}
              ·{" "}
              <span
                className={
                  targetDay.inside ? "text-inside" : "text-destructive"
                }
              >
                {targetDay.inside ? "inside" : "outside"} the range
              </span>
            </>
          )}
        </p>
        <p>
          {sofar.of === 0 ? (
            "Scored as each real value comes in"
          ) : (
            <>
              So far{" "}
              <b className="font-normal text-primary">
                {sofar.inside} of {sofar.of}
              </b>{" "}
              {sofar.of === 1 ? "day" : "days"} inside the range
            </>
          )}
        </p>
      </div>
      <PixelForecastChart
        forecast={forecast}
        path={path(forecast, rho, drawn)}
        summary={`${forecast.series}: daily values, ${lastValue} on ${made} (7-day average ${average}), then the ${forecast.backtest ? "backtest" : "forecast"} of the daily value to ${target}: 8 in 10 between ${at("0.1")} and ${at("0.9")}, most likely ${at("0.5")}.${sofar.of ? ` What happened: ${sofar.inside} of ${sofar.of} days inside.` : ""}`}
      />
      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
        {!reduced && (
          <button
            type="button"
            onClick={() => setPaused(!paused)}
            // As wide as either word, so the controls after it never move.
            className={`min-w-14 ${control}`}
          >
            {paused ? "Play" : "Pause"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setDrawn((k) => (k + 1) % paths)}
          className={control}
        >
          Another path
        </button>
        <span>{`Possible path ${drawn + 1} of ${paths}`}</span>
      </div>
      {/* A path drawn from the forecast reads like data: the words keep it from reading as the forecast. */}
      <p className="text-muted-foreground">
        The line ahead is one possible path, not the forecast: no one knows
        which days turn out high.
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-muted-foreground">
        {legend.map(([name, swatch]) => (
          <li key={name} className="flex items-center gap-2">
            <span aria-hidden className={swatch} />
            {name}
          </li>
        ))}
      </ul>
      {/* Text, not the legend, prevents the known misreadings of a band: a high and a low,
          a swing, a weekly dip taken for a fall. The same whatever the day, so that the
          slider under it never moves during a replay. Only GPR has a weekly cycle (lag-7
          autocorrelation 0.62); the sea lanes have none. */}
      <p className="text-muted-foreground">
        The 8 in 10 band: where the daily value should land 8 days in 10,
        outside it about 2 in 10. Not a high and a low, nor volatility: it
        widens because later days are harder to call.
        {id === "gpr_daily" &&
          " Daily values can follow the week: compare a day with the same weekday."}
      </p>
      {last > 0 && (
        <ReplaySlider forecasts={forecasts} shown={shown} setShown={setShown} />
      )}
      <Intervals
        forecast={forecast}
        today={live}
        steps={steps}
        year={yearRange(forecasts[last].values)}
        baseline={today.baseline}
        baselineLabel={today.baselineLabel}
      />
      {/* The URLs in it are longer than a phone is wide. */}
      <p className="wrap-anywhere text-muted-foreground">
        {/^Sources?:/.test(forecast.attribution) ? "" : "Source: "}
        {forecast.attribution}
        {forecast.backtest &&
          ` Backtest: made after the fact, with only the data up to ${made}, but as published later: it may have been revised since. The model's training cutoff is not published, so backtests may be optimistic.`}
      </p>
    </section>
  )
}
