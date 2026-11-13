import { useEffect, useState } from 'react'
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { RUN_SETTLE_MS } from '@/lib/announcements'

// The bar starts empty and reveals its scores a second and a half into a run, so the
// first thing a player sees is the game rather than a row of other people's numbers.
// They drop in from above as they fade up. If the board is still loading by then the
// reveal waits for it, rather than dropping in a row of zeroes and correcting itself a
// moment later — but never past REVEAL_MAX_MS, so a request that hangs cannot keep the
// strip empty for a whole run. The countdown is tied to the run and not to mount: this
// component lives inside the always-mounted game Screen, so a mount timer would expire
// while the player was still on the menu overlay.
//
// The delay is the run's settling beat, shared with the announcements that cover this
// same row: the numbers arriving and the bar finding its voice are one moment, not two.
const REVEAL_DELAY_MS = RUN_SETTLE_MS
const REVEAL_MAX_MS = 5000
const REVEAL_MS = 400
const DROP_FROM = -6

// When the best-scores strip's figures come in, and the two styles that bring them: the
// cells fading up as they drop, and the hairlines fading with them in place.
export function useBestsReveal({
  inRun,
  loaded,
}: {
  // True for the whole of a run, pauses included.
  inRun: boolean
  // Whether the board's leaders have arrived.
  loaded: boolean
}) {
  const [delayDone, setDelayDone] = useState(false)
  const [waitedOut, setWaitedOut] = useState(false)
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(DROP_FROM)

  // Past the delay the scores wait on the board; past the cap they show regardless.
  const revealed = waitedOut || (delayDone && loaded)

  useEffect(() => {
    if (!inRun) {
      // Back to the menu or game over — reset so the next run reveals afresh.
      setDelayDone(false)
      setWaitedOut(false)
      opacity.value = 0
      translateY.value = DROP_FROM
      return
    }
    const delay = setTimeout(() => {
      setDelayDone(true)
    }, REVEAL_DELAY_MS)
    const cap = setTimeout(() => {
      setWaitedOut(true)
    }, REVEAL_MAX_MS)
    return () => {
      clearTimeout(delay)
      clearTimeout(cap)
    }
  }, [inRun, opacity, translateY])

  useEffect(() => {
    if (!revealed) return
    const timing = { duration: REVEAL_MS, easing: Easing.out(Easing.cubic) }
    opacity.value = withTiming(1, timing)
    translateY.value = withTiming(0, timing)
  }, [revealed, opacity, translateY])

  const revealStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  // The rules fade in with the scores but hold still — a hairline sliding into
  // place reads as a glitch, where the numbers dropping in reads as motion.
  const ruleStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return { revealed, revealStyle, ruleStyle }
}
