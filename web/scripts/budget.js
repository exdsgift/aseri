// Fails when the page outgrows spec 6.8's budget: the JS and CSS that the built page loads,
// and the data its first load fetches from an API directory, the fixtures by default.
// node scripts/budget.js [api-dir], from web/, after `npm run build`.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { gzipSync } from "node:zlib"

// Kilobytes of 1,000 bytes, as Vite reports them.
const gzippedKB = (paths) =>
  paths.reduce((sum, path) => sum + gzipSync(readFileSync(path)).length, 0) /
  1000

// The files the built page names, not every file in site/assets, which a build never
// empties. The closing quote ends a name, so a .json is never taken for a .js.
const code = [
  ...readFileSync("../site/index.html", "utf8").matchAll(
    /assets\/[^"]+\.(?:js|css)(?=")/g
  ),
].map(([path]) => `../site/${path}`)

// What the first load fetches, as App.tsx's first effect and loadSeries in lib/api.ts do:
// the catalog, the record's scores, every series' forecast and daily values, and GPR's
// replay. The others load when their series is picked. Keep this in step with them.
const api = process.argv[2] ?? "src/fixtures"
const { series } = JSON.parse(readFileSync(join(api, "series.json"), "utf8"))
const data = [
  "series.json",
  "scores.json",
  ...series.flatMap(({ series_id, links }) =>
    series_id === "gpr_daily"
      ? [links.latest, links.actuals, links.replay]
      : [links.latest, links.actuals]
  ),
].map((path) => join(api, path))

const budgets = [
  ["JS and CSS", gzippedKB(code), 150],
  [`Initial data in ${api}`, gzippedKB(data), 100],
]
for (const [name, size, limit] of budgets)
  console.log(`${name}: ${size.toFixed(1)} KB gzipped, budget ${limit} KB`)
if (budgets.some(([, size, limit]) => size > limit)) process.exit(1)
