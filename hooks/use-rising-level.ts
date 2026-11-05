import { useEffect } from 'react'
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

// A level that climbs for as long as a run is played: nought to one as a share of the screen.
//
// The level is the run's own clock, not the wall's: it climbs while the run is being played,
// holds where it stands under a pause and under game over, and starts again from `from` with
// the next run. `delayMs` is how long a run that has not begun to climb waits before it does,
// and `ms` how long the whole climb from `from` to `to` takes.
export function useRisingLevel(
  running: boolean,
  runId: string,
  { from, to, delayMs, ms }: { from: number; to: number; delayMs: number; ms: number },
): SharedValue<number> {
  const level = useSharedValue(from)

  // A new run starts from the foot again.
  useEffect(() => {
    cancelAnimation(level)
    level.value = from
  }, [runId])

  // Up while the run is played; held where it stands otherwise. The remaining time is the
  // remaining share of the climb, so a pause costs the level nothing and gives it nothing.
  useEffect(() => {
    if (!running) {
      cancelAnimation(level)
      return
    }
    const left = (to - level.value) / (to - from)
    // The wait is only for a run that has not begun to climb: a level already up does not
    // wait again after a pause.
    const wait = level.value <= from ? delayMs : 0
    level.value = withDelay(
      wait,
      withTiming(to, { duration: ms * left, easing: Easing.linear }),
    )
  }, [running, runId])

  return level
}
