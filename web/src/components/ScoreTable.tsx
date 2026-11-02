import { type Bucket } from "@/lib/api"
import { dayWord } from "@/lib/format"
import { coverage, skill } from "@/lib/takeaways"

const percent = (share: number) => Math.round(share * 100)
const ratio = (value: number | null) =>
  value === null ? "-" : value.toFixed(2)
const cell = "py-1 pr-2 align-top font-normal"

// Ten blocks, filled for each tenth of the days that landed in range, with a tick after the 8th:
// "78% · aim 80%" as a picture before it is a number. For the eye: the cell says it.
function Tenths({ rate }: { rate: number }) {
  return (
    <span
      aria-hidden
      className="mr-1.5 inline-flex items-center gap-0.5 align-middle"
    >
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="contents">
          {i === 8 && <i className="mx-px h-3.5 w-0.5 bg-secondary" />}
          <i
            className={`size-2 ${i < Math.round(rate * 10) ? "bg-primary" : "border-2 border-primary"}`}
          />
        </span>
      ))}
    </span>
  )
}

// A row per bucket of days ahead: how many forecasts resolved, how often the range held what
// happened, and the middle estimate's misses against the series' own simple rule, in words, with
// the 95% ranges in brackets.
export function ScoreTable({
  label,
  buckets,
  baseline,
  horizon,
  horizonUnit,
}: {
  label: string
  buckets: Record<string, Bucket>
  baseline: string
  horizon: number
  // Brent's buckets count trading days.
  horizonUnit: string
}) {
  return (
    <table aria-label={label} className="w-full text-left">
      <thead className="text-muted-foreground">
        <tr>
          <th scope="col" className={cell}>
            {`${dayWord(horizonUnit)} ahead`.replace(/^./, (c) =>
              c.toUpperCase()
            )}
          </th>
          <th scope="col" className={cell}>
            Forecasts
          </th>
          <th scope="col" className={cell}>
            In range
          </th>
          <th scope="col" className={cell}>
            Misses
          </th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(buckets).map(([name, bucket]) => {
          const [first, last] = name.split("-").map(Number)
          const held = bucket.coverage_80
          const versus = bucket.ae_median?.vs[baseline]
          return (
            <tr key={name}>
              {/* A 14-day series' longer bucket ends on its 14th day. */}
              <th scope="row" className={cell}>
                {first}-{Math.min(last, horizon)}
              </th>
              {bucket.n && held && versus ? (
                <>
                  <td className={cell}>{bucket.n}</td>
                  <td className={cell}>
                    <Tenths rate={held.rate} />
                    {coverage(held.rate)} ({percent(held.ci[0])}-
                    {percent(held.ci[1])})
                  </td>
                  <td className={cell}>
                    {skill(versus, baseline)}
                    {/* A baseline with no error leaves no ratio to read. */}
                    {versus.verdict !== null &&
                      ` (${ratio(versus.ratio)}, ${ratio(versus.ci[0])}-${ratio(versus.ci[1])})`}
                  </td>
                </>
              ) : (
                <td colSpan={3} className={`${cell} text-muted-foreground`}>
                  None resolved yet
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
