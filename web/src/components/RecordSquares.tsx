import { type ScoreRecord } from "@/lib/api"
import { daysAhead, monthDay } from "@/lib/format"

// The last weekly forecasts at 7 days ahead, oldest first: a square each, filled when what
// happened landed in its range, hollow when it missed. A tap opens it in the replay, which holds
// the forecasts from `replayFrom` on: an older square is drawn without a link, as is every square
// without `onOpen`, a record of a model the replay does not show. A `tag` ("live")
// sets a second group apart, before its squares, and gives it no count: one figure never adds
// the two up.
export function RecordSquares({
  name,
  tag,
  weekly,
  horizonUnit,
  replayFrom,
  onOpen,
}: {
  name: string
  tag?: string
  weekly: ScoreRecord["live"]["weekly"]
  // Brent's steps are trading days: its squares are 7 trading days ahead.
  horizonUnit: string
  replayFrom: string
  onOpen?: (referenceDate: string) => void
}) {
  if (!weekly.length) return null
  const inside = weekly.filter((forecast) => forecast.inside_80).length
  const ahead = `${daysAhead(7, horizonUnit)} ahead`
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {tag && <span className="text-secondary">{tag}</span>}
      <ul
        aria-label={`${name}: the last ${weekly.length} weekly forecasts, ${ahead}`}
        className="flex flex-wrap gap-1"
      >
        {weekly.map(({ reference_date, inside_80 }) => {
          const said = `${monthDay(reference_date)}: ${inside_80 ? "landed in range" : "missed"} ${ahead}`
          // A hover adds only an outline, so a hollow square never fills.
          const shape = inside_80 ? "bg-primary" : "border-2 border-primary"
          return (
            <li key={reference_date} className="flex">
              {!onOpen || reference_date < replayFrom ? (
                <span
                  role="img"
                  aria-label={
                    onOpen ? `${said}, no longer in the replay` : said
                  }
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
      {!tag && (
        <p>
          {inside} of {weekly.length} in range
        </p>
      )}
    </div>
  )
}
