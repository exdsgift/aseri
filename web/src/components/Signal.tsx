import hercules from "@/assets/hercules.png"
import {
  channels,
  grown,
  label,
  type Art,
  type Frame,
  type Inks,
} from "@/components/HeroArt"
import { clamp, hash, noise, remember } from "@/lib/art"
import { formatValue } from "@/lib/format"
import { counted, easeOut } from "@/lib/motion"
import {
  placed,
  screenAt,
  selection,
  signalLayout,
  type SignalLayout,
} from "@/lib/signal"

// Study B, "Signal": Goltzius's Farnese Hercules on a failing screen, light leaking in from
// above, and two selection frames on his back: the small one the baseline, the large one
// GPR's 7-day average.
export const signal: Art = {
  src: hercules,
  credit: {
    work: "Hendrick Goltzius, The Farnese Hercules, c. 1592, published 1617, The Metropolitan Museum of Art",
    source:
      "https://commons.wikimedia.org/wiki/File:Farnese_Hercules_MET_DP102198.jpg",
  },
  lettered: true,
  compose({ width, height, text }, inks, image) {
    const layout = signalLayout(width, height, text)
    const { rows, width: wide, height: tall } = layout.screen
    const pictures =
      image && screens(image, rows, wide, tall, inks.ink, inks.mid)
    return (context, frame) => {
      light(context, layout, height, frame, inks.ink)
      if (pictures) show(context, layout, pictures, frame, inks.ink)
      frames(context, layout, { width, height }, frame, inks)
    }
  },
}

// Faint rays from above the hero's top right, growing in as the art arrives, then sweeping
// by a degree or so, about once a minute.
function light(
  context: CanvasRenderingContext2D,
  { light: [x, y] }: SignalLayout,
  height: number,
  { art, still }: Frame,
  ink: string
) {
  const sweep = still ? 0 : 1.6 * Math.sin(art / 9000)
  const grow = easeOut(art / grown)
  context.strokeStyle = ink
  context.lineWidth = 1
  context.globalAlpha = 0.22
  context.beginPath()
  for (let i = 0; i < 46; i++) {
    const a = ((96 + 1.3 * i + sweep + 0.6 * hash(i)) * Math.PI) / 180
    const length = grow * height * (0.55 + 0.35 * hash(3 * i))
    context.moveTo(x, y)
    context.lineTo(x + Math.cos(a) * length, y + Math.sin(a) * length)
  }
  context.stroke()
  context.globalAlpha = 1
}

// The screen as it comes on: a line across its middle that opens into the picture, which
// warms up and then flickers, a band of it slipping sideways now and then (`screenAt`).
function show(
  context: CanvasRenderingContext2D,
  { screen }: SignalLayout,
  pictures: HTMLCanvasElement[],
  { art, still }: Frame,
  ink: string
) {
  const { picture: shown, slip } = screenAt(art, still)
  const picture = pictures[shown]
  const on = still ? 1 : clamp((art - 120) / 380, 0, 1)
  if (on < 1) {
    const middle = screen.y + screen.height / 2
    const open = screen.height * easeOut(on)
    context.fillStyle = ink
    context.fillRect(
      screen.x,
      middle - 1,
      screen.width * clamp(3 * on, 0, 1),
      2
    )
    context.save()
    context.beginPath()
    context.rect(screen.x, middle - open / 2, screen.width, open)
    context.clip()
    context.drawImage(picture, screen.x, screen.y)
    context.restore()
    return
  }
  context.drawImage(picture, screen.x, screen.y)
  if (slip === undefined) return
  const top = Math.floor(hash(7 * slip) * 0.8 * screen.height)
  const rows = 8 + Math.floor(hash(11 * slip) * 18)
  const shift = Math.round((hash(13 * slip) - 0.5) * 30)
  context.drawImage(
    picture,
    0,
    top,
    screen.width,
    rows,
    screen.x + shift,
    screen.y + top,
    screen.width,
    rows
  )
}

// The engraving's top `rows` at `width` by `height` on a failing screen, in six pictures from
// noisy to settled. Each smears its light to the right as phosphor does, darkens every third
// line and adds noise: the bright in the ink, some of the dim in the mid tone, and its edges
// fray. Kept while the size and the inks hold.
const screens = remember(
  (
    image: HTMLImageElement,
    rows: number,
    width: number,
    height: number,
    ink: string,
    mid: string
  ) => {
    const source = document.createElement("canvas")
    source.width = width
    source.height = height
    const reading = source.getContext("2d", { willReadFrequently: true })!
    reading.imageSmoothingQuality = "high"
    reading.drawImage(
      image,
      0,
      0,
      image.naturalWidth,
      rows,
      0,
      0,
      width,
      height
    )
    const tones = reading.getImageData(0, 0, width, height).data
    const [bright, dim] = [channels(ink), channels(mid)]
    return [0.9, 0.55, 0.3, 0.12, 0.12, 0.12].map((amount, n) => {
      const random = noise(11 + 31 * n)
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext("2d")!
      const pixels = context.createImageData(width, height)
      for (let y = 0; y < height; y++) {
        const scan = y % 3 === 2 ? 0.45 : 1
        let glow = 0
        for (let x = 0; x < width; x++) {
          glow = Math.max(tones[4 * (y * width + x)] / 255, 0.78 * glow)
          const level = glow * scan + (random() - 0.5) * amount
          const u = (x + 0.5) / width
          const v = (y + 0.5) / height
          const frayed = Math.min(u, 1 - u, v, 1 - v) / 0.06
          if (frayed < 1 && random() > frayed) continue
          const color =
            level > 0.6 + 0.2 * (random() - 0.5)
              ? bright
              : level > 0.42 && random() < 0.22
                ? dim
                : undefined
          if (color) pixels.data.set(color, 4 * (y * width + x))
        }
      }
      context.putImageData(pixels, 0, 0)
      return canvas
    })
  }
)

// The selection frames on his back, once today's value is in: the value's grows with the
// number as it counts up, its dashes marching slowly; the baseline's over it. Each is
// labelled above its top left corner, and kept inside the `hero` with its label.
function frames(
  context: CanvasRenderingContext2D,
  layout: SignalLayout,
  hero: { width: number; height: number },
  { art, count, still, value, baseline }: Frame,
  inks: Inks
) {
  if (value === undefined || baseline === undefined) return
  const shown = value * counted(count)
  const sizes = selection(shown, baseline, layout.small)
  if (!sizes) return
  for (const [size, dash, offset, thick, words] of [
    [sizes.value, [6, 4], still ? 0 : -art / 400, 2, formatValue(shown)],
    [sizes.baseline, [2, 3], 0, 1, formatValue(baseline)],
  ] as const) {
    const box = placed(layout.back, size, hero)
    outline(context, box, [...dash], offset, thick, inks)
    label(
      context,
      words,
      [box.left + (8 * words.length + 6) / 2, box.top - 9],
      inks
    )
  }
}

// A dotted frame, on a band of the ground so that it reads over the noise.
function outline(
  context: CanvasRenderingContext2D,
  { left, top, width, height }: ReturnType<typeof placed>,
  dash: number[],
  offset: number,
  thick: number,
  { ink, ground }: Inks
) {
  const box = [left + 0.5, top + 0.5, width, height] as const
  context.strokeStyle = ground
  context.lineWidth = thick + 3
  context.strokeRect(...box)
  context.strokeStyle = ink
  context.lineWidth = thick
  context.setLineDash(dash)
  context.lineDashOffset = offset
  context.strokeRect(...box)
  context.setLineDash([])
}
