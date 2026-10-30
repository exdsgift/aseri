import { useEffect, useState, useSyncExternalStore } from "react"

import { bayer } from "@/lib/chart"
import { formatValue } from "@/lib/format"

// What the number shows on each step of its count-up, 40 ms apart: from 0, slowing
// down into the value, and ending on exactly the text the page writes for it.
export const countUp = (value: number, steps = 16) =>
  Array.from({ length: steps + 1 }, (_, k) =>
    formatValue(value * (1 - (1 - k / steps) ** 3))
  )

// Step k of the 8-step Bayer dither lights the cells of the 4x4 tile whose threshold is
// under 2(k + 1), so each step adds two cells and keeps the rest.
export const ditherCells = (step: number) =>
  bayer.flatMap((threshold, i) =>
    threshold < 2 * (step + 1) ? [[i % 4, Math.floor(i / 4)]] : []
  )

// The same step as a CSS mask: the tile repeats every 12 px, in dots of 3 px.
export function ditherMask(step: number) {
  const dots = ditherCells(step)
    .map(([x, y]) => `<rect x="${3 * x}" y="${3 * y}" width="3" height="3"/>`)
    .join("")
  const tile = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12">${dots}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(tile)}")`
}

const reduce = "(prefers-reduced-motion: reduce)"

function onReduceChange(changed: () => void) {
  const query = matchMedia(reduce)
  query.addEventListener("change", changed)
  return () => query.removeEventListener("change", changed)
}

// True while the reader asks for less motion: then nothing on the page moves.
export const useReducedMotion = () =>
  useSyncExternalStore(onReduceChange, () => matchMedia(reduce).matches)

// Steps 0 to count - 1, `ms` apart, then undefined: the resting state, and the only
// one under reduced motion. Animation frames wait while the tab is hidden, and so
// does the sequence.
export function useSteps(count: number, ms: number) {
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (reduced) return
    let start: number | undefined
    let frame = requestAnimationFrame(function next(now) {
      start ??= now
      const reached = Math.floor((now - start) / ms)
      setStep(reached)
      if (reached < count) frame = requestAnimationFrame(next)
    })
    return () => cancelAnimationFrame(frame)
  }, [count, ms, reduced])
  return reduced || step >= count ? undefined : step
}
