import { pixel } from "@/lib/chart"

// The widest column, the signals' and the record's cards: 1040 px less their 16 px padding.
// The stripes follow it all down the page, so the current never steps in or out.
const widest = 1008
// The calm gap the stripes keep from the column.
const clearance = 24
// Under 600 px, a phone: the stripes fill the page's 16 px gutters, right up to the column,
// and reach into the gaps between the sections.
export const phone = 600
const gutter = 16

// The op-art margins in a viewport `width` CSS px wide (without its scrollbar), in art
// pixels: the columns of the left margin (under `left`) and of the right (from `right`), each
// `margin` wide. `top`, the hero's foot, and `gaps`, the spans between the sections' content,
// come in page CSS px; `drift` is how far the current has travelled, in radians.
export function scene(
  width: number,
  top: number,
  drift = 0,
  gaps: number[][] = []
) {
  const columns = Math.ceil(width / pixel)
  const narrow = width < phone
  const gap = narrow ? gutter : (width - widest) / 2 - clearance
  const margin = Math.max(0, Math.floor(gap / pixel))
  return {
    columns,
    left: margin,
    right: columns - margin,
    margin,
    top: top / pixel,
    // The rows the stripes take to come in from the hero's foot: the margin's width, 192 px
    // at most, so a wide screen redraws no more of them as the current moves.
    fade: Math.min(margin, 96),
    drift,
    // On a phone the stripes are finer, so a few fit the gutter, and they reach into the
    // gaps between the sections below the hero, a gutter clear of them, a quarter of the
    // screen in at most.
    pitch: narrow ? 4 : 10,
    swing: narrow ? 2 : 8,
    gaps: narrow
      ? gaps
          .map(([from, to]) => [
            (Math.max(from, top) + gutter) / pixel,
            (to - gutter) / pixel,
          ])
          .filter(([from, to]) => to > from)
      : [],
    // How far past `left` and before `right` the stripes may reach.
    reach: narrow ? Math.floor(columns / 4) : 0,
  }
}
export type Scene = ReturnType<typeof scene>

// The stripes along page row y: whether the art pixel in column x is inked, in the frame.
// Vortex's stripes as a current, 10 art pixels apart, bending by up to 8 art pixels the
// nearer the page edge, and thinning out to nothing at the calm gap beside the column, over
// the margin's width, and at the hero's foot. The prototype's op-art. What the
// row shares is worked out once, as a frame asks it of every pixel of the margins. The pixel
// spans [x, x + 1) and [y, y + 1).
export function stripes(y: number, s: Scene) {
  // In a gap between sections, the margins swell in and back, in an arc.
  let swell = 0
  for (const gap of s.gaps)
    if (y >= gap[0] && y + 1 <= gap[1])
      swell =
        s.reach * Math.sin((Math.PI * (y + 0.5 - gap[0])) / (gap[1] - gap[0]))
  const left = s.left + swell
  const right = s.right - swell
  const margin = s.margin + swell
  const below = (y - s.top) / s.fade
  const wave = s.swing * Math.sin(y / 36 + s.drift)
  return (x: number) => {
    const out = x < left ? left - x : x >= right ? x - right + 1 : 0
    if (!out || below <= 0) return false
    const depth = out / margin
    const phase = (x + wave * depth) / s.pitch
    return phase - Math.floor(phase) < 0.55 * Math.min(depth, below)
  }
}
