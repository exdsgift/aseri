import { useMemo, useRef } from "react"

import { Messenger } from "@/components/Messenger"
import { Wordmark } from "@/components/Wordmark"
import { type Today } from "@/lib/api"
import {
  dayLabel,
  formatValue,
  monthDay,
  versusBaseline,
  weekday,
} from "@/lib/format"
import { countMs, countUp, useSteps } from "@/lib/motion"

// `updated` is when the daily run last wrote the site.
export function Hero({
  today,
  updated,
  failed,
}: {
  today?: Today
  updated?: string
  failed: boolean
}) {
  const text = useRef<HTMLDivElement>(null)
  return (
    // From 224 px down: on a narrow screen, Mercury stands in the band above the wordmark.
    <section
      id="today"
      className="relative isolate flex min-h-svh flex-col items-center px-4 pt-56 pb-14 text-center text-primary uppercase"
    >
      <Messenger
        value={today?.sevenDayAverage}
        baseline={today?.baseline}
        text={text}
      />
      {/* The art keeps this column calm, so the text reads over it. As wide as the copy
          from the start, so the art never moves as the text arrives. */}
      <div
        ref={text}
        className="flex w-full max-w-[46ch] flex-col items-center gap-9"
      >
        <Wordmark />
        <p>Geopolitical risk · today</p>
        {/* GitHub pauses the schedule of an idle repository, and a run that never starts
            writes nothing: only the page can say its data is old. */}
        {updated &&
          Date.parse(updated) < new Date().getTime() - 2 * 86_400_000 && (
            <p className="caution">
              Site last updated {monthDay(updated.slice(0, 10))}: the daily
              update may have stopped.
            </p>
          )}
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
              {/* The range first, with its complement: a median alone reads as a promise. */}
              <p>
                {dayLabel(today.targetDate)}, {today.daysAhead / 7} weeks from
                the last data: 8 in 10 between {formatValue(today.low)} and{" "}
                {formatValue(today.high)}, 2 in 10 outside. Most likely{" "}
                {formatValue(today.mostLikely)}. (Last{" "}
                {weekday(today.referenceDate)}:{" "}
                {formatValue(today.referenceValue)})
              </p>
              {/* Its source revises GPR for about a month. */}
              <p className="text-muted-foreground">
                GPR runs on a weekly cycle: compare{" "}
                {weekday(today.referenceDate)} with{" "}
                {weekday(today.referenceDate)}. Data as of{" "}
                {monthDay(today.asOf)}, preliminary for about 4 weeks.
              </p>
            </div>
          </>
        )}
        {failed && (
          <p role="alert" className="caution">
            Couldn&apos;t load today&apos;s data. Refresh to try again.
          </p>
        )}
      </div>
    </section>
  )
}

// The giant number counts up on arrival, 40 ms a step. The count is drawn over the
// number's own text (`count-up` in index.css), so screen readers and copying get the real value.
function CountUp({ value }: { value: number }) {
  const shown = useMemo(() => countUp(value), [value])
  const step = useSteps(shown.length, countMs)
  return (
    <p
      className="count-up font-display text-[144px]/[108px] md:text-[192px]/[144px]"
      data-count={step === undefined ? undefined : shown[step]}
    >
      {formatValue(value)}
    </p>
  )
}
