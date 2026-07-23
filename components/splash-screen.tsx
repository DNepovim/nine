import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { mono } from '@/constants/theme'

const NINE_CHARS = ['N', 'I', 'N', 'E'] as const
const FLOAT_PERIODS = [8000, 9500, 7500, 9000] as const

function FloatingLetter({ char, period }: { char: string; period: number }) {
  const translateY = useSharedValue(0)

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: period / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: period / 2, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Animated.Text
      selectable={false}
      style={[
        {
          fontFamily: mono,
          fontSize: 80,
          fontWeight: '900' as const,
          color: '#FFFFFF',
          includeFontPadding: false,
          letterSpacing: 4,
        },
        style,
      ]}
    >
      {char}
    </Animated.Text>
  )
}

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const gradPhase = useSharedValue(0)
  const nineOpacity = useSharedValue(0)
  const subtitleOpacity = useSharedValue(0)
  const contentScale = useSharedValue(1)
  const contentOpacity = useSharedValue(1)
  const bgOpacity = useSharedValue(1)

  useEffect(() => {
    // Moving gradient — 5× slower than menu overlay
    gradPhase.value = withRepeat(
      withTiming(1, { duration: 10000, easing: Easing.linear }),
      -1,
      false,
    )

    // Appearance sequence
    nineOpacity.value = withDelay(1000, withTiming(1, { duration: 1500 }))
    subtitleOpacity.value = withDelay(4000, withTiming(1, { duration: 1500 }))

    // Exit: 5 seconds after subtitle appears (4000ms) = 9000ms total
    contentScale.value = withDelay(
      9000,
      withTiming(1.35, { duration: 2250, easing: Easing.in(Easing.ease) }),
    )
    contentOpacity.value = withDelay(9000, withTiming(0, { duration: 2000 }))

    // Background fades after content is mostly gone, then calls onDone
    bgOpacity.value = withDelay(
      10500,
      withTiming(0, { duration: 2000 }, (finished) => {
        'worklet'
        if (finished) scheduleOnRN(onDone)
      }),
    )
  }, [])

  const gradStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.sin(gradPhase.value * Math.PI * 2) * 50 },
      { translateY: Math.sin(gradPhase.value * Math.PI * 2 + Math.PI / 4) * 30 },
    ],
  }))
  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }))
  const nineStyle = useAnimatedStyle(() => ({ opacity: nineOpacity.value }))
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }))
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }))

  return (
    <Animated.View style={[styles.absolute, { zIndex: 100 }, bgStyle]}>
      {/* Animated gradient — larger than screen so panning doesn't reveal edges */}
      <Animated.View style={[styles.absolute, { overflow: 'hidden' }]}>
        <Animated.View style={[styles.gradPad, gradStyle]}>
          <LinearGradient
            colors={['#4C7EFF', '#7273D2', '#c36282', '#E5534B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </Animated.View>

      {/* Centered text content */}
      <Animated.View style={[styles.absolute, styles.center, contentStyle]}>
        <Animated.View style={[styles.row, nineStyle]}>
          {NINE_CHARS.map((char, i) => (
            <FloatingLetter key={i} char={char} period={FLOAT_PERIODS[i] ?? 1600} />
          ))}
        </Animated.View>
        <Animated.Text
          selectable={false}
          style={[
            {
              fontFamily: mono,
              fontSize: 13,
              fontWeight: '700' as const,
              color: 'rgba(255,255,255,0.85)',
              letterSpacing: 2,
              marginTop: 20,
            },
            subtitleStyle,
          ]}
        >
          {"Let's multiply."}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  absolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  gradPad: {
    position: 'absolute',
    top: -80,
    left: -80,
    right: -80,
    bottom: -80,
  },
})
