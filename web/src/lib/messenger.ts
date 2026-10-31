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

// The angle between neighbouring rays, in degrees: 19 rays over the baseline's 40, denser than
// the study's 300 (27 over 66), as the owner asked for a richer fan.
const slot = 40 / 18

export type Ray = { slot: number; angle: number }

// Each fan opens with GPR's 7-day average against its baseline. At the baseline and under it,
// already full: 19 rays over 40 degrees, more than the study's fans at 181. Each further baseline
// opens it 13 degrees, so 300 opens as wide as the study's 300, up to 4 times the baseline.
// The rays keep fixed slots a slot's angle apart, so the fan gains rays only at its edges as
// it opens, and none ever moves. The two dashed rays stay at the full fan's edges. Angles are
// off the fan's axis, in degrees; no fan when the ratio is not a number, so a broken file
// draws no rays rather than wrong ones.
export function fan(value: number, baseline: number) {
  const ratio = value / baseline
  if (!Number.isFinite(ratio)) return undefined
  const opening = 40 + 13 * (Math.min(Math.max(ratio, 1), 4) - 1)
  // A hair over, so the baseline's own edge slots count.
  const edge = Math.floor(opening / 2 / slot + 1e-9)
  return {
    rays: Array.from({ length: 2 * edge + 1 }, (_, i): Ray => ({
      slot: i - edge,
      angle: (i - edge) * slot,
    })),
    baseline: [-20, 20],
  }
}

// A fixed number from 0 to 1 for each `n`.
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// One fan's rays in a frame, from the point that holds it, the `bundle`th: each from `held`
// behind the point out to its own length, from 3/4 to all of `reach`, both grown by `grow`
// (0 to 1). Over `sway` ms each sways by up to 0.3 degrees, out of step with the others;
// none at rest. Length and sway are its slot's, so a ray looks the same whatever the value.
export function fanRays(
  point: { x: number; y: number; angle: number },
  bundle: number,
  rays: Ray[],
  frame: { grow: number; reach: number; held: number; sway?: number }
) {
  return rays.map(({ slot, angle }) => {
    const shift =
      frame.sway === undefined
        ? 0
        : 0.3 * Math.sin(frame.sway / 2300 + slot * 1.7 + bundle * 5)
    const a = ((point.angle + angle + shift) * Math.PI) / 180
    const [dx, dy] = [Math.cos(a), Math.sin(a)]
    const near = frame.held * frame.grow
    const far =
      frame.reach * frame.grow * (0.75 + 0.25 * hash(slot * 13 + bundle * 7))
    return {
      slot,
      from: [point.x - dx * near, point.y - dy * near],
      to: [point.x + dx * far, point.y + dy * far],
    }
  })
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
