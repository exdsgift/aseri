import { useId, useState } from "react"

import { Intervals } from "@/components/Intervals"
import { PixelForecastChart } from "@/components/PixelForecastChart"
import { ReplaySlider } from "@/components/ReplaySlider"
import { type Gpr } from "@/lib/api"
import { formatValue, monthDay } from "@/lib/format"
import { insideSoFar, stepRows, yearRange } from "@/lib/replay"

const legend = [
  ["Daily value", "h-0.5 w-4 bg-primary"],
  ["7-day average", "h-0.5 w-4 bg-muted-foreground"],
  ["What happened", "size-1 bg-white"],
  ["Most likely", "h-0.5 w-4 bg-gold-pale"],
  ["5 in 10", "h-2.5 w-4 dither-50"],
  ["8 in 10", "h-2.5 w-4 dither-25"],
  ["Forecast made", "h-3 border-l-2 border-dotted border-focus"],
]

// A game sheet: today's forecast or a past one from the replay, its pixel chart,
// its intervals and where the data comes from.
export function ForecastPanel({ gpr }: { gpr: Gpr }) {
  const title = useId()
  const { forecasts, steps, today } = gpr
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

  return (
    <section
      aria-labelledby={title}
      className="mx-auto flex max-w-[720px] flex-col gap-3 border-2 border-border px-3 pt-2 pb-3 text-[8px]/[12px] uppercase chip"
    >
      <div className="flex flex-wrap justify-between gap-2 border-b-2 border-border pb-2 text-key">
        {/* As long today as in replay, so it wraps the same way on a phone. */}
        <h2 id={title}>
          [F] {forecast.series} ·{" "}
          {live
            ? "forecast made today"
            : `${forecast.backtest ? "backtest from" : "forecast made"} ${made}`}
        </h2>
        <p>
          {forecast.unit} · data to {dataTo}
        </p>
      </div>
      {/* The same lines whatever the day, each short enough not to wrap on a 360 px phone,
          so that the chart and the slider never move under a finger dragging the replay. */}
      {/* Not a live region: re-read on every slider step, it would pile up announcements;
          the slider itself announces the day. */}
      <div data-testid="readout" className="flex flex-col gap-1.5">
        <p>
          {target}: most likely{" "}
          <b className="font-normal text-gold-pale">{at("0.5")}</b>
          <span className="max-[480px]:hidden"> ·</span>{" "}
          <span className="max-[480px]:block">
            8 in 10:{" "}
            <b className="font-normal text-gold-pale">
              {at("0.1")}-{at("0.9")}
            </b>
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
        summary={`${forecast.series}: daily values, ${lastValue} on ${made} (7-day average ${average}), then the ${forecast.backtest ? "backtest" : "forecast"} of the daily value to ${target}: most likely ${at("0.5")}, 8 in 10 between ${at("0.1")} and ${at("0.9")}.${sofar.of ? ` In white, what happened: ${sofar.inside} of ${sofar.of} days inside.` : ""}`}
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-muted-foreground">
        {legend.map(([name, swatch]) => (
          <li key={name} className="flex items-center gap-2">
            <span aria-hidden className={swatch} />
            {name}
          </li>
        ))}
      </ul>
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
        Source: {forecast.attribution}
        {forecast.backtest &&
          ` Backtest: made after the fact, with only the data up to ${made}, but as published later: it may have been revised since. The model's training cutoff is not published, so backtests may be optimistic.`}
      </p>
    </section>
  )
}
