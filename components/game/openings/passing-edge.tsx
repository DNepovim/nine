import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import type { OpeningSceneProps } from '@/components/game/opening-layer'
import { MIRROR_GLASS } from '@/constants/colors'
import { useViewport } from '@/hooks/use-viewport'
import type { OpeningTake } from '@/modes'

// MIRROR's **opening**: the edge of a mirror passing over the screen.
//
// The game screen stands as it always does, in the day colours. A bright edge of glass slides
// across it corner to corner, and each key it reaches spins round its upright and lands back to
// front (`keySpinDegrees`, read off `sweep` by the dial). Behind the edge the screen is already
// glass, a sheet drawn under the run (`PassingEdgeUnder`), and when the edge has gone the whole
// screen turns over to the glass **scheme** to match it. Fog stays in the corners for the run: the
// scene's **remains**, `PassingEdgeRemains`. The glass then takes the run's gloss and damage,
// in `mirror-damage.tsx`.
//
// The `short` take is the same pass quickly, for a run dealt again.

// When each beat lands, in ms from the scene's start, per take: how long the screen stands
// before the edge sets off, how long it takes to cross, and the end. The switch is the moment
// it has gone, and `done` leaves the corners' fog time to come in.
const BEATS = {
  full: { wait: 700, cross: 1400, done: 2450 },
  short: { wait: 40, cross: 300, done: 420 },
} as const satisfies Record<OpeningTake, { wait: number; cross: number; done: number }>

// How much fog the run keeps in the corners, and how long it takes to gather.
const CORNER_OPACITY = 0.6
const CORNERS_MS = 300

// The edge itself: a hard bright line, with a soft glow either side.
const EDGE_LINE = 3
const EDGE_GLOW = 44

const CORNERS_ID = 'mirror-corners'

// Fog thickest at the corners and gone by the middle, where the player is looking.
function EdgeFog() {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id={CORNERS_ID} cx="50%" cy="50%" r="72%">
          <Stop offset="55%" stopColor={MIRROR_GLASS.fog} stopOpacity={0} />
          <Stop offset="100%" stopColor={MIRROR_GLASS.fog} stopOpacity={1} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${CORNERS_ID})`} />
    </Svg>
  )
}

// What the scene leaves behind: fog in the corners, for as long as the run
// lasts. Drawn behind the targets and the dial, and never pressable.
export function PassingEdgeRemains() {
  return (
    <View className="absolute inset-0 overflow-hidden" pointerEvents="none" aria-hidden>
      <View className="absolute inset-0" style={{ opacity: CORNER_OPACITY }}>
        <EdgeFog />
      </View>
    </View>
  )
}

// The line the edge travels along: corner to corner, top left to bottom right, with the edge
// itself lying along the other diagonal. `angle` turns a box's width onto that line and `span`
// is how long the line is. Everything is then laid out in a zero-sized box at the top-left
// corner, turned by `angle`, so a distance along the line is simply a distance across it.
function useDiagonal() {
  const { width, height } = useViewport()
  const diagonal = Math.hypot(width, height)
  return {
    angle: `${Math.atan2(width, height)}rad`,
    span: (2 * width * height) / diagonal,
    reach: 1.5 * diagonal,
  }
}

const CORNER_BOX = { position: 'absolute', left: 0, top: 0, width: 0, height: 0 } as const

// The glass the edge leaves behind it, under everything the run draws, so the keys spin in front
// of it. Only for as long as the scene plays: the scheme is the glass from then on.
export function PassingEdgeUnder({ sweep }: { sweep: SharedValue<number> }) {
  const { angle, span, reach } = useDiagonal()
  const style = useAnimatedStyle(() => ({
    width: reach + sweep.value * (span + 2 * EDGE_GLOW) - EDGE_GLOW,
  }))
  return (
    <View className="absolute inset-0 overflow-hidden" pointerEvents="none" aria-hidden>
      <View style={[CORNER_BOX, { transform: [{ rotate: angle }] }]}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: -reach,
              top: -reach,
              height: 2 * reach,
              backgroundColor: MIRROR_GLASS.glass,
            },
            style,
          ]}
        />
      </View>
    </View>
  )
}

export function PassingEdge({ take, sweep, onSwitch, onDone }: OpeningSceneProps) {
  const beats = BEATS[take]
  const { angle, span, reach } = useDiagonal()
  const corners = useSharedValue(0)

  useEffect(() => {
    sweep.value = 0
    sweep.value = withDelay(
      beats.wait,
      withTiming(1, { duration: beats.cross, easing: Easing.inOut(Easing.sin) }),
    )
    const timers = [
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      }, beats.wait),
      setTimeout(() => {
        onSwitch()
        corners.value = withTiming(CORNER_OPACITY, { duration: CORNERS_MS })
      }, beats.wait + beats.cross),
      setTimeout(onDone, beats.done),
    ]
    return () => {
      for (const timer of timers) clearTimeout(timer)
    }
  }, [])

  // Starting and ending past the corners, so it arrives and leaves rather than appears.
  const edgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value * (span + 2 * EDGE_GLOW) - 2 * EDGE_GLOW }],
  }))
  const cornersStyle = useAnimatedStyle(() => ({ opacity: corners.value }))

  return (
    <View className="absolute inset-0 overflow-hidden" pointerEvents="none" aria-hidden>
      <Animated.View className="absolute inset-0" style={cornersStyle}>
        <EdgeFog />
      </Animated.View>
      <View style={[CORNER_BOX, { transform: [{ rotate: angle }] }]}>
        <Animated.View
          className="flex-row"
          style={[
            {
              position: 'absolute',
              left: 0,
              top: -reach,
              height: 2 * reach,
              width: 2 * EDGE_GLOW,
            },
            edgeStyle,
          ]}
        >
          <LinearGradient
            colors={[MIRROR_GLASS.shineClear, MIRROR_GLASS.edgeGlow]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
          <View style={{ width: EDGE_LINE, backgroundColor: MIRROR_GLASS.edge }} />
          <LinearGradient
            colors={[MIRROR_GLASS.edgeGlow, MIRROR_GLASS.shineClear]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    </View>
  )
}
