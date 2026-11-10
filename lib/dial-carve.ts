import type { DialMetrics } from '@/lib/dial-metrics'

// How a **proportional** dial is cut — see `DialSpec.proportional`. One square, split by
// rows and by columns, each as large as the share of the dial's sum it holds: a row is the
// weighted digits of its keys added up, over the same for the whole dial.
//
// Every function here is read from the pan's worklets as well as from render, so they are
// pure and carry no state; the cut itself is a plain list, which a shared value can hold and
// animate from one position of the dial to the next.

// Nothing is allowed to shrink below this share of the square. A row holding nothing would
// otherwise be no row at all, and a key with no size is a key nobody can press. A fifth of
// the side is the narrowest a key can be: about 45pt on the smallest phone, which a thumb
// can still land on.
const FLOOR = 0.2

// A cut: the share each row takes, top to bottom, then the share each column takes, left to
// right. Each run adds up to one.
export type Carve = readonly number[]

// A key's place in the dial's box, in points from its top-left corner.
export type CellRect = { x: number; y: number; width: number; height: number }

type Shape = { rows: number; cols: number }

// One run of totals as shares of their sum, none under `FLOOR`.
//
// Clamped at both ends so the shares stay exact wherever nothing is held down: two lanes
// with 0.05 and 0.95 become 0.2 and 0.8. Renormalised afterwards, for the wider dial whose
// clamps can overshoot the whole; on two lanes that does nothing.
function sharesOf(totals: readonly number[]): number[] {
  'worklet'
  const lanes = totals.length
  const sum = totals.reduce((all, total) => all + total, 0)
  const ceiling = 1 - (lanes - 1) * FLOOR
  const clamped = totals.map((total) =>
    Math.min(ceiling, Math.max(FLOOR, sum > 0 ? total / sum : 1 / lanes)),
  )
  const whole = clamped.reduce((all, share) => all + share, 0)
  return clamped.map((share) => share / whole)
}

// What each row and each column of a position holds: its keys' digits times their weights,
// added up. The figures the cut is made from, and the ones a dimension line prints.
export function laneTotals(
  dial: Shape & { weights: readonly number[] },
  grid: readonly number[],
): { rows: number[]; cols: number[] } {
  'worklet'
  const { rows, cols, weights } = dial
  const rowTotals = new Array<number>(rows).fill(0)
  const colTotals = new Array<number>(cols).fill(0)
  for (let index = 0; index < rows * cols; index++) {
    const part = (grid[index] ?? 0) * (weights[index] ?? 0)
    const row = Math.floor(index / cols)
    const col = index % cols
    rowTotals[row] = (rowTotals[row] ?? 0) + part
    colTotals[col] = (colTotals[col] ?? 0) + part
  }
  return { rows: rowTotals, cols: colTotals }
}

// The cut a position of the dial makes.
//
// A key is counted as its digit times its weight — what it is adding to the sum right now —
// so turning a key up pulls its row and its column larger. A dial standing at nought has
// nothing to go by, and is cut as if every key stood on the same digit: in the proportion
// of its weights, which on FOUR KEYS is 1 : 2 each way, the square cut into 1, 2, 2 and 4.
export function carveOf(
  dial: Shape & { weights: readonly number[] },
  grid: readonly number[],
): number[] {
  'worklet'
  const held = grid.some((digit) => digit > 0)
  const { rows, cols } = laneTotals(
    dial,
    held ? grid : new Array<number>(dial.rows * dial.cols).fill(1),
  )
  return [...sharesOf(rows), ...sharesOf(cols)]
}

// Where one lane starts and how long it is: lane `at` of `lanes`, the shares starting at
// `offset` in the cut, in a `span` that has `gap` between every two lanes.
function lane(
  carve: Carve,
  offset: number,
  lanes: number,
  at: number,
  span: number,
  gap: number,
): { start: number; size: number } {
  'worklet'
  const room = span - gap * (lanes - 1)
  let start = 0
  for (let i = 0; i < at; i++) start += (carve[offset + i] ?? 0) * room + gap
  return { start, size: (carve[offset + at] ?? 0) * room }
}

// The box key `index` fills in the dial's.
export function cellRect(
  index: number,
  carve: Carve,
  metrics: DialMetrics,
  shape: Shape,
): CellRect {
  'worklet'
  const { rows, cols } = shape
  const across = lane(carve, rows, cols, index % cols, metrics.width, metrics.gap)
  const down = lane(carve, 0, rows, Math.floor(index / cols), metrics.height, metrics.gap)
  return { x: across.start, y: down.start, width: across.size, height: down.size }
}

// Which lane a coordinate falls in. The gap between two lanes is split down the middle, as
// it is on the uniform dial, so a finger crossing it is never nowhere.
function laneAt(
  p: number,
  carve: Carve,
  offset: number,
  lanes: number,
  span: number,
  gap: number,
): number {
  'worklet'
  for (let i = 0; i < lanes - 1; i++) {
    const { start, size } = lane(carve, offset, lanes, i, span, gap)
    if (p < start + size + gap / 2) return i
  }
  return lanes - 1
}

// Which key a point in the dial's box belongs to, or none outside it — `cellAt`, for a cut
// dial.
export function carvedCellAt(
  x: number,
  y: number,
  carve: Carve,
  metrics: DialMetrics,
  shape: Shape,
): number | null {
  'worklet'
  if (metrics.width <= 0 || metrics.height <= 0) return null
  if (x < 0 || y < 0 || x >= metrics.width || y >= metrics.height) return null
  const row = laneAt(y, carve, 0, shape.rows, metrics.height, metrics.gap)
  const col = laneAt(x, carve, shape.rows, shape.cols, metrics.width, metrics.gap)
  return row * shape.cols + col
}
