// Renders the brand images into branding/ and the site's favicon PNGs into public/, from the
// brand page (brand/index.html, with every file in brand/formats.ts): the site's own hero art, fonts
// and tokens, and today's GPR value from the live API, through the dev server's proxy.
// Then the README's screenshots of the live site. From web/: node scripts/brand.mjs [filter],
// where `filter` keeps the files whose path holds it. Needs Playwright's Chromium and WebKit
// (npx playwright install chromium webkit); oxipng on the PATH, when there, then shrinks
// every file without changing a pixel.
import { spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { chromium, webkit } from "playwright"
import { createServer } from "vite"

const web = join(import.meta.dirname, "..")
const root = join(web, "..")
const filter = process.argv[2] ?? ""
// The API is read with a User-Agent that names the project.
const userAgent = "aseri (+https://github.com/exdsgift/aseri)"
// The live site for the README, with Messenger as the hero: at 1440 px from the top through
// the forecast panel, and an iPhone's first screen in WebKit.
const pages = [
  {
    file: "branding/screenshots/page-1440.png",
    engine: chromium,
    viewport: { width: 1440, height: 900 },
    scale: 1,
    through: "#forecast > div",
  },
  {
    file: "branding/screenshots/page-phone.png",
    engine: webkit,
    viewport: { width: 390, height: 844 },
    scale: 2,
    mobile: true,
  },
]

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
    const path = join(root, shot.file)
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
  for (const shot of pages.filter((p) => p.file.includes(filter))) {
    const engine = await shot.engine.launch()
    try {
      const context = await engine.newContext({
        viewport: shot.viewport,
        deviceScaleFactor: shot.scale,
        isMobile: shot.mobile,
        hasTouch: shot.mobile,
        reducedMotion: "reduce",
        userAgent,
      })
      await context.addInitScript(() =>
        localStorage.setItem("aseri.hero", "messenger")
      )
      const page = await context.newPage()
      await page.goto("https://exdsgift.github.io/aseri/", {
        waitUntil: "networkidle",
      })
      // The forecast panel shows once the data has loaded.
      await page.locator("#forecast").waitFor()
      await page.evaluate(() => document.fonts.ready)
      // The art and the margins draw on the frames after that.
      await page.waitForTimeout(1000)
      const height = shot.through
        ? await page
            .locator(shot.through)
            .evaluate((panel) => panel.getBoundingClientRect().bottom + 40)
        : shot.viewport.height
      const path = join(root, shot.file)
      mkdirSync(dirname(path), { recursive: true })
      await page.screenshot({
        path,
        fullPage: Boolean(shot.through),
        clip: { x: 0, y: 0, width: shot.viewport.width, height },
      })
      written.push(path)
      console.log(shot.file)
    } finally {
      await engine.close()
    }
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
