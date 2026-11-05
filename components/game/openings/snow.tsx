import { useMemo } from 'react'
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { FROST } from '@/constants/colors'
import { useRisingLevel } from '@/hooks/use-rising-level'
import { useShake } from '@/hooks/use-shake'
import { useViewport } from '@/hooks/use-viewport'
import { flurry, type Flake } from '@/lib/snow'

// The snow FREEZE's frost leaves behind the dial: flakes falling for the whole run, a drift
// along the foot of the screen that they build and that grows with the run, and a shake of the
// phone (`useShake`) that throws the lot up and lets it fall again, as in a snow globe.
//
// Falling is a loop on the clock rather than a body that lands: a flake that reaches the foot
// sinks into the drift, which is drawn in front of it, and the drift stands for everything
// that has landed. Its height is the run's own clock, as the storm's water is
// (`useRisingLevel`): it climbs while the run is played, holds under a pause and starts over
// with the next run. It stops short of the dial's lower rows, so it is weather and never a wall.
//
// A shake sends the drift's snow up, not the drift's shape: the drift sinks as it is thrown
// and rebuilds as it comes back down, with a second flurry in the air in between.

// How high the drift stands at the start, as a dusting, and at the most, as shares of the
// screen, and how long the climb between them takes.
const START_LEVEL = 0.02
const TOP_LEVEL = 0.15
const CLIMB_DELAY_MS = 2000
const CLIMB_MS = 180_000

// The share of the drift a full shake lifts out of it.
const LIFT_SHARE = 0.9

const FALLING = flurry(5, 38)
const THROWN = flurry(9, 34)

// Past the screen's edges where a flake starts and ends, so none pops in or out in view.
const MARGIN = 12

function Fall({
  flake,
  clock,
  shake,
  width,
  height,
}: {
  flake: Flake
  clock: SharedValue<number>
  shake: SharedValue<number>
  width: number
  height: number
}) {
  const style = useAnimatedStyle(() => {
    const t = clock.value
    const fallen = (t / flake.period + flake.phase) % 1
    const a = shake.value
    const y = fallen * (height + 2 * MARGIN) - MARGIN - a * flake.lift * height * 0.45
    const x =
      flake.x * width +
      Math.sin(t / flake.sway + flake.phase * 6.28) * flake.drift +
      Math.sin(t / 140 + flake.phase * 20) * a * 18
    return { transform: [{ translateX: x }, { translateY: y }] }
  })
  return <Animated.View style={[flakeBox(flake.size), style]} />
}

// A flake thrown up from the drift by a shake: out of sight while all is still, rising from
// the foot as the shake builds and sinking back with it.
function Thrown({
  flake,
  clock,
  shake,
  width,
  height,
}: {
  flake: Flake
  clock: SharedValue<number>
  shake: SharedValue<number>
  width: number
  height: number
}) {
  const style = useAnimatedStyle(() => {
    const t = clock.value
    const a = shake.value
    const y =
      height -
      a * flake.lift * height * 0.8 +
      Math.sin(t / 300 + flake.phase * 9) * 14 * a
    const x =
      flake.x * width +
      Math.sin(t / flake.sway + flake.phase * 6.28) * flake.drift * 1.5 * a
    return {
      opacity: Math.min(1, a * 3),
      transform: [{ translateX: x }, { translateY: y }],
    }
  })
  return <Animated.View style={[flakeBox(flake.size), style]} />
}

const flakeBox = (size: number) =>
  ({
    position: 'absolute',
    left: 0,
    top: 0,
    width: size,
    height: size,
    borderRadius: size,
    backgroundColor: FROST.flake,
    borderWidth: 1,
    borderColor: FROST.flakeEdge,
  }) as const

// A drift's outline across `span`: soft hills of a few wavelengths summed, closed under at
// `depth`. `seed` offsets the hills so the two drifts do not rise together.
function driftPath(span: number, depth: number, seed: number): string {
  const points: string[] = []
  for (let x = 0; x <= span; x += 8) {
    const y =
      6 +
      3.2 * Math.sin(x / 38 + seed) +
      2.4 * Math.sin(x / 17 + seed * 2.3) +
      1.6 * Math.sin(x / 71 + seed * 0.7)
    points.push(`${x === 0 ? 'M' : 'L'}${x} ${Math.round(y * 10) / 10}`)
  }
  return `${points.join(' ')} L${span} ${depth} L0 ${depth} Z`
}

export function Snow({ running, runId }: { running: boolean; runId: string }) {
  const { width, height } = useViewport()
  const shake = useShake()
  const level = useRisingLevel(running, runId, {
    from: START_LEVEL,
    to: TOP_LEVEL,
    delayMs: CLIMB_DELAY_MS,
    ms: CLIMB_MS,
  })

  // The wall's time, in ms, for every flake's loop. Where the loop stands is the clock's, so
  // the remains take up the snow wherever the scene left it.
  const clock = useSharedValue(Date.now())
  useFrameCallback(() => {
    clock.value = Date.now()
  })

  const back = useMemo(() => driftPath(width, height, 1.7), [width, height])
  const front = useMemo(() => driftPath(width, height, 0), [width, height])
  const drift = useAnimatedStyle(() => ({
    transform: [
      { translateY: height * (1 - level.value * (1 - LIFT_SHARE * shake.value)) },
    ],
  }))

  return (
    <Animated.View
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
      pointerEvents="none"
    >
      {FALLING.map((flake) => (
        <Fall
          key={flake.x}
          flake={flake}
          clock={clock}
          shake={shake}
          width={width}
          height={height}
        />
      ))}
      {THROWN.map((flake) => (
        <Thrown
          key={flake.x}
          flake={flake}
          clock={clock}
          shake={shake}
          width={width}
          height={height}
        />
      ))}
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, drift]}>
        <Svg width={width} height={height}>
          <Path d={back} fill={FROST.driftBack} />
          <Path
            d={front}
            fill={FROST.drift}
            stroke={FROST.driftEdge}
            strokeWidth={1.5}
            transform="translate(0 7)"
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  )
}
