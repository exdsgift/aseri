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

// The 8 steps as CSS masks, made once: the tile repeats every 12 px, in dots of 3 px.
export const ditherMasks = Array.from({ length: 8 }, (_, step) => {
  const dots = ditherCells(step)
    .map(([x, y]) => `<rect x="${3 * x}" y="${3 * y}" width="3" height="3"/>`)
    .join("")
  const tile = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12">${dots}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(tile)}")`
})

// Made on first use, so importing this module needs no DOM, then kept: every render reads it.
let reduce: MediaQueryList | undefined
const reduceQuery = () =>
  (reduce ??= matchMedia("(prefers-reduced-motion: reduce)"))

function onReduceChange(changed: () => void) {
  reduceQuery().addEventListener("change", changed)
  return () => reduceQuery().removeEventListener("change", changed)
}

// True while the reader asks for less motion: then nothing on the page moves.
export const useReducedMotion = () =>
  useSyncExternalStore(onReduceChange, () => reduceQuery().matches)

// Steps 0 to count - 1, `ms` apart, then undefined: the resting state. Already there
// under reduced motion at load, so turning it off later never replays the sequence.
// Timed from the first animation frame: a tab hidden midway gets no frames, and on
// its return the sequence skips to its end.
export function useSteps(count: number, ms: number) {
  const reduced = useReducedMotion()
  const [step, setStep] = useState(reduced ? count : 0)
  const finished = step >= count
  useEffect(() => {
    if (reduced || finished) return
    let start: number | undefined
    let shown = -1
    let frame = requestAnimationFrame(function next(now) {
      start ??= now
      const reached = Math.min(count, Math.floor((now - start) / ms))
      if (reached !== shown) setStep((shown = reached))
      if (reached < count) frame = requestAnimationFrame(next)
    })
    return () => cancelAnimationFrame(frame)
  }, [count, ms, reduced, finished])
  return reduced || finished ? undefined : step
}
