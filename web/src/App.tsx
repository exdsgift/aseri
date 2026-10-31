import { useEffect, useRef, useState } from "react"

import { ForecastPanel } from "@/components/ForecastPanel"
import { Hero } from "@/components/Hero"
import { Signals } from "@/components/Signals"
import { TrackRecord } from "@/components/TrackRecord"
import {
  loadCatalog,
  loadScores,
  loadSeries,
  type CatalogEntry,
  type ScoreRecord,
  type Series,
} from "@/lib/api"

const gprId = "gpr_daily"

export function App() {
  // Every series of the catalog that loaded, with its entry, to load its replay from.
  const [signals, setSignals] =
    useState<{ entry: CatalogEntry; series: Series }[]>()
  const [failed, setFailed] = useState(false)
  // When the daily run last wrote the site.
  const [updated, setUpdated] = useState<string>()
  // The series in the panel. The hero stays on GPR.
  const [picked, setPicked] = useState(gprId)
  // How past forecasts did, for the record: the page goes on without it.
  const [records, setRecords] = useState<ScoreRecord[]>()
  // The past forecast a square of the record opened in the panel's replay, and a count of
  // the taps, so that a second tap on the same square opens it again.
  const [opened, setOpened] = useState<string>()
  const [taps, setTaps] = useState(0)
  const panelBox = useRef<HTMLDivElement>(null)
  // The series whose replay was asked for: GPR's comes with the page.
  const replayed = useRef(new Set([gprId]))
  const find = (id: string) => signals?.find((s) => s.series.id === id)
  const gpr = find(gprId)?.series
  const panel = find(picked)?.series

  // The cards need every series' forecast and daily values; only GPR's replay, the panel's first.
  // Each series shows as it loads, so the hero and the panel wait for GPR alone.
  useEffect(() => {
    loadCatalog()
      .then(({ generated_at, series: catalog }) => {
        setUpdated(generated_at)
        if (!catalog.some((entry) => entry.series_id === gprId))
          throw new Error("The catalog has no gpr_daily")
        for (const entry of catalog)
          loadSeries(entry, { replay: entry.series_id === gprId }).then(
            (series) => setSignals((all = []) => [...all, { entry, series }]),
            (error) => {
              console.error(error)
              // One broken series costs its card, not the page: only GPR's are vital.
              if (entry.series_id === gprId) setFailed(true)
            }
          )
      })
      .catch((error) => {
        console.error(error)
        setFailed(true)
      })
    loadScores().then(({ series }) => setRecords(series), console.error)
  }, [])

  const pick = (id: string) => {
    setPicked(id)
    setOpened(undefined)
    // Smooth unless the reader asks for less motion: see index.css.
    panelBox.current!.scrollIntoView({ block: "start" })
    const { entry } = find(id)!
    // Only today's forecast so far: the replay loads the first time the series is picked, whatever comes back.
    if (!replayed.current.has(id)) {
      replayed.current.add(id)
      loadSeries(entry, { replay: true }).then(
        (full) =>
          setSignals((all) =>
            all!.map((s) => (s.series.id === id ? { entry, series: full } : s))
          ),
        console.error
      )
    }
  }

  return (
    <main>
      <Hero today={gpr?.today} updated={updated} failed={failed} />
      {signals && panel && (
        <>
          <div ref={panelBox} className="scroll-mt-4 px-4 pb-14">
            {/* A new series dithers in. Its replay, arriving later, starts the panel again on today,
                or on the past forecast a square of the record opened. */}
            <div key={picked} className="motion-safe:animate-dither-in">
              <ForecastPanel
                key={`${panel.forecasts.length} ${opened} ${taps}`}
                series={panel}
                opened={opened}
              />
            </div>
          </div>
          <Signals
            series={signals.map((s) => s.series)}
            picked={picked}
            onPick={pick}
          />
          {records && (
            <TrackRecord
              records={records}
              entries={signals.map((s) => s.entry)}
              onOpen={(id, date) => {
                pick(id)
                setOpened(date)
                setTaps((count) => count + 1)
              }}
            />
          )}
        </>
      )}
    </main>
  )
}
