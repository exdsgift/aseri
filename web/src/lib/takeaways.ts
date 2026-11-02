import { awayFromNormal } from "@/lib/format"

// The words each block leads with, computed from the data every day: its takeaway first,
// so a reader who reads only the first words still gets it (the study's change 3).

// Which way the target day leans against today's like-for-like value, from the chance that it
// lands above it. Past 65 in 100 either way is a lean; the thresholds are the study's design
// choice, not a sourced rule.
export const direction = (chanceAbove: number) =>
  chanceAbove > 0.65
    ? "likely higher than now"
    : chanceAbove < 0.35
      ? "likely lower than now"
      : "about where it is now"

// Up to the next 5%, and never under it: "within 15%".
const within = (percents: number[]) =>
  Math.max(5, Math.ceil(Math.max(...percents.map(Math.abs)) / 5) * 5)

// The signal furthest from normal, and how far the others of its kind stay, when it has a kind
// ("lanes"); all of them at once when none is 25% off.
export function signalsTitle(
  signals: { name: string; kind?: string; percent: number }[]
) {
  const lead = signals.reduce((a, b) =>
    Math.abs(b.percent) > Math.abs(a.percent) ? b : a
  )
  if (Math.abs(lead.percent) < 25)
    return `All signals within ${within(signals.map((s) => s.percent))}% of normal`
  const peers = signals.filter(
    (s) => s !== lead && s.kind && s.kind === lead.kind
  )
  return `${lead.name} ${awayFromNormal(lead.percent)}${peers.length ? `; other ${lead.kind} within ${within(peers.map((s) => s.percent))}%` : ""}`
}

// How many of the record's squares landed in range. "Close to" while the share stays within two
// standard errors of 8 in 10, as an honest range's would.
export function recordTitle(squares: boolean[], backtest: boolean) {
  if (!squares.length) return "No forecast scored yet"
  const hits = squares.filter(Boolean).length
  const rate = hits / squares.length
  const against =
    Math.abs(rate - 0.8) <= 2 * Math.sqrt(0.16 / squares.length)
      ? "close to"
      : rate < 0.8
        ? "fewer than"
        : "more than"
  return `${backtest ? "Backtest: " : ""}${hits} of ${squares.length} forecasts landed in range, ${against} the 8 in 10 promised`
}

// The simple rules a forecast's misses are compared with, as the pipeline keys them, in plain
// words: a "mean" is a known stumbling block. A key not named here reads as itself.
const baselines: Record<string, string> = {
  naive: "just repeating the last value",
  snaive7: "the same weekday a week back",
  mean28: "a simple 4-week average",
}

// The middle estimate's misses against the series' own simple rule, as a size: better or worse
// only where the pipeline's interval says so, about as good otherwise.
export function skill(
  versus: { ratio: number | null; verdict: string | null },
  baseline: string
) {
  const { ratio, verdict } = versus
  const rule = baselines[baseline] ?? baseline
  if (ratio === null || verdict === null) return "-"
  // Never 0%: the interval already said better or worse.
  const size = Math.max(1, Math.round(Math.abs(1 - ratio) * 100))
  if (verdict === "beats") return `${size}% smaller misses than ${rule}`
  if (verdict === "loses") return `${size}% bigger misses than ${rule}`
  return `About as good as ${rule}`
}

// How often the range held what happened, beside the 8 in 10 it aims for.
export const coverage = (rate: number) =>
  `${Math.round(rate * 100)}% landed in range · aim 80%`
