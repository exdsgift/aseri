import { useEffect, useMemo, useRef, useState } from "react"

import { Footer } from "@/components/Footer"
import { ForecastPanel } from "@/components/ForecastPanel"
import { Hero } from "@/components/Hero"
import { Margins } from "@/components/Margins"
import { SideNav, type Section } from "@/components/SideNav"
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
import { useHero } from "@/lib/heroes"

const gprId = "gpr_daily"
// The side navigation's entry for each section of the page.
const nav = {
  today: { id: "today", icon: "risk", label: ["Risk", "today"] },
  forecast: { id: "forecast", icon: "band", label: ["The", "forecast"] },
  signals: { id: "signals", icon: "grid", label: ["All", "signals"] },
  record: {
    id: "record",
    icon: "check",
    label: ["The", "record"],
    shortcut: "R",
  },
} satisfies Record<string, Section>

// The panel's heading, focused so screen readers land on the panel, with no second jump.
const focusHeading = (box: HTMLElement | null) =>
  box?.querySelector("h2")?.focus({ preventScroll: true })

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
  // The hero on show: the next in turn on each load, unless the reader picked one.
  const { hero, choice, choose } = useHero()
  const panelBox = useRef<HTMLDivElement>(null)
  // The series whose replay was asked for: GPR's comes with the page.
  const replayed = useRef(new Set([gprId]))
  const find = (id: string) => signals?.find((s) => s.series.id === id)
  const gpr = find(gprId)?.series
  const panel = find(picked)?.series
  // Under the hero, the panel and the cards wait for the picked series, and the record for
  // the scores too. The page and its side navigation both go by these two.
  const drawn = signals !== undefined && panel !== undefined
  const recorded = drawn && records !== undefined
  const sections = useMemo(
    () => [
      nav.today,
      ...(drawn ? [nav.forecast, nav.signals] : []),
      ...(recorded ? [nav.record] : []),
    ],
    [drawn, recorded]
  )

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

  // Each pick brings the panel into view once its new series is drawn, not again when the
  // replay arrives. Asked from the click, the scroll began before the panel changed height
  // above the card, and scroll anchoring, keeping the card still, cut it short: anchoring is
  // off from the pick until the page settles, and only then.
  const [asked, setAsked] = useState(0)
  useEffect(() => {
    if (!asked) return
    let quiet: ReturnType<typeof setTimeout> | undefined
    const stop = () => {
      clearTimeout(quiet)
      removeEventListener("scroll", wait)
      removeEventListener("scrollend", settle)
    }
    const settle = () => {
      stop()
      document.documentElement.style.overflowAnchor = ""
    }
    // Where there is no scrollend: 300 ms after the last scroll.
    const wait = () => {
      clearTimeout(quiet)
      quiet = setTimeout(settle, 300)
    }
    const frame = requestAnimationFrame(() => {
      // Smooth unless the reader asks for less motion: see index.css.
      panelBox.current!.scrollIntoView({ block: "start" })
      focusHeading(panelBox.current)
      addEventListener("scroll", wait)
      addEventListener("scrollend", settle)
      wait()
    })
    return () => {
      cancelAnimationFrame(frame)
      stop()
    }
  }, [asked])
  // Whether the focus is in the panel. The replay arriving draws the panel anew, which drops
  // it: then it goes back on the heading, and only then.
  const focusInPanel = useRef(false)
  const length = panel?.forecasts.length
  useEffect(() => {
    if (
      focusInPanel.current &&
      !panelBox.current?.contains(document.activeElement)
    )
      focusHeading(panelBox.current)
  }, [length])

  const pick = (id: string) => {
    document.documentElement.style.overflowAnchor = "none"
    setPicked(id)
    setOpened(undefined)
    setAsked((count) => count + 1)
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
    <>
      <Margins />
      <SideNav sections={sections} />
      <main>
        <Hero
          hero={hero}
          today={gpr?.today}
          updated={updated}
          failed={failed}
        />
        {drawn && (
          <>
            <div
              id="forecast"
              ref={panelBox}
              onFocus={() => {
                focusInPanel.current = true
              }}
              // A blur as the panel is drawn anew leaves it so: the element is gone by then.
              onBlur={({ target, relatedTarget }) =>
                queueMicrotask(() => {
                  if (target.isConnected)
                    focusInPanel.current =
                      !!panelBox.current?.contains(relatedTarget)
                })
              }
              className="scroll-mt-[calc(16px+env(safe-area-inset-top))] px-4 pb-20 md:pb-32"
            >
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
            {recorded && (
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
      <Footer choice={choice} onChoose={choose} />
    </>
  )
}
