import { useId } from "react"

import { Disclosure } from "@/components/Disclosure"
import { RecordSquares } from "@/components/RecordSquares"
import { ScoreTable } from "@/components/ScoreTable"
import { daysAfter, type CatalogEntry, type ScoreRecord } from "@/lib/api"
import { recordTitle } from "@/lib/takeaways"

// A series' live record once it has enough resolved forecasts; its backtest until then.
const isLive = (record: ScoreRecord) => record.n >= record.min_n_to_display
const scoredOf = (record: ScoreRecord) =>
  isLive(record) ? record.live : record.retrospective
// The replay's oldest forecast: the pipeline keeps 120 days before the newest one.
const replayFrom = (entry: CatalogEntry) =>
  daysAfter(entry.latest_reference_date, -120)

// How past forecasts did, its verdict first: the squares of every series, counted in the title,
// and how they are scored one tap away. Backtest and live never add up in one figure: the title
// counts the live series once any has its record, the backtests while none has. Nor do two models:
// `model` is the one in the code, and a record of the model before it is counted only when every
// series shows one.
export function TrackRecord({
  model,
  records,
  entries,
  onOpen,
}: {
  model: string
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
  // After a model change, until the new model has a record to show: a file from before the label
  // scores its own model.
  const isEarlier = (record: ScoreRecord) =>
    (record.scored_model_id ?? model) !== model
  const earlier = shown.filter(({ record }) => isEarlier(record))
  const counted =
    earlier.length === shown.length
      ? shown
      : shown.filter(({ record }) => !isEarlier(record))
  const live = counted.filter(({ record }) => isLive(record))
  const collecting = counted.filter(({ record }) => !isLive(record))
  const squares = (live.length ? live : counted).flatMap(({ record }) =>
    scoredOf(record).weekly.map((week) => week.inside_80)
  )

  return (
    // Focused by R, so the next Tab goes on from here; a ring round the whole section would
    // say nothing the jump does not.
    <section
      id="record"
      tabIndex={-1}
      aria-labelledby={title}
      className="mx-auto flex max-w-[1040px] scroll-mt-[calc(16px+env(safe-area-inset-top))] flex-col gap-6 px-4 pb-20 text-[8px]/[14px] uppercase outline-none md:pb-32"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <h2
          id={title}
          className="font-display text-[48px]/none tracking-[0.04em] text-secondary normal-case"
        >
          Record
        </h2>
        <p className="max-w-[52ch] text-[12px]/[18px] text-primary">
          {recordTitle(squares, !live.length)}
        </p>
      </div>
      {collecting.length > 0 && (
        <p className="bg-muted px-2.5 py-2 text-secondary">
          Live record starts after {collecting[0].record.min_n_to_display}{" "}
          forecasts ({Math.min(...collecting.map(({ record }) => record.n))} so
          far). Until then, backtests made after the fact.
        </p>
      )}
      {earlier.length > 0 && (
        <p className="text-secondary">
          {earlier.length === shown.length
            ? "Scores of the previous model until the new one has its own."
            : "Counts the new model only. Cards marked previous model show the old one's scores."}
        </p>
      )}
      {/* The key, once, with how many should miss: 8 of 8 is no triumph, 6 of 8 no failure. */}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-secondary">
        <span className="flex items-center gap-1.5">
          <i aria-hidden className="size-2 bg-primary" /> landed in range
        </span>{" "}
        <span className="flex items-center gap-1.5">
          <i aria-hidden className="size-2 border-2 border-primary" /> missed
        </span>{" "}
        <span>
          About 2 in 10 squares should be hollow if the range is honest.
        </span>
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(296px,1fr))] gap-2">
        {shown.map(({ record, entry }) => (
          <li
            key={record.series_id}
            className="flex flex-col gap-2 border-2 border-border px-2.5 pt-2 pb-2.5 text-[8px]/[12px] chip"
          >
            <h3 className="text-secondary">
              {entry.title}
              {/* A backtest beside live records says so, and the previous model's beside the new one's. */}
              {live.length > 0 && !isLive(record) && ", backtest"}
              {earlier.length < shown.length &&
                isEarlier(record) &&
                ", previous model"}
            </h3>
            {/* The replay shows the model in the code: a square of the model before opens nothing. */}
            <RecordSquares
              name={entry.title}
              weekly={scoredOf(record).weekly}
              horizonUnit={entry.horizon_unit}
              replayFrom={replayFrom(entry)}
              onOpen={
                isEarlier(record)
                  ? undefined
                  : (date) => onOpen(record.series_id, date)
              }
            />
            {/* While it collects, the live forecasts already resolved, after the backtest's. */}
            {!isLive(record) && (
              <RecordSquares
                name={`${entry.title}, live`}
                tag="live"
                weekly={record.live.weekly}
                horizonUnit={entry.horizon_unit}
                replayFrom={replayFrom(entry)}
                onOpen={
                  isEarlier(record)
                    ? undefined
                    : (date) => onOpen(record.series_id, date)
                }
              />
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-start gap-2">
        <Disclosure label="How we score">
          {shown.map(({ record, entry }) => {
            const kind = isLive(record)
              ? `live, ${record.live.n} forecasts`
              : "backtest"
            return (
              <div key={record.series_id} className="flex flex-col gap-1">
                <p className="text-primary">
                  {entry.title}, {kind}
                </p>
                <ScoreTable
                  label={`${entry.title}, ${kind}`}
                  buckets={scoredOf(record).buckets}
                  baseline={record.primary_baseline}
                  horizon={entry.horizon_max}
                  horizonUnit={entry.horizon_unit}
                />
              </div>
            )
          })}
          <p>
            Each square is one weekly forecast, scored 7 days ahead. Misses: how
            far the middle estimate fell from what happened, on average, against
            the series&apos; own simple rule. Better or worse only when the
            whole 95% range of the comparison says so; about as good otherwise.
          </p>
          <p>
            In brackets, 95% ranges, and the ratio of the misses. Those of the
            share in range assume independent days, which neighbouring forecasts
            are not: read them as too narrow.
          </p>
          <p>
            Backtests are made after the fact, with data published later, so
            they may flatter the model.
          </p>
        </Disclosure>
      </div>
    </section>
  )
}
