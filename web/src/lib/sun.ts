import { bayer } from "@/lib/chart"

// The prototype's measures, in art pixels of 4 CSS px: the art is 90 high, the sun's
// centre sits 34 from the top, its glow reaches 20 past the disc and the halo is at 26.
export const artHeight = 90
const centreY = 34
const glowWidth = 20
const haloRadius = 26

// 6 art pixels, and 3 more for each multiple of the baseline, up to three. No radius
// when the ratio is not a number, so a broken file draws no sun rather than a wrong one.
export function sunRadius(value: number, baseline: number) {
  const ratio = value / baseline
  return Number.isFinite(ratio)
    ? Math.round(6 + 3 * Math.min(ratio, 3))
    : undefined
}

// The art moves in ticks of 260 ms, like the game's sprites.
export const tick = 260

// The glow's six densities, up and back down: ten ticks, 2.6 s.
const glows = [0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 0.85, 0.75, 0.65, 0.55]

// `step` counts the ticks, and sets which stars are lit: none given, all of them.
export type SunFrame = { glow: number; angle: number; step?: number }

// Reduced motion: the sun at rest.
export const stillSun: SunFrame = { glow: 0.7, angle: 0 }

export const sunFrame = (step: number): SunFrame => ({
  glow: glows[step % glows.length],
  angle: (step * Math.PI) / 36,
  step,
})

type Plot = (x: number, y: number, color: string) => void
type Colors = Record<"sun" | "halo" | "star" | "faint", string>

// Stars, a dithered sun with its glow, and a dashed halo, on art `width` pixels by
// `artHeight`. The sun is centred, and drawn only once its radius is known.
export function paintSun(
  plot: Plot,
  width: number,
  radius: number | undefined,
  frame: SunFrame,
  color: Colors
) {
  // Seeded, so the stars keep their places: the bright few blink, the faint ones flicker less.
  let seed = 11
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let n = Math.round(width / 4); n > 0; n--) {
    const x = Math.floor(random() * width)
    const y = Math.floor(random() * artHeight)
    const phase = Math.floor(random() * 8)
    const bright = random() < 0.15
    if (frame.step === undefined || (frame.step + phase) % 8 < (bright ? 2 : 6))
      plot(x, y, bright ? color.star : color.faint)
  }
  if (radius === undefined) return

  const cx = width / 2
  const reach = Math.max(radius + glowWidth, haloRadius + 1)
  for (let y = Math.floor(centreY - reach); y <= centreY + reach; y++)
    for (let x = Math.floor(cx - reach); x <= cx + reach; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - centreY
      const d = Math.hypot(dx, dy)
      // The glow thins out with distance, through the Bayer thresholds.
      const lit =
        d <= radius ||
        (d < radius + glowWidth &&
          (bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16 <
            (1 - (d - radius) / glowWidth) * frame.glow)
      if (lit) plot(x, y, color.sun)
      // The halo: 20 dashes round the ring.
      else if (
        Math.abs(d - haloRadius) < 0.6 &&
        (Math.floor(((Math.atan2(dy, dx) + frame.angle) * 10) / Math.PI) &
          1) ===
          0
      )
        plot(x, y, color.halo)
    }
}
