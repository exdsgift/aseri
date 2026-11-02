// 8x12 pictograms, "#" for a pixel of the picture: the prototype's, after dos-age's stat icons.
const pictograms = {
  risk: `
........
...##...
...##...
...##...
...##...
...##...
...##...
........
...##...
...##...
........
........`,
  eye: `
........
........
........
..####..
.#....#.
#..##..#
#..##..#
.#....#.
..####..
........
........
........`,
  drop: `
........
....#...
...###..
...###..
..#####.
..#####.
..#####.
..#####.
...###..
........
........
........`,
  ship: `
........
........
....#...
....##..
....###.
....#...
.######.
.######.
..####..
........
#.#.#.#.
........`,
  siren: `
........
........
...##...
..####..
..####..
..####..
.######.
.######.
........
#..##..#
........
........`,
  drone: `
........
##....##
##....##
..#..#..
...##...
...##...
..#..#..
##....##
##....##
........
........
........`,
  band: `
........
........
........
......##
....####
##.#####
....####
......##
........
........
........
........`,
  grid: `
........
........
.##..##.
.##..##.
........
........
.##..##.
.##..##.
........
........
........
........`,
  check: `
........
........
........
......##
.....##.
#...##..
##.##...
.###....
..#.....
........
........
........`,
}

export type PictogramName = keyof typeof pictograms

// The "#" runs of a picture as a path, a pixel a unit.
const runs = (picture: string) =>
  picture
    .trim()
    .split("\n")
    .flatMap((row, y) =>
      [...row.matchAll(/#+/g)].map(
        (run) => `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`
      )
    )
    .join("")

// Marks the page's font has no glyph for, drawn in the text's colour at 2 px a pixel: which way a
// value lies from normal, and the share outside a range, on both sides.
const glyphs = {
  up: `
..#..
.###.
#####`,
  down: `
#####
.###.
..#..`,
  out: `
.#.
###
...
###
.#.`,
}

// `spaced`, before words: a gap after it. Alone, as a marker, it sits on its point.
export function Glyph({
  name,
  spaced = true,
}: {
  name: keyof typeof glyphs
  spaced?: boolean
}) {
  const rows = glyphs[name].trim().split("\n")
  return (
    <svg
      aria-hidden
      width={rows[0].length * 2}
      height={rows.length * 2}
      viewBox={`0 0 ${rows[0].length} ${rows.length}`}
      shapeRendering="crispEdges"
      className={`inline-block shrink-0 align-baseline ${spaced ? "mr-1.5" : ""}`}
    >
      <path fill="currentColor" d={runs(glyphs[name])} />
    </svg>
  )
}

// The picture knocked out of a solid block, drawn at 2 px a pixel.
export function Pictogram({ name }: { name: PictogramName }) {
  return (
    <svg
      aria-hidden
      width={16}
      height={24}
      viewBox="0 0 8 12"
      shapeRendering="crispEdges"
      className="shrink-0"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d={`M0 0h8v12H0z${runs(pictograms[name])}`}
      />
    </svg>
  )
}
