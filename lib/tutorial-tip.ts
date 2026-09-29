import { PIE_SIZE } from '@/constants/game'
import type { Position } from '@/types/game'

// Where the lesson's pointing card goes, and which way its beak turns.
//
// `top` is measured from the top of the spawn canvas, the same origin a target's own
// position uses. `beakAt` is how far along the card's width the beak sits, 0 to 1 — the
// card spans the canvas, so a fraction is all it needs to be aimed.
export type TipPlacement = { top: number; beak: 'up' | 'down'; beakAt: number }

// The gap between the card and the thing it points at. Enough that the beak reads as
// reaching for the target rather than touching it.
const TIP_GAP = 6

// The card for the target: under it where there is room, over it where there is not.
//
// Anchored to the target rather than parked somewhere fixed, because the target is placed
// at random and a card in a fixed band would sooner or later be drawn across it — pointing
// at something it was covering. Flipping to the other side is the ordinary tooltip
// behaviour and it is what keeps the two apart on a short board.
export function tipForTarget(
  position: Position,
  canvasHeight: number,
  cardHeight: number,
): TipPlacement {
  const beakAt = position.x + PIE_SIZE / 2
  const below = position.y + PIE_SIZE + TIP_GAP
  const fitsBelow = below + cardHeight <= canvasHeight
  return {
    // Held inside the canvas on the up side too: a target sitting against the top edge
    // has no room above it either, and a negative top would draw the card over the band
    // above the board.
    top: fitsBelow ? below : Math.max(0, position.y - cardHeight - TIP_GAP),
    beak: fitsBelow ? 'up' : 'down',
    beakAt,
  }
}
