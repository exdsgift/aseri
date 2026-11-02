// Renders the brand images into branding/ at the repository's root, from the brand page
// (brand/index.html, with its formats in brand/formats.ts): the site's own hero art, fonts
// and tokens, and today's GPR value from the live API, through the dev server's proxy.
// From web/: node scripts/brand.mjs [filter], where `filter` keeps the files whose path
// holds it. Needs Playwright's Chromium (npx playwright install chromium); oxipng on the
// PATH, when there, then shrinks every file without changing a pixel.
import { spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { chromium } from "playwright"
import { createServer } from "vite"

const web = join(import.meta.dirname, "..")
const out = join(web, "../branding")
const filter = process.argv[2] ?? ""
// The API is read with a User-Agent that names the project.
const userAgent = "aseri (+https://github.com/exdsgift/aseri)"

const server = await createServer({ root: web, logLevel: "error" })
await server.listen()
const browser = await chromium.launch()
try {
  const { shots } = await server.ssrLoadModule("/brand/formats.ts")
  const base = server.resolvedUrls.local[0]
  // One browser context per scale: the device pixels per page pixel.
  const contexts = new Map()
  const written = []
  for (const shot of shots().filter((s) => s.file.includes(filter))) {
    if (!contexts.has(shot.scale))
      contexts.set(
        shot.scale,
        await browser.newContext({
          deviceScaleFactor: shot.scale,
          reducedMotion: "reduce",
          userAgent,
        })
      )
    const page = await contexts.get(shot.scale).newPage()
    await page.setViewportSize({
      width: Math.ceil(shot.width),
      height: Math.ceil(shot.height),
    })
    await page.goto(`${base}brand/index.html?${shot.query}`)
    // Drawn once: the page draws the frame the motion ends on, and never another.
    await page.waitForFunction(() => document.documentElement.dataset.ready)
    const { ready, value, referenceDate } = await page.evaluate(
      () => document.documentElement.dataset
    )
    if (ready !== "true") throw new Error(`${shot.file}: ${ready}`)
    if (value && !written.length)
      console.log(`GPR 7-day average to ${referenceDate}: ${value}`)
    const path = join(out, shot.file)
    mkdirSync(dirname(path), { recursive: true })
    // Through Chromium's own call, which keeps a half page pixel (313.5 at scale 2 is 627)
    // where Playwright's screenshot drops it.
    const cdp = await page.context().newCDPSession(page)
    const { data } = await cdp.send("Page.captureScreenshot", {
      format: "png",
      clip: {
        x: 0,
        y: 0,
        width: shot.width,
        height: shot.height,
        scale: shot.scale,
      },
    })
    writeFileSync(path, Buffer.from(data, "base64"))
    await page.close()
    written.push(path)
    console.log(shot.file)
  }
  const optimised = spawnSync(
    "oxipng",
    ["--opt", "max", "--strip", "safe", "--quiet", ...written],
    { stdio: "inherit" }
  )
  if (optimised.error)
    console.warn("No oxipng on the PATH: files left as drawn.")
  else if (optimised.status) process.exitCode = optimised.status
} finally {
  await browser.close()
  await server.close()
}
