import { Trans } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useEffect, useRef, useState } from 'react'
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

// The intro — the logo fades in, then the subtitle under it. INTRO_MS is the moment
// the last of that has landed: the one point in the sequence where the splash is
// showing a finished picture and can be held there without anything mid-animation.
const NINE_IN_DELAY = 300
const NINE_IN_MS = 1500
const SUB_IN_DELAY = 1300
const SUB_IN_MS = 1500
const INTRO_MS = SUB_IN_DELAY + SUB_IN_MS

// How long the finished logo sits before it leaves, and the shorter beat used when it
// has been held instead — whatever was covering it is gone and the player is waiting.
const REST_MS = 2200
const RESUME_MS = 250

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

export function SplashScreen({
  onDone,
  hold,
  onIntroDone,
}: {
  onDone: () => void
  // Keep the finished logo on screen instead of playing the exit. Set while the
  // install popup is up: it is shown over the splash, so what is underneath it must
  // stay covered — the game and the tutorial are already mounted down there.
  hold: boolean
  // The intro has landed. Whatever wants to be shown over a finished splash waits
  // for this rather than for a duration of its own.
  onIntroDone: () => void
}) {
  // Bridge animated values → React state so LinearGradient sees the updates.
  // expo-linear-gradient doesn't expose locations as an animatable native prop,
  // so useAnimatedProps is a no-op for it; runOnJS is the correct path.
  const [locations, setLocations] = useState<[number, number, number, number]>([
    0, 0.1, 0.9, 1,
  ])
  const loc1 = useSharedValue(0.1)
  const loc2 = useSharedValue(0.9)

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

  // The intro and the exit used to be one scheduled sequence. They are two now: the
  // exit only starts once the intro has landed *and* nothing is holding the splash,
  // which is the whole of how the install popup gets a still screen to sit on.
  const [introDone, setIntroDone] = useState(false)
  const held = useRef(false)
  // The exit is one-way: once it is running, a hold arriving late (a window resized
  // across the desktop threshold brings the popup back) must not restart it.
  const leaving = useRef(false)

  useEffect(() => {
    // Threshold animation — asynchronous periods so they never sync up
    loc1.value = withRepeat(
      withTiming(0.45, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    loc2.value = withRepeat(
      withTiming(0.55, { duration: 5800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )

    // Appearance sequence
    nineOpacity.value = withDelay(NINE_IN_DELAY, withTiming(1, { duration: NINE_IN_MS }))
    subtitleOpacity.value = withDelay(
      SUB_IN_DELAY,
      withTiming(1, { duration: SUB_IN_MS }),
    )

    const timer = setTimeout(() => {
      setIntroDone(true)
      onIntroDone()
    }, INTRO_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!introDone || leaving.current) return
    if (hold) {
      held.current = true
      return
    }

    const timer = setTimeout(
      () => {
        leaving.current = true
        contentScale.value = withTiming(1.35, {
          duration: 2250,
          easing: Easing.in(Easing.ease),
        })
        contentOpacity.value = withTiming(0, { duration: 2000 })

        // Background fades after content is mostly gone, then calls onDone
        bgOpacity.value = withDelay(
          1500,
          withTiming(0, { duration: 2000 }, (finished) => {
            'worklet'
            if (finished) scheduleOnRN(onDone)
          }),
        )
      },
      held.current ? RESUME_MS : REST_MS,
    )
    return () => {
      clearTimeout(timer)
    }
  }, [introDone, hold])

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
          <Trans>Let's multiply</Trans>
        </Animated.Text>

        {/* Bottom attribution — inside contentStyle so it fades out with the rest */}
        <Animated.Text
          selectable={false}
          style={[
            {
              position: 'absolute',
              bottom: 48,
              alignSelf: 'center',
              fontFamily: mono,
              fontSize: 11,
              fontWeight: '700' as const,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: 2,
            },
            subtitleStyle,
          ]}
        >
          by Donda
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
