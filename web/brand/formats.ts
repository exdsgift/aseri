// Every brand image: its format's size and layout, read by the brand page (main.tsx) and
// by scripts/brand.mjs, which screenshots each one into branding/<folder>/<file>.

export const heroes = ["messenger", "signal", "vortex"] as const
export type Hero = (typeof heroes)[number]

// The lines under the wordmark: the first by default, the others as alternatives.
export const lines = [
  "Geopolitical risk, forecast daily",
  "Daily forecasts of geopolitical risk, with an honest track record",
  "Open forecasts. Every one archived. Every miss shown.",
]
export const url = "exdsgift.github.io/aseri"

// Where Mercury's or Hercules' engraving goes: its top left and its width, at most the
// engraving's own 360 px and, to keep the wide screen's layout, at least 190.
export type Figure = { x: number; y: number; width: number }
// Where Apollo's dial goes: its centre and its ring's radius. Its stripes fill the image.
export type Dial = { x: number; y: number; ring: number }
// The wordmark, the line and the URL, centred on (x, y) in a column `width` wide: the
// wordmark `mark` px (a multiple of DotGothic16's 16), the line `line` px, the URL `link`.
export type Lockup = {
  x: number
  y: number
  width: number
  mark: number
  line: number
  link: number
}
// A composition in the page's px, where an art pixel is one px, as on the site; the image
// is `scale` times as big. `margin` is the op-art stripes' width at each side, in the
// margins' 2 px pixels; `lockup` is absent from an art-only image.
export type Plan = {
  width: number
  height: number
  scale: number
  margin: number
  lockup?: Lockup
  art: { messenger: Figure; signal: Figure; vortex: Dial }
}

// The image's size in its own pixels, as each platform asks for it, and where it is used.
export type Format = {
  folder: string
  name: string
  pixels: [number, number]
  plan: (options: { bare: boolean }) => Plan
}

// Art beside the lockup, for the 2:1 to 3:1 previews at scale 2: a social card is shown
// at about half its size, where 1 px lines would blur away.
const card = (width: number, height: number, lockupX: number): Plan => ({
  width,
  height,
  scale: 2,
  margin: 10,
  lockup: {
    x: lockupX,
    y: height / 2,
    width: 280,
    mark: 80,
    line: 16,
    link: 12,
  },
  art: {
    messenger: { x: 36, y: 6, width: 196 },
    signal: { x: 36, y: 10, width: 200 },
    vortex: { x: 122, y: Math.round(height / 2), ring: 96 },
  },
})

export const formats: Format[] = [
  {
    folder: "linkedin-banner",
    name: "linkedin-banner",
    pixels: [1584, 396],
    // LinkedIn's round profile photo covers the left of the lower half: nothing there but
    // the ground, the rays and the stripes.
    plan: ({ bare }) => ({
      width: 1584,
      height: 396,
      scale: 1,
      margin: 36,
      lockup: bare
        ? undefined
        : { x: 1236, y: 198, width: 560, mark: 128, line: 16, link: 12 },
      art: bare
        ? {
            messenger: { x: 940, y: 4, width: 360 },
            signal: { x: 640, y: 8, width: 360 },
            vortex: { x: 1040, y: 194, ring: 180 },
          }
        : {
            messenger: { x: 612, y: 4, width: 300 },
            signal: { x: 620, y: 8, width: 300 },
            vortex: { x: 700, y: 164, ring: 150 },
          },
    }),
  },
  {
    folder: "linkedin-post",
    name: "linkedin-post",
    pixels: [1200, 627],
    // 627 is odd: the page is 313.5 px tall, and the screenshot takes the half pixel.
    plan: () => card(600, 313.5, 440),
  },
  {
    folder: "linkedin-post",
    name: "linkedin-post-square",
    pixels: [1080, 1080],
    plan: () => ({
      width: 540,
      height: 540,
      scale: 2,
      margin: 10,
      lockup: { x: 372, y: 396, width: 320, mark: 80, line: 16, link: 12 },
      art: {
        messenger: { x: 24, y: 12, width: 240 },
        signal: { x: 24, y: 20, width: 240 },
        vortex: { x: 164, y: 168, ring: 138 },
      },
    }),
  },
  {
    folder: "linkedin-post",
    name: "linkedin-post-portrait",
    pixels: [1080, 1350],
    plan: () => ({
      width: 540,
      height: 675,
      scale: 2,
      margin: 10,
      lockup: { x: 270, y: 520, width: 420, mark: 96, line: 16, link: 12 },
      art: {
        messenger: { x: 160, y: 8, width: 220 },
        signal: { x: 150, y: 16, width: 240 },
        vortex: { x: 270, y: 184, ring: 170 },
      },
    }),
  },
  {
    folder: "og",
    name: "og",
    pixels: [1200, 630],
    plan: () => card(600, 315, 440),
  },
  {
    folder: "x-header",
    name: "x-header",
    pixels: [1500, 500],
    // X's round profile photo covers the left of the lower half, as LinkedIn's does, and
    // some screens crop the top and bottom: the lockup stays in the middle band.
    plan: () => ({
      width: 750,
      height: 250,
      scale: 2,
      margin: 10,
      lockup: { x: 560, y: 125, width: 340, mark: 64, line: 12, link: 12 },
      art: {
        messenger: { x: 196, y: 4, width: 190 },
        signal: { x: 196, y: 8, width: 190 },
        vortex: { x: 300, y: 112, ring: 98 },
      },
    }),
  },
  {
    folder: "github-social",
    name: "github-social",
    pixels: [1280, 640],
    plan: () => card(640, 320, 466),
  },
]

// The avatars: the first favicon's winged hat, or 焦, 16 px on its own grid, centred on the
// ground in a square `size` px of the page, at `scale`: each pixel of the mark is `scale`
// of the image's, and the mark, 64% of the side, keeps inside the circle a platform crops.
export const avatars = [
  { mark: "hat", pixels: 400, size: 25, scale: 16 },
  { mark: "hat", pixels: 1024, size: 25.6, scale: 40 },
  { mark: "kanji", pixels: 400, size: 25, scale: 16 },
  { mark: "kanji", pixels: 1024, size: 25.6, scale: 40 },
] as const

// The hero whose image gets the alternative lines and the art-only banner's twins.
export const alternativesFor: Hero = "messenger"

// The site's favicons: the touch icon, the hat avatar at 7 (180 px, the hat 112), and
// public/favicon.svg, that same icon on its 7 px grid (owner's choice: the margin round the hat),
// drawn at 16 and 32 px.
const favicons = [
  {
    file: "web/public/favicon-16.png",
    query: "avatar=favicon&size=16",
    size: 16,
    scale: 1,
  },
  {
    file: "web/public/favicon-32.png",
    query: "avatar=favicon&size=16",
    size: 16,
    scale: 2,
  },
  {
    file: "web/public/apple-touch-icon.png",
    query: `avatar=hat&size=${180 / 7}`,
    size: 180 / 7,
    scale: 7,
  },
]

// Every image: its file from the repository's root, the page's query for it, its size in
// the page's px and its scale.
export function shots() {
  const all: {
    file: string
    query: string
    width: number
    height: number
    scale: number
  }[] = []
  for (const format of formats)
    for (const hero of heroes)
      for (const variant of [
        { suffix: "", query: "" },
        ...(format.name === "linkedin-banner"
          ? [{ suffix: "-art", query: "&bare=1" }]
          : []),
        ...(format.name === "linkedin-banner" || format.name === "linkedin-post"
          ? hero === alternativesFor
            ? [
                { suffix: "-line2", query: "&line=1" },
                { suffix: "-line3", query: "&line=2" },
              ]
            : []
          : []),
      ]) {
        const { width, height, scale } = format.plan({
          bare: variant.query.includes("bare"),
        })
        const query = `format=${format.name}&hero=${hero}${variant.query}`
        const name = `${format.folder}/${format.name}-${hero}${variant.suffix}`
        all.push({ file: `branding/${name}.png`, query, width, height, scale })
        // The banner is shown near its full size: a retina screen gets twice the pixels.
        if (
          format.name === "linkedin-banner" &&
          !variant.suffix.includes("line")
        )
          all.push({
            file: `branding/${name}@2x.png`,
            query,
            width,
            height,
            scale: 2 * scale,
          })
      }
  for (const avatar of avatars)
    all.push({
      file: `branding/avatar/avatar-${avatar.mark}-${avatar.pixels}.png`,
      query: `avatar=${avatar.mark}&size=${avatar.size}`,
      width: avatar.size,
      height: avatar.size,
      scale: avatar.scale,
    })
  for (const { file, query, size, scale } of favicons)
    all.push({ file, query, width: size, height: size, scale })
  return all
}
