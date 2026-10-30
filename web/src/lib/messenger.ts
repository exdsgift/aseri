import { bayer } from "@/lib/chart"

// The engraving in src/assets/mercury.png, in its own pixels, and the points on it the art
// hangs on, from study A: his chest, the centre of the disc, then a fan from each of the
// winged hat, the caduceus, the hand on the staff, the elbow in the cloak and the winged
// ankle. Each fan points out at an angle in degrees, clockwise from the right: beside the
// text on a wide screen, or above it on a narrow one.
export const engraving = { width: 360, height: 760 }
const chest = [195, 244]
const bundles = [
  { at: [183, 35], wide: -75, narrow: -92 },
  { at: [338, 145], wide: -25, narrow: -38 },
  { at: [305, 427], wide: 14, narrow: -6 },
  { at: [64, 270], wide: 196, narrow: 188 },
  { at: [207, 662], wide: 52, narrow: 142 },
]

// Each fan opens with GPR's 7-day average against its baseline. At the baseline and under it,
// already full: 15 rays over 40 degrees, as the study's fans at 181. Each further baseline
// opens it 13 degrees and adds 6 rays, so 300 opens as wide as the study's 300, and denser,
// up to 4 times the baseline. The two dashed rays stay at the full fan's edges. The rays are
// angles off the fan's axis, in degrees; no fan when the ratio is not a number, so a broken
// file draws no rays rather than wrong ones.
export function fan(value: number, baseline: number) {
  const ratio = value / baseline
  if (!Number.isFinite(ratio)) return undefined
  const above = Math.min(Math.max(ratio, 1), 4) - 1
  const spread = 40 + 13 * above
  const count = Math.round(15 + 6 * above)
  return {
    rays: Array.from(
      { length: count },
      (_, i) => spread * (i / (count - 1) - 0.5)
    ),
    baseline: [-20, 20],
  }
}

export type Box = { left: number; top: number; right: number; bottom: number }

// Where the art goes in a hero `width` by `height`, around the `text` box, in CSS pixels.
export function messengerLayout(width: number, height: number, text: Box) {
  // The text and a margin round it, which the art keeps calm.
  const calm = {
    left: text.left - 20,
    top: text.top - 14,
    right: text.right + 20,
    bottom: text.bottom + 14,
  }
  // Beside the text when its margin has room for him, else in the band above it. Never
  // past the engraving's own size, whose dither would blur.
  const wide = calm.left >= 230
  const shown = Math.max(
    1,
    wide
      ? Math.min(calm.left - 50, engraving.width)
      : Math.min(140, ((calm.top - 24) * engraving.width) / engraving.height)
  )
  const scale = shown / engraving.width
  const tall = engraving.height * scale
  const x = Math.round(wide ? (calm.left - shown) / 2 : (width - shown) / 2)
  const y = Math.round(
    wide ? Math.min(Math.max((height - tall) * 0.3, 30), 400) : 12
  )
  const at = ([px, py]: number[]) => [x + px * scale, y + py * scale]
  return {
    calm,
    figure: { x, y, scale },
    chest: at(chest),
    // The ring of ticks behind him, from 0.4 to 0.5 of his height.
    disc: [0.4 * tall, 0.5 * tall],
    // How far each ray runs back through the hand that holds it: the study's at full size,
    // and no thicket over him when he is small.
    held: 0.4 * tall,
    bundles: bundles.map((bundle) => {
      const [bx, by] = at(bundle.at)
      return { x: bx, y: by, angle: wide ? bundle.wide : bundle.narrow }
    }),
  }
}

export type MessengerLayout = ReturnType<typeof messengerLayout>

// The ordered dither: whether pixel (x, y) is lit at `level`, from 0 (none) to 1 (all).
export const lit = (x: number, y: number, level: number) =>
  (bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < level
