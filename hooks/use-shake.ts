import {
  Easing,
  SensorType,
  useAnimatedReaction,
  useAnimatedSensor,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

// How shaken the phone is, nought to one: a shake throws it to one at once and it settles
// back to nought over a few seconds, the way a snow globe's flurry does.
//
// A shake is the phone's total acceleration straying far from gravity alone, in m/s². A
// second one inside `REFRACTORY_MS` is the same shake, still going.
const GRAVITY = 9.81
const THRESHOLD = 9
const REFRACTORY_MS = 500
const THROW_MS = 280
const SETTLE_MS = 3200

export function useShake(): SharedValue<number> {
  const shaken = useSharedValue(0)
  const lastAt = useSharedValue(0)
  const accel = useAnimatedSensor(SensorType.ACCELEROMETER, { interval: 'auto' })
  useAnimatedReaction(
    () => {
      const { x, y, z } = accel.sensor.value
      return Math.abs(Math.hypot(x, y, z) - GRAVITY)
    },
    (stray) => {
      const now = Date.now()
      if (stray < THRESHOLD || now - lastAt.value < REFRACTORY_MS) return
      lastAt.value = now
      shaken.value = withSequence(
        withTiming(1, { duration: THROW_MS, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: SETTLE_MS, easing: Easing.in(Easing.quad) }),
      )
    },
  )
  return shaken
}
