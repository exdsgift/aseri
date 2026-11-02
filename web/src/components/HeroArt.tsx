import { useEffect, useRef, useState, type RefObject } from "react"

import { calmAround, lit, remember, type Box } from "@/lib/art"
import { tickWhileShown, useReducedMotion } from "@/lib/motion"

// About 30 frames a second while the art arrives, over `grown` ms. After it, what moves is a
// fraction of a pixel a frame: a frame every 200 ms draws the same picture for far less.
const arriving = 33
const settled = 200
export const grown = 1100

export type Size = { width: number; height: number; text: Box }
// The tokens the art paints with, as the page's CSS gives them.
export type Inks = { ink: string; mid: string; ground: string }
// One frame: milliseconds since the art showed, and into the count-up of today's value (0
// before it arrives), both Infinity when `still`, under reduced motion, for the frame the
// motion ends on.
export type Frame = {
  art: number
  count: number
  still: boolean
  value?: number
  baseline?: number
}
// A hero's art: its engraving and the engraving's credit, whether it letters the canvas, and
// how it lays out in a hero of `size`, with the engraving once it has loaded, into what
// draws each frame.
export type Art = {
  src: string
  credit: { work: string; source: string }
  lettered?: boolean
  compose: (
    size: Size,
    inks: Inks,
    image?: HTMLImageElement
  ) => (context: CanvasRenderingContext2D, frame: Frame) => void
}

// A hero's art, as a layer the size of the hero, behind its `text`, which it keeps calm.
// Decorative: the number and the sentence under it say in words what it shows.
export function HeroArt({
  art,
  value,
  baseline,
  text,
}: {
  art: Art
  value?: number
  baseline?: number
  text: RefObject<HTMLElement | null>
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<Size>()
  const [image, setImage] = useState<HTMLImageElement>()
  // Labels on the canvas wait for the pixel font, which a still frame never redraws.
  const [lettered, setLettered] = useState(false)
  const reduced = useReducedMotion()
  // When the art and the value first showed: a resize, or the engraving arriving late,
  // redraws the art without replaying its arrival.
  const since = useRef<{ art?: number; value?: number }>({})

  useEffect(() => {
    const loading = new Image()
    loading.onload = () => setImage(loading)
    loading.src = art.src
  }, [art.src])

  useEffect(() => {
    if (!art.lettered) return
    let shown = true
    document.fonts?.ready.then(() => shown && setLettered(true))
    return () => {
      shown = false
    }
  }, [art.lettered])

  useEffect(() => {
    const layer = canvas.current!.parentElement!
    const observer = new ResizeObserver(() => {
      const hero = layer.getBoundingClientRect()
      const box = text.current!.getBoundingClientRect()
      const measured: Size = {
        width: Math.round(hero.width),
        height: Math.round(hero.height),
        text: {
          left: box.left - hero.left,
          top: box.top - hero.top,
          right: box.right - hero.left,
          bottom: box.bottom - hero.top,
        },
      }
      // The same numbers redraw nothing.
      setSize((last) =>
        JSON.stringify(last) === JSON.stringify(measured) ? last : measured
      )
    })
    observer.observe(layer)
    observer.observe(text.current!)
    return () => observer.disconnect()
  }, [text])

  useEffect(() => {
    if (!size?.width || !size.height) return
    const element = canvas.current!
    // Sizing clears the canvas, so the frame is drawn at once: never a blank one.
    element.width = size.width
    element.height = size.height
    const context = element.getContext("2d")!
    const css = getComputedStyle(element)
    const inks = {
      ink: css.getPropertyValue("--primary"),
      mid: css.getPropertyValue("--dim"),
      ground: css.getPropertyValue("--background"),
    }
    const paint = art.compose(size, inks, image)
    const veil = calm(size, inks.ground)
    const start = performance.now()
    since.current.art ??= start
    if (value !== undefined) since.current.value ??= start
    // The value arrives last: until then, the art without it.
    const arrived = () =>
      performance.now() - (since.current.value ?? since.current.art!) >= grown

    const draw = () => {
      const now = performance.now()
      context.clearRect(0, 0, size.width, size.height)
      paint(context, {
        art: reduced ? Infinity : now - since.current.art!,
        count: reduced ? Infinity : now - (since.current.value ?? now),
        still: reduced,
        value,
        baseline,
      })
      context.drawImage(veil.canvas, veil.left, veil.top)
    }
    draw()
    if (reduced) return
    // None while the tab is hidden or the hero is off screen.
    let stop = tickWhileShown(element, arriving, () => {
      draw()
      if (!arrived()) return
      stop()
      stop = tickWhileShown(element, settled, draw)
    })
    return () => stop()
  }, [art, size, image, lettered, value, baseline, reduced])

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <canvas ref={canvas} className="block [image-rendering:pixelated]" />
    </div>
  )
}

// Any CSS colour as its four channels: a canvas paints it and reads the pixel back, so no
// token syntax can break the art. A colour the canvas refuses reads as its default, black.
export function channels(color: string) {
  const context = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true })!
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)
  return context.getImageData(0, 0, 1, 1).data
}

// A dithered engraving (its paper's red channel 255, its lines' 0, transparent outside its
// cut) at `scale`, dithered again so that it stays in two inks at any size: its paper in
// the ink, its lines in the ground. Kept while the scale and the inks hold.
export const engrave = remember(
  (image: HTMLImageElement, scale: number, ink: string, ground: string) => {
    const width = Math.round(image.naturalWidth * scale)
    const height = Math.round(image.naturalHeight * scale)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d", { willReadFrequently: true })!
    context.imageSmoothingQuality = "high"
    context.drawImage(image, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height)
    const data = pixels.data
    const [paper, line] = [channels(ink), channels(ground)]
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = 4 * (y * width + x)
        const kept = lit(x, y, data[i + 3] / 255)
        const color = lit(x, y, data[i] / 255) ? paper : line
        data[i] = color[0]
        data[i + 1] = color[1]
        data[i + 2] = color[2]
        data[i + 3] = kept ? 255 : 0
      }
    context.putImageData(pixels, 0, 0)
    return canvas
  }
)

// A label on the art, as the study's selection frames have: the ground's words on a block of
// ink, centred on (x, y). Press Start 2P draws each character 8 px wide at 8 px.
export function label(
  context: CanvasRenderingContext2D,
  words: string,
  [x, y]: number[],
  { ink, ground }: Inks
) {
  const width = 8 * words.length + 6
  context.fillStyle = ink
  context.fillRect(Math.round(x - width / 2), Math.round(y - 6), width, 12)
  context.fillStyle = ground
  context.font = '8px "Press Start 2P", monospace'
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText(words, Math.round(x), Math.round(y) + 1)
}

// The calm behind the text: the ground over the text and its margin, nearly opaque, so the
// art shows only faintly through, dissolving in a dither over 48 px at its edge. Only as
// big as that, within the hero, and drawn at its `left` and `top`. Kept while the hero's
// size and the ground hold: today's value arriving changes neither.
export const calm = remember((size: Size, ground: string) => {
  const { width, height } = size
  const box = calmAround(size.text)
  const edge = 48
  const left = Math.max(0, Math.floor(box.left - edge))
  const top = Math.max(0, Math.floor(box.top - edge))
  const right = Math.min(width, Math.ceil(box.right + edge))
  const bottom = Math.min(height, Math.ceil(box.bottom + edge))
  const canvas = document.createElement("canvas")
  canvas.width = right - left
  canvas.height = bottom - top
  const context = canvas.getContext("2d")!
  const pixels = context.createImageData(canvas.width, canvas.height)
  const color = channels(ground)
  for (let y = top; y < bottom; y++)
    for (let x = left; x < right; x++) {
      const d = Math.hypot(
        Math.max(box.left - x, 0, x - box.right),
        Math.max(box.top - y, 0, y - box.bottom)
      )
      if (d > 0 && !(d < edge && lit(x, y, 1 - d / edge))) continue
      const i = 4 * ((y - top) * canvas.width + (x - left))
      pixels.data[i] = color[0]
      pixels.data[i + 1] = color[1]
      pixels.data[i + 2] = color[2]
      pixels.data[i + 3] = 232
    }
  context.putImageData(pixels, 0, 0)
  return { canvas, left, top }
})
