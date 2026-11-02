// The brand page: one brand image, from its URL, drawn with the site's own hero art, fonts
// and tokens, and today's GPR value from the API. scripts/brand.mjs screenshots it; it is
// not one of the build's inputs. ?format=<name>&hero=<hero>[&bare=1][&line=1|2], or
// ?avatar=hat|kanji&size=<px>: see formats.ts.
import { useEffect, useRef, type CSSProperties } from "react"
import { createRoot } from "react-dom/client"

import "@/index.css"
import { arts } from "@/components/Hero"
import { calm, type Inks } from "@/components/HeroArt"
import { loadCatalog, loadSeries } from "@/lib/api"
import { pixel } from "@/lib/chart"
import { stripes, type Scene } from "@/lib/margins"
import { messengerLayout } from "@/lib/messenger"
import { signalLayout } from "@/lib/signal"
import { vortexLayout } from "@/lib/vortex"

import { formats, lines, url, type Hero, type Plan } from "./formats"

const query = new URLSearchParams(location.search)
const sans = '"Press Start 2P", "DotGothic16", monospace'
const wordmark = '"DotGothic16", sans-serif'
// Every word casts the site's shadow: 1 px of the page, so one art pixel at any scale.
const drop = "1px 1px 0 #000000"

// The page reports to the script on its root: `ready` once drawn, or what went wrong.
const report = (fields: Record<string, string>) =>
  Object.assign(document.documentElement.dataset, fields)

// The fonts, which a canvas label or a measure must not run ahead of.
const fonts = () =>
  Promise.all([
    document.fonts.load(`16px ${sans}`, "aseri"),
    document.fonts.load(`16px ${wordmark}`, "焦りあせ"),
  ])

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load ${src}`))
    image.src = src
  })
}

// GPR's 7-day average and its baseline, as the hero reads them.
async function today() {
  const { series } = await loadCatalog()
  const entry = series.find((s) => s.series_id === "gpr_daily")
  if (!entry) throw new Error("The catalog has no gpr_daily")
  return (await loadSeries(entry, { replay: false })).today
}

// The hero's art laid out by its own layout code for a hero `size` (with a text box that
// only steers it), and how far to move it so that it lands where the plan puts it.
function place(hero: Hero, { art }: Plan, width: number, height: number) {
  if (hero === "messenger") {
    const { x, y, width: shown } = art.messenger
    // Beside the text, `shown` wide: the wide screen's layout.
    const text = { left: shown + 70, top: 0, right: width, bottom: height }
    const { figure } = messengerLayout(width, height, text)
    return { size: { width, height, text }, dx: x - figure.x, dy: y - figure.y }
  }
  if (hero === "signal") {
    const { x, y, width: shown } = art.signal
    // The light leaks in from 0.68 of the hero's width: half his width past his right.
    const wide = Math.round((20 + 1.5 * shown) / 0.68)
    const tall = Math.round(1.6 * height)
    const text = { left: shown + 60, top: 0, right: wide, bottom: tall }
    const { screen } = signalLayout(wide, tall, text)
    return {
      size: { width: wide, height: tall, text },
      dx: x - screen.x,
      dy: y - screen.y,
    }
  }
  // The stripes fill only the hero, so it must cover the image wherever the dial is: beside
  // the text (the wide screen's layout) for a dial at the left edge, else above it.
  const { x, y, ring } = art.vortex
  const beside = x <= ring + 26
  const wide = beside
    ? width + ring + 26 - x
    : 2 * Math.ceil(Math.max(x, width - x, ring + 58))
  const tall = beside
    ? Math.ceil(Math.max(height / 0.7, y / 0.3, 2 * ring + 48)) + 1
    : Math.ceil(height - y + 14 + ring)
  const text = beside
    ? { left: 2 * ring + 139, top: 0, right: wide, bottom: tall }
    : { left: 0, top: 2 * ring + 86, right: wide, bottom: tall }
  const layout = vortexLayout(wide, tall, text)
  const dx = Math.round(x - layout.center[0])
  const dy = Math.round(y - layout.center[1])
  if (
    Math.abs(layout.ring - ring) > 0.5 ||
    dx > 0 ||
    dy > 0 ||
    wide + dx < width ||
    tall + dy < height
  )
    throw new Error(`Vortex cannot cover the image with its dial at ${x}, ${y}`)
  return { size: { width: wide, height: tall, text }, dx, dy }
}

// The op-art margins at each side, `margin` of their pixels wide, in the frame colour: the
// site's stripes, in a scene of the image's own, as `scene` sizes it for the site's column.
function margins(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  margin: number,
  ink: string
) {
  if (!margin) return
  const columns = Math.ceil(width / pixel)
  const rows = Math.ceil(height / pixel)
  const scene: Scene = {
    columns,
    left: margin,
    right: columns - margin,
    margin,
    // The whole height: no hero's foot to fade in below.
    top: -Infinity,
    fade: margin,
    drift: 0,
    pitch: 10,
    swing: 8,
    gaps: [],
    reach: 0,
  }
  const layer = document.createElement("canvas")
  layer.width = columns
  layer.height = rows
  const drawing = layer.getContext("2d")!
  drawing.fillStyle = ink
  for (let y = 0; y < rows; y++) {
    const inked = stripes(y, scene)
    for (let x = 0; x < columns; x++) if (inked(x)) drawing.fillRect(x, y, 1, 1)
  }
  context.imageSmoothingEnabled = false
  context.drawImage(layer, 0, 0, columns * pixel, rows * pixel)
}

async function draw(
  canvas: HTMLCanvasElement,
  lockup: HTMLElement | null,
  plan: Plan,
  hero: Hero
) {
  await fonts()
  // The lockup on whole pixels, centred where the plan puts it.
  if (lockup && plan.lockup) {
    lockup.style.left = `${Math.round(plan.lockup.x - lockup.offsetWidth / 2)}px`
    lockup.style.top = `${Math.round(plan.lockup.y - lockup.offsetHeight / 2)}px`
  }
  const [{ sevenDayAverage, baseline, referenceDate }, image] =
    await Promise.all([today(), loadImage(arts[hero].src)])
  report({ value: String(sevenDayAverage), referenceDate })
  const width = Math.ceil(plan.width)
  const height = Math.ceil(plan.height)
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")!
  const css = getComputedStyle(canvas)
  const inks: Inks = {
    ink: css.getPropertyValue("--primary"),
    mid: css.getPropertyValue("--dim"),
    ground: css.getPropertyValue("--background"),
  }
  context.fillStyle = inks.ground
  context.fillRect(0, 0, width, height)
  margins(context, width, height, plan.margin, css.getPropertyValue("--border"))
  const { size, dx, dy } = place(hero, plan, width, height)
  context.save()
  context.translate(dx, dy)
  // The frame the motion ends on, as under reduced motion: complete and still.
  arts[hero].compose(
    size,
    inks,
    image
  )(context, {
    art: Infinity,
    count: Infinity,
    still: true,
    value: sevenDayAverage,
    baseline,
  })
  context.restore()
  // The calm behind the words, as the hero keeps it.
  if (lockup) {
    const box = lockup.getBoundingClientRect()
    const veil = calm(
      {
        width,
        height,
        text: {
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
        },
      },
      inks.ground
    )
    context.drawImage(veil.canvas, veil.left, veil.top)
  }
}

function Composition({ plan, hero }: { plan: Plan; hero: Hero }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const lockup = useRef<HTMLDivElement>(null)
  useEffect(() => {
    draw(canvas.current!, lockup.current, plan, hero).then(
      () => report({ ready: "true" }),
      (error: Error) => report({ ready: `error: ${error.message}` })
    )
  }, [plan, hero])
  const words = plan.lockup
  const line = lines[Number(query.get("line") ?? 0)]
  // A line that would take more than two lines of the column at its size takes 12 px.
  const size =
    words && line.length * words.line > 2 * words.width ? 12 : words?.line
  return (
    <div style={stage(plan.width, plan.height)}>
      <canvas
        ref={canvas}
        style={{ position: "absolute", inset: 0, imageRendering: "pixelated" }}
      />
      {words && (
        <div
          ref={lockup}
          style={{
            position: "absolute",
            maxWidth: words.width,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: Math.round(0.375 * words.mark),
            textAlign: "center",
            textShadow: drop,
            color: "var(--primary)",
          }}
        >
          {/* The site's wordmark, at this image's size. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <span lang="ja" style={{ font: `${words.mark}px/1 ${wordmark}` }}>
              焦り
            </span>
            <span
              style={{
                font: `16px/24px ${sans}`,
                color: "var(--secondary)",
                textTransform: "uppercase",
              }}
            >
              <span lang="ja">あせり</span> · aseri
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: Math.round(1.25 * words.line),
            }}
          >
            <p
              style={{
                font: `${size}px/${1.5 * size!}px ${sans}`,
                textTransform: "uppercase",
                textWrap: "balance",
              }}
            >
              {/* A sentence to a line. */}
              {line.split(/(?<=\.) /).map((sentence) => (
                <span key={sentence} style={{ display: "block" }}>
                  {sentence}
                </span>
              ))}
            </p>
            <p
              style={{
                font: `${words.link}px/${1.5 * words.link}px ${sans}`,
                color: "var(--secondary)",
              }}
            >
              {url}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// An avatar: the favicon's winged hat without its ground tile, so that it casts the words'
// shadow, or 焦, 16 px (one pixel of its grid a page pixel) on a square `size` px.
function Avatar({ mark, size }: { mark: string; size: number }) {
  const hat = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const drawn =
      mark === "hat"
        ? fetch("/favicon.svg")
            .then((response) => response.text())
            .then((svg) => {
              const parsed = new DOMParser().parseFromString(
                svg,
                "image/svg+xml"
              )
              parsed.querySelector('path[fill="#1b1bf2"]')?.remove()
              const icon = parsed.documentElement
              icon.setAttribute("width", "16")
              icon.setAttribute("height", "16")
              hat.current!.replaceChildren(icon)
            })
        : fonts()
    drawn.then(
      () => report({ ready: "true" }),
      (error: Error) => report({ ready: `error: ${error.message}` })
    )
  }, [mark])
  return (
    <div
      style={{
        ...stage(size, size),
        display: "grid",
        placeItems: "center",
        color: "var(--primary)",
      }}
    >
      {mark === "hat" ? (
        <div
          ref={hat}
          style={{
            width: 16,
            height: 16,
            filter: `drop-shadow(${drop})`,
          }}
        />
      ) : (
        <span
          lang="ja"
          style={{
            font: `16px/16px ${wordmark}`,
            textShadow: drop,
          }}
        >
          焦
        </span>
      )}
    </div>
  )
}

const stage = (width: number, height: number): CSSProperties => ({
  position: "relative",
  width,
  height,
  overflow: "hidden",
  background: "var(--background)",
})

function Brand() {
  const avatar = query.get("avatar")
  if (avatar) return <Avatar mark={avatar} size={Number(query.get("size"))} />
  const format = formats.find((f) => f.name === query.get("format"))
  if (!format) {
    report({ ready: `error: no format ${query.get("format")}` })
    return null
  }
  const hero = (query.get("hero") ?? "messenger") as Hero
  return (
    <Composition plan={format.plan({ bare: query.has("bare") })} hero={hero} />
  )
}

createRoot(document.getElementById("root")!).render(<Brand />)
