import { useId } from "react"

import { type ScoreRecord } from "@/lib/api"
import { monthDay } from "@/lib/format"

// The last weekly forecasts at 7 days ahead, oldest first: a square each, filled when the
// real value landed inside its 8 in 10 range, hollow when not. A tap opens it in the replay,
// which holds the forecasts from `replayFrom` on: an older square is drawn without a link.
export function RecordSquares({
  weekly,
  replayFrom,
  onOpen,
}: {
  weekly: ScoreRecord["live"]["weekly"]
  replayFrom: string
  onOpen: (referenceDate: string) => void
}) {
  const title = useId()
  if (!weekly.length) return null
  const inside = weekly.filter((forecast) => forecast.inside_80).length
  return (
    <div className="flex flex-col gap-1.5">
      <p id={title} className="text-muted-foreground">
        Last {weekly.length} weekly forecasts, 7 days ahead
      </p>
      <ul aria-labelledby={title} className="flex flex-wrap gap-1">
        {weekly.map(({ reference_date, inside_80 }) => {
          const said = `${monthDay(reference_date)}: ${inside_80 ? "inside" : "outside"} its 8 in 10 range 7 days ahead`
          // A hover adds only an outline, so a hollow square never fills.
          const shape = inside_80 ? "bg-primary" : "border-2 border-primary"
          return (
            <li key={reference_date} className="flex">
              {reference_date < replayFrom ? (
                <span
                  role="img"
                  aria-label={`${said}, no longer in the replay`}
                  className={`size-6 ${shape}`}
                />
              ) : (
                <button
                  type="button"
                  aria-label={`${said}. Open it in the replay`}
                  onClick={() => onOpen(reference_date)}
                  className={`size-6 cursor-pointer ${shape} hover:outline-2 hover:outline-offset-1 hover:outline-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors motion-safe:duration-160`}
                />
              )}
            </li>
          )
        })}
      </ul>
      {/* In words too, so the record never rests on the squares alone. */}
      <p>
        {inside} of {weekly.length} inside the 8 in 10 range
      </p>
    </div>
  )
}
