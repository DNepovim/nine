import { useEffect } from 'react'
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { APP_BLUE, APP_RED } from '@/constants/colors'
import { mono } from '@/constants/theme'

export function FloatingStat({
  value,
  progress,
  onDone,
}: {
  value: number
  progress: number
  onDone: () => void
}) {
  const ty = useSharedValue(0)
  const op = useSharedValue(0)

  useEffect(() => {
    op.value = withSequence(
      withTiming(1, { duration: 90 }),
      withTiming(1, { duration: 500 }),
      withTiming(0, { duration: 300 }),
    )
    ty.value = withTiming(-20, { duration: 840, easing: Easing.out(Easing.quad) })
    const t = setTimeout(onDone, 920)
    return () => {
      clearTimeout(t)
    }
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
    opacity: op.value,
  }))

  const color = interpolateColor(progress, [0, 1], [APP_RED, APP_BLUE])

  return (
    <Animated.Text
      selectable={false}
      style={[
        {
          position: 'absolute',
          top: 32,
          fontFamily: mono,
          fontWeight: '700',
          fontSize: 12,
          color,
        },
        style,
      ]}
    >
      {value}%
    </Animated.Text>
  )
}
