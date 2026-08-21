import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'

import { mono } from '@/constants/theme'

// One of DialButton's two corner hints: the weight at top-left, the key's ceiling
// at bottom-right. Mirrors the pill's own fill exactly — the same ramp, the same
// peak gradient, driven by the same shared values — so the badge reads as part of
// the button rather than a sticker sitting on it. The border is what keeps it
// legible when its fill and the pill's happen to match: a ring in the mode's own
// CTA colour, constant while the fill underneath keeps animating.
export function DialBadge({
  label,
  size,
  fontSize,
  offset,
  corner,
  low,
  high,
  text,
  peakText,
  peakFrom,
  peakTo,
  borderColor,
  borderWidth,
  rampProgress,
  peakProgress,
  scale,
}: {
  label: string
  size: number
  fontSize: number
  offset: number
  corner: 'topLeft' | 'bottomRight'
  low: string
  high: string
  text: string
  peakText: string
  peakFrom: string
  peakTo: string
  borderColor: string
  borderWidth: number
  rampProgress: SharedValue<number>
  peakProgress: SharedValue<number>
  scale: SharedValue<number>
}) {
  const position =
    corner === 'topLeft'
      ? { top: offset, left: offset }
      : { bottom: offset, right: offset }

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(rampProgress.value, [0, 1], [low, high]),
  }))
  const peakStyle = useAnimatedStyle(() => ({ opacity: peakProgress.value }))
  const inkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(peakProgress.value, [0, 1], [text, peakText]),
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          borderWidth,
          borderColor,
        },
        position,
        badgeStyle,
      ]}
    >
      {/* Clipped on its own, like the pill's own peak overlay — the outer view's
          border-radius doesn't reach a child unless that child clips itself. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius: size / 2,
            overflow: 'hidden' as const,
          },
          peakStyle,
        ]}
      >
        <LinearGradient
          colors={[peakFrom, peakTo]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <Animated.Text
        selectable={false}
        style={[
          {
            fontSize,
            fontFamily: mono,
            fontWeight: '700' as const,
            includeFontPadding: false,
          },
          inkStyle,
        ]}
      >
        {label}
      </Animated.Text>
    </Animated.View>
  )
}
