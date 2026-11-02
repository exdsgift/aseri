import { useEffect, useRef } from "react"

import { channels, word } from "@/components/HeroArt"
import { pixel } from "@/lib/chart"
import { inked, scene } from "@/lib/margins"
import { tickWhileShown, useReducedMotion } from "@/lib/motion"

// The current travels a radian in 5 s: a bend crosses its wave in about 30 s.
const drift = 1 / 5000
// A frame every 200 ms, as the hero's art once it has arrived: in that time a bend moves a
// third of an art pixel at most.
const every = 200

// The op-art margins: one canvas fixed behind the page, a screen's worth at 2 CSS px per art
// pixel, inked only in the margins beside the column (`inked`), from the hero's foot down and
// clear of the side navigation, and drawn again as the page scrolls, so they scroll with it.
// Decorative.
export function Margins() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const element = canvas.current!
    // What the stripes keep clear of: both are on the page before this effect runs.
    const hero = document.getElementById("today")
    const nav = document.querySelector('nav[aria-label="Sections"]')
    // The gaps between the sections' content, the space each leaves under it, in page px.
    const gaps = () => {
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
    let context: CanvasRenderingContext2D | undefined
    let pixels: ImageData | undefined
    let ink = 0

    const draw = () => {
      const width = document.documentElement.clientWidth
      // A page not laid out, as in jsdom, has no margins.
      if (!width) return
      const columns = Math.ceil(width / pixel)
      const rows = Math.ceil(innerHeight / pixel) + 1
      if (pixels?.width !== columns || pixels.height !== rows) {
        element.width = columns
        element.height = rows
        element.style.width = `${columns * pixel}px`
        element.style.height = `${rows * pixel}px`
        context ??= element.getContext("2d")!
        pixels = context.createImageData(columns, rows)
        ink ||= word(
          channels(getComputedStyle(element).getPropertyValue("--border"))
        )
      }
      // Whole art pixels scroll with the page; the canvas takes up the odd CSS pixel.
      const top = Math.floor(scrollY / pixel)
      element.style.transform = `translateY(${top * pixel - scrollY}px)`
      const box = nav?.getBoundingClientRect()
      const s = scene(
        width,
        (hero?.getBoundingClientRect().bottom ?? 0) + scrollY,
        box?.width
          ? {
              left: box.left,
              right: box.right,
              top: box.top + scrollY,
              bottom: box.bottom + scrollY,
            }
          : undefined,
        reduced ? 0 : performance.now() * drift,
        gaps()
      )
      const words = new Uint32Array(pixels.data.buffer)
      words.fill(0)
      for (let j = Math.max(0, Math.floor(s.top) - top); j < rows; j++) {
        const [y, row] = [top + j, j * columns]
        for (let x = 0; x < s.left + s.reach; x++)
          if (inked(x, y, s)) words[row + x] = ink
        for (let x = s.right - s.reach; x < columns; x++)
          if (inked(x, y, s)) words[row + x] = ink
      }
      context!.putImageData(pixels, 0, 0)
    }

    let queued = 0
    const soon = () => {
      cancelAnimationFrame(queued)
      queued = requestAnimationFrame(draw)
    }
    addEventListener("scroll", soon, { passive: true })
    addEventListener("resize", soon)
    // The hero's foot, the gaps and the navigation move as the page's data arrives.
    const resized = new ResizeObserver(soon)
    for (const watched of [hero, document.querySelector("main"), nav])
      if (watched) resized.observe(watched)
    draw()
    // None while the tab is hidden.
    const stop = reduced ? undefined : tickWhileShown(element, every, draw)
    return () => {
      stop?.()
      resized.disconnect()
      cancelAnimationFrame(queued)
      removeEventListener("scroll", soon)
      removeEventListener("resize", soon)
    }
  }, [reduced])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <canvas ref={canvas} className="block [image-rendering:pixelated]" />
    </div>
  )
}
