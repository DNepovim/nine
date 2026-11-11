import {
  SensorType,
  useAnimatedSensor,
  useDerivedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated'

// How far the phone has turned from upright, in radians: nought held upright, positive as the
// top goes to the right. What a level surface looks like from the phone's point of view.
//
// Read off gravity, so it is the phone's own roll and nothing the player does with a finger.
// Smoothed by a spring, since the sensor is a little restless and a surface that shivered
// with it would read as a fault. Nought when the phone lies flat, where "which way is up on
// the screen" has no answer, and never past `MAX_TILT`.
const MAX_TILT = Math.PI / 3
// Below this much of gravity in the screen's plane the phone is lying flat, in m/s².
const FLAT = 2.5
const SETTLE = { damping: 18, stiffness: 90, mass: 1 } as const

export function useTilt(): SharedValue<number> {
  const gravity = useAnimatedSensor(SensorType.GRAVITY, { interval: 'auto' })
  return useDerivedValue(() => {
    const { x: across, y: along } = gravity.sensor.value
    if (Math.hypot(across, along) < FLAT) return withSpring(0, SETTLE)
    const roll = Math.atan2(-across, along)
    return withSpring(Math.max(-MAX_TILT, Math.min(MAX_TILT, roll)), SETTLE)
  })
}
