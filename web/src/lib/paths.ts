import { type Forecast } from "@/lib/api"

// Mulberry32: a small seeded generator of uniforms in [0, 1), so a path always looks the same.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hash = (text: string) =>
  [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)

// A standard normal draw, by Box-Muller: 1 - u keeps the logarithm finite.
const gauss = (uniform: () => number) =>
  Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform())

// The standard normal CDF, through Abramowitz and Stegun's erf 7.1.26 (error under 1.5e-7).
function phi(z: number) {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const tail =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
    t *
    Math.exp(-x * x)
  return z >= 0 ? 1 - tail / 2 : tail / 2
}

// A day's quantile function at u: read off the published levels by straight lines,
// and held at the end levels beyond them. `levels` are the keys, in ascending order.
function quantileAt(
  quantiles: Record<string, number[]>,
  levels: string[],
  day: number,
  u: number
) {
  const at = (i: number) => quantiles[levels[i]][day]
  if (u <= Number(levels[0])) return at(0)
  for (let i = 1; i < levels.length; i++) {
    const [a, b] = [Number(levels[i - 1]), Number(levels[i])]
    if (u <= b) return at(i - 1) + ((at(i) - at(i - 1)) * (u - a)) / (b - a)
  }
  return at(levels.length - 1)
}

// One possible path of the days ahead, after the last daily value it starts from. Day h is
// that day's quantile at Phi(z_h), with z a Gaussian AR(1) of the series' day-to-day tie
// `rho`: each day lands in its ranges as often as they say, and moves from the day before
// as the real days did. Seeded by series, reference date and index.
export function path(forecast: Forecast, rho: number, index: number) {
  return draw(forecast, rho, index).values
}

// How many paths the page draws from each forecast.
export const PATHS = 20

// A tie of 1 would leave no room to move: the pipeline's correlations stay inside it.
const tied = (rho: number) => Math.max(-0.99, Math.min(0.99, rho))

// The paths the page shows, the most likely first: ranked by their log-likelihood under
// the AR(1) they are drawn from, in normal scores, so the first is the most typical of them.
export function ranked(forecast: Forecast, rho: number) {
  rho = tied(rho)
  return Array.from({ length: PATHS }, (_, index) => draw(forecast, rho, index))
    .map(({ values, z }) => ({
      values,
      logLikelihood: z.reduce(
        (sum, now, day) =>
          sum -
          (day === 0
            ? now * now
            : (now - rho * z[day - 1]) ** 2 / (1 - rho * rho)) /
            2,
        0
      ),
    }))
    .toSorted((a, b) => b.logLikelihood - a.logLikelihood)
}

function draw(forecast: Forecast, rho: number, index: number) {
  const uniform = seeded(
    hash(`${forecast.series} ${forecast.dates.at(-1)} ${index}`)
  )
  const levels = Object.keys(forecast.quantiles).sort(
    (a, b) => Number(a) - Number(b)
  )
  rho = tied(rho)
  const z: number[] = []
  for (let day = 0; day < forecast.targetDates.length; day++)
    z.push(
      day
        ? rho * z[day - 1] + Math.sqrt(1 - rho * rho) * gauss(uniform)
        : gauss(uniform)
    )
  return {
    z,
    values: [
      forecast.values.at(-1)!,
      ...z.map((score, day) =>
        quantileAt(forecast.quantiles, levels, day, phi(score))
      ),
    ],
  }
}
