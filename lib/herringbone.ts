// A herringbone floor: planks `ratio` times as long as they are wide, laid in diagonal staircases
// of one horizontal plank and one upright one. Pure — this only says where each plank lies.

export type Plank = { x: number; y: number; width: number; height: number }

// One staircase step is a horizontal plank and an upright one, (W, W) further along each time, and
// the next staircase stands (L, -L) away: a cell of 2·L·W, which is exactly the two planks in it,
// so nothing overlaps and nothing is left bare.
export function planksOf(
  span: number,
  plankWidth: number,
  ratio: number,
  // Which stairs to start from, so the floor's centre is not always a plank's corner.
  phase = 0,
): Plank[] {
  const length = plankWidth * ratio
  const planks: Plank[] = []
  const reach = span + length * 2
  // Staircases are indexed by `s`, steps along one by `k`.
  const stairs = Math.ceil(reach / length) + 2
  const steps = Math.ceil(reach / plankWidth) + 2
  for (let s = -stairs; s <= stairs; s++) {
    for (let k = -steps; k <= steps; k++) {
      const x = s * length + k * plankWidth + phase * plankWidth
      const y = -s * length + k * plankWidth
      const horizontal = { x, y, width: length, height: plankWidth }
      const upright = {
        x: x + length,
        y: y + plankWidth - length,
        width: plankWidth,
        height: length,
      }
      for (const plank of [horizontal, upright]) {
        if (
          plank.x < span + length &&
          plank.y < span + length &&
          plank.x + plank.width > -length &&
          plank.y + plank.height > -length
        ) {
          planks.push(plank)
        }
      }
    }
  }
  return planks
}
