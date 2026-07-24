import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedReaction,
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
  // Bridge animated values → React state so LinearGradient sees the updates.
  // expo-linear-gradient doesn't expose locations as an animatable native prop,
  // so useAnimatedProps is a no-op for it; runOnJS is the correct path.
  const [locations, setLocations] = useState<[number, number, number, number]>([
    0, 0.28, 0.62, 1,
  ])
  const loc1 = useSharedValue(0.28)
  const loc2 = useSharedValue(0.62)

  const applyLocations = useCallback((l1: number, l2: number) => {
    setLocations([0, l1, l2, 1])
  }, [])

  useAnimatedReaction(
    () => ({ l1: loc1.value, l2: loc2.value }),
    ({ l1, l2 }) => {
      scheduleOnRN(() => {
        applyLocations(l1, l2)
      })
    },
  )

  const nineOpacity = useSharedValue(0)
  const subtitleOpacity = useSharedValue(0)
  const contentScale = useSharedValue(1)
  const contentOpacity = useSharedValue(1)
  const bgOpacity = useSharedValue(1)

  useEffect(() => {
    // Threshold animation — asynchronous periods so they never sync up
    loc1.value = withRepeat(
      withTiming(0.44, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    loc2.value = withRepeat(
      withTiming(0.76, { duration: 5800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
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

  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }))
  const nineStyle = useAnimatedStyle(() => ({ opacity: nineOpacity.value }))
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }))
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }))

  return (
    <Animated.View style={[styles.absolute, { zIndex: 100 }, bgStyle]}>
      <LinearGradient
        colors={['#4C7EFF', '#7273D2', '#c36282', '#E5534B']}
        locations={locations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.absolute}
      />

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
})
