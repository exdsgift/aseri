import { useId, useState, type ReactNode } from "react"

// Flat blocks that turn white on hover, as the game's buttons do, a finger's size to tap.
export const control =
  "hit cursor-pointer bg-secondary px-2 py-1.5 text-background uppercase hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors motion-safe:duration-160"

// The second layer, one labelled tap away: method, details and sources, out of the default view
// until asked for. A button that says whether it is open, and the part it shows or hides. Open,
// it takes a row of its own, so its words run the width of the block.
export function Disclosure({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const body = useId()
  const [open, setOpen] = useState(false)
  return (
    <div className={open ? "basis-full" : undefined}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={body}
        onClick={() => setOpen(!open)}
        className={`${control} aria-expanded:bg-white`}
      >
        {label}
        <span aria-hidden> {open ? "-" : "+"}</span>
      </button>
      <div
        id={body}
        hidden={!open}
        className="mt-2 flex flex-col gap-2 text-[8px]/[14px] text-secondary"
      >
        {children}
      </div>
    </div>
  )
}
