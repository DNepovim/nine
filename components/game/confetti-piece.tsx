import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

const FADE_IN_MS = 120
const FADE_OUT_MS = 380

// One falling scrap. Mounting it plays the fall once — the parent controls the show
// by mounting and unmounting, so there is no idle animation left running.
export function ConfettiPiece({
  color,
  startX,
  size,
  delay,
  duration,
  fallTo,
  drift,
  spin,
}: {
  color: string
  startX: number
  size: number
  delay: number
  duration: number
  fallTo: number
  drift: number
  spin: number
}) {
  const translateY = useSharedValue(-size * 2)
  const translateX = useSharedValue(0)
  const rotate = useSharedValue(0)
  const opacity = useSharedValue(0)

  useEffect(() => {
    // Gravity-ish: accelerate downward, sway sideways, spin at a constant rate.
    translateY.value = withDelay(
      delay,
      withTiming(fallTo, { duration, easing: Easing.in(Easing.quad) }),
    )
    translateX.value = withDelay(
      delay,
      withTiming(drift, { duration, easing: Easing.inOut(Easing.sin) }),
    )
    rotate.value = withDelay(delay, withTiming(spin, { duration, easing: Easing.linear }))
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: FADE_IN_MS }),
        withDelay(
          Math.max(0, duration - FADE_IN_MS - FADE_OUT_MS),
          withTiming(0, { duration: FADE_OUT_MS }),
        ),
      ),
    )
  }, [delay, drift, duration, fallTo, opacity, rotate, spin, translateX, translateY])

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: startX,
          width: size,
          height: size * 0.6,
          backgroundColor: color,
          borderRadius: 1,
        },
        style,
      ]}
    />
  )
}
