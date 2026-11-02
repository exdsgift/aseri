import { besideText, calmAround, clamp, type Box } from "@/lib/art"
import { formatValue } from "@/lib/format"

// The arm turns one degree per point of GPR's 7-day average between the head and the ring,
// up to 400: past one turn, as Mercury's fans stop at 4 times the baseline. No arm when
// the value against its baseline is not a number, as Messenger's `fan` and Signal's
// `selection` draw none: a broken file draws no mark rather than a wrong one.
export const armDegrees = (value: number, baseline: number) =>
  Number.isFinite(value / baseline) ? clamp(value, 0, 400) : undefined

// The ring's ticks, in degrees clockwise from the top: one every 10 points, longer on the
// quarters, and the longest at the baseline, the one labelled, when it is a number.
export const dialTicks = (
  baseline: number
): { degrees: number; length: number; label?: string }[] => [
  ...Array.from({ length: 36 }, (_, i) => i * 10)
    .filter((degrees) => degrees !== baseline)
    .map((degrees) => ({ degrees, length: degrees % 90 === 0 ? 10 : 6 })),
  ...(Number.isFinite(baseline)
    ? [{ degrees: baseline, length: 18, label: formatValue(baseline) }]
    : []),
]

// The arm, about `center`: from the top of the head's disc, of radius `head`, out to the
// ring, turning `degrees` clockwise on the way, a point every few pixels. It turns with the
// log of the radius, as the vortex's stripes do, so it lies along them.
export function armPoints(
  [x, y]: number[],
  head: number,
  ring: number,
  degrees: number
) {
  const steps = Math.max(1, Math.ceil((ring - head) / 3))
  return Array.from({ length: steps + 1 }, (_, i) => {
    const radius = head + ((ring - head) * i) / steps
    const turned =
      ((degrees * Math.PI) / 180) *
      (Math.log(radius / head) / Math.log(ring / head))
    return [x + Math.sin(turned) * radius, y - Math.cos(turned) * radius]
  })
}

// Where the vortex's eye goes in a hero `width` by `height`, around the `text` box, in CSS
// pixels: the dial beside the text, where Mercury stands, or in the band above it, with
// its ticks and the baseline's label (outside the ring, at 100 degrees) clear of the veil's
// dithered edge. The stripes fill the whole hero about it. The ring is 2.2 times the head.
export function vortexLayout(width: number, height: number, text: Box) {
  const calm = calmAround(text)
  const [right, bottom] = [calm.left - 48, calm.top - 48]
  if (besideText(calm)) {
    // 10 px of ticks to the left, the label 45 px past the ring to the right.
    const ring = Math.max(1, Math.min((right - 16 - 55) / 2, 230))
    const x = (16 + 10 - 45 + right) / 2
    const y = clamp(0.3 * height, ring + 24, height - ring - 24)
    return { calm, center: [x, y], ring, head: ring / 2.2 }
  }
  // 10 px of ticks above and below.
  const ring = Math.max(1, Math.min((bottom - 24) / 2, (width - 16 - 100) / 2))
  return {
    calm,
    center: [width / 2, 14 + ring],
    ring,
    head: ring / 2.2,
  }
}

export type VortexLayout = ReturnType<typeof vortexLayout>
