import { SPECTRUM } from '@/constants/colors'

// The colour of the streak badge — the ×2 / ×4 / ×8 beside a score.
//
// It climbs the game scale as the streak doubles: blue at the start of it, the purple in
// the middle, and the red at the end once the multiplier is capped. Stepping along the
// scale rather than picking a hue per tier is what makes the badge read as a thing
// getting further rather than a thing changing colour.
//
// One ladder, because the badge is drawn twice: beside the running score and on the
// points floating up to join it. Two of them would drift apart, and the pair are on
// screen together often enough for that to show.
export function multiplierColor(multiplier: number): string {
  if (multiplier >= 8) return SPECTRUM[3]
  if (multiplier >= 4) return SPECTRUM[1]
  return SPECTRUM[0]
}
