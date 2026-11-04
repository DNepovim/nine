import type { DisplayTarget, Position } from '@/types/game'

// Where a lost target stood, for the things a run leaves where a target was missed: its
// middle, in the board's own measure.
export const lostMark = (
  { position }: Pick<DisplayTarget, 'position'>,
  size: number,
): Position => ({ x: position.x + size / 2, y: position.y + size / 2 })

// The target whose clock ran out first, of those still standing. What ended a run on its last
// heart: the machine goes straight to game over then and the target never picks up an exit
// of its own, so the board has to be asked which one it was.
export function firstToRunOut<T extends { spawnedAt: number; duration: number }>(
  targets: readonly T[],
): T | null {
  return targets.reduce<T | null>(
    (first, target) =>
      first === null ||
      target.spawnedAt + target.duration < first.spawnedAt + first.duration
        ? target
        : first,
    null,
  )
}
