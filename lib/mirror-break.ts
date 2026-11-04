import { seeded } from '@/lib/rng'

// The drawings of a mirror breaking, for MIRROR's lost hearts: a crack for each one, and the
// whole glass in pieces for the last.
//
// Seeded, so a crack is the same crack on every render, and so a test can hold the pieces to
// covering the glass. All of it in fractions of the screen rather than in points, since the
// shapes are decided before anything knows how big the screen is. A crack's rays are the
// exception: they are drawn on the screen as it stands, so they take its size.

type Point = { x: number; y: number }

export type CrackRay = { path: string; length: number }

const RAYS = 9
const SEGMENTS = 5
// How far a ray wanders off its line per segment, and how long a side branch runs, as parts
// of a segment.
const WANDER = 0.45
const BRANCH = 2
const BRANCH_ANGLE = 0.6

const lengthOf = (points: readonly Point[]): number =>
  points.reduce((total, point, index) => {
    const before = points[index - 1]
    return before === undefined
      ? total
      : total + Math.hypot(point.x - before.x, point.y - before.y)
  }, 0)

const pathOf = (points: readonly Point[]): string =>
  points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(' ')

// A jagged line out from `from`, along `angle`.
function walk(
  from: Point,
  angle: number,
  step: number,
  segments: number,
  rng: () => number,
): Point[] {
  const points = [from]
  for (let segment = 1; segment <= segments; segment += 1) {
    const last = points[points.length - 1] ?? from
    const turned = angle + (rng() - 0.5) * 2 * WANDER
    points.push({
      x: last.x + Math.cos(turned) * step,
      y: last.y + Math.sin(turned) * step,
    })
  }
  return points
}

// A crack: jagged rays out from where the glass was struck, each with a branch off its middle.
// `reach` is how far the longest ray runs, in points.
export function crackRays(center: Point, reach: number, seed: number): CrackRay[] {
  const rng = seeded(seed)
  return Array.from({ length: RAYS }, (_, ray) => {
    const angle = (ray / RAYS) * 2 * Math.PI + (rng() - 0.5) * 0.5
    const step = (reach * (0.45 + rng() * 0.55)) / SEGMENTS
    const line = walk(center, angle, step, SEGMENTS, rng)
    const fork = line[Math.floor(SEGMENTS / 2)] ?? center
    const side = rng() < 0.5 ? -1 : 1
    const branch = walk(fork, angle + side * BRANCH_ANGLE, step, BRANCH, rng)
    return [line, branch]
  })
    .flat()
    .map((points) => ({ path: pathOf(points), length: lengthOf(points) }))
}

export type Shard = {
  // Its four corners, clockwise from the top-left, as fractions of the screen.
  corners: readonly [Point, Point, Point, Point]
  // How far from the point of impact, nought to one: the nearest pieces go first.
  distance: number
  // Nought-centred, -1 to 1: which way it turns and drifts as it falls.
  spin: number
  drift: number
  // How much light this piece happens to catch, nought to one.
  glint: number
}

// How far a corner inside the glass may stray, as a part of its cell.
const JITTER = 0.32

// The whole glass in pieces: a grid with its inner corners pushed about, so neighbours share
// their corners exactly and the pieces leave no gap and no overlap. The outer edge stays put.
export function shatterShards(
  cols: number,
  rows: number,
  impact: Point,
  seed: number,
): Shard[] {
  const rng = seeded(seed)
  const corners = Array.from({ length: rows + 1 }, (_, row) =>
    Array.from({ length: cols + 1 }, (_, col) => {
      const inner = row > 0 && row < rows && col > 0 && col < cols
      return {
        x: (col + (inner ? (rng() - 0.5) * 2 * JITTER : 0)) / cols,
        y: (row + (inner ? (rng() - 0.5) * 2 * JITTER : 0)) / rows,
      }
    }),
  )
  const at = (row: number, col: number): Point => corners[row]?.[col] ?? { x: 0, y: 0 }
  const farthest = Math.hypot(
    Math.max(impact.x, 1 - impact.x),
    Math.max(impact.y, 1 - impact.y),
  )
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col): Shard => {
      const shape = [
        at(row, col),
        at(row, col + 1),
        at(row + 1, col + 1),
        at(row + 1, col),
      ] as const
      const x = (shape[0].x + shape[1].x + shape[2].x + shape[3].x) / 4
      const y = (shape[0].y + shape[1].y + shape[2].y + shape[3].y) / 4
      return {
        corners: shape,
        distance: Math.hypot(x - impact.x, y - impact.y) / farthest,
        spin: rng() * 2 - 1,
        drift: rng() * 2 - 1,
        glint: rng(),
      }
    }),
  ).flat()
}
