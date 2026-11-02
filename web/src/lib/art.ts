import { bayer } from "@/lib/chart"

export type Box = { left: number; top: number; right: number; bottom: number }

// The text and a margin round it, which every hero's art keeps calm.
export const calmAround = (text: Box): Box => ({
  left: text.left - 20,
  top: text.top - 14,
  right: text.right + 20,
  bottom: text.bottom + 14,
})

// Whether the margin beside the text has room for the art (from about 1,050 px), or the
// art goes in the band above the text.
export const besideText = (calm: Box) => calm.left >= 230

// The ordered dither: whether pixel (x, y) is lit at `level`, from 0 (none) to 1 (all).
export const lit = (x: number, y: number, level: number) =>
  (bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < level

// A fixed number from 0 to 1 for each `n`.
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// Numbers from 0 to 1 that look random, the same ones for the same `seed`.
export const noise = (seed: number) => () =>
  (seed = (seed * 16807) % 2147483647) / 2147483647

// `make`, keeping its last result while it is asked again with the same arguments: the art
// dithers its engraving again only when its size or its inks change.
export function remember<A extends unknown[], R>(make: (...args: A) => R) {
  let last: { args: A; result: R } | undefined
  return (...args: A) => {
    const kept = last
    if (!kept || args.some((arg, i) => arg !== kept.args[i]))
      last = { args, result: make(...args) }
    return last!.result
  }
}

export const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high)
