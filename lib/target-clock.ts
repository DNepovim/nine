import type { Target } from '@/machines/game'

// How much of a target's clock is left, as the fraction its ring draws: 1 for one that
// has just arrived, 0 for one that has run out.
//
// The ring is a Reanimated value that starts full and drains, which is right for every
// target that spawns while the app is open and wrong for the one kind that does not. A
// target put back from storage arrives mid-clock, and a ring starting full would hand
// the player back time the run had already spent — and a countdown the machine's own
// figures disagree with. This is what it starts at instead.
export function remainingFraction(target: Target, now: number): number {
  if (target.duration <= 0) return 0
  const left = target.duration - (now - target.spawnedAt)
  return Math.min(1, Math.max(0, left / target.duration))
}
