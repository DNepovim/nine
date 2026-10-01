import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { gradientOf } from '@/modes'

// The tutorial's colour, the one its tips panel, route hint and praise line all wear.
const TINT = gradientOf('trainee')[0]

// A halo outside the pill rather than a border on it.
//
// On it was tried first and does not work: a dial key's fill runs from pale lavender up to
// app blue as its value climbs, and at the top of that ramp a blue ring on a blue key is
// invisible — which is exactly where the lesson's keys end up, since every step of its
// route presses a key upward. Out here the ring sits on the screen's own surface instead,
// where this blue is the same 3:1 it is everywhere else in the app, in both themes.
//
// The dial's box does not clip — the weight badges already straddle the pill's rim — so a
// ring drawn past the button's edge draws, and the 12pt gap between keys has room for it.
const REACH = 6
const RING = 3

// How the halo breathes. The app's own idle-float timing, and slow enough that it reads as
// attention rather than as an alarm: the key is being offered, not demanded.
const BREATH_MS = 900
const DIM = 0.3
const SWELL = 1.04

// The mark that says "this key, now" — drawn around the one key the tutorial's guided route
// is asking for while every other key is dimmed and dead.
export function DialPulse() {
  const breath = useSharedValue(0)

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
  }, [])

  const style = useAnimatedStyle(() => ({
    opacity: DIM + (1 - DIM) * breath.value,
    transform: [{ scale: 1 + (SWELL - 1) * breath.value }],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: -REACH,
          right: -REACH,
          bottom: -REACH,
          left: -REACH,
          borderRadius: 999,
          borderWidth: RING,
          borderColor: TINT,
        },
        style,
      ]}
    />
  )
}
