import * as Haptics from 'expo-haptics'
import { useEffect, useMemo } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Line, Polyline } from 'react-native-svg'

import type { OpeningSceneProps } from '@/components/game/opening-layer'
import { StormWater } from '@/components/game/openings/storm-water'
import { STORM } from '@/constants/colors'
import { useViewport } from '@/hooks/use-viewport'
import { boltForks, boltPath, boltPoints, RAIN_LEAN, rainStreaks } from '@/lib/storm'
import type { OpeningTake } from '@/modes'

// GLIMPSE's **opening**: a storm breaking.
//
// The game screen is the night's navy from its first frame and the rain is already falling
// (`StormUnder`, behind the run). A beat of rain, then a bolt splits the sky from the top of
// the screen, the whole screen flashes white with it, and the flash drains away into the
// storm the run is played in. The rain stays for the run as the scene's **remains**
// (`StormRemains`), the same sheets in the same place.
//
// The `short` take is for a run dealt again: the same bolt, struck at once.

// When each beat lands, in ms from the scene's start, per take: the strike, and the end,
// which leaves the flash its time to drain before the first target arrives.
const BEATS = {
  full: { strike: 900, done: 1700 },
  short: { strike: 120, done: 560 },
} as const satisfies Record<OpeningTake, { strike: number; done: number }>

// The flash: up at once, back to a flicker, up again, and out.
const FLASH_STEPS = [
  { to: 0.95, ms: 50 },
  { to: 0.2, ms: 90 },
  { to: 0.75, ms: 60 },
  { to: 0, ms: 420 },
] as const

// Wide enough for the forks to leave the trunk and spread either side of it.
const BOLT_WIDTH = 320
const FORKS = 6
const BOLT_SEED = 41
const BOLT_REACH = 0.62

// Three sheets of rain at three speeds, the near one longer, brighter and quicker: depth
// from nothing but distance. Counts are for a phone-sized screen.
const SHEETS = [
  { seed: 1, count: 46, length: [8, 16], opacity: 0.35, period: 1100, width: 1 },
  { seed: 2, count: 34, length: [12, 22], opacity: 0.55, period: 800, width: 1.4 },
  { seed: 3, count: 20, length: [18, 30], opacity: 0.8, period: 600, width: 1.8 },
] as const

// One tile of rain, and a second copy of it under the first, so a sheet that slides down by
// one tile has nothing to show but itself: a loop with no seam.
function Sheet({
  seed,
  count,
  length,
  opacity,
  period,
  width: stroke,
}: (typeof SHEETS)[number]) {
  const { width, height } = useViewport()
  const streaks = useMemo(
    () => rainStreaks(seed, count, width, height, length[0], length[1]),
    [seed, count, width, height, length],
  )
  // Where the loop stands is the clock's, not the mount's, so the remains take up the rain
  // exactly where the scene's left it.
  const phase = useSharedValue((Date.now() % period) / period)
  useEffect(() => {
    phase.value = withSequence(
      withTiming(1, { duration: (1 - phase.value) * period, easing: Easing.linear }),
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: period, easing: Easing.linear }),
        ),
        -1,
      ),
    )
  }, [])
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: (phase.value - 1) * height }],
  }))
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: 0, top: 0, width, height: height * 2 },
        style,
      ]}
    >
      <Svg width={width} height={height * 2}>
        {[0, height].flatMap((offset) =>
          streaks.map((streak, index) => (
            <Line
              key={`${offset}-${index}`}
              x1={streak.x}
              y1={streak.y + offset}
              x2={streak.x - streak.length * RAIN_LEAN}
              y2={streak.y + offset + streak.length}
              stroke={STORM.rain}
              strokeOpacity={opacity}
              strokeWidth={stroke}
              strokeLinecap="round"
            />
          )),
        )}
      </Svg>
    </Animated.View>
  )
}

function Rain() {
  return (
    <View className="absolute inset-0 overflow-hidden" pointerEvents="none" aria-hidden>
      {SHEETS.map((sheet) => (
        <Sheet key={sheet.seed} {...sheet} />
      ))}
    </View>
  )
}

// The rain behind the run while the scene plays, and after it.
export function StormUnder() {
  return <Rain />
}

// The rain, and the water that rises through the run. See `StormWater`.
export function StormRemains({ running, runId }: { running: boolean; runId: string }) {
  return (
    <>
      <Rain />
      <StormWater running={running} runId={runId} />
    </>
  )
}

export function StormFront({ take, onSwitch, onDone }: OpeningSceneProps) {
  const beats = BEATS[take]
  const { width, height } = useViewport()
  const veil = useSharedValue(0)
  const bolt = useSharedValue(0)
  const { trunk, forks } = useMemo(() => {
    const reach = height * BOLT_REACH
    const spine = boltPoints(BOLT_SEED, BOLT_WIDTH, reach)
    return {
      trunk: boltPath(spine),
      forks: boltForks(BOLT_SEED, spine, FORKS, reach).map(boltPath),
    }
  }, [height])

  useEffect(() => {
    const flash = FLASH_STEPS.map(({ to, ms }) => withTiming(to, { duration: ms }))
    veil.value = withDelay(beats.strike, withSequence(...flash))
    bolt.value = withDelay(
      beats.strike,
      withSequence(
        withTiming(1, { duration: 40 }),
        withTiming(0.3, { duration: 100 }),
        withTiming(1, { duration: 50 }),
        withTiming(0, { duration: 260 }),
      ),
    )
    const strike = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
      onSwitch()
    }, beats.strike)
    const done = setTimeout(onDone, beats.done)
    return () => {
      clearTimeout(strike)
      clearTimeout(done)
    }
  }, [])

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }))
  const boltStyle = useAnimatedStyle(() => ({ opacity: bolt.value }))
  return (
    <View className="absolute inset-0" pointerEvents="none">
      <Animated.View
        style={[
          { position: 'absolute', left: (width - BOLT_WIDTH) / 2, top: 0 },
          boltStyle,
        ]}
      >
        <Svg width={BOLT_WIDTH} height={height * BOLT_REACH}>
          {forks.map((fork) => (
            <Polyline
              key={`edge-${fork}`}
              points={fork}
              fill="none"
              stroke={STORM.boltEdge}
              strokeWidth={5}
              strokeOpacity={0.5}
              strokeLinejoin="round"
            />
          ))}
          <Polyline
            points={trunk}
            fill="none"
            stroke={STORM.boltEdge}
            strokeWidth={9}
            strokeOpacity={0.6}
            strokeLinejoin="round"
          />
          {forks.map((fork) => (
            <Polyline
              key={`core-${fork}`}
              points={fork}
              fill="none"
              stroke={STORM.bolt}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          ))}
          <Polyline
            points={trunk}
            fill="none"
            stroke={STORM.bolt}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          { position: 'absolute', inset: 0, backgroundColor: STORM.veil },
          veilStyle,
        ]}
      />
    </View>
  )
}
