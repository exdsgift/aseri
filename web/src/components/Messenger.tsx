import { useEffect, useRef, useState, type RefObject } from "react"

import mercury from "@/assets/mercury.png"
import {
  engraving,
  fan,
  fanRays,
  lit,
  messengerLayout,
  type Box,
  type MessengerLayout,
} from "@/lib/messenger"
import {
  counted,
  easeOut,
  tickWhileShown,
  useReducedMotion,
} from "@/lib/motion"

// About 30 frames a second while the art arrives, over `grown` ms. After it, what moves is a
// fraction of a pixel a frame: a frame every 200 ms draws the same picture for far less.
const arriving = 33
const settled = 200
const grown = 1100

type Size = { width: number; height: number; text: Box }

// The hero's art, after study A, "Messenger": Goltzius's Mercury in his niche, a disc of ticks
// turning behind him, and a fan of rays from five points of him, as open as GPR's 7-day
// average against its baseline. A layer the size of the hero, behind its `text`, which it
// keeps calm. Decorative: the number and the sentence under it say in words what it shows.
export function Messenger({
  value,
  baseline,
  text,
}: {
  value?: number
  baseline?: number
  text: RefObject<HTMLElement | null>
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<Size>()
  const [image, setImage] = useState<HTMLImageElement>()
  const reduced = useReducedMotion()
  // When the art and the value first showed: a resize, or the engraving arriving late,
  // redraws the art without replaying its arrival.
  const since = useRef<{ art?: number; value?: number }>({})
  // The engraving as last dithered: a resize that keeps its scale skips the dither.
  const engraved = useRef<{
    image?: HTMLImageElement
    scale?: number
    figure?: HTMLCanvasElement
  }>({})

  useEffect(() => {
    const loading = new Image()
    loading.onload = () => setImage(loading)
    loading.src = mercury
  }, [])

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
    const ink = css.getPropertyValue("--primary")
    const ground = css.getPropertyValue("--background")
    const layout = messengerLayout(size.width, size.height, size.text)
    const { scale } = layout.figure
    if (
      image &&
      (engraved.current.image !== image || engraved.current.scale !== scale)
    )
      engraved.current = {
        image,
        scale,
        figure: engrave(image, scale, ink, ground),
      }
    const figure = engraved.current.figure
    const veil = calm(size, layout.calm, ground)
    // Far enough to leave the hero from any of the five points.
    const reach = 1.1 * Math.hypot(size.width, size.height)
    const start = performance.now()
    since.current.art ??= start
    if (value !== undefined) since.current.value ??= start
    // The rays arrive last, with the value: until then, the disc.
    const arrived = () =>
      performance.now() - (since.current.value ?? since.current.art!) >= grown

    // Under reduced motion, the frame the motion ends on, still.
    const draw = () => {
      const now = performance.now()
      const art = reduced ? Infinity : now - since.current.art!
      const rays = reduced ? Infinity : now - (since.current.value ?? now)
      context.clearRect(0, 0, size.width, size.height)
      context.strokeStyle = ink
      context.lineWidth = 1
      disc(context, layout, easeOut(art / grown), reduced ? 0 : art * 1e-5)
      if (figure) context.drawImage(figure, layout.figure.x, layout.figure.y)
      // The fans open with the number, step by step as it counts up.
      const opened =
        value === undefined || baseline === undefined
          ? undefined
          : fan(value * counted(rays), baseline)
      if (opened)
        fans(context, layout, opened, {
          grow: easeOut(rays / grown),
          reach,
          held: layout.held,
          sway: reduced ? undefined : rays,
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
  }, [size, image, value, baseline, reduced])

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
function channels(color: string) {
  const context = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true })!
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)
  return context.getImageData(0, 0, 1, 1).data
}

// The disc behind him: 220 ticks, every fifth longer, drawn in as the page arrives
// (`shown`, 0 to 1), then turned by `turn` radians.
function disc(
  context: CanvasRenderingContext2D,
  { chest: [cx, cy], disc: [inner, outer] }: MessengerLayout,
  shown: number,
  turn: number
) {
  context.globalAlpha = 0.55
  context.beginPath()
  for (let i = 0; i < Math.floor(220 * shown); i++) {
    const angle = -Math.PI / 2 + (i / 220) * 2 * Math.PI + turn
    const from = i % 5 === 0 ? inner - 10 : inner
    context.moveTo(cx + Math.cos(angle) * from, cy + Math.sin(angle) * from)
    context.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer)
  }
  context.stroke()
  context.globalAlpha = 1
}

// Each fan's rays (see `fanRays`), then, once it has mostly grown so that they never lead
// it, the baseline's two dashed rays.
function fans(
  context: CanvasRenderingContext2D,
  layout: MessengerLayout,
  { rays, baseline }: NonNullable<ReturnType<typeof fan>>,
  frame: Parameters<typeof fanRays>[3]
) {
  layout.bundles.forEach((point, bundle) => {
    context.globalAlpha = 0.85
    context.beginPath()
    for (const { from, to } of fanRays(point, bundle, rays, frame)) {
      context.moveTo(from[0], from[1])
      context.lineTo(to[0], to[1])
    }
    context.stroke()
    if (frame.grow <= 0.6) return
    context.globalAlpha = 0.8
    context.setLineDash([3, 5])
    context.beginPath()
    for (const offset of baseline) {
      const a = ((point.angle + offset) * Math.PI) / 180
      const length = frame.reach * frame.grow
      context.moveTo(point.x, point.y)
      context.lineTo(
        point.x + Math.cos(a) * length,
        point.y + Math.sin(a) * length
      )
    }
    context.stroke()
    context.setLineDash([])
  })
  context.globalAlpha = 1
}

// The engraving at `scale`, dithered again so that it stays in two inks at any size: its
// paper in the ink, its lines and the niche in the ground, nothing outside the niche.
function engrave(
  image: HTMLImageElement,
  scale: number,
  ink: string,
  ground: string
) {
  const width = Math.round(engraving.width * scale)
  const height = Math.round(engraving.height * scale)
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

// The calm behind the text: the ground over the text and its margin, nearly opaque, so the
// art shows only faintly through, dissolving in a dither over 48 px at its edge. Only as
// big as that, within the hero, and drawn at its `left` and `top`.
function calm({ width, height }: Size, box: Box, ground: string) {
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
}
