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

import { THUMB_ASPECT, ThumbPrint } from '@/components/overlays/tutorial/thumb-print'

export type ThumbGesture = 'tap' | 'down' | 'right' | 'left'

// How far the hand travels, as a fraction of its width — roughly one button over.
const TRAVEL_BY_GESTURE = {
  tap: { x: 0, y: 0 },
  down: { x: 0, y: 0.7 },
  right: { x: 0.7, y: 0 },
  left: { x: -0.7, y: 0 },
} as const satisfies Record<ThumbGesture, { x: number; y: number }>

// The contact point is near the top of the pad, so the shape is nudged down by
// this much of its height to put that point on whatever it's pointing at.
const CONTACT_OFFSET = 0.18

// A looping thumb demonstrating the gesture the current task expects. Drawn as an
// outline at roughly life size so it reads as a real thumb without hiding the
// button's value. Purely decorative — it must never intercept the touches it's
// asking for.
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
      {
        translateY:
          size * THUMB_ASPECT * CONTACT_OFFSET + travel.y * size * progress.value,
      },
      { scale: isTap ? 1 - 0.08 * progress.value : 1 },
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
              width: size * 0.7,
              height: size * 0.7,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: color,
            },
            rippleStyle,
          ]}
        />
      )}
      <Animated.View style={[{ opacity: 0.65 }, handStyle]}>
        <ThumbPrint width={size} color={color} />
      </Animated.View>
    </View>
  )
}
