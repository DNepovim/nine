import { MaterialIcons } from '@expo/vector-icons'
import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

export type ThumbGesture = 'tap' | 'down' | 'right' | 'left'

// How far the hand travels, as a fraction of its size — roughly one button over.
const TRAVEL_BY_GESTURE = {
  tap: { x: 0, y: 0 },
  down: { x: 0, y: 0.45 },
  right: { x: 0.45, y: 0 },
  left: { x: -0.45, y: 0 },
} as const satisfies Record<ThumbGesture, { x: number; y: number }>

// The glyph's fingertip sits above its own centre, so the hand is nudged down to
// bring the fingertip onto whatever it points at. Deliberately less than the full
// offset: on the dial's bottom row a fully-offset hand runs off the screen, and
// landing the fingertip just above centre still reads as touching the button.
const FINGERTIP_OFFSET = 0.16

// A looping hand demonstrating the gesture the current task expects. Sized like a
// real thumb and kept translucent so the button's value stays readable. Purely
// decorative — it must never intercept the touches it's asking for.
export function ThumbHint({
  gesture,
  color,
  size,
}: {
  gesture: ThumbGesture
  color: string
  size: number
}) {
  const progress = useSharedValue(0)
  const travel = TRAVEL_BY_GESTURE[gesture]
  const isTap = gesture === 'tap'

  useEffect(() => {
    progress.value = 0
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 620, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 140 }),
        withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) }),
        // A beat of stillness so each repetition reads as a separate gesture.
        withTiming(0, { duration: 420 }),
      ),
      -1,
      false,
    )
  }, [gesture])

  const handStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: travel.x * size * progress.value },
      { translateY: size * FINGERTIP_OFFSET + travel.y * size * progress.value },
      { scale: isTap ? 1 - 0.12 * progress.value : 1 },
    ],
  }))

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - progress.value),
    transform: [{ scale: 0.5 + progress.value }],
  }))

  return (
    <View pointerEvents="none" className="items-center justify-center">
      {isTap && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: size * 0.6,
              height: size * 0.6,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: color,
            },
            rippleStyle,
          ]}
        />
      )}
      <Animated.View style={[{ opacity: 0.55 }, handStyle]}>
        <MaterialIcons name="touch-app" size={size} color={color} />
      </Animated.View>
    </View>
  )
}
