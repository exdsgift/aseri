import { useEffect, useState } from "react"

import { Pictogram, type PictogramName } from "@/components/Pictogram"
import { isShortcut } from "@/lib/keys"

// A section of the page by its element's id, with a label in two lines, and the key that
// jumps to it if it has one.
export type Section = {
  id: string
  icon: PictogramName
  label: [string, string]
  shortcut?: string
}

// The page's sections down the right edge of a wide screen, the one in the middle of the
// screen lit. Only from 1344 px, where the gutter beside the 1040 px sections holds it;
// the ground behind it keeps its words clear of the hero's rays.
export function SideNav({ sections }: { sections: Section[] }) {
  const [lit, setLit] = useState(sections[0].id)
  const ids = sections.map((section) => section.id).join(" ")

  // The section that crosses the line across the middle of the screen. In the footer
  // none does, and the last one stays lit.
  useEffect(() => {
    const spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) setLit(entry.target.id)
      },
      { rootMargin: "-50% 0px" }
    )
    for (const id of ids.split(" ")) spy.observe(document.getElementById(id)!)
    return () => spy.disconnect()
  }, [ids])

  // On a narrow screen too, where the navigation is hidden.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const section = sections.find(
        (s) => s.shortcut === event.key.toUpperCase()
      )
      if (section && isShortcut(event))
        document.getElementById(section.id)!.scrollIntoView({ block: "start" })
    }
    addEventListener("keydown", onKey)
    return () => removeEventListener("keydown", onKey)
  })

  return (
    <nav
      aria-label="Sections"
      className="fixed top-1/2 right-6 z-10 hidden -translate-y-1/2 flex-col gap-7 bg-background p-2 min-[1344px]:flex"
    >
      {sections.map(({ id, icon, label: [first, second], shortcut }) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={id === lit ? "location" : undefined}
          aria-keyshortcuts={shortcut}
          className="flex items-center gap-3 text-[8px]/[12px] text-secondary uppercase opacity-30 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[current=location]:opacity-100 motion-safe:transition-opacity motion-safe:duration-160"
        >
          <span className="text-primary">
            <Pictogram name={icon} />
          </span>
          {/* Spans with a space between them, so the link's name reads as words. */}
          <span className="flex flex-col">
            <span>{first}</span> <span>{second}</span>
          </span>
        </a>
      ))}
    </nav>
  )
}
