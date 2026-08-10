import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { DIAL_COLORS } from '@/constants/colors'
import { SWIPE_THRESHOLD } from '@/constants/game'
import { mono } from '@/constants/theme'

// Values 0..8 ride the low → high tint ramp; 9 is the mode's CTA gradient.
const RAMP_MAX = 8
const TINT_TIMING = { duration: 260, easing: Easing.out(Easing.quad) }

export function DialButton({
  value,
  isDark,
  size,
  weight,
  showSum,
  trainee,
  peakFrom,
  peakTo,
  onDelta,
  onSet,
}: {
  value: number
  isDark: boolean
  size: number
  weight: number
  showSum: boolean
  trainee: boolean
  // The mode's dark CTA gradient, worn by the button at its maximum value.
  peakFrom: string
  peakTo: string
  onDelta: (delta: 1 | -1) => void
  onSet: (value: number) => void
}) {
  const scale = useSharedValue(1)
  const translateY = useSharedValue(0)
  const numTranslateY = useSharedValue(0)
  const numOpacity = useSharedValue(1)
  const numScale = useSharedValue(1)
  const rampProgress = useSharedValue(Math.min(value, RAMP_MAX) / RAMP_MAX)
  const peakProgress = useSharedValue(value === 9 ? 1 : 0)

  // Animate the button tint whenever its value changes.
  useEffect(() => {
    // At 9 the gradient covers the pill, so the ramp underneath holds its
    // previous color: animating it up to `high` would flash a lighter blue
    // through the fading-in gradient — visible when swiping right from a low
    // value straight to 9.
    if (value !== 9) rampProgress.value = withTiming(value / RAMP_MAX, TINT_TIMING)
    peakProgress.value = withTiming(value === 9 ? 1 : 0, TINT_TIMING)
  }, [value])

  const animateSwipe = (delta: 1 | -1) => {
    'worklet'
    const exitDir = delta === 1 ? -1 : 1

    translateY.value = withSequence(
      withTiming(exitDir * 7, { duration: 100 }),
      withSpring(0, { damping: 18, stiffness: 120, mass: 0.8 }),
    )

    numOpacity.value = withTiming(0, { duration: 110 })
    numTranslateY.value = withTiming(exitDir * 18, { duration: 110 }, (finished) => {
      if (!finished) return
      scheduleOnRN(onDelta, delta)
      numTranslateY.value = exitDir * -18
      numTranslateY.value = withSpring(0, { damping: 22, stiffness: 160 })
      numOpacity.value = withTiming(1, { duration: 130 })
    })
  }

  // Left/right swipe sets an absolute value (left → 0, right → 9), animated the
  // same way as an up/down swipe. exitDir: -1 = up (increase), 1 = down (decrease).
  const animateSet = (newValue: number, exitDir: 1 | -1) => {
    'worklet'
    translateY.value = withSequence(
      withTiming(exitDir * 7, { duration: 100 }),
      withSpring(0, { damping: 18, stiffness: 120, mass: 0.8 }),
    )

    numOpacity.value = withTiming(0, { duration: 110 })
    numTranslateY.value = withTiming(exitDir * 18, { duration: 110 }, (finished) => {
      if (!finished) return
      scheduleOnRN(onSet, newValue)
      numTranslateY.value = exitDir * -18
      numTranslateY.value = withSpring(0, { damping: 22, stiffness: 160 })
      numOpacity.value = withTiming(1, { duration: 130 })
    })
  }

  const animateTap = () => {
    'worklet'
    numScale.value = withSequence(
      withTiming(1.15, { duration: 90 }),
      withSpring(1, { damping: 18, stiffness: 160 }),
    )
    scheduleOnRN(onDelta, 1)
  }

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      'worklet'
      scale.value = withSpring(0.94, { damping: 20, stiffness: 260 })
    })
    .onEnd((e) => {
      'worklet'
      // Dominant axis decides the gesture: horizontal sets 0/9, vertical ±1.
      // Skip the number animation when the value wouldn't change (already 0/9).
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        if (e.translationX < -SWIPE_THRESHOLD) {
          if (value !== 0) animateSet(0, 1)
        } else if (e.translationX > SWIPE_THRESHOLD) {
          if (value !== 9) animateSet(9, -1)
        } else animateTap()
      } else {
        if (e.translationY < -SWIPE_THRESHOLD) animateSwipe(1)
        else if (e.translationY > SWIPE_THRESHOLD) animateSwipe(-1)
        else animateTap()
      }
    })
    .onFinalize(() => {
      'worklet'
      scale.value = withSpring(1, { damping: 16, stiffness: 140 })
    })

  const palette = isDark ? DIAL_COLORS.dark : DIAL_COLORS.light
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    backgroundColor: interpolateColor(
      rampProgress.value,
      [0, 1],
      [palette.low, palette.high],
    ),
  }))

  // The CTA gradient crossfades in over the ramp — every tint change, including
  // the jump to and from 9, is a timed transition.
  const peakStyle = useAnimatedStyle(() => ({ opacity: peakProgress.value }))

  const numStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: numTranslateY.value }, { scale: numScale.value }],
    opacity: numOpacity.value,
  }))

  // The digit and its trainee hints warm to pale red over the dark 9 gradient.
  const digitStyle = useAnimatedStyle(() => ({
    color: interpolateColor(peakProgress.value, [0, 1], [palette.text, palette.peakText]),
  }))

  const hintStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      peakProgress.value,
      [0, 1],
      [palette.label, palette.peakLabel],
    ),
  }))

  return (
    <GestureDetector gesture={gesture}>
      {/* Explicit pixel size (not w-1/3 + aspect-square): iOS WebKit fails to
          derive height from aspect-ratio on wrapping flex children. */}
      <View style={{ width: size, height: size, padding: 10 }}>
        <Animated.View
          style={[
            {
              flex: 1,
              borderRadius: 999,
              justifyContent: 'center' as const,
              alignItems: 'center' as const,
              shadowColor: isDark ? '#04040C' : '#1C1928',
              shadowOpacity: isDark ? 0.9 : 0.13,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 10,
            },
            btnStyle,
          ]}
        >
          {/* Rounded on its own rather than clipped by the pill — `overflow:
              hidden` on the parent would clip away the button's shadow too. */}
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
              peakStyle,
            ]}
          >
            <LinearGradient
              colors={[peakFrom, peakTo]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1, borderRadius: 999 }}
            />
          </Animated.View>
          <Animated.View style={[{ alignItems: 'center' as const }, numStyle]}>
            {trainee && (
              <Animated.Text
                selectable={false}
                style={[
                  {
                    fontSize: 10,
                    fontFamily: mono,
                    fontWeight: '700' as const,
                    includeFontPadding: false,
                    letterSpacing: 0.5,
                  },
                  hintStyle,
                ]}
              >
                ×{weight}
              </Animated.Text>
            )}
            <Animated.Text
              selectable={false}
              style={[
                {
                  fontSize: trainee ? 24 : 30,
                  fontFamily: mono,
                  fontWeight: '500' as const,
                  includeFontPadding: false,
                },
                digitStyle,
              ]}
            >
              {showSum ? value * weight : value}
            </Animated.Text>
            {trainee && (
              <Animated.Text
                selectable={false}
                style={[
                  {
                    fontSize: 10,
                    fontFamily: mono,
                    fontWeight: '700' as const,
                    includeFontPadding: false,
                    letterSpacing: 0.5,
                  },
                  hintStyle,
                ]}
              >
                {9 * weight}
              </Animated.Text>
            )}
          </Animated.View>
        </Animated.View>
      </View>
    </GestureDetector>
  )
}
