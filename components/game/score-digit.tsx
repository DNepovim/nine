import { useEffect, useRef } from 'react'
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { SCORE_COLORS } from '@/constants/colors'
import { mono } from '@/constants/theme'

export function ScoreDigit({
  digit,
  direction,
  isDark,
  progress,
}: {
  digit: string
  direction: 1 | -1
  isDark: boolean
  progress: number
}) {
  const prevDigit = useRef(digit)
  const translateY = useSharedValue(0)
  const opacity = useSharedValue(1)
  const colorProgress = useSharedValue(progress)

  // Animate the tint as the sum changes.
  useEffect(() => {
    colorProgress.value = withTiming(progress, {
      duration: 260,
      easing: Easing.out(Easing.quad),
    })
  }, [progress])

  useEffect(() => {
    if (digit === prevDigit.current) return
    prevDigit.current = digit

    const exitDir = direction === 1 ? -1 : 1

    opacity.value = withSequence(
      withTiming(0, { duration: 80 }),
      withTiming(1, { duration: 110 }),
    )
    translateY.value = withSequence(
      withTiming(exitDir * 10, { duration: 80 }),
      withTiming(exitDir * -10, { duration: 0 }),
      withSpring(0, { damping: 18, stiffness: 180 }),
    )
  }, [digit])

  const palette = isDark ? SCORE_COLORS.dark : SCORE_COLORS.light
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
    color: interpolateColor(colorProgress.value, [0, 1], [palette.high, palette.low]),
  }))

  return (
    <Animated.Text
      selectable={false}
      style={[
        {
          fontSize: 42,
          fontWeight: '700',
          fontFamily: mono,
          letterSpacing: 2,
        },
        animStyle,
      ]}
    >
      {digit}
    </Animated.Text>
  )
}
