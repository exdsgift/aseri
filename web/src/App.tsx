import { useEffect, useRef, useState } from "react"

import { ForecastPanel } from "@/components/ForecastPanel"
import { Hero } from "@/components/Hero"
import { Signals } from "@/components/Signals"
import {
  loadCatalog,
  loadSeries,
  type CatalogEntry,
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
  const panelBox = useRef<HTMLDivElement>(null)
  const find = (id: string) => signals?.find((s) => s.series.id === id)
  const gpr = find(gprId)?.series
  const panel = find(picked)?.series

  // The cards need every series' forecast and daily values; only GPR's replay, the panel's first.
  useEffect(() => {
    loadCatalog()
      .then(async ({ generated_at, series: catalog }) => {
        setUpdated(generated_at)
        if (!catalog.some((entry) => entry.series_id === gprId))
          throw new Error("The catalog has no gpr_daily")
        const loaded = await Promise.all(
          catalog.map((entry) =>
            loadSeries(entry, { replay: entry.series_id === gprId }).then(
              (series) => [{ entry, series }],
              (error) => {
                // One broken series costs its card, not the page: only GPR's are vital.
                if (entry.series_id === gprId) throw error
                console.error(error)
                return []
              }
            )
          )
        )
        setSignals(loaded.flat())
      })
      .catch((error) => {
        console.error(error)
        setFailed(true)
      })
  }, [])

  const pick = (id: string) => {
    setPicked(id)
    // Smooth unless the reader asks for less motion: see index.css.
    panelBox.current!.scrollIntoView({ block: "start" })
    const { entry, series } = find(id)!
    // Only today's forecast so far: the replay loads once the series is picked.
    if (series.forecasts.length === 1)
      loadSeries(entry, { replay: true }).then(
        (full) =>
          setSignals((all) =>
            all!.map((s) => (s.series.id === id ? { entry, series: full } : s))
          ),
        console.error
      )
  }

  return (
    <main>
      <Hero today={gpr?.today} updated={updated} failed={failed} />
      {signals && panel && (
        <>
          <div ref={panelBox} className="scroll-mt-4 px-4 pb-14">
            {/* A new series dithers in. Its replay, arriving later, starts the panel again on today. */}
            <div key={picked} className="motion-safe:animate-dither-in">
              <ForecastPanel key={panel.forecasts.length} series={panel} />
            </div>
          </div>
          <Signals
            series={signals.map((s) => s.series)}
            picked={picked}
            onPick={pick}
          />
        </>
      )}
    </main>
  )
}
