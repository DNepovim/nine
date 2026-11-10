// The painted patterns of FOUR BY FOUR's azulejo panel. A **tile** is drawn in a 100 × 100 box from
// petals, rings, beads and scrolls laid in fourfold symmetry round the middle, the way a
// tile-painter's one quarter is turned to make the whole. Pure: the shapes are a function of
// which tile it is and how much is painted on it, and the screen only fills them.
//
// How much is painted is the tile's **level**, nought to nine. A key is the level of its digit —
// a plain tile at 0, the fullest at 9 — so the pattern is a second reading of the value, and a
// wall tile is drawn at a level of its own. Every level keeps the middle clear for a digit,
// unless the tile is drawn with a `centre` of its own, as a wall tile is.
//
// A tile is two paths, because the two are painted differently: `fill` is solid paint (petals,
// beads, scrolls) and `stroke` is line (rings, frames, stars), drawn in one ink.

export type TileMotif = { fill: string; stroke: string }

export const TILE_LEVELS = 10
export const TOP_LEVEL = TILE_LEVELS - 1

const SIZE = 100
const MID = SIZE / 2

type Point = readonly [number, number]

const r2 = (n: number) => Math.round(n * 100) / 100
const at = (angle: number, radius: number): Point => [
  MID + radius * Math.cos(angle),
  MID + radius * Math.sin(angle),
]
const fmt = ([x, y]: Point) => `${r2(x)} ${r2(y)}`

// A leaf from `from` out to `to` along `angle`, `width` across at its fullest.
function leaf(angle: number, from: number, to: number, width: number): string {
  const start = at(angle, from)
  const tip = at(angle, to)
  const mid = at(angle, (from + to) / 2)
  const side: Point = [-Math.sin(angle) * width * 2, Math.cos(angle) * width * 2]
  const left: Point = [mid[0] + side[0], mid[1] + side[1]]
  const right: Point = [mid[0] - side[0], mid[1] - side[1]]
  return `M${fmt(start)}Q${fmt(left)} ${fmt(tip)}Q${fmt(right)} ${fmt(start)}Z`
}

// A full circle as a closed path, so it can be filled as a bead or stroked as a ring.
function circle(centre: Point, radius: number): string {
  const [x, y] = centre
  return `M${r2(x - radius)} ${r2(y)}a${radius} ${radius} 0 1 0 ${r2(2 * radius)} 0a${radius} ${radius} 0 1 0 ${r2(-2 * radius)} 0Z`
}

const polygon = (points: readonly Point[]): string => `M${points.map(fmt).join('L')}Z`

const ring = (count: number, radius: number, from = 0): Point[] =>
  Array.from({ length: count }, (_, i) => at(from + (i * 2 * Math.PI) / count, radius))

const petals = (count: number, from: number, to: number, width: number, turn = 0) =>
  Array.from({ length: count }, (_, i) =>
    leaf(turn + (i * 2 * Math.PI) / count, from, to, width),
  ).join('')

const beads = (count: number, radius: number, size: number, from = 0) =>
  ring(count, radius, from)
    .map((p) => circle(p, size))
    .join('')

// The points of one scroll's stem, in the top-left corner: where it starts, its two bends, and the
// hook it curls into.
const SCROLL_STEM: readonly Point[] = [
  [6, 6],
  [30, 4],
  [34, 22],
  [20, 24],
  [16, 14],
  [24, 12],
  [26, 14],
]

// A scroll in one corner: a hooked stem that curls in on itself, turned into each of the four.
function scroll(quarter: number): string {
  const angle = (quarter * Math.PI) / 2
  const turn = (p: Point): Point => {
    const dx = p[0] - MID
    const dy = p[1] - MID
    return [
      MID + dx * Math.cos(angle) - dy * Math.sin(angle),
      MID + dx * Math.sin(angle) + dy * Math.cos(angle),
    ]
  }
  const at = SCROLL_STEM.map((p) => fmt(turn(p)))
  return `M${at.slice(0, 1).join('')}C${at.slice(1, 4).join(' ')}C${at.slice(4).join(' ')}`
}

const SCROLLS = [0, 1, 2, 3].map(scroll).join('')

// What varies between one tile and the next at the same level: how many petals the full tile has,
// whether the corners carry scrolls, and which star it is framed with.
const PETAL_COUNTS = [8, 12, 10, 16] as const
const STAR_POINTS = [8, 6, 10] as const

// One tile at one level. `index` picks the tile's own variations, `level` how much of it is
// painted — each level adds a layer to the one below, so a tile only ever gets richer.
export function tileAt(index: number, level: number, centre = false): TileMotif {
  const top = Math.max(0, Math.min(TOP_LEVEL, Math.round(level)))
  const n = PETAL_COUNTS[index % PETAL_COUNTS.length] ?? 8
  const star = STAR_POINTS[index % STAR_POINTS.length] ?? 8
  const scrolled = Math.floor(index / 4) % 2 === 0

  const fill: string[] = []
  const stroke: string[] = []

  // 0 — the plain tile, with the thin frame every tile has.
  stroke.push(
    polygon([
      [8, 8],
      [92, 8],
      [92, 92],
      [8, 92],
    ]),
  )
  // 1 — a bead in every corner.
  if (top >= 1) fill.push(beads(4, 58, 2.4, Math.PI / 4))
  // 2 — a small leaf reaching into each corner.
  if (top >= 2) fill.push(petals(4, 46, 62, 4, Math.PI / 4))
  // 3 — a ring round the middle, clear of the digit.
  if (top >= 3) stroke.push(circle([MID, MID], 24))
  // 4 — four leaves standing on the ring.
  if (top >= 4) fill.push(petals(4, 28, 44, 7))
  // 5 — the tile's own full count of leaves, small ones between the four.
  if (top >= 5) fill.push(petals(n, 28, 42, 4.5, Math.PI / n))
  // 6 — a beading round the digit.
  if (top >= 6) fill.push(beads(n, 19, 1.4))
  // 7 — a scroll in each corner, or a second leaf where the tile has none.
  if (top >= 7) {
    if (scrolled) stroke.push(SCROLLS)
    else fill.push(petals(4, 50, 70, 6, Math.PI / 4))
  }
  // 8 — a star and a second ring about the whole.
  if (top >= 8) {
    stroke.push(
      polygon(
        Array.from({ length: star * 2 }, (_, i) =>
          at((i * Math.PI) / star, i % 2 === 0 ? 47 : 36),
        ),
      ),
      circle([MID, MID], 47),
    )
  }
  // 9 — the full tile: a ring of beads between, and leaves between those.
  if (top >= 9) {
    fill.push(beads(n * 2, 53, 1.3, Math.PI / (n * 2)), petals(n, 12, 20, 2.6))
  }
  // A wall tile has no digit on it, so the middle is painted too.
  if (centre) {
    fill.push(petals(n, 6, 20, 4), circle([MID, MID], 4))
    stroke.push(circle([MID, MID], 24))
  }

  return { fill: fill.join(''), stroke: stroke.join('') }
}
