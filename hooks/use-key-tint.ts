import { useEffect } from 'react'
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated'

import { LESSON_DIM, LESSON_DIM_MS } from '@/constants/tutorial'
import type { DialControl } from '@/machines/tutorial-lesson'

// Every value below a key's top rides the low → high tint ramp; the top is the mode's CTA
// gradient. The top is the dial's to say — 9 on every ten-digit dial, 1 on BINARY's —
// so a key that only counts to one is lit by its 1 rather than left a pale step short
// of a 9 it can never reach.
const rampOf = (value: number, top: number): number =>
  top > 1 ? Math.min(value, top - 1) / (top - 1) : 0
const TINT_TIMING = { duration: 260, easing: Easing.out(Easing.quad) }

// How far a key dims while the tutorial has it shut, and how long it takes either way.
//
// The depth is LESSON_DIM, shared with the sum — everything the lesson takes out of the
// player's hands steps back by the same amount. The clock is the tint's above, because the
// two land together: the moment the lesson hands the dial back, eight keys brighten and the
// ninth loses its halo, and two speeds there would read as two separate events. Eased out
// on the way up and in on the way down, the app's rule for anything arriving and leaving.
const DIM = LESSON_DIM
const DIM_UP = { duration: LESSON_DIM_MS, easing: Easing.out(Easing.quad) }
const DIM_DOWN = { duration: LESSON_DIM_MS, easing: Easing.in(Easing.quad) }

// A key's tint as its digit climbs, its CTA gradient at the top, and its dimming while the
// lesson has it shut — the three things a key's colour answers to.
export function useKeyTint({
  value,
  top,
  control,
}: {
  value: number
  // The highest digit the key takes.
  top: number
  control: DialControl
}) {
  const rampProgress = useSharedValue(rampOf(value, top))
  const peakProgress = useSharedValue(value === top ? 1 : 0)
  // Starts where the key already stands rather than at full: a key that is dead on its
  // first render — every key but one, the moment a tutorial's guided route begins — should
  // be dim from the first frame, not fade down into it.
  const live = useSharedValue(control === 'off' ? DIM : 1)

  useEffect(() => {
    const waking = control !== 'off'
    live.value = withTiming(waking ? 1 : DIM, waking ? DIM_UP : DIM_DOWN)
  }, [control])

  // Animate the button tint whenever its value changes.
  useEffect(() => {
    // At the top the gradient covers the pill, so the ramp underneath holds its
    // previous color: animating it up to `high` would flash a lighter blue
    // through the fading-in gradient — visible when swiping right from a low
    // value straight to 9.
    if (value !== top) rampProgress.value = withTiming(rampOf(value, top), TINT_TIMING)
    peakProgress.value = withTiming(value === top ? 1 : 0, TINT_TIMING)
  }, [value, top])

  return { rampProgress, peakProgress, live }
}
