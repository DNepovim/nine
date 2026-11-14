import { useEffect } from 'react'
import { Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

// The intro title's colour: a phase that runs round for ever, and the two stops it runs
// between, which follow the focused pill. The letters and the pills both read the phase,
// so the whole screen moves on one clock.
export function useTitleGradient(activeGradient: readonly [string, string]) {
  const gradPhase = useSharedValue(0)
  const gradStartSv = useSharedValue<string>(activeGradient[0])
  const gradEndSv = useSharedValue<string>(activeGradient[1])

  useEffect(() => {
    gradPhase.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    )
  }, [gradPhase])

  useEffect(() => {
    gradStartSv.value = activeGradient[0]
    gradEndSv.value = activeGradient[1]
  }, [activeGradient, gradStartSv, gradEndSv])

  return { gradPhase, gradStartSv, gradEndSv }
}
