import { CARD_GAP, PIE_SIZE } from '@/constants/game'
import type { DisplayTarget, Position } from '@/types/game'

const overlaps = (position: Position, target: DisplayTarget): boolean =>
  target.exit === null &&
  position.x < target.position.x + PIE_SIZE &&
  position.x + PIE_SIZE > target.position.x &&
  position.y < target.position.y + PIE_SIZE &&
  position.y + PIE_SIZE > target.position.y

// Whether a spot is one this board can still use. Asked of a position remembered from
// the launch before: the same device gives the same board back, but a browser window
// resized between the two would leave a card hanging off the edge. A container that has
// not been measured yet answers yes — an unmeasured board is no reason to throw away a
// spot that was good for it.
export function fitsContainer(
  position: Position,
  containerW: number,
  containerH: number,
): boolean {
  if (containerW <= 0 || containerH <= 0) return true
  if (position.x < 0 || position.y < 0) return false
  return position.x + PIE_SIZE <= containerW && position.y + PIE_SIZE <= containerH
}

// Picks a non-overlapping card position inside the container. If the board is so
// tight no clear spot is found, falls back to the least-crowded candidate (the
// one farthest from its nearest neighbour) rather than a blind overlap.
export function findPosition(
  existing: readonly DisplayTarget[],
  containerW: number,
  containerH: number,
): Position {
  const maxX = containerW - PIE_SIZE - CARD_GAP
  const maxY = containerH - PIE_SIZE - CARD_GAP
  if (maxX <= 0 || maxY <= 0) return { x: CARD_GAP, y: CARD_GAP }

  const active = existing.filter((target) => target.exit === null)

  let best: Position = { x: CARD_GAP, y: CARD_GAP }
  let bestClearance = -Infinity
  for (let attempt = 0; attempt < 150; attempt++) {
    const candidate: Position = {
      x: CARD_GAP + Math.random() * (maxX - CARD_GAP),
      y: CARD_GAP + Math.random() * (maxY - CARD_GAP),
    }
    if (!active.some((target) => overlaps(candidate, target))) return candidate

    // Track the emptiest spot as a graceful fallback for a fully packed board.
    const clearance = active.reduce((min, target) => {
      const dx = candidate.x - target.position.x
      const dy = candidate.y - target.position.y
      return Math.min(min, Math.hypot(dx, dy))
    }, Number.POSITIVE_INFINITY)
    if (clearance > bestClearance) {
      bestClearance = clearance
      best = candidate
    }
  }
  return best
}
