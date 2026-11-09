import { useEffect, useRef, useState } from 'react'
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

// How a multistep dialog turns from one step to the next: the step on screen fades and
// slides a little the way the player is heading, the next one is swapped in at that moment
// and slides in from the same side. Going back mirrors it.
//
// OUT is shorter than IN because the leaving step is already read and the arriving one is
// the one the eye is waiting for.
const OUT_MS = 130
const IN_MS = 240
const OUT_OFFSET = 18
const IN_OFFSET = 28

// The step to draw, not the step asked for.
//
// `shown` follows `step` with one beat of delay — it changes once the old step has faded,
// not when the player pressed — so everything a dialog derives from the step (the body, the
// title, the ground it is painted on) is read from `shown` and turns at the same instant.
// Deriving the title from `step` and the body from `shown` would retitle the card while the
// old step was still on it.
//
// `leaving` is true between the press and the swap. A press landing in that window belongs
// to a step that is going and is best ignored.
//
// Steps are numbers, their position in the dialog, because direction is the one thing this
// has to know about them: forward is towards a higher number.
export function useStepFlow(step: number) {
  const [shown, setShown] = useState(step)
  // Read at the swap, not at the press: the step may have moved on again during the fade.
  const latest = useRef(step)
  latest.current = step
  const opacity = useSharedValue(1)
  const shift = useSharedValue(0)

  const settle = (direction: number) => {
    setShown(latest.current)
    shift.value = direction * IN_OFFSET
    opacity.value = withTiming(1, { duration: IN_MS })
    shift.value = withTiming(0, { duration: IN_MS, easing: Easing.out(Easing.cubic) })
  }

  useEffect(() => {
    if (shown === step) {
      // Back on the step that was leaving, before it had gone.
      opacity.value = withTiming(1, { duration: OUT_MS })
      shift.value = withTiming(0, { duration: OUT_MS })
      return
    }
    const direction = step > shown ? 1 : -1
    shift.value = withTiming(-direction * OUT_OFFSET, { duration: OUT_MS })
    opacity.value = withTiming(0, { duration: OUT_MS }, (finished) => {
      'worklet'
      if (finished === true) scheduleOnRN(settle, direction)
    })
  }, [step])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: shift.value }],
  }))

  return { shown, style, leaving: shown !== step }
}
