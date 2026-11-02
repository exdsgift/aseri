import { useMemo, useRef } from "react"

import { Disclosure } from "@/components/Disclosure"
import { HeroArt, type Art } from "@/components/HeroArt"
import { messenger } from "@/components/Messenger"
import { Glyph } from "@/components/Pictogram"
import { signal } from "@/components/Signal"
import { vortex } from "@/components/Vortex"
import { Wordmark } from "@/components/Wordmark"
import { type Today } from "@/lib/api"
import { textWidth } from "@/lib/chart"
import {
  dayLabel,
  formatValue,
  likely,
  monthDay,
  outward,
  valueRange,
  versusBaseline,
  weekday,
} from "@/lib/format"
import { type HeroName } from "@/lib/heroes"
import { countMs, countUp, useSteps } from "@/lib/motion"
import { intervalScale } from "@/lib/replay"
import { direction } from "@/lib/takeaways"

// Each hero's art, with its engraving's credit.
export const arts: Record<HeroName, Art> = { messenger, signal, vortex }

// `hero` names the art behind the text. `updated` is when the daily run last wrote the site.
export function Hero({
  hero,
  today,
  updated,
  failed,
}: {
  hero: HeroName
  today?: Today
  updated?: string
  failed: boolean
}) {
  const text = useRef<HTMLDivElement>(null)
  return (
    // From 224 px down: on a narrow screen, the art stands in the band above the wordmark.
    <section
      id="today"
      data-hero={hero}
      className="relative isolate flex min-h-svh flex-col items-center px-4 pt-56 pb-14 text-center text-primary uppercase"
    >
      {/* Another hero arrives afresh, and loads only its own engraving. */}
      <HeroArt
        key={hero}
        art={arts[hero]}
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
        <p>Geopolitical risk</p>
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
            <div className="flex w-full max-w-[46ch] flex-col items-center gap-[18px] text-balance">
              {/* The number is an average, and the data lags: say both. */}
              <p className="-mt-6">
                {versusBaseline(today.sevenDayAverage, today.baseline)}{" "}
                <span className="whitespace-nowrap text-muted-foreground">
                  · 7-day average to {monthDay(today.referenceDate)}
                </span>
              </p>
              {/* One day against the same weekday, never against the average above: the direction
                  reads off the chance that day lands above the last one. The range carries its
                  "8 in 10" here, the one headline that defines it in words. */}
              <p>
                {monthDay(today.targetDate)}:{" "}
                {likely(...outward(today.low, today.high))} (8 in 10),{" "}
                {direction(today.chanceAbove)}
              </p>
              <RangeBar today={today} />
              <Disclosure label="About this data">
                <p>
                  GPR runs on a weekly cycle: compare{" "}
                  {weekday(today.referenceDate)} with{" "}
                  {weekday(today.referenceDate)}.
                </p>
                <p>
                  The big number averages the 7 days to{" "}
                  {monthDay(today.referenceDate)}. The outlook is for one day,{" "}
                  {dayLabel(today.targetDate)}, against the last{" "}
                  {weekday(today.referenceDate)},{" "}
                  {formatValue(today.referenceValue)}.
                </p>
                {/* Its source revises GPR for about a month. */}
                <p>
                  Normal: {today.baselineLabel}, {formatValue(today.baseline)}.
                  Data as of {monthDay(today.asOf)}, preliminary for about 4
                  weeks.
                </p>
              </Disclosure>
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

// The outlook drawn: the target day's range in the chart's dither, its middle half denser, on one
// value scale with a tick at normal and a marker on the like-for-like day, each with its value.
// The bar shows what no sentence says: where normal sits against the whole range.
function RangeBar({ today }: { today: Today }) {
  const { low, high, middleHalf, baseline, referenceValue } = today
  const scale = intervalScale([baseline, low, high, referenceValue])
  const at = (value: number) => `${scale.at(value)}%`
  const span = ([from, to]: number[]) => ({
    left: at(from),
    width: `${scale.at(to) - scale.at(from)}%`,
  })
  // A label on its mark, kept inside the bar: from the mark near the left end, up to it near the
  // right end, centred on it between.
  const on = (value: number) => ({
    left: at(value),
    translate:
      scale.at(value) < 25
        ? "-1px"
        : scale.at(value) > 75
          ? "calc(1px - 100%)"
          : "-50%",
  })
  const said = `Last ${weekday(today.referenceDate)} ${formatValue(referenceValue)}`
  // The ends' labels, each 4 px inside its edge, need their widths and a gap between them on the
  // bar's 320 px. shortcut: reads the bar at its full 320 px; measure it if a phone under 352 px
  // ever shows the two labels touching.
  const ends = [formatValue(low), formatValue(high)]
  const apart =
    ((scale.at(high) - scale.at(low)) / 100) * 320 >=
    textWidth(ends[0]) + textWidth(ends[1]) + 16
  return (
    <div
      role="img"
      aria-label={`${monthDay(today.targetDate)}: ${likely(low, high)}, normal ${formatValue(baseline)}, ${said}`}
      className="relative h-[68px] w-full max-w-[320px] text-[8px]/[12px] whitespace-nowrap"
    >
      <span className="absolute top-0 text-primary" style={on(referenceValue)}>
        {said}
      </span>
      <span
        className="absolute top-3.5 flex -translate-x-1/2 text-primary"
        style={{ left: at(referenceValue) }}
      >
        <Glyph name="down" spaced={false} />
      </span>
      <i
        className="absolute top-[22px] h-4 border-x-2 border-dim dither-25"
        style={span([low, high])}
      />
      <i
        className="absolute top-[22px] h-4 dither-50"
        style={span(middleHalf)}
      />
      <i
        className="absolute top-[18px] -ml-px h-[38px] w-0.5 bg-secondary"
        style={{ left: at(baseline) }}
      />
      {apart ? (
        <>
          <span className="absolute top-[42px] ml-1" style={{ left: at(low) }}>
            {ends[0]}
          </span>
          <span
            className="absolute top-[42px] -ml-1 -translate-x-full"
            style={{ left: at(high) }}
          >
            {ends[1]}
          </span>
        </>
      ) : (
        // Too narrow for two: once, centred under the range.
        <span className="absolute top-[42px]" style={on((low + high) / 2)}>
          {valueRange(low, high)}
        </span>
      )}
      <span className="absolute top-14 text-secondary" style={on(baseline)}>
        normal {formatValue(baseline)}
      </span>
    </div>
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
