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

// Phase lengths: a star appears, stretches into a line, then flies off screen. Kept
// unhurried — the whole point is a long, deliberate acceleration, and the announcement
// holds the bar for five seconds either way.
const APPEAR_MS = 600
const GROW_MS = 1000
const TRAVEL_MS = 1600

// Scale the bar sits at while it is still a dot, and how much further it stretches
// while flying out.
const DOT_SCALE = 0.04
const TRAVEL_STRETCH = 1.7

// One star turning into a light streak. The parent rotates a zero-size wrapper to this
// streak's angle, so everything here happens along a single axis: +X is "away from the
// centre" whatever direction that ends up being on screen.
export function HyperspaceStreak({
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
  // Streaks stay translucent, and vary, so the field reads as depth rather than as a
  // sheet of paint over the board.
  peakOpacity: number
}) {
  const radius = useSharedValue(fromRadius)
  const scale = useSharedValue(DOT_SCALE)
  const opacity = useSharedValue(0)

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(peakOpacity, { duration: APPEAR_MS }),
        // Hold through the growth and the first half of the flight, then fade as it
        // leaves, so the streak doesn't blink out while still on screen.
        withDelay(GROW_MS + TRAVEL_MS / 2, withTiming(0, { duration: TRAVEL_MS / 2 })),
      ),
    )
    scale.value = withDelay(
      delay + APPEAR_MS,
      withSequence(
        withTiming(1, { duration: GROW_MS, easing: Easing.out(Easing.cubic) }),
        withTiming(TRAVEL_STRETCH, {
          duration: TRAVEL_MS,
          easing: Easing.in(Easing.quad),
        }),
      ),
    )
    radius.value = withDelay(
      delay + APPEAR_MS + GROW_MS,
      withTiming(toRadius, { duration: TRAVEL_MS, easing: Easing.in(Easing.quad) }),
    )
  }, [delay, fromRadius, toRadius, peakOpacity, opacity, radius, scale])

  const style = useAnimatedStyle(() => ({
    // scaleX grows the bar about its own centre, so translateX compensates to keep the
    // inner end pinned at `radius` — that is what makes a line grow away from the
    // centre rather than out of its own middle.
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
