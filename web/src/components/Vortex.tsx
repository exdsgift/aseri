import apollo from "@/assets/apollo.png"
import {
  channels,
  engrave,
  grown,
  label,
  type Art,
  type Frame,
  type Inks,
} from "@/components/HeroArt"
import { noise, remember } from "@/lib/art"
import { formatValue } from "@/lib/format"
import { counted, easeOut } from "@/lib/motion"
import {
  armDegrees,
  armPoints,
  dialTicks,
  vortexLayout,
  type VortexLayout,
} from "@/lib/vortex"

// Study C, "Vortex": the Apollo Belvedere's head at the eye of an op-art vortex, and a solid
// arm turning one degree per point of GPR's 7-day average from the head to the ring.
export const vortex: Art = {
  src: apollo,
  compose({ width, height, text }, inks, image) {
    const layout = vortexLayout(width, height, text)
    const {
      center: [x, y],
      head,
      ring,
    } = layout
    const field = polar(width, height, x, y, head, ring)
    const face =
      image &&
      engrave(image, (2 * head) / image.naturalWidth, inks.ink, inks.ground)
    const [ink, ground] = [channels(inks.ink), channels(inks.ground)]
    return (context, frame) => {
      // The vortex winds up as the number counts up.
      const turned =
        frame.value === undefined
          ? undefined
          : armDegrees(frame.value * counted(frame.count))
      stripes(context, field, turned ?? 0, frame, ink, ground)
      if (face)
        context.drawImage(face, Math.round(x - head), Math.round(y - head))
      dial(context, layout, frame, turned, inks)
    }
  },
}

// The hero at half its resolution, about the vortex's eye at (x, y): each cell's angle
// clockwise from the top, its radius on a log scale from the head (0) to the ring (1), or
// -1 under the head, its checker square and its grain. Kept while the size holds.
const polar = remember(
  (
    width: number,
    height: number,
    x: number,
    y: number,
    head: number,
    ring: number
  ) => {
    const [w, h] = [Math.ceil(width / 2), Math.ceil(height / 2)]
    const random = noise(3)
    const angle = new Float32Array(w * h)
    const radius = new Float32Array(w * h)
    const square = new Uint8Array(w * h)
    const grain = new Uint8Array(w * h)
    const span = Math.log(ring / head)
    for (let row = 0, i = 0; row < h; row++)
      for (let column = 0; column < w; column++, i++) {
        const [dx, dy] = [2 * column + 1 - x, 2 * row + 1 - y]
        const r = Math.hypot(dx, dy)
        angle[i] = Math.atan2(dx, -dy)
        radius[i] = r < head - 1 ? -1 : Math.max(0, Math.log(r / head) / span)
        square[i] = (Math.floor(column / 18) + Math.floor(row / 18)) & 1
        grain[i] = Math.floor(random() * 255)
      }
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const context = canvas.getContext("2d")!
    const pixels = context.createImageData(w, h)
    return { w, h, angle, radius, square, grain, canvas, context, pixels }
  }
)

// The vortex in two inks. Inside the ring, twelve stippled arms turn `turned` degrees from
// the head to the ring, the solid arm along one of them. Outside, stripes curve on, turning
// about once in 15 minutes, through checker squares that invert and stipple them, their
// grain shifting each tick.
function stripes(
  context: CanvasRenderingContext2D,
  field: ReturnType<typeof polar>,
  turned: number,
  { art, still }: Frame,
  ink: Uint8ClampedArray,
  ground: Uint8ClampedArray
) {
  const twist = (turned * Math.PI) / 180
  const turn = still ? 0 : art * 7e-6
  const shift = still ? 0 : Math.floor(art / 200) % 3
  const [cut, sparse] = [[232, 238, 244][shift], [30, 22, 38][shift]]
  const data = field.pixels.data
  for (let i = 0; i < field.angle.length; i++) {
    const r = field.radius[i]
    if (r < 0) {
      data[4 * i + 3] = 0
      continue
    }
    const checker = ((i % field.w) + Math.floor(i / field.w)) % 2 === 0
    const grain = field.grain[i]
    let inked: boolean
    if (r <= 1) {
      const s = (field.angle[i] - twist * r) * (6 / Math.PI) + 0.19
      inked = s - Math.floor(s) < 0.38 && (grain < 140 || checker)
    } else {
      const s =
        (field.angle[i] - twist - 0.45 * (r - 1) - turn) * (28 / Math.PI)
      const stripe = s - Math.floor(s) < 0.5
      inked = field.square[i]
        ? stripe
          ? grain < sparse
          : checker || grain < 90
        : stripe && grain < cut
    }
    data.set(inked ? ink : ground, 4 * i)
  }
  field.context.putImageData(field.pixels, 0, 0)
  context.imageSmoothingEnabled = false
  context.drawImage(field.canvas, 0, 0, 2 * field.w, 2 * field.h)
}

// The dial over the vortex: a ring about the head and the outer ring, then, with today's
// value, the ticks sweeping round as the number counts up, the solid arm out to the value,
// and the labels: the baseline's outside the ring, the value's at the arm's end.
function dial(
  context: CanvasRenderingContext2D,
  { center: [x, y], head, ring }: VortexLayout,
  { count, value, baseline }: Frame,
  turned: number | undefined,
  inks: Inks
) {
  const circle = (radius: number, thick: number, color: string) => {
    context.lineWidth = thick
    context.strokeStyle = color
    context.beginPath()
    context.arc(x, y, radius, 0, 2 * Math.PI)
    context.stroke()
  }
  circle(head + 1, 6, inks.ground)
  circle(head + 1, 2, inks.ink)
  circle(ring, 5, inks.ground)
  circle(ring, 1, inks.ink)
  if (value === undefined || baseline === undefined || turned === undefined)
    return
  // A point `radius` from the eye, `degrees` clockwise from the top.
  const along = (degrees: number, radius: number) => {
    const a = (degrees * Math.PI) / 180
    return [x + Math.sin(a) * radius, y - Math.cos(a) * radius]
  }
  const swept = 360 * easeOut(count / grown)
  const ticks = dialTicks(baseline).filter((tick) => tick.degrees <= swept)
  // Each tick on a band of the ground, as the rings are, so it reads over the stripes.
  for (const [thick, color] of [
    [3, inks.ground],
    [1, inks.ink],
  ] as const) {
    context.lineWidth = thick
    context.strokeStyle = color
    context.beginPath()
    for (const { degrees, length } of ticks) {
      const [[x0, y0], [x1, y1]] = [ring, ring + length].map((r) =>
        along(degrees, r)
      )
      context.moveTo(x0, y0)
      context.lineTo(x1, y1)
    }
    context.stroke()
  }

  const points = armPoints([x, y], head, ring, turned)
  const path = () => {
    context.beginPath()
    for (const [px, py] of points) context.lineTo(px, py)
    context.stroke()
  }
  context.lineCap = "round"
  for (const [thick, color] of [
    [11, inks.ground],
    [7, inks.ink],
  ] as const) {
    context.lineWidth = thick
    context.strokeStyle = color
    path()
  }
  context.lineWidth = 1
  context.strokeStyle = inks.ground
  context.setLineDash([4, 4])
  path()
  context.setLineDash([])
  context.lineCap = "butt"
  const [ex, ey] = points.at(-1)!
  context.fillStyle = inks.ink
  context.beginPath()
  context.arc(ex, ey, 6, 0, 2 * Math.PI)
  context.fill()

  for (const tick of ticks)
    if (tick.label)
      label(context, tick.label, along(tick.degrees, ring + 30), inks)
  label(
    context,
    formatValue(value * counted(count)),
    along(turned, ring - 16),
    inks
  )
}
