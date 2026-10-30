import { useEffect, useRef, useState } from "react"

import { useReducedMotion } from "@/lib/motion"
import { paintSun, stillSun, sunFrame, tick } from "@/lib/sun"

// CSS pixels per art pixel: chunkier than the chart, like the game's title art.
const art = 4

// The hero's art, with its box reserved so nothing moves when it draws. Decorative:
// the number and the sentence under it say in text what the sun's size shows.
export function Sun({ radius }: { radius?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState<{ width: number; height: number }>()
  const reduced = useReducedMotion()

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setBox({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    )
    observer.observe(canvas.current!)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!box) return
    const element = canvas.current!
    // shortcut: read on resize only, so a window moved to a screen of another density
    // keeps the old one until the next resize. Upgrade with a resolution media query.
    const ratio = devicePixelRatio
    element.width = Math.round(box.width * ratio)
    element.height = Math.round(box.height * ratio)
    // Whole device pixels per art pixel, so every art pixel is the same size at any zoom.
    const scale = Math.max(1, Math.round(art * ratio))
    const context = element.getContext("2d")!
    const css = getComputedStyle(element)
    const colors = {
      sun: css.getPropertyValue("--secondary"),
      halo: css.getPropertyValue("--primary"),
      star: css.getPropertyValue("--muted-foreground"),
      faint: css.getPropertyValue("--border"),
    }
    const size = {
      width: Math.ceil(element.width / scale),
      height: Math.ceil(element.height / scale),
    }
    const draw = (frame = stillSun) => {
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, element.width, element.height)
      context.setTransform(scale, 0, 0, scale, 0, 0)
      paintSun(
        (x, y, color) => {
          context.fillStyle = color
          context.fillRect(x, y, 1, 1)
        },
        size,
        radius,
        frame,
        colors
      )
    }
    if (reduced) return draw()

    // Redrawn once a tick. Animation frames stop while the tab is hidden.
    let shown: number | undefined
    let frame = requestAnimationFrame(function next(now) {
      const step = Math.floor(now / tick)
      if (step !== shown) draw(sunFrame((shown = step)))
      frame = requestAnimationFrame(next)
    })
    return () => cancelAnimationFrame(frame)
  }, [box, radius, reduced])

  return (
    <div aria-hidden className="relative -mx-4 h-56 self-stretch">
      <canvas
        ref={canvas}
        className="absolute inset-0 size-full [image-rendering:pixelated]"
      />
      <div
        className={`absolute inset-0 vignette ${reduced ? "opacity-70" : "animate-breathe"}`}
      />
    </div>
  )
}
