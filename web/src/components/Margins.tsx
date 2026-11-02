import { useEffect, useRef } from "react"

import { channels, word } from "@/components/HeroArt"
import { pixel } from "@/lib/chart"
import { phone, scene, stripes } from "@/lib/margins"
import { tickWhileShown, useReducedMotion } from "@/lib/motion"

// The current travels a radian in 5 s: a bend crosses its wave in about 30 s.
const drift = 1 / 5000
// A frame every 200 ms, as the hero's art once it has arrived: in that time a bend moves a
// third of an art pixel at most.
const every = 200
// The ground the stripes leave round the side navigation.
const clear = 24

// The gaps between the sections' content, the space each leaves under it, in page px.
function sectionGaps() {
  const blocks = [
    ...(document.querySelector("main")?.children ?? []),
    ...document.getElementsByTagName("footer"),
  ].map((block) => {
    const { top, bottom } = block.getBoundingClientRect()
    const under = parseFloat(getComputedStyle(block).paddingBottom) || 0
    return [top + scrollY, bottom + scrollY - under]
  })
  return blocks.slice(1).map(([top], i) => [blocks[i][1], top])
}

// The op-art margins: a canvas down each side of the page, in the page, so the stripes scroll
// with it as smoothly as it scrolls, at 2 CSS px per art pixel from the hero's foot to the
// page's end, inked only in the margins beside the column and, on a phone, the gaps between
// the sections (`stripes`). The layout is read when it changes, never per frame: a frame
// only redraws the drift. A fixed halo of the ground, under the page's own content, keeps
// the stripes 24 px clear of the side navigation. Decorative.
export function Margins() {
  const layer = useRef<HTMLDivElement>(null)
  const halo = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvases = [...layer.current!.children] as HTMLCanvasElement[]
    // What the stripes keep clear of: both are on the page before this effect runs.
    const hero = document.getElementById("today")
    const nav = document.querySelector('nav[aria-label="Sections"]')
    let layout: { width: number; top: number; gaps: number[][] } | undefined
    let sides: {
      context: CanvasRenderingContext2D
      pixels: ImageData
      from: number
    }[] = []
    let ink = 0
    // The drift drawn, in whole art rows (36 a radian): none yet.
    let shown = -1

    // Each 36th of a radian of drift moves the stripes up one whole row: a step moves the
    // picture's rows up, and works out again only the rows that are not their lower
    // neighbour's, the hero's fade, each gap and the rows above it, and those coming in at
    // the foot. A new layout, or a long pause, draws it all.
    const draw = () => {
      if (!layout) return
      const step = reduced ? 0 : Math.floor(performance.now() * drift * 36)
      if (step === shown) return
      const { width, top, gaps } = layout
      const s = scene(width, top, step / 36, gaps)
      const first = Math.floor(s.top)
      const moved = step - shown
      for (const { context, pixels, from } of sides) {
        const { width: columns, height: rows } = pixels
        const words = new Uint32Array(pixels.data.buffer)
        const whole = shown < 0 || moved >= rows
        if (!whole) words.copyWithin(0, moved * columns)
        const fresh = whole
          ? [[0, rows]]
          : [
              [0, s.fade + 2],
              ...s.gaps.map(([from, to]) => [
                Math.floor(from) - first - moved - 1,
                Math.ceil(to) - first + 1,
              ]),
              [rows - moved, rows],
            ]
        for (const [start, end] of fresh)
          for (let j = Math.max(0, start); j < Math.min(rows, end); j++) {
            const inked = stripes(first + j, s)
            for (let i = 0; i < columns; i++)
              words[j * columns + i] = inked(from + i) ? ink : 0
          }
        context.putImageData(pixels, 0, 0)
      }
      shown = step
    }

    const measure = () => {
      const width = document.documentElement.clientWidth
      // A page not laid out, as in jsdom, has no margins.
      if (!width) return
      // Every read first, then every write.
      const top = (hero?.getBoundingClientRect().bottom ?? 0) + scrollY
      const height = document.documentElement.scrollHeight
      const gaps = width < phone ? sectionGaps() : []
      const box = nav?.getBoundingClientRect()
      ink ||= word(
        channels(getComputedStyle(canvases[0]).getPropertyValue("--border"))
      )
      layout = { width, top, gaps }
      const s = scene(width, top, 0, gaps)
      const first = Math.floor(s.top)
      const rows = Math.max(0, Math.ceil(height / pixel) - first)
      const spans = [
        [0, s.left + s.reach],
        [s.right - s.reach, s.columns],
      ]
      sides = spans.flatMap(([from, to], i) => {
        const canvas = canvases[i]
        const columns = to - from
        canvas.hidden = columns <= 0 || !rows
        if (canvas.hidden) return []
        canvas.width = columns
        canvas.height = rows
        Object.assign(canvas.style, {
          left: `${from * pixel}px`,
          top: `${first * pixel}px`,
          width: `${columns * pixel}px`,
          height: `${rows * pixel}px`,
        })
        const context = canvas.getContext("2d")!
        const pixels = context.createImageData(columns, rows)
        return [{ context, pixels, from }]
      })
      shown = -1
      halo.current!.hidden = !box?.width
      if (box?.width)
        Object.assign(halo.current!.style, {
          left: `${box.left - clear}px`,
          top: `${box.top - clear}px`,
          width: `${box.width + 2 * clear}px`,
          height: `${box.height + 2 * clear}px`,
        })
      draw()
    }

    // The hero's foot, the page's length and the navigation change as the data and the
    // fonts arrive, and with the screen's width; a scroll changes none of them.
    const resized = new ResizeObserver(measure)
    for (const watched of [document.body, hero, nav])
      if (watched) resized.observe(watched)
    let live = true
    document.fonts?.ready.then(() => live && measure())
    measure()
    // None while the tab is hidden or the stripes are off screen, above them in the hero.
    const stop = reduced ? undefined : tickWhileShown(canvases[0], every, draw)
    return () => {
      live = false
      stop?.()
      resized.disconnect()
    }
  }, [reduced])

  // Never the scroll anchor: first on the page and as long as it, the layer would be picked,
  // and anchoring would keep it still instead of what the reader is reading.
  return (
    <>
      <div
        ref={layer}
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [overflow-anchor:none]"
      >
        <canvas className="absolute [image-rendering:pixelated]" />
        <canvas className="absolute [image-rendering:pixelated]" />
      </div>
      <div
        ref={halo}
        data-halo
        hidden
        aria-hidden
        className="pointer-events-none fixed -z-5 bg-background"
      />
    </>
  )
}
