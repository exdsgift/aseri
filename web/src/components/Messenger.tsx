import { useEffect, useRef, useState, type RefObject } from "react"

import mercury from "@/assets/mercury.png"
import {
  engraving,
  fan,
  lit,
  messengerLayout,
  type Box,
  type MessengerLayout,
} from "@/lib/messenger"
import { tickWhileShown, useReducedMotion } from "@/lib/motion"

// About 30 frames a second: the disc turns and the rays sway smoothly, and slowly.
const frameMs = 33
const degree = Math.PI / 180

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
      setSize({
        width: Math.round(hero.width),
        height: Math.round(hero.height),
        text: {
          left: box.left - hero.left,
          top: box.top - hero.top,
          right: box.right - hero.left,
          bottom: box.bottom - hero.top,
        },
      })
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
    const figure = image && engrave(image, layout, ink, ground)
    const veil = calm(size, layout.calm, ground)
    // Far enough to leave the hero from any of the five points.
    const reach = 1.1 * Math.hypot(size.width, size.height)
    const start = performance.now()
    since.current.art ??= start
    if (value !== undefined) since.current.value ??= start

    // Under reduced motion, the frame the motion ends on, still.
    const draw = () => {
      const now = performance.now()
      const art = reduced ? Infinity : now - since.current.art!
      const rays = reduced ? Infinity : now - (since.current.value ?? now)
      context.clearRect(0, 0, size.width, size.height)
      context.strokeStyle = ink
      context.lineWidth = 1
      disc(context, layout, ease(art / 1100), reduced ? 0 : art * 1e-5)
      if (figure) context.drawImage(figure, layout.figure.x, layout.figure.y)
      // The fans open with the number's count-up, over its 640 ms and its easing.
      const opened =
        value === undefined || baseline === undefined
          ? undefined
          : fan(value * ease(rays / 640), baseline)
      if (opened)
        fans(context, layout, opened, {
          grow: ease(rays / 1100),
          reach,
          sway: reduced ? undefined : rays,
        })
      context.drawImage(veil, 0, 0)
    }
    draw()
    if (reduced) return
    // None while the tab is hidden or the hero is off screen.
    return tickWhileShown(element, frameMs, draw)
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

// Cubic ease-out, as the count-up's, of `k` from 0 to 1.
const ease = (k: number) => 1 - (1 - Math.min(Math.max(k, 0), 1)) ** 3

// A fixed number from 0 to 1 for each `n`, so each ray keeps its own length.
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// A token's "#rrggbb" as its three channels.
const rgb = (hex: string) =>
  hex
    .trim()
    .slice(1)
    .match(/../g)!
    .map((pair) => parseInt(pair, 16))

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

// Each fan, held at its point: rays from a little behind it out past the hero, grown to
// `grow` (0 to 1) of their length, each swaying a fraction of a degree out of step with the
// others over `sway` ms (none: still); then the baseline's two dashed rays.
function fans(
  context: CanvasRenderingContext2D,
  layout: MessengerLayout,
  { rays, baseline }: NonNullable<ReturnType<typeof fan>>,
  { grow, reach, sway }: { grow: number; reach: number; sway?: number }
) {
  layout.bundles.forEach(({ x, y, angle }, j) => {
    context.globalAlpha = 0.85
    context.beginPath()
    rays.forEach((offset, i) => {
      const shift =
        sway === undefined ? 0 : 0.3 * Math.sin(sway / 2300 + i * 1.7 + j * 5)
      const a = (angle + offset + shift) * degree
      const far = reach * grow * (0.75 + 0.25 * hash(i * 13 + j * 7))
      const near = layout.held * grow
      context.moveTo(x - Math.cos(a) * near, y - Math.sin(a) * near)
      context.lineTo(x + Math.cos(a) * far, y + Math.sin(a) * far)
    })
    context.stroke()
    // Once the fan has mostly grown, so they never lead it.
    if (grow > 0.6) {
      context.globalAlpha = 0.8
      context.setLineDash([3, 5])
      context.beginPath()
      for (const offset of baseline) {
        const a = (angle + offset) * degree
        context.moveTo(x, y)
        context.lineTo(
          x + Math.cos(a) * reach * grow,
          y + Math.sin(a) * reach * grow
        )
      }
      context.stroke()
      context.setLineDash([])
    }
  })
  context.globalAlpha = 1
}

// The engraving at the layout's scale, dithered again so that it stays in two inks at any
// size: its paper in the ink, its lines and the niche in the ground, nothing outside the niche.
function engrave(
  image: HTMLImageElement,
  { figure: { scale } }: MessengerLayout,
  ink: string,
  ground: string
) {
  const width = Math.round(engraving.width * scale)
  const height = Math.round(engraving.height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")!
  context.imageSmoothingQuality = "high"
  context.drawImage(image, 0, 0, width, height)
  const pixels = context.getImageData(0, 0, width, height)
  const [paper, line] = [rgb(ink), rgb(ground)]
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = 4 * (y * width + x)
      const kept = lit(x, y, pixels.data[i + 3] / 255)
      const light = lit(x, y, pixels.data[i] / 255)
      pixels.data.set(kept ? [...(light ? paper : line), 255] : [0, 0, 0, 0], i)
    }
  context.putImageData(pixels, 0, 0)
  return canvas
}

// The calm behind the text: the ground over the text and its margin, nearly opaque, so the
// art shows only faintly through, dissolving in a dither over 48 px at its edge.
function calm({ width, height }: Size, box: Box, ground: string) {
  const edge = 48
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")!
  const pixels = context.createImageData(width, height)
  const veil = [...rgb(ground), 232]
  const top = Math.max(0, Math.floor(box.top - edge))
  const left = Math.max(0, Math.floor(box.left - edge))
  for (let y = top; y < Math.min(height, box.bottom + edge); y++)
    for (let x = left; x < Math.min(width, box.right + edge); x++) {
      const d = Math.hypot(
        Math.max(box.left - x, 0, x - box.right),
        Math.max(box.top - y, 0, y - box.bottom)
      )
      if (d === 0 || (d < edge && lit(x, y, 1 - d / edge)))
        pixels.data.set(veil, 4 * (y * width + x))
    }
  context.putImageData(pixels, 0, 0)
  return canvas
}
