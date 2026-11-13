import { useEffect } from 'react'
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { GLIMPSE_FADE_MS } from '@/constants/game'

// How long a pie's numeral shows before it fades — its **glimpse** — and its coming back
// to be seen leaving. Returns the numeral's opacity, which nothing else drives.
export function usePieGlimpse({
  glimpse,
  active,
  revealed,
}: {
  glimpse: number | null
  active: boolean
  revealed: boolean
}) {
  // The numeral alone, so a glimpse never has to touch the swell, the squash or the
  // colour the exits drive.
  const numberOpacity = useSharedValue(glimpse === 0 ? 0 : 1)
  // What is left of the glimpse, in ms — run down like `progress`, so it stops where it
  // stands when the run pauses and goes on from there.
  const glimpseHeld = useSharedValue(glimpse ?? 0)

  // The glimpse, run the way the clock is run: down while the card is live, held where it
  // stands while it is not. A pause is the case that asks for it — the glimpse is the one
  // look the player gets, and a pause just after an arrival would otherwise spend it behind
  // the pause screen, where nobody can see anything. Pausing costs nothing and gives
  // nothing, here as on the ring.
  //
  // Keyed on `active` rather than `running`: a glimpse is about the card being on screen,
  // not about whether it has a clock. And nothing is scheduled without one, so a mode
  // that hides no number pays for none of this.
  useEffect(() => {
    if (glimpse === null || glimpse === 0) return
    if (!active) {
      cancelAnimation(glimpseHeld)
      return
    }
    if (glimpseHeld.value <= 0) return
    glimpseHeld.value = withTiming(
      0,
      { duration: glimpseHeld.value, easing: Easing.linear },
      (finished) => {
        if (!finished) return
        numberOpacity.value = withTiming(0, {
          duration: GLIMPSE_FADE_MS,
          easing: Easing.in(Easing.quad),
        })
      },
    )
  }, [active])

  // Whatever was hidden comes back to be seen leaving. The hold is cancelled first, so a
  // card taken inside its glimpse never has a fade land after this and blank it on the
  // way out — and assigning the opacity a new animation replaces one already in flight.
  useEffect(() => {
    if (!revealed || glimpse === null) return
    cancelAnimation(glimpseHeld)
    numberOpacity.value = withTiming(1, {
      duration: GLIMPSE_FADE_MS,
      easing: Easing.out(Easing.quad),
    })
  }, [revealed])

  return numberOpacity
}
