import { bayer } from "@/lib/chart"

// The sun's radius at the baseline, in art pixels.
const baselineRadius = 7

// The area, not the radius, is in proportion to today's value over the baseline: a
// radius would square every difference. Clamped so the sun stays on the canvas.
export const sunRadius = (value: number, baseline: number) =>
  baselineRadius * Math.sqrt(Math.min(4, Math.max(1 / 4, value / baseline)))

// The art moves in ticks of 260 ms, like the game's sprites.
export const tick = 260

// The glow's six densities, up and back down: ten ticks, 2.6 s. At most about half the
// pixels next to the disc, so its solid edge, and so its size, stays plain to see.
const glows = [0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.55, 0.5, 0.45, 0.4]

// `step` counts the ticks, and sets which stars are lit: none given, all of them.
export type SunFrame = {
  glow: number
  angle: number
  scale: number
  step?: number
}

// Reduced motion: the sun at rest.
export const stillSun: SunFrame = { glow: 0.5, angle: 0, scale: 1 }

export const sunFrame = (step: number): SunFrame => ({
  glow: glows[step % glows.length],
  angle: (step * Math.PI) / 36,
  // From 1 to 1.04 in 3.2 s and back, easing in and out.
  scale: 1 + 0.02 * (1 - Math.cos((Math.PI * step * tick) / 3200)),
  step,
})

type Plot = (x: number, y: number, color: string) => void
type Colors = Record<"sun" | "halo" | "star" | "faint", string>

// In art pixels: the glow beyond the disc, and the halo's radius. The largest sun and
// its glow reach 28 from the centre, so a canvas 56 high holds every one.
const glowWidth = 14
const haloRadius = 24

// Stars, a dithered sun with its glow, and a dashed halo, in art pixels. The sun sits
// in the middle, and only once its radius is known.
export function paintSun(
  plot: Plot,
  art: { width: number; height: number },
  radius: number | undefined,
  frame: SunFrame,
  color: Colors
) {
  // Seeded, so the stars keep their places: the bright few blink, the faint ones flicker less.
  let seed = 11
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let n = Math.round(art.width / 4); n > 0; n--) {
    const x = Math.floor(random() * art.width)
    const y = Math.floor(random() * art.height)
    const phase = Math.floor(random() * 8)
    const bright = random() < 0.15
    if (frame.step === undefined || (frame.step + phase) % 8 < (bright ? 2 : 6))
      plot(x, y, bright ? color.star : color.faint)
  }
  if (radius === undefined) return

  const cx = art.width / 2
  const cy = art.height / 2
  const r = radius * frame.scale
  const reach = Math.ceil(Math.max(r + glowWidth, haloRadius + 1))
  for (let y = Math.floor(cy - reach); y <= cy + reach; y++)
    for (let x = Math.floor(cx - reach); x <= cx + reach; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const d = Math.hypot(dx, dy)
      // The glow thins out with distance, through the Bayer thresholds.
      const lit =
        d <= r ||
        (d < r + glowWidth &&
          (bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16 <
            (1 - (d - r) / glowWidth) * frame.glow)
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
