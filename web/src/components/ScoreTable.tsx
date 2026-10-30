import { type Bucket } from "@/lib/api"

// The baselines as the page names them, by the pipeline's keys.
const baselines: Record<string, string> = {
  naive: "last value",
  snaive7: "same weekday a week back",
  mean28: "28-day mean",
}
const percent = (share: number) => Math.round(share * 100)
const ratio = (value: number | null) =>
  value === null ? "-" : value.toFixed(2)
const cell = "py-1 pr-2 align-top font-normal"

// A row per bucket of days ahead: how many forecasts resolved, how often the 8 in 10 range
// held the real value, and the most likely value's error against the series' baseline.
export function ScoreTable({
  label,
  buckets,
  baseline,
  horizon,
}: {
  label: string
  buckets: Record<string, Bucket>
  baseline: string
  horizon: number
}) {
  return (
    <table aria-label={label} className="w-full text-left">
      <thead className="text-muted-foreground">
        <tr>
          <th scope="col" className={cell}>
            Days ahead
          </th>
          <th scope="col" className={cell}>
            Forecasts
          </th>
          <th scope="col" className={cell}>
            Inside the 8 in 10 range
          </th>
          <th scope="col" className={cell}>
            Error vs {baselines[baseline]}
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
                    {percent(held.rate)}% ({percent(held.ci[0])}-
                    {percent(held.ci[1])})
                  </td>
                  <td className={cell}>
                    {versus.verdict === null ? (
                      // A baseline with no error leaves no ratio to read.
                      "-"
                    ) : (
                      <>
                        {versus.verdict} {ratio(versus.ratio)} (
                        {ratio(versus.ci[0])}-{ratio(versus.ci[1])})
                      </>
                    )}
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
