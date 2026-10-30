import { useMemo } from "react"

import { Sun } from "@/components/Sun"
import { Wordmark } from "@/components/Wordmark"
import { type GprToday } from "@/lib/api"
import {
  dayLabel,
  formatValue,
  monthDay,
  versusBaseline,
  weekday,
} from "@/lib/format"
import { countUp, useSteps } from "@/lib/motion"
import { sunRadius } from "@/lib/sun"

export function Hero({ today, failed }: { today?: GprToday; failed: boolean }) {
  return (
    // From 224 px down, as in the prototype: the wordmark sits under the sun.
    <section className="relative isolate flex min-h-svh flex-col items-center gap-9 px-4 pt-56 pb-14 text-center text-primary uppercase">
      <Sun radius={today && sunRadius(today.sevenDayAverage, today.baseline)} />
      <Wordmark />
      <p>Geopolitical risk · today</p>
      {today && (
        <>
          <CountUp value={today.sevenDayAverage} />
          <div className="flex max-w-[46ch] flex-col gap-[18px] text-balance">
            {/* The number is an average, and the data lags: say both. */}
            <p className="-mt-6 text-muted-foreground">
              7-day average to {monthDay(today.referenceDate)}
            </p>
            <p>
              {versusBaseline(today.sevenDayAverage, today.baseline)}{" "}
              <span className="whitespace-nowrap">{today.baselineLabel}</span>
            </p>
            <p>
              {dayLabel(today.targetDate)}, {today.weeksAhead} weeks from the
              last data: most likely {formatValue(today.mostLikely)}. 8 in 10
              between {formatValue(today.low)} and {formatValue(today.high)}.
              (Last {weekday(today.referenceDate)}:{" "}
              {formatValue(today.referenceValue)})
            </p>
          </div>
        </>
      )}
      {failed && (
        <p role="alert" className="text-destructive">
          Couldn&apos;t load today&apos;s data. Refresh to try again.
        </p>
      )}
    </section>
  )
}

// The giant number counts up on arrival, 40 ms a step. The count is drawn over the
// number's own text (`count-up` in index.css), so screen readers and copying get the real value.
function CountUp({ value }: { value: number }) {
  const shown = useMemo(() => countUp(value), [value])
  const step = useSteps(shown.length, 40)
  return (
    <p
      className="count-up font-display text-[144px]/[108px] md:text-[192px]/[144px]"
      data-count={step === undefined ? undefined : shown[step]}
    >
      {formatValue(value)}
    </p>
  )
}
