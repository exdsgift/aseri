import { useEffect, useRef, useState } from "react"

import { tickWhileShown, useReducedMotion } from "@/lib/motion"
import {
  artHeight,
  paintSun,
  stillSun,
  sunFrame,
  tick,
  type SunFrame,
} from "@/lib/sun"

// CSS pixels per art pixel, as in the prototype: chunkier than the chart.
const art = 4

// The hero's art: a 360 px layer behind the wordmark and the text, so it moves nothing.
// Decorative: the number and the sentence under it say in text what the sun shows.
export function Sun({ radius }: { radius?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  // In art pixels: the canvas is drawn small and scaled up without smoothing.
  const [width, setWidth] = useState(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.ceil(entry.contentRect.width / art))
    )
    observer.observe(canvas.current!.parentElement!)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!width) return
    const element = canvas.current!
    // Sizing clears the canvas, so the frame is drawn at once: never a blank one.
    element.width = width
    element.height = artHeight
    const context = element.getContext("2d")!
    const css = getComputedStyle(element)
    const colors = {
      sun: css.getPropertyValue("--secondary"),
      halo: css.getPropertyValue("--primary"),
      star: css.getPropertyValue("--muted-foreground"),
      faint: css.getPropertyValue("--border"),
    }
    const draw = (frame: SunFrame) => {
      // Pixels grouped by colour, in the order first painted, so later colours stay on top.
      const byColor = new Map<string, number[]>()
      paintSun(
        (x, y, color) => {
          if (!byColor.has(color)) byColor.set(color, [])
          byColor.get(color)!.push(x, y)
        },
        width,
        radius,
        frame,
        colors
      )
      context.clearRect(0, 0, width, artHeight)
      for (const [color, xy] of byColor) {
        context.fillStyle = color
        for (let i = 0; i < xy.length; i += 2)
          context.fillRect(xy[i], xy[i + 1], 1, 1)
      }
    }
    if (reduced) return draw(stillSun)

    // One tick every 260 ms, and none while the tab is hidden or the hero is off screen.
    let step = 0
    draw(sunFrame(step))
    return tickWhileShown(element, tick, () => draw(sunFrame(++step)))
  }, [width, radius, reduced])

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex h-[360px] justify-center overflow-hidden"
    >
      {/* Exactly 4 CSS px an art pixel: a few px wider than the layer, centred and clipped. */}
      <canvas
        ref={canvas}
        className="h-full shrink-0 origin-[50%_136px] [mask-image:linear-gradient(to_bottom,#000_40%,transparent_100%)] [image-rendering:pixelated] motion-safe:animate-sun-pulse"
        style={{ width: width * art }}
      />
      <div className="absolute inset-0 opacity-70 vignette motion-safe:animate-breathe" />
    </div>
  )
}
