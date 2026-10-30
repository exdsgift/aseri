import { useEffect, useState } from "react"

import { Wordmark } from "@/components/Wordmark"
import { loadGprToday, type GprToday } from "@/lib/api"
import { dayLabel, formatValue, versusBaseline, weekday } from "@/lib/format"

export function Hero() {
  const [today, setToday] = useState<GprToday>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    loadGprToday().then(setToday, (error) => {
      console.error(error)
      setFailed(true)
    })
  }, [])

  return (
    <section className="flex min-h-svh flex-col items-center justify-center gap-9 px-4 py-14 text-center text-primary uppercase">
      <Wordmark />
      <p>Geopolitical risk · today</p>
      {today && (
        <>
          <p className="font-display text-[144px]/[108px] md:text-[192px]/[144px]">
            {formatValue(today.sevenDayAverage)}
          </p>
          <div className="flex max-w-[46ch] flex-col gap-[18px] text-balance">
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
