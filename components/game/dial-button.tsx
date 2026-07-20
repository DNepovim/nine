import { useEffect } from 'react'
import { Text, View } from 'react-native'
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

export function DialButton({
  value,
  isDark,
  size,
  weight,
  showSum,
  showFactor,
  onDelta,
  onSet,
}: {
  value: number
  isDark: boolean
  size: number
  weight: number
  showSum: boolean
  showFactor: boolean
  onDelta: (delta: 1 | -1) => void
  onSet: (value: number) => void
}) {
  const scale = useSharedValue(1)
  const translateY = useSharedValue(0)
  const numTranslateY = useSharedValue(0)
  const numOpacity = useSharedValue(1)
  const numScale = useSharedValue(1)
  const colorProgress = useSharedValue(value / 9)

  // Animate the button tint whenever its value changes.
  useEffect(() => {
    colorProgress.value = withTiming(value / 9, {
      duration: 260,
      easing: Easing.out(Easing.quad),
    })
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
      colorProgress.value,
      [0, 1],
      [palette.low, palette.high],
    ),
  }))

  const numStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: numTranslateY.value }, { scale: numScale.value }],
    opacity: numOpacity.value,
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
          {/* Factor (row×col multiplier) — small, pinned near the top */}
          {showFactor && (
            <View
              style={{
                position: 'absolute',
                top: Math.round(size * 0.1),
                left: 0,
                right: 0,
                alignItems: 'center',
              }}
              pointerEvents="none"
            >
              <Text
                selectable={false}
                className="font-mono font-bold text-factor"
                style={{
                  fontSize: Math.max(10, Math.round(size * 0.14)),
                  includeFontPadding: false,
                }}
              >
                {weight}
              </Text>
            </View>
          )}
          <Animated.Text
            selectable={false}
            style={[
              {
                fontSize: 30,
                fontFamily: mono,
                fontWeight: '500' as const,
                includeFontPadding: false,
                color: isDark ? '#C8C2E8' : '#1C1928',
              },
              numStyle,
            ]}
          >
            {showSum ? value * weight : value}
          </Animated.Text>
        </Animated.View>
      </View>
    </GestureDetector>
  )
}
