import { useId } from "react"

import { type ScoreRecord } from "@/lib/api"
import { monthDay } from "@/lib/format"

// The last weekly forecasts at 7 days ahead, oldest first: a square each, green when the
// real value landed inside its 8 in 10 range, red when not. A tap opens it in the replay.
export function RecordSquares({
  weekly,
  onOpen,
}: {
  weekly: ScoreRecord["live"]["weekly"]
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
        {weekly.map(({ reference_date, inside_80 }) => (
          <li key={reference_date} className="flex">
            <button
              type="button"
              aria-label={`${monthDay(reference_date)}: ${inside_80 ? "inside" : "outside"} its 8 in 10 range 7 days ahead. Open it in the replay`}
              onClick={() => onOpen(reference_date)}
              className={`size-6 cursor-pointer ${inside_80 ? "bg-inside" : "bg-destructive"} hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors motion-safe:duration-160`}
            />
          </li>
        ))}
      </ul>
      {/* In words too, so the record never rests on colour alone. */}
      <p>
        {inside} of {weekly.length} inside the 8 in 10 range
      </p>
    </div>
  )
}
