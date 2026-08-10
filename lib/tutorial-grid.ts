// The tutorial's dial state is a flat list of nine digits — the lessons only ever
// need per-cell access and a running sum, so there's no reason to carry the
// machine's nested Grid tuple around.

export const GRID_SIZE = 3
const CELL_COUNT = GRID_SIZE * GRID_SIZE

// weight = row order × column order. Mirrors computeSum in machines/game.ts.
export const cellWeight = (index: number): number =>
  (Math.floor(index / GRID_SIZE) + 1) * ((index % GRID_SIZE) + 1)

export const emptyCells = (): number[] => Array.from({ length: CELL_COUNT }, () => 0)

export const sumCells = (cells: readonly number[]): number =>
  cells.reduce((sum, value, index) => sum + value * cellWeight(index), 0)

// Tap / vertical swipe: ±1 with a 9 → 0 wrap, matching the game's press handling.
export const dialValue = (value: number, delta: 1 | -1): number =>
  (((value + delta) % 10) + 10) % 10

export const dialCell = (
  cells: readonly number[],
  index: number,
  delta: 1 | -1,
): number[] => cells.map((value, i) => (i === index ? dialValue(value, delta) : value))

// Horizontal swipe: jump straight to an absolute value.
export const setCell = (
  cells: readonly number[],
  index: number,
  value: number,
): number[] => cells.map((current, i) => (i === index ? value : current))
