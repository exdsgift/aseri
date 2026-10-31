import mercury from "@/assets/mercury.png"
import { engrave, grown, type Art } from "@/components/HeroArt"
import {
  fan,
  fanRays,
  messengerLayout,
  type MessengerLayout,
} from "@/lib/messenger"
import { counted, easeOut } from "@/lib/motion"

// Study A, "Messenger": Goltzius's Mercury in his niche, a disc of ticks turning behind him,
// and a fan of rays from five points of him, as open as GPR's 7-day average against its
// baseline.
export const messenger: Art = {
  src: mercury,
  compose({ width, height, text }, inks, image) {
    const layout = messengerLayout(width, height, text)
    const figure =
      image && engrave(image, layout.figure.scale, inks.ink, inks.ground)
    // Far enough to leave the hero from any of the five points.
    const reach = 1.1 * Math.hypot(width, height)
    return (context, { art, count, still, value, baseline }) => {
      context.strokeStyle = inks.ink
      context.lineWidth = 1
      disc(context, layout, easeOut(art / grown), still ? 0 : art * 1e-5)
      if (figure) context.drawImage(figure, layout.figure.x, layout.figure.y)
      // The fans open with the number, step by step as it counts up.
      const opened =
        value === undefined || baseline === undefined
          ? undefined
          : fan(value * counted(count), baseline)
      if (opened)
        fans(context, layout, opened, {
          grow: easeOut(count / grown),
          reach,
          held: layout.held,
          sway: still ? undefined : count,
        })
    }
  },
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
