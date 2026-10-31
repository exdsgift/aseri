import { useId } from "react"

import { RecordSquares } from "@/components/RecordSquares"
import { ScoreTable } from "@/components/ScoreTable"
import { daysAfter, type CatalogEntry, type ScoreRecord } from "@/lib/api"
import { monthDay } from "@/lib/format"

// How past forecasts did, per series. The live record shows once it has enough resolved
// forecasts; until then the backtest shows under it, apart and labelled, never combined.
export function TrackRecord({
  records,
  entries,
  onOpen,
}: {
  records: ScoreRecord[]
  entries: CatalogEntry[]
  onOpen: (seriesId: string, referenceDate: string) => void
}) {
  const title = useId()
  // Only the series the page has loaded, so a square can open its forecast.
  const shown = records.flatMap((record) => {
    const entry = entries.find((e) => e.series_id === record.series_id)
    return entry ? [{ record, entry }] : []
  })

  return (
    <section
      id="record"
      aria-labelledby={title}
      className="mx-auto flex max-w-[1040px] scroll-mt-4 flex-col gap-8 px-4 pb-14"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <h2
          id={title}
          className="font-display text-[48px]/none tracking-[0.04em] text-secondary"
        >
          Record
        </h2>
        <p className="max-w-[52ch] text-[8px]/[14px] text-muted-foreground uppercase">
          How past forecasts did against what happened. Pick a square to replay
          its forecast above.
        </p>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(296px,1fr))] gap-2">
        {shown.map(({ record, entry }) => (
          <RecordCard
            key={record.series_id}
            record={record}
            entry={entry}
            onOpen={(date) => onOpen(record.series_id, date)}
          />
        ))}
      </ul>
      <p className="mx-auto max-w-[72ch] text-[8px]/[14px] text-muted-foreground uppercase">
        In brackets, 95% ranges. Those of the 8 in 10 coverage assume
        independent days, which neighbouring forecasts are not: read them as too
        narrow. Error: the most likely value&apos;s mean miss over the
        baseline&apos;s. Beats only when its whole range is under 1, loses when
        over 1, ties otherwise.
      </p>
    </section>
  )
}

function RecordCard({
  record,
  entry,
  onOpen,
}: {
  record: ScoreRecord
  entry: CatalogEntry
  onOpen: (referenceDate: string) => void
}) {
  const backtest = useId()
  const { live, retrospective, min_n_to_display: needed } = record
  // The replay's oldest forecast: the pipeline keeps 120 days before the newest one.
  const replayFrom = daysAfter(entry.latest_reference_date, -120)
  const squares = (scored: ScoreRecord["live"]) => (
    <RecordSquares
      weekly={scored.weekly}
      horizonUnit={entry.horizon_unit}
      replayFrom={replayFrom}
      onOpen={onOpen}
    />
  )
  const table = (scored: ScoreRecord["live"], kind: string) => (
    <ScoreTable
      label={`${entry.title}, ${kind}`}
      buckets={scored.buckets}
      baseline={record.primary_baseline}
      horizon={entry.horizon_max}
      horizonUnit={entry.horizon_unit}
    />
  )

  return (
    <li className="flex flex-col gap-3 border-2 border-border px-2.5 pt-2 pb-2.5 text-[8px]/[12px] uppercase chip">
      <h3 className="text-secondary">{entry.title}</h3>
      {record.n >= needed ? (
        <>
          <p>
            Live record: {live.n} forecasts since {monthDay(live.since!)}
          </p>
          {squares(live)}
          {table(live, "live")}
        </>
      ) : (
        <>
          <p>
            Collecting live record:{" "}
            <b className="font-normal text-primary">{record.n}</b> of {needed}
          </p>
          {squares(live)}
          <div
            role="group"
            aria-labelledby={backtest}
            className="flex flex-col gap-2 bg-muted px-2 py-1.5"
          >
            <p id={backtest} className="text-secondary">
              Backtest, not the live record
            </p>
            {squares(retrospective)}
            {table(retrospective, "backtest")}
          </div>
        </>
      )}
    </li>
  )
}
