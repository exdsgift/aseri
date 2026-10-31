// Fails when the page outgrows spec 6.8's budget: the JS and CSS that the built page loads,
// and the data its first load fetches (App.tsx), on the fixtures, which mirror the API.
import { readFileSync } from "node:fs"
import { gzipSync } from "node:zlib"

// Kilobytes of 1,000 bytes, as Vite reports them.
const gzippedKB = (paths) =>
  paths.reduce((sum, path) => sum + gzipSync(readFileSync(path)).length, 0) /
  1000

// The files the built page names, not every file in site/assets, which a build never empties.
const code = [
  ...readFileSync("../site/index.html", "utf8").matchAll(
    /assets\/[^"]+\.(?:js|css)/g
  ),
].map(([path]) => `../site/${path}`)

// The catalog, the record's scores, every series' forecast and daily values, and GPR's
// replay: the others load when their series is picked.
const api = "src/fixtures/"
const { series } = JSON.parse(readFileSync(`${api}series.json`, "utf8"))
const data = [
  "series.json",
  "scores.json",
  ...series.flatMap(({ series_id, links }) =>
    series_id === "gpr_daily"
      ? [links.latest, links.actuals, links.replay]
      : [links.latest, links.actuals]
  ),
].map((path) => api + path)

const budgets = [
  ["JS and CSS", gzippedKB(code), 150],
  ["Initial data", gzippedKB(data), 100],
]
for (const [name, size, limit] of budgets)
  console.log(`${name}: ${size.toFixed(1)} KB gzipped, budget ${limit} KB`)
if (budgets.some(([, size, limit]) => size > limit)) process.exit(1)
