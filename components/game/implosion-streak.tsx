import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

// Phase lengths: a line fades in out near the edge, is drawn inwards, then collapses to
// a dot and goes out. Slower at the start than the end — the pull accelerates.
const APPEAR_MS = 400
const FALL_MS = 1300
const COLLAPSE_MS = 400

const DOT_SCALE = 0.04

// One line being pulled back into the centre — the jump to lightspeed run backwards.
// Shares its geometry with HyperspaceStreak: the parent rotates a zero-size wrapper to
// this streak's angle, so +X is always "away from the centre", and translateX
// compensates for scaleX growing about the bar's own middle so the inner end stays
// pinned to `radius`.
export function ImplosionStreak({
  angle,
  fromRadius,
  toRadius,
  length,
  thickness,
  color,
  delay,
  peakOpacity,
}: {
  angle: number
  fromRadius: number
  toRadius: number
  length: number
  thickness: number
  color: string
  delay: number
  peakOpacity: number
}) {
  const radius = useSharedValue(fromRadius)
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0)

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(peakOpacity, { duration: APPEAR_MS }),
        withDelay(FALL_MS, withTiming(0, { duration: COLLAPSE_MS })),
      ),
    )
    // Accelerating inwards, so the collapse feels like a pull rather than a drift.
    radius.value = withDelay(
      delay + APPEAR_MS,
      withTiming(toRadius, { duration: FALL_MS, easing: Easing.in(Easing.cubic) }),
    )
    // Shrink only at the very end: the line arrives, then winks out.
    scale.value = withDelay(
      delay + APPEAR_MS + FALL_MS,
      withTiming(DOT_SCALE, { duration: COLLAPSE_MS, easing: Easing.in(Easing.quad) }),
    )
  }, [delay, fromRadius, toRadius, peakOpacity, opacity, radius, scale])

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: radius.value - (length * (1 - scale.value)) / 2 },
      { scaleX: scale.value },
    ],
    opacity: opacity.value,
  }))

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: 0,
        height: 0,
        transform: [{ rotate: `${angle}deg` }],
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            top: -thickness / 2,
            width: length,
            height: thickness,
            borderRadius: thickness / 2,
            backgroundColor: color,
          },
          style,
        ]}
      />
    </View>
  )
}
