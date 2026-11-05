import * as Haptics from 'expo-haptics'
import { useEffect, useMemo, useRef } from 'react'
import { View } from 'react-native'
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import type { OpeningSceneProps } from '@/components/game/opening-layer'
import { MonitorVitals } from '@/components/game/openings/monitor-vitals'
import { MONITOR } from '@/constants/colors'
import { useViewport } from '@/hooks/use-viewport'
import { BEAT_STEP, BEAT_WIDTH, beatPoints, fibrillationPath } from '@/lib/ecg'
import { RESTING, type RunFigures } from '@/lib/vitals'
import type { OpeningTake } from '@/modes'

// NO SLIP's **opening**: a heart monitor, and a heart being brought back.
//
// The game screen is the monitor's black-green from its first frame and across the middle of
// it, where the targets will stand, runs a straight line: nothing. It stays flat for a beat
// too long while the defibrillator charges — haptic ticks coming faster — and then the
// shock: a white flash, a heavy thump, the line thrown into a few moments of chaos, and out of
// it two steady beats. After that the heart beats when the player does: the line stays flat
// behind the run, on paper ruled into faint squares, and every press of a key sends one beat
// across it (`DefibrillatorRemains`, `useBeats`). No press, no beat.
//
// The `short` take is for a run dealt again: the same shock, struck at once.

// When each beat lands, in ms from the scene's start, per take: the shock, the end, which leaves
// the first beats time to be seen before the first target arrives, and the charging ticks.
const BEATS = {
  full: { shock: 2200, done: 3500, ticks: [1200, 1650, 1950, 2100], pulses: [380, 1250] },
  short: { shock: 150, done: 800, ticks: [], pulses: [380] },
} as const satisfies Record<
  OpeningTake,
  {
    shock: number
    done: number
    ticks: readonly number[]
    // When each steady beat after the shock is sent, in ms after it.
    pulses: readonly number[]
  }
>

// The flash of the shock: up at once, back to a flicker, up again, and out.
const FLASH_STEPS = [
  { to: 0.9, ms: 50 },
  { to: 0.2, ms: 90 },
  { to: 0.6, ms: 60 },
  { to: 0, ms: 360 },
] as const

// Where down the screen the line runs, as a share of its height: the middle of the target area.
const TRACE_AT = 0.4
// The trace's box: how tall it is, with its baseline in the middle so it can be scaled about it.
const TRACE_HEIGHT = 160
const BASELINE = TRACE_HEIGHT / 2
const FIBRILLATION_SEED = 7
const FIBRILLATION_REACH = 44
// How long the chaos has the line to itself before the first beat comes out of it.
const CHAOS_MS = 380

// How fast a beat crosses the screen, right to left, in px a second, and how many can be on
// it at once: a press that would send an eleventh takes the oldest's place.
const SPEED = 300
const POOL = 10

const GRID = 28

function tick() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

// The thump of a beat the shock brings back.
function thump() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
}

// When each beat on the screen was sent, one slot each, and where the next goes. Kept here and
// not in the component so the beats the opening sent are still crossing the screen when its
// remains take over.
const sent: number[] = Array.from({ length: POOL }, () => 0)
let next = 0

// How wide the screen the beats cross was when they were last drawn, which is what a beat's
// crossing is as long as.
let crossingWidth = 0
const CLEAR_MARGIN_MS = 200

// How long until every beat sent has left the screen and the line is flat, in ms: nought when
// none is on it.
export function beatsClearIn(): number {
  const last = Math.max(...sent)
  const crossing = ((crossingWidth + BEAT_WIDTH) * 1000) / SPEED
  return last === 0 ? 0 : Math.max(0, last + crossing + CLEAR_MARGIN_MS - Date.now())
}

// A heart that beats when told to: `fire` sends one beat across the screen from its right edge.
// Everything a beat needs is the moment it was sent, so the beats cross the screen on the wall's
// clock and the remains pick them up where the opening left them.
function useBeats() {
  const starts = useSharedValue<number[]>([...sent])
  const clock = useSharedValue(Date.now())
  useFrameCallback(() => {
    clock.value = Date.now()
  })
  const fire = () => {
    sent[next] = Date.now()
    next = (next + 1) % POOL
    starts.value = [...sent]
  }
  return { starts, clock, fire }
}

const AnimatedPath = Animated.createAnimatedComponent(Path)

// How a beat stands along its width, one height a sample.
const SHAPE = beatPoints().map(({ y }) => y)

// The line across the middle of the screen, and the one line it is: a single path, level where
// nothing has been sent, with every beat on the screen added into it where it has got to. Drawn
// from the beats' own clock each frame, so there is never a second line under the first.
// `chaos` of a fibrillating heart lies over it for the shock, and `glow` is how bright its
// halo stands.
function Trace({
  beats,
  chaos,
  glow,
}: {
  beats: ReturnType<typeof useBeats>
  chaos: SharedValue<number>
  glow: SharedValue<number>
}) {
  const { width, height } = useViewport()
  useEffect(() => {
    crossingWidth = width
  }, [width])
  const mess = useMemo(
    () => fibrillationPath(FIBRILLATION_SEED, width, FIBRILLATION_REACH, BASELINE),
    [width],
  )
  const d = useDerivedValue(() => {
    const now = beats.clock.value
    const sent = beats.starts.value
    let path = ''
    for (let x = 0; x <= width; x += BEAT_STEP) {
      let y = BASELINE
      for (const start of sent) {
        // A slot never used is at the beginning of time: far off to the left.
        const along = (x - (width - ((now - start) * SPEED) / 1000)) / BEAT_STEP
        const sample = Math.floor(along)
        if (sample < 0 || sample >= SHAPE.length - 1) continue
        const here = SHAPE[sample] ?? 0
        const onward = SHAPE[sample + 1] ?? 0
        y += here + (onward - here) * (along - sample)
      }
      path += `${x === 0 ? 'M' : 'L'}${x} ${Math.round(y * 10) / 10} `
    }
    return path
  })
  const line = useAnimatedProps(() => ({ d: d.value }))
  const halo = useAnimatedProps(() => ({ d: d.value, strokeOpacity: glow.value }))
  const chaosStyle = useAnimatedStyle(() => ({ opacity: chaos.value }))
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: height * TRACE_AT - BASELINE,
        height: TRACE_HEIGHT,
        overflow: 'hidden',
      }}
    >
      <Svg width={width} height={TRACE_HEIGHT}>
        <AnimatedPath
          animatedProps={halo}
          fill="none"
          stroke={MONITOR.glow}
          strokeWidth={7}
          strokeLinejoin="round"
        />
        <AnimatedPath
          animatedProps={line}
          fill="none"
          stroke={MONITOR.line}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </Svg>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, chaosStyle]}>
        <Svg width={width} height={TRACE_HEIGHT}>
          <Path d={mess} fill="none" stroke={MONITOR.line} strokeWidth={2} />
        </Svg>
      </Animated.View>
    </View>
  )
}

// The paper the trace is on, ruled into faint squares.
function Grid() {
  const { width, height } = useViewport()
  const d = useMemo(() => {
    const lines: string[] = []
    for (let x = 0; x <= width; x += GRID) lines.push(`M${x} 0 L${x} ${height}`)
    for (let y = 0; y <= height; y += GRID) lines.push(`M0 ${y} L${width} ${y}`)
    return lines.join(' ')
  }, [width, height])
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={MONITOR.grid} strokeWidth={1} />
    </Svg>
  )
}

// The paper behind the run while the scene plays, and after it.
export function DefibrillatorUnder() {
  return (
    <View className="absolute inset-0" pointerEvents="none" aria-hidden>
      <Grid />
      <MonitorVitals figures={RESTING} />
    </View>
  )
}

// The line behind the run, on the paper, with a beat sent across it each time the grid changes:
// a press of a key.
export function DefibrillatorRemains({
  grid,
  figures,
}: {
  grid: unknown
  figures: RunFigures
}) {
  const beats = useBeats()
  const chaos = useSharedValue(0)
  const glow = useSharedValue(1)
  // The grid as it was when this mounted is not a press.
  const seen = useRef(grid)
  useEffect(() => {
    if (seen.current === grid) return
    seen.current = grid
    beats.fire()
  }, [grid])
  return (
    <View className="absolute inset-0" pointerEvents="none" aria-hidden>
      <Grid />
      <MonitorVitals figures={figures} stir={grid} />
      <Trace beats={beats} chaos={chaos} glow={glow} />
    </View>
  )
}

export function Defibrillator({ take, onSwitch, onDone }: OpeningSceneProps) {
  const beats = BEATS[take]
  const heart = useBeats()
  const chaos = useSharedValue(0)
  const glow = useSharedValue(0.3)
  const veil = useSharedValue(0)

  useEffect(() => {
    glow.value = withTiming(1, { duration: beats.shock })
    veil.value = withDelay(
      beats.shock,
      withSequence(...FLASH_STEPS.map(({ to, ms }) => withTiming(to, { duration: ms }))),
    )
    chaos.value = withDelay(
      beats.shock,
      withSequence(
        withTiming(1, { duration: 40 }),
        withTiming(0.35, { duration: 80 }),
        withTiming(1, { duration: 60 }),
        withTiming(0, { duration: CHAOS_MS - 180 }),
      ),
    )
    const timers = [
      ...beats.ticks.map((at) => setTimeout(tick, at)),
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
        onSwitch()
      }, beats.shock),
      ...beats.pulses.map((at) =>
        setTimeout(() => {
          thump()
          heart.fire()
        }, beats.shock + at),
      ),
      setTimeout(onDone, beats.done),
    ]
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [])

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }))
  return (
    <View className="absolute inset-0" pointerEvents="none">
      <Trace beats={heart} chaos={chaos} glow={glow} />
      <Animated.View
        style={[
          { position: 'absolute', inset: 0, backgroundColor: MONITOR.shock },
          veilStyle,
        ]}
      />
    </View>
  )
}
