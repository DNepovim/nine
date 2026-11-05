import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import type { OpeningSceneProps } from '@/components/game/opening-layer'
import { Snow } from '@/components/game/openings/snow'
import { FROST, SCHEMES } from '@/constants/colors'
import { useViewport } from '@/hooks/use-viewport'
import type { OpeningTake } from '@/modes'

// FREEZE's **opening**: a cold snap.
//
// The game screen starts in the day colours, plain. A sheet of frost comes down it from the
// top (`FrostUnder`, drawn under the run, with a bright edge leading it), the white rim of the
// frost closing in from the screen's edges as it goes, a crackle of haptic ticks along the
// way, and the first snow falling behind it. When the edge has reached the foot the whole
// screen turns over to the frost **scheme**. Rim and snow stay for the run as the scene's
// **remains** (`FrostRemains`).
//
// The `short` take is for a run dealt again: the same snap, quickly.

// When each beat lands, in ms from the scene's start, per take: how long the screen stands
// before the frost sets off, how long it takes to reach the foot, the end — which is when
// the first target may arrive — and the crackle along the way.
const BEATS = {
  full: { wait: 600, cross: 1500, done: 2300, ticks: [0.15, 0.35, 0.55, 0.78] },
  short: { wait: 40, cross: 320, done: 520, ticks: [0.5] },
} as const satisfies Record<
  OpeningTake,
  { wait: number; cross: number; done: number; ticks: readonly number[] }
>

// The bright edge leading the frost: a hard line, with a soft glow ahead of it.
const EDGE_LINE = 3
const EDGE_GLOW = 56

// How far the rim starts beyond the screen, as a multiple of it, and how much of the middle
// stays clear once the creep is over.
const RIM_FROM = 1.9
const CLEAR = 0.52

const RIM_ID = 'frost-rim'

// One crackle of the creep.
function tick() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

function FrostRim() {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id={RIM_ID} cx="50%" cy="50%" r="72%">
          <Stop offset={`${CLEAR * 100}%`} stopColor={FROST.rim} stopOpacity={0} />
          <Stop offset="82%" stopColor={FROST.body} stopOpacity={0.55} />
          <Stop offset="100%" stopColor={FROST.rim} stopOpacity={0.95} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${RIM_ID})`} />
    </Svg>
  )
}

// The sheet of frost under the run, with the snow falling behind its edge. Only for as long
// as the scene plays: the scheme is the frost from then on.
export function FrostUnder({ sweep }: { sweep: SharedValue<number> }) {
  const { height } = useViewport()
  const sheet = useAnimatedStyle(() => ({ height: sweep.value * (height + EDGE_GLOW) }))
  const snowed = useAnimatedStyle(() => ({ height: sweep.value * height }))
  return (
    <View className="absolute inset-0 overflow-hidden" pointerEvents="none" aria-hidden>
      <Animated.View
        style={[
          { position: 'absolute', left: 0, right: 0, top: 0 },
          { backgroundColor: SCHEMES.frost.inks.ground },
          sheet,
        ]}
      >
        <LinearGradient
          colors={[FROST.rim, 'rgba(244, 251, 255, 0)']}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            height: EDGE_GLOW,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: EDGE_LINE,
            backgroundColor: FROST.rim,
          }}
        />
      </Animated.View>
      <Animated.View
        style={[
          { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },
          snowed,
        ]}
      >
        <Snow running={false} runId="" />
      </Animated.View>
    </View>
  )
}

// The frost as it stands once the snap is over, behind the run.
export function FrostRemains({ running, runId }: { running: boolean; runId: string }) {
  return (
    <View className="absolute inset-0" pointerEvents="none" aria-hidden>
      <FrostRim />
      <Snow running={running} runId={runId} />
    </View>
  )
}

export function FrostCreep({ take, sweep, onSwitch, onDone }: OpeningSceneProps) {
  const beats = BEATS[take]

  useEffect(() => {
    sweep.value = 0
    sweep.value = withDelay(
      beats.wait,
      withTiming(1, { duration: beats.cross, easing: Easing.inOut(Easing.sin) }),
    )
    const timers = [
      ...beats.ticks.map((at) => setTimeout(tick, beats.wait + at * beats.cross)),
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
        onSwitch()
      }, beats.wait + beats.cross),
      setTimeout(onDone, beats.done),
    ]
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [])

  // The rim closes in with the frost, from beyond the screen to its edges.
  const rimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: RIM_FROM - (RIM_FROM - 1) * sweep.value }],
  }))
  return (
    <View className="absolute inset-0" pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', inset: 0 }, rimStyle]}>
        <FrostRim />
      </Animated.View>
    </View>
  )
}
