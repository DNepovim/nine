import { AntDesign } from '@expo/vector-icons'
import { useEffect, useRef } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

// A heart, filled or spent.
//
// Lifted out of the game screen when arcade grew hearts of its own. Two screens drawing
// the same three hearts two different ways would be two things to keep in step, and the
// player reads them as one thing.
export function HeartIcon({
  filled,
  emptyColor,
}: {
  filled: boolean
  emptyColor: string
}) {
  const scale = useSharedValue(1)
  const fillOp = useSharedValue(filled ? 1 : 0)
  const prevFilled = useRef(filled)

  useEffect(() => {
    if (prevFilled.current && !filled) {
      scale.value = withSequence(
        withTiming(1.5, { duration: 120, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 10, stiffness: 250 }),
      )
      fillOp.value = withDelay(80, withTiming(0, { duration: 200 }))
    } else if (!prevFilled.current && filled) {
      fillOp.value = 1
      scale.value = 1
    }
    prevFilled.current = filled
  }, [filled, fillOp, scale])

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const fillStyle = useAnimatedStyle(() => ({ opacity: fillOp.value }))

  return (
    <Animated.View style={scaleStyle}>
      <AntDesign name="heart" size={22} color={emptyColor} />
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
          fillStyle,
        ]}
      >
        <AntDesign name="heart" size={22} color="#E5534B" />
      </Animated.View>
    </Animated.View>
  )
}
