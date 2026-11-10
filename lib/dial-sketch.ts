import type { Carve } from '@/lib/dial-carve'

// The drawing a **proportional** dial is: the square in pencil, its cuts, and the dimension
// lines — *kóty* — a technical drawing puts round what it shows. Everything here is the
// geometry of those lines, as the path strings an SVG takes, in points from the dial box's
// top-left corner. Pure, and read from the UI thread once a frame while the cuts move.

// How far past the box the drawing reaches on every side, which is the room the svg that
// draws it is given. The deepest thing in it is a dimension line's extension.
export const SKETCH_PAD = 32

// A construction line runs past where it meets the next one, as a pencil rule does.
const OVERSHOOT = 7

// The dimension lines. `OFFSET` is how far outside the box the line itself runs, `FROM` how
// far off the box an extension line starts, and `BEYOND` how far one carries on past its
// dimension line. An arrow is `ARROW` long and `HALF_ARROW` either side of its axis.
export const DIM = { OFFSET: 18, FROM: 4, BEYOND: 5, ARROW: 7, HALF_ARROW: 2.2 } as const

// Where the cuts stand along one axis: `lanes + 1` places, nought to `span`, the first and
// last being the box's own edges. `offset` is where the axis's shares start in the cut.
export function edgesOf(
  carve: Carve,
  offset: number,
  lanes: number,
  span: number,
): number[] {
  'worklet'
  const edges = [0]
  for (let i = 0; i < lanes; i++) {
    edges.push((edges[i] ?? 0) + (carve[offset + i] ?? 0) * span)
  }
  return edges
}

const last = (list: readonly number[]): number => {
  'worklet'
  return list[list.length - 1] ?? 0
}

// How the drawing is made over an opening's `sweep`, nought to one: the square is ruled, then
// cut, then the keys come up in grey, then the dimensions are drawn and their arrows and figures
// written, and the top bar's items drawn in. Each is a stretch of the sweep and the next starts before the last is done, as a hand
// does not wait for the pencil to stop.
export const DRAW = {
  outer: [0, 0.35],
  cuts: [0.3, 0.55],
  keys: [0.5, 0.7],
  dims: [0.6, 0.85],
  marks: [0.8, 1],
  // The rows above the dial, drawn in beside it: the run's name, then the game's, then the way out.
  title: [0.05, 0.3],
  name: [0.2, 0.45],
  menu: [0.35, 0.6],
  // Then the row under it: the hearts, and the score.
  hearts: [0.6, 0.78],
  score: [0.7, 0.88],
} as const satisfies Record<string, readonly [number, number]>

// How far through its stretch the sweep is, nought to one.
export function phaseOf(sweep: number, [from, to]: readonly [number, number]): number {
  'worklet'
  return Math.min(1, Math.max(0, (sweep - from) / (to - from)))
}

// One ruled line, drawn as far as `progress` of it — nothing at nought, since a round-capped
// line of no length would still leave a dot.
const ruled = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  progress: number,
): string => {
  'worklet'
  if (progress <= 0) return ''
  return `M${x1} ${y1}L${x1 + (x2 - x1) * progress} ${y1 + (y2 - y1) * progress}`
}

// The square and its cuts as pencil lines. `dx` and `dy` move the whole drawing, so a second
// stroke can be laid beside the first; `outer` and `cuts` are how much of the edges and of the
// cuts are ruled so far.
export function frameD(
  xs: readonly number[],
  ys: readonly number[],
  dx = 0,
  dy = 0,
  outer = 1,
  cuts = 1,
): string {
  'worklet'
  const left = (xs[0] ?? 0) - OVERSHOOT + dx
  const right = last(xs) + OVERSHOOT + dx
  const top = (ys[0] ?? 0) - OVERSHOOT + dy
  const bottom = last(ys) + OVERSHOOT + dy
  let d = ''
  for (let i = 0; i < ys.length; i++) {
    const y = (ys[i] ?? 0) + dy
    d += ruled(left, y, right, y, i === 0 || i === ys.length - 1 ? outer : cuts)
  }
  for (let i = 0; i < xs.length; i++) {
    const x = (xs[i] ?? 0) + dx
    d += ruled(x, top, x, bottom, i === 0 || i === xs.length - 1 ? outer : cuts)
  }
  return d
}

// The thin lines of the dimensions: an extension line off every cut and the dimension line
// between each two, drawn as far as `progress` of their length. Columns are measured along the
// bottom, rows down the left.
export function dimensionD(
  xs: readonly number[],
  ys: readonly number[],
  progress = 1,
): string {
  'worklet'
  const bottom = last(ys) + DIM.OFFSET
  const left = (xs[0] ?? 0) - DIM.OFFSET
  let d = ''
  for (const x of xs) {
    d += ruled(x, last(ys) + DIM.FROM, x, bottom + DIM.BEYOND, progress)
  }
  for (let i = 0; i < xs.length - 1; i++) {
    d += ruled(xs[i] ?? 0, bottom, xs[i + 1] ?? 0, bottom, progress)
  }
  for (const y of ys) {
    d += ruled((xs[0] ?? 0) - DIM.FROM, y, left - DIM.BEYOND, y, progress)
  }
  for (let i = 0; i < ys.length - 1; i++) {
    d += ruled(left, ys[i] ?? 0, left, ys[i + 1] ?? 0, progress)
  }
  return d
}

// The arrowheads, filled: one at each end of every dimension line, its tip on the extension
// line it touches.
export function arrowsD(xs: readonly number[], ys: readonly number[]): string {
  'worklet'
  const { ARROW, HALF_ARROW } = DIM
  const bottom = last(ys) + DIM.OFFSET
  const left = (xs[0] ?? 0) - DIM.OFFSET
  let d = ''
  for (let i = 0; i < xs.length - 1; i++) {
    const from = xs[i] ?? 0
    const to = xs[i + 1] ?? 0
    d += `M${from} ${bottom}L${from + ARROW} ${bottom - HALF_ARROW}L${from + ARROW} ${bottom + HALF_ARROW}Z`
    d += `M${to} ${bottom}L${to - ARROW} ${bottom - HALF_ARROW}L${to - ARROW} ${bottom + HALF_ARROW}Z`
  }
  for (let i = 0; i < ys.length - 1; i++) {
    const from = ys[i] ?? 0
    const to = ys[i + 1] ?? 0
    d += `M${left} ${from}L${left - HALF_ARROW} ${from + ARROW}L${left + HALF_ARROW} ${from + ARROW}Z`
    d += `M${left} ${to}L${left - HALF_ARROW} ${to - ARROW}L${left + HALF_ARROW} ${to - ARROW}Z`
  }
  return d
}
