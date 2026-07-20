import { CARD_GAP, PIE_SIZE } from '@/constants/game'
import type { DisplayTarget, Position } from '@/types/game'

const overlaps = (position: Position, target: DisplayTarget): boolean =>
  !target.exiting &&
  position.x < target.position.x + PIE_SIZE &&
  position.x + PIE_SIZE > target.position.x &&
  position.y < target.position.y + PIE_SIZE &&
  position.y + PIE_SIZE > target.position.y

// Picks a non-overlapping card position inside the container, falling back to a
// random (possibly overlapping) spot after a bounded number of attempts.
export function findPosition(
  existing: readonly DisplayTarget[],
  containerW: number,
  containerH: number,
): Position {
  const maxX = containerW - PIE_SIZE - CARD_GAP
  const maxY = containerH - PIE_SIZE - CARD_GAP
  if (maxX <= 0 || maxY <= 0) return { x: CARD_GAP, y: CARD_GAP }

  for (let attempt = 0; attempt < 60; attempt++) {
    const candidate: Position = {
      x: CARD_GAP + Math.random() * (maxX - CARD_GAP),
      y: CARD_GAP + Math.random() * (maxY - CARD_GAP),
    }
    if (!existing.some((target) => overlaps(candidate, target))) return candidate
  }
  return { x: CARD_GAP + Math.random() * maxX, y: CARD_GAP + Math.random() * maxY }
}
