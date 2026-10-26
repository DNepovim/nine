import { CARD_ENTER_MS, GLIMPSE_FADE_MS } from '@/constants/game'
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

// How long a card holds its number from the moment it mounts, in ms — or null where the
// run hides no number, and nought for a card drawn already hidden.
//
// The run's **glimpse** less whatever of it has already gone, counted from the target's
// own arrival and read back off the ring: whatever share of the clock has gone is time the
// number has already been on the board. A card drawn the moment its target is dealt has a
// few milliseconds gone, so it shows all but those; a card put back from storage long after
// its target arrived has nothing left.
//
// Two adjustments, both about what the player can actually read. What is left is held
// *after* the card's entrance, since a number fading up and springing in is not yet one
// anybody can read — so the entrance is added on top. And a remainder shorter than the
// fade is not shown at all: a number put back at full strength only to fade straight away
// would be a second glimpse of something already spent. The floor is never more than half
// the glimpse itself, so a card dealt live in a mode with a glimpse shorter than the fade
// still shows its number — a floor of the full fade would hide every card from the start.
export function glimpseLeft(
  glimpse: number | null,
  startProgress: number,
  duration: number,
): number | null {
  if (glimpse === null) return null
  const left = Math.round(glimpse - (1 - startProgress) * duration)
  if (left < Math.min(GLIMPSE_FADE_MS, glimpse / 2)) return 0
  return left + CARD_ENTER_MS
}
