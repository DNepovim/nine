import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

// How far a spark falls by the end of its flight, relative to how far it flew out.
const GRAVITY = 0.45
const FADE_IN_MS = 90

// One spark of a burst. A single 0→1 value drives the whole arc: the outward throw is
// linear in it and the fall is quadratic, which traces a parabola without needing a
// second animation to fight with the first.
export function FireworkParticle({
  originX,
  originY,
  dx,
  dy,
  size,
  color,
  delay,
  duration,
}: {
  originX: number
  originY: number
  dx: number
  dy: number
  size: number
  color: string
  delay: number
  duration: number
}) {
  const travel = useSharedValue(0)
  const opacity = useSharedValue(0)

  useEffect(() => {
    travel.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.quad) }),
    )
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: FADE_IN_MS }),
        withTiming(0, { duration: Math.max(0, duration - FADE_IN_MS) }),
      ),
    )
  }, [delay, duration, opacity, travel])

  const style = useAnimatedStyle(() => {
    const t = travel.value
    return {
      transform: [
        { translateX: dx * t },
        { translateY: dy * t + GRAVITY * Math.abs(dy) * t * t },
      ],
      opacity: opacity.value,
    }
  })

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: originX,
          top: originY,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  )
}
