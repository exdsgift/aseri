import { useEffect, useId } from "react"

import { type PictogramName } from "@/components/Pictogram"
import { SignalCard } from "@/components/SignalCard"
import { type Series } from "@/lib/api"
import { isShortcut } from "@/lib/keys"

// Spec 6.8's groups, each series with its pictogram, in the order of the cards.
const groups: [string, Record<string, PictogramName>][] = [
  [
    "Risk, attention and oil",
    { gpr_daily: "risk", wiki_ww3_views: "eye", brent_spot: "drop" },
  ],
  [
    "Sea lanes",
    {
      suez_transits: "ship",
      hormuz_transits: "ship",
      bab_el_mandeb_transits: "ship",
      taiwan_strait_transits: "ship",
    },
  ],
  [
    "War in Ukraine",
    { ua_air_raid_hours: "siren", ua_drones_downed_claimed: "drone" },
  ],
]

// The series of the catalog as cards, by group; a group with none of them is left out.
export function Signals({
  series,
  picked,
  onPick,
}: {
  series: Series[]
  picked: string
  onPick: (id: string) => void
}) {
  const title = useId()
  // The keys count the cards in the order they are drawn.
  let key = 0
  const drawn = groups
    .map(([name, icons]) => ({
      name,
      cards: Object.entries(icons).flatMap(([id, icon]) => {
        const found = series.find((s) => s.id === id)
        return found ? [{ series: found, icon, hint: String(++key) }] : []
      }),
    }))
    .filter((group) => group.cards.length)
  const cards = drawn.flatMap((group) => group.cards)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const card = cards.find((c) => c.hint === event.key)
      if (card && isShortcut(event)) onPick(card.series.id)
    }
    addEventListener("keydown", onKey)
    return () => removeEventListener("keydown", onKey)
  })

  return (
    <section
      id="signals"
      aria-labelledby={title}
      className="mx-auto flex max-w-[1040px] scroll-mt-4 flex-col gap-8 px-4 pb-14"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <h2
          id={title}
          className="font-display text-[48px]/none tracking-[0.04em] text-secondary"
        >
          Signals
        </h2>
        <p className="max-w-[52ch] text-[8px]/[14px] text-muted-foreground uppercase">
          Public series, each with its forecast. Pick one to open it above, with
          its replay and intervals.
        </p>
      </div>
      {drawn.map((group) => (
        <div key={group.name} className="flex flex-col gap-2.5">
          <h3 className="text-[8px]/[12px] text-secondary uppercase">
            {group.name}
          </h3>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-2">
            {group.cards.map(({ series, icon, hint }) => (
              <li key={series.id} className="flex">
                <SignalCard
                  series={series}
                  icon={icon}
                  hint={hint}
                  picked={series.id === picked}
                  onPick={() => onPick(series.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
