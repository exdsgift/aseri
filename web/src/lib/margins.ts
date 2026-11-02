import { type Box } from "@/lib/art"
import { pixel } from "@/lib/chart"

// The widest column, the signals' and the record's cards: 1040 px less their 16 px padding.
// The stripes follow it all down the page, so the current never steps in or out.
export const widest = 1008
// The calm gap the stripes keep from the column and from the side navigation.
export const clearance = 24
// Under 600 px, a phone: the stripes fill the page's 16 px gutters, right up to the column.
const phone = 600
export const gutter = 16

// The op-art margins in a viewport `width` CSS px wide (without its scrollbar), in art
// pixels: the columns of the left margin (under `left`) and of the right (from `right`), each
// `margin` wide. `top`, the hero's foot, `nav`, the side navigation's box, and `gaps`, the
// spans between the sections' content, come in page CSS px; `drift` is how far the current
// has travelled, in radians.
export function scene(
  width: number,
  top: number,
  nav?: Box,
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
    // Grown by the gap it keeps.
    nav: nav && {
      left: (nav.left - clearance) / pixel,
      top: (nav.top - clearance) / pixel,
      right: (nav.right + clearance) / pixel,
      bottom: (nav.bottom + clearance) / pixel,
    },
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

// Whether the art pixel in column x and page row y is inked, in the frame: Vortex's stripes
// as a current, 10 art pixels apart, bending by up to 8 art pixels the nearer the page edge,
// and thinning out to nothing at the calm gap beside the column, from the hero's foot down
// and round the side navigation, each over the margin's width. The prototype's op-art.
export function inked(x: number, y: number, s: Scene) {
  // In a gap between sections, the margins swell in and back, in an arc. The pixel spans
  // [x, x + 1) and [y, y + 1).
  let swell = 0
  for (const [from, to] of s.gaps)
    if (y >= from && y + 1 <= to)
      swell = s.reach * Math.sin((Math.PI * (y + 0.5 - from)) / (to - from))
  const [left, right, margin] = [
    s.left + swell,
    s.right - swell,
    s.margin + swell,
  ]
  const out = x < left ? left - x : x >= right ? x - right + 1 : 0
  if (!out) return false
  const depth = out / margin
  const nav = s.nav
    ? Math.hypot(
        Math.max(s.nav.left - x - 1, 0, x - s.nav.right),
        Math.max(s.nav.top - y - 1, 0, y - s.nav.bottom)
      )
    : margin
  const thick = 0.55 * Math.min(depth, (y - s.top) / s.margin, nav / margin)
  const phase = (x + s.swing * depth * Math.sin(y / 36 + s.drift)) / s.pitch
  return phase - Math.floor(phase) < thick
}
