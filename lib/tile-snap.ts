// Where a target's tile lands on the wall's grid: the cell nearest to where it was dealt.
//
// Everything is in window coordinates until the end, because the grid is the dial's and the
// board the target stands in is another box on the same screen. `grid` is where any one cell of
// it starts, `board` where the board does, and the answer is back in the board's own.
//
// Two targets dealt `size` apart on either axis land in different cells, which is what the
// spawner's own spacing guarantees at the size of a disc — so tiles never share a cell as long
// as a tile is no bigger than that. The cell is then kept on the screen: one that would hang
// off an edge is moved a whole cell in.
export type Spot = { x: number; y: number }

export function snapToGrid({
  at,
  board,
  grid,
  size,
  width,
}: {
  at: Spot
  board: Spot
  grid: Spot
  size: number
  // The width of the screen, for the right-hand edge.
  width: number
}): Spot {
  if (size <= 0) return at
  const cell = (point: number, boardOrigin: number, gridOrigin: number) =>
    Math.round((point + boardOrigin - gridOrigin) / size)
  const cx = cell(at.x, board.x, grid.x)
  const cy = cell(at.y, board.y, grid.y)
  let x = grid.x + cx * size
  const y = grid.y + cy * size
  if (x < 0) x += size
  else if (x + size > width) x -= size
  return { x: x - board.x, y: y - board.y }
}
