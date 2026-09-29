import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import {
  BEAM_GRADIENT,
  SNIPER_DRAW_MS,
  SNIPER_FADE_MS,
  SNIPER_HOLD_MS,
} from '@/lib/strike-shot'

// The beam is two bars on the same ray: a hairline that is the shot itself, and a wide
// faint one under it that is the light coming off it. A drawn glow rather than a
// platform shadow, because a shadow cannot be a gradient and this one has to cool from
// gold to red along its length the way the core does.
const CORE = 2
const GLOW = 9
const GLOW_OPACITY = 0.3
const PEAK_OPACITY = 0.95

// The lift under the hairline, which the drawn glow cannot give it: a glow is a shape
// on the board, and this is the core sitting above it. No elevation to go with it on
// purpose — Android's elevation ignores the colour it is given, and a grey box under a
// red laser is worse than no shadow at all.
const SHADOW = {
  shadowColor: BEAM_GRADIENT[1],
  shadowOpacity: 0.9,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 0 },
} as const

// Accuracy's strike: one beam from the sum to the target it took, drawn almost instantly
// and held while the target goes. Accuracy's streak is a chain of exact presses, and
// this is what an exact press looks like — a single line, held long enough to be read.
//
// Laid out the way every line in this app is: the parent puts a zero-size anchor at the
// muzzle, this turns it to the angle, and the bars run along +X from there. `offset` is
// the air the beam leaves before it starts, so the muzzle end clears the digits it was
// fired from — see insetLine.
export function StrikeBeam({
  offset,
  length,
  angle,
}: {
  offset: number
  length: number
  angle: number
}) {
  const draw = useSharedValue(0)
  const opacity = useSharedValue(0)

  useEffect(() => {
    draw.value = withTiming(1, {
      duration: SNIPER_DRAW_MS,
      easing: Easing.out(Easing.quad),
    })
    opacity.value = withSequence(
      withTiming(PEAK_OPACITY, { duration: SNIPER_DRAW_MS }),
      withTiming(PEAK_OPACITY, { duration: SNIPER_HOLD_MS }),
      withTiming(0, { duration: SNIPER_FADE_MS, easing: Easing.in(Easing.quad) }),
    )
  }, [draw, opacity])

  const style = useAnimatedStyle(() => ({
    // scaleX grows a bar about its own centre, so translateX compensates to keep the
    // near end pinned where the offset put it — that is what makes a beam draw outwards
    // rather than out of its own middle. Same trick as HyperspaceStreak, and the same
    // for both bars, which share a width.
    transform: [{ translateX: -(length * (1 - draw.value)) / 2 }, { scaleX: draw.value }],
    opacity: opacity.value,
  }))

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: 0,
        height: 0,
        transform: [{ rotate: `${angle}deg` }],
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: offset,
            top: -GLOW / 2,
            width: length,
            height: GLOW,
          },
          style,
        ]}
      >
        <LinearGradient
          colors={[...BEAM_GRADIENT]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1, borderRadius: GLOW / 2, opacity: GLOW_OPACITY }}
        />
      </Animated.View>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: offset,
            top: -CORE / 2,
            width: length,
            height: CORE,
          },
          SHADOW,
          style,
        ]}
      >
        <LinearGradient
          colors={[...BEAM_GRADIENT]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1, borderRadius: CORE / 2 }}
        />
      </Animated.View>
    </View>
  )
}
