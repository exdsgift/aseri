import { useId, type ReactNode } from "react"

import { type Forecast } from "@/lib/api"
import { valueTicks } from "@/lib/chart"
import { daysAhead, formatValue, monthDay } from "@/lib/format"
import { intervalScale, stepRows } from "@/lib/replay"

// How sure the model is: the day the forecast was made, then each step ahead, as text
// and as lanes on one value scale, with the 1-year range (cut at the lanes' edges) and the
// baseline behind them.
export function Intervals({
  forecast,
  today,
  steps,
  horizonUnit,
  year,
  baseline,
  baselineLabel,
}: {
  forecast: Forecast
  today: boolean
  steps: number[]
  horizonUnit: string
  year: number[]
  baseline: number
  baselineLabel: string
}) {
  const title = useId()
  const rows = stepRows(forecast, steps)
  const thatDay = forecast.values.at(-1)!
  // Real values too: one pinned to the edge would hide how far outside the range it fell.
  // Not the year: a spike in it (Wikipedia's 171,260 views) would squash every range to a sliver.
  const scale = intervalScale([
    baseline,
    thatDay,
    ...rows.flatMap((row) => [
      ...row.eightInTen,
      ...(row.real === undefined ? [] : [row.real]),
    ]),
  ])
  const at = (value: number) => `${scale.at(value)}%`
  const span = ([low, high]: number[]) => ({
    left: at(low),
    width: `${scale.at(high) - scale.at(low)}%`,
  })
  // A 2 px mark centred on its value.
  const mark = "absolute top-0 -ml-px h-4 w-0.5"
  // The year's thin line stops at the lane's edge, with an arrowhead where it runs on past it.
  const runsOn = (side: "low" | "high") => (
    <i
      data-runs-on={side}
      className={`absolute top-[5px] border-y-[3px] border-y-transparent ${side === "low" ? "left-0 border-r-4 border-r-border" : "right-0 border-l-4 border-l-border"}`}
    />
  )
  const lane = (marks: ReactNode) => (
    <div aria-hidden className="relative h-4">
      <i className="absolute top-[7px] h-0.5 bg-border" style={span(year)} />
      {year[0] < scale.lo && runsOn("low")}
      {year[1] > scale.hi && runsOn("high")}
      <i className={`${mark} bg-secondary`} style={{ left: at(baseline) }} />
      <i
        className="absolute top-0 -ml-px h-4 border-l-2 border-dotted border-focus"
        style={{ left: at(thatDay) }}
      />
      {marks}
    </div>
  )
  const ticks = valueTicks(scale.lo, scale.hi, 4).filter(
    (tick) => scale.at(tick) > 5 && scale.at(tick) < 95
  )

  return (
    <div className="flex flex-col gap-1.5 border-t-2 border-border pt-2.5">
      <p id={title} className="text-key">
        [I] Intervals · how sure the model is
      </p>
      <ol aria-labelledby={title} className="flex flex-col gap-1.5">
        <li className="flex flex-col gap-1.5 bg-muted px-2 py-1.5">
          <p className="flex items-baseline justify-between gap-2 text-muted-foreground">
            <span>
              {today ? "Today" : "Forecast made"} ·{" "}
              {monthDay(forecast.dates.at(-1)!)} · that day
            </span>{" "}
            <b className="text-[12px] font-normal text-primary">
              {formatValue(thatDay)}
            </b>
          </p>
          {lane(
            <i
              className="absolute top-[3px] -ml-[5px] size-2.5 bg-primary"
              style={{ left: at(thatDay) }}
            />
          )}
        </li>
        {rows.map((row) => (
          <li
            key={row.step}
            className="flex flex-col gap-1.5 bg-muted px-2 py-1.5"
          >
            <p className="text-muted-foreground">
              In {daysAhead(row.step, horizonUnit)} · {monthDay(row.date)}
            </p>
            {/* The ranges first: a median alone reads as a promise. */}
            <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span>
                5 in 10: {formatValue(row.fiveInTen[0])}-
                {formatValue(row.fiveInTen[1])}
              </span>{" "}
              <span>
                8 in 10: {formatValue(row.eightInTen[0])}-
                {formatValue(row.eightInTen[1])}
              </span>{" "}
              <span>
                most likely{" "}
                <b className="text-[12px] font-normal text-gold-pale">
                  {formatValue(row.mostLikely)}
                </b>
              </span>
              {row.real !== undefined && (
                <>
                  {" "}
                  <span
                    className={row.inside ? "text-inside" : "text-destructive"}
                  >
                    Real {formatValue(row.real)} ·{" "}
                    {row.inside ? "inside" : "outside"}
                  </span>
                </>
              )}
            </p>
            {lane(
              <>
                <i
                  className="absolute top-0.5 h-3 border-x-2 border-secondary dither-25"
                  style={span(row.eightInTen)}
                />
                <i
                  className="absolute top-0.5 h-3 dither-50"
                  style={span(row.fiveInTen)}
                />
                <i
                  className={`${mark} bg-gold-pale`}
                  style={{ left: at(row.mostLikely) }}
                />
                {row.real !== undefined && (
                  <i
                    className={`${mark} bg-white`}
                    style={{ left: at(row.real) }}
                  />
                )}
              </>
            )}
          </li>
        ))}
      </ol>
      {/* Inset like the lanes, so each value sits over its place on them. */}
      <div aria-hidden className="relative mx-2 h-7 text-muted-foreground">
        {ticks.map((tick) => (
          <span
            key={tick}
            className="absolute top-0 -translate-x-1/2"
            style={{ left: at(tick) }}
          >
            {formatValue(tick)}
          </span>
        ))}
        {/* The catalog's label follows a value: "its 1985-2019 average". It ends on a
            baseline in the right half, which can end the scale, so it stays in the panel. */}
        <span
          className={`absolute top-4 whitespace-nowrap text-secondary ${scale.at(baseline) > 50 ? "-translate-x-full" : ""}`}
          style={{ left: at(baseline) }}
        >
          {baselineLabel.replace(/^its /, "")}
        </span>
      </div>
      <p className="text-muted-foreground">
        Thin line: the 1-year range of the daily value, {formatValue(year[0])}{" "}
        to {formatValue(year[1])}. Dotted: the day the forecast was made.
      </p>
    </div>
  )
}
