// The dial a run is played on: how many keys it has, how they are arranged, what each
// key multiplies its digit by, and how far a digit goes.
//
// All of that was once a single hard-coded fact — nine keys in a square, weights 1 to 9,
// digits 0–9, sums reaching 324 — spread across the scoring DP, the gesture reader, the
// layout arithmetic and the guide. It is data now, because a mode is allowed to change
// it: a challenge that wants a 2 × 4 dial, or keys that only count to five, hands the
// engine a different dial and nothing in the engine learns that there is more than one.
//
// The dial the game has always been played on is `NINE_DIAL`, and every mode shipped
// today uses it, so nothing about a run changes by this being a parameter.

export type DialSpec = {
  // What the dial is called wherever one has to be named — the key a stored run is
  // checked against, so a run put away on one dial is never put back on another.
  id: string
  rows: number
  cols: number
  // Row-major, one per key: what the key multiplies its digit by.
  weights: readonly number[]
  // How many values a key takes, counted from zero: 10 is the digits 0–9.
  digits: number
  // The highest sum the dial reaches, which is the top of every target range on it.
  // Derived rather than given, so it can never disagree with the weights above it.
  maxSum: number
}

// One position of the dial: every key's digit, row-major.
//
// Flat rather than rows of rows, which is what it was while there was only ever one
// dial. A dial is an arrangement of a list of keys, and the arrangement is the
// DialSpec's business — so a position is the list, and nothing holding one has to know
// the shape it is drawn in. Which also makes every per-key question — the weights, the
// scoring DP's layers, a gesture's cell, the tutorial's lit key — one index rather than
// a pair, and all of those were already indexing a flattened copy.
export type Grid = readonly number[]

// The weight of the key at row `r`, column `c` on the dial the game grew up on: its row
// order times its column order, counting both from one. The rule the guide prints.
const byPosition = (cols: number) => (_: number, index: number) =>
  (Math.floor(index / cols) + 1) * ((index % cols) + 1)

// A dial, with everything derivable derived. `weights` defaults to row order × column
// order, which is the rule every dial in the app follows and the one the guide explains.
export function defineDial({
  id,
  rows,
  cols,
  weights,
  digits = 10,
}: {
  id: string
  rows: number
  cols: number
  weights?: readonly number[]
  digits?: number
}): DialSpec {
  const cells = rows * cols
  const spread = weights ?? Array.from({ length: cells }, byPosition(cols))
  const top = Math.max(0, digits - 1)
  return {
    id,
    rows,
    cols,
    weights: spread,
    digits,
    maxSum: spread.reduce((sum, weight) => sum + weight * top, 0),
  }
}

// The dial the game is played on, and the only one any shipped mode uses: three rows of
// three, each key a digit 0–9, weights 1 through 9 and sums reaching 324.
export const NINE_DIAL = defineDial({ id: 'nine', rows: 3, cols: 3 })

// How many keys a dial has.
export const cellCount = (dial: DialSpec): number => dial.rows * dial.cols

// Every key index, in the order they are drawn and the order a position is stored in.
// Anything that has to say something per key counts through this rather than its own
// literal, so a key's index means the same thing to the pan, the lesson and the machine.
export const cellsOf = (dial: DialSpec): readonly number[] =>
  Array.from({ length: cellCount(dial) }, (_, index) => index)

// What one key multiplies its digit by. The dial needs it to label a button and the
// coach needs it to tell a fine key from a coarse one.
export const weightAt = (dial: DialSpec, index: number): number =>
  dial.weights[index] ?? 0

// The weights laid back out in rows, for the one place that draws them as a table — the
// guide's explanation of what a key is worth.
export const weightRows = (dial: DialSpec): readonly (readonly number[])[] =>
  Array.from({ length: dial.rows }, (_, row) =>
    dial.weights.slice(row * dial.cols, (row + 1) * dial.cols),
  )

// The dial every run but a scripted one opens on: every key at zero.
export const emptyGrid = (dial: DialSpec): Grid =>
  new Array<number>(cellCount(dial)).fill(0)

// What the dial currently adds up to — every key's digit times what that key is worth.
// The number a target is matched against, and the one printed above the dial.
export const sumOf = (dial: DialSpec, grid: Grid): number =>
  grid.reduce((sum, value, index) => sum + value * weightAt(dial, index), 0)

// Where a key lands when it is stepped. Wraps at both ends, so neither direction is
// ever a dead press: the top digit taps round to zero and a swipe down off zero lands on
// the top.
const stepValue = (dial: DialSpec, value: number, delta: 1 | -1): number =>
  (((value + delta) % dial.digits) + dial.digits) % dial.digits

// The dial after one key is stepped.
//
// Exported because Trainee's coach applies a press itself, to compare the route before
// against the route after while the machine's snapshot still holds the position from
// before. A second copy of the wrap arithmetic was the alternative.
export const pressGrid = (
  dial: DialSpec,
  grid: Grid,
  index: number,
  delta: 1 | -1,
): Grid => grid.map((value, i) => (i === index ? stepValue(dial, value, delta) : value))

// The dial after one key is set outright — a swipe left to the floor, a swipe right to
// the ceiling.
export const setGrid = (grid: Grid, index: number, value: number): Grid =>
  grid.map((held, i) => (i === index ? value : held))
