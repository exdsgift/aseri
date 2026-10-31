import { besideText, calmAround, clamp, type Box } from "@/lib/art"

// The engraving in src/assets/hercules.png: Goltzius's Farnese Hercules from behind, the
// study's crop at 360 px wide in 8 greys, which the failing screen smears. The selection
// frames hold the spot on his back; on a narrow screen only his torso shows, the top rows.
export const engraving = { width: 360, height: 641 }
const torso = 366
const back = [191, 196]

// Where the art goes in a hero `width` by `height`, around the `text` box, in CSS pixels:
// the screen beside the text, where Mercury stands, or his torso in the band above it.
// Never past the engraving's own size.
export function signalLayout(width: number, height: number, text: Box) {
  const calm = calmAround(text)
  const wide = besideText(calm)
  const rows = wide ? engraving.height : torso
  const shown = Math.max(
    1,
    wide
      ? Math.min(calm.left - 40, engraving.width)
      : Math.min(width - 40, ((calm.top - 22) * engraving.width) / rows)
  )
  const scale = shown / engraving.width
  const tall = rows * scale
  const x = Math.round(wide ? (calm.left - shown) / 2 : (width - shown) / 2)
  const y = Math.round(wide ? clamp((height - tall) * 0.22, 24, 300) : 10)
  return {
    calm,
    // The engraving's top `rows`, drawn `width` by `height` at (x, y).
    screen: {
      x,
      y,
      width: Math.round(shown),
      height: Math.round(tall),
      rows,
    },
    back: [x + back[0] * scale, y + back[1] * scale],
    // The baseline's frame: a quarter of his width, and never too small to hold its label.
    small: Math.max(36, 0.26 * shown),
    // Light leaks in from above the hero's top right.
    light: [0.68 * width, -0.25 * height],
  }
}

export type SignalLayout = ReturnType<typeof signalLayout>

// The two selection frames on his back, from GPR's 7-day average against its baseline: the
// small one is the baseline, `small` px wide, and the large one the value, as many times as
// wide as the value is the baseline, up to 4 times as Mercury's fans. Both 1.3 times as
// tall as wide. None when the ratio is not a number: a broken file draws no frame.
export function selection(value: number, baseline: number, small: number) {
  const ratio = value / baseline
  if (!Number.isFinite(ratio)) return undefined
  const frame = (width: number) => ({ width, height: 1.3 * width })
  return { baseline: frame(small), value: frame(small * clamp(ratio, 0, 4)) }
}

// Which of the screen's six pictures shows `art` ms after the art showed: it warms up
// through three noisier ones, 300 ms each, then flickers among three settled ones, a new
// one each 200 ms tick. Still, one settled picture.
export const screenAt = (art: number, still: boolean) =>
  still
    ? 3
    : art < 900
      ? Math.floor(art / 300)
      : 3 + (Math.floor(art / 200) % 3)
