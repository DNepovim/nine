import { useEffect } from 'react'
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

// A target's clock for a **target form** that draws it from one value: one at full, nought
// when it has run out.
//
// Down from wherever it stands, so a pause costs nothing and gives nothing, and a cancelled
// timing reports not-finished, so a stopped target does not expire.
export function useTargetClock({
  startProgress,
  duration,
  running,
  onExpire,
}: {
  startProgress: number
  duration: number
  running: boolean
  onExpire: () => void
}): SharedValue<number> {
  const progress = useSharedValue(startProgress)
  useEffect(() => {
    if (!running) {
      cancelAnimation(progress)
      return
    }
    progress.value = withTiming(
      0,
      { duration: duration * progress.value, easing: Easing.linear },
      (finished) => {
        if (finished) scheduleOnRN(onExpire)
      },
    )
  }, [running])
  return progress
}
