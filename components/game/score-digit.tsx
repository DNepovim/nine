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
import { SUM_DIGIT_SIZE, SUM_DIGIT_TRACKING } from '@/constants/game'
import { mono } from '@/constants/theme'
import { useScheme } from '@/hooks/use-scheme'

export function ScoreDigit({
  digit,
  direction,
  progress,
  size = SUM_DIGIT_SIZE,
}: {
  digit: string
  direction: 1 | -1
  progress: number
  size?: number
}) {
  const prevDigit = useRef(digit)
  const translateY = useSharedValue(0)
  const opacity = useSharedValue(1)
  const colorProgress = useSharedValue(progress)
  // The calm end of the ramp is the screen's text colour, which the **scheme** decides:
  // the app's near-black on day, its parchment on dark. Read once per scheme, as a plain
  // string the worklet below closes over.
  const { score: settled, mono: monoInk } = useScheme().inks
  const low = monoInk ?? SCORE_COLORS.low

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

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
    color: interpolateColor(colorProgress.value, [0, 1], [settled, low]),
  }))

  return (
    <Animated.Text
      selectable={false}
      style={[
        {
          fontSize: size,
          fontWeight: '700',
          fontFamily: mono,
          letterSpacing: SUM_DIGIT_TRACKING,
        },
        animStyle,
      ]}
    >
      {digit}
    </Animated.Text>
  )
}
