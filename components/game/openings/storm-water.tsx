import { useEffect, useMemo } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { STORM } from '@/constants/colors'
import { useTilt } from '@/hooks/use-tilt'
import { useViewport } from '@/hooks/use-viewport'
import { splashSpots, type Splash } from '@/lib/storm'

// The flood GLIMPSE's storm leaves behind the dial: a water surface that comes up from the
// bottom of the screen for as long as the run is played, and lies level whichever way the
// phone is turned.
//
// The level is the run's own clock, not the wall's: it climbs while the run is being played,
// holds where it stands under a pause and under game over, and starts again from the foot with
// the next run. It stops short of the dial's top rows, so it is weather and never a wall.
// Drawn behind the keys and the targets, which stay above it whatever it does.
//
// Two layers of wave slide in opposite directions over a body of water, and the whole
// surface turns about the middle of the screen as the phone does (`useTilt`).

// How high the water stands at the start and at the most, as shares of the screen, how long
// the run waits before it starts to come up, and how long it takes to bring it from one to
// the other. The water is there from the first frame, below the screen's foot: what the
// player sees is its surface coming up out of the bottom.
const START_LEVEL = 0
const TOP_LEVEL = 0.4
const RISE_DELAY_MS = 4000
const RISE_MS = 180_000

// Splashes along the surface, each of three droplets thrown up and out and let fall.
const SPLASHES = splashSpots(17, 14)
const DROPLETS = [-1, 0.35, 1] as const
const DROPLET_SIZE = 3

const WAVELENGTH = 90
const STEP = 10

// A wave's outline across `span` points with `amp` of rise, and the body under it closed at
// `depth`. One wavelength longer than needed, so a slide of exactly one is seamless.
function wavePath(span: number, amp: number, depth: number, phase: number): string {
  const points: string[] = []
  for (let x = 0; x <= span + WAVELENGTH; x += STEP) {
    const y = amp + amp * Math.sin(((x + phase) / WAVELENGTH) * 2 * Math.PI)
    points.push(`${x === 0 ? 'M' : 'L'}${x} ${Math.round(y * 10) / 10}`)
  }
  return `${points.join(' ')} L${span + WAVELENGTH} ${depth} L0 ${depth} Z`
}

function Wave({
  span,
  depth,
  amp,
  phase,
  period,
  direction,
  fill,
}: {
  span: number
  depth: number
  amp: number
  phase: number
  period: number
  direction: 1 | -1
  fill: string
}) {
  const d = useMemo(() => wavePath(span, amp, depth, phase), [span, amp, depth, phase])
  const slide = useSharedValue(0)
  useEffect(() => {
    slide.value = withRepeat(
      withTiming(1, { duration: period, easing: Easing.linear }),
      -1,
    )
  }, [])
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -direction * slide.value * WAVELENGTH - WAVELENGTH }],
  }))
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, style]}>
      <Svg width={span + WAVELENGTH * 2} height={depth}>
        <Path d={d} fill={fill} />
      </Svg>
    </Animated.View>
  )
}

// One raindrop breaking on the surface. `t` runs nought to one over the splash and nought
// again for the wait before the first: a droplet is hidden at nought, so a splash that has
// not begun draws nothing.
function Droplet({
  t,
  side,
  spread,
  lift,
}: {
  t: SharedValue<number>
  side: number
  spread: number
  lift: number
}) {
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1 - t.value,
    transform: [
      { translateX: side * spread * t.value },
      { translateY: -4 * lift * Math.abs(side * 0.5 + 0.5) * t.value * (1 - t.value) },
    ],
  }))
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: DROPLET_SIZE,
          height: DROPLET_SIZE,
          borderRadius: DROPLET_SIZE,
          backgroundColor: STORM.splash,
        },
        style,
      ]}
    />
  )
}

function SplashAt({ spot, width }: { spot: Splash; width: number }) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withDelay(
      spot.offset,
      withRepeat(
        withTiming(1, { duration: spot.period, easing: Easing.out(Easing.quad) }),
        -1,
      ),
    )
  }, [])
  return (
    <View style={{ position: 'absolute', left: (spot.at - 0.5) * width, top: -6 }}>
      {DROPLETS.map((side) => (
        <Droplet key={side} t={t} side={side} spread={spot.spread} lift={spot.lift} />
      ))}
    </View>
  )
}

export function StormWater({ running, runId }: { running: boolean; runId: string }) {
  const { width, height } = useViewport()
  const tilt = useTilt()
  const level = useSharedValue(START_LEVEL)

  // A new run starts from the foot again.
  useEffect(() => {
    cancelAnimation(level)
    level.value = START_LEVEL
  }, [runId])

  // Up while the run is played; held where it stands otherwise. The remaining time is the
  // remaining share of the climb, so a pause costs the water nothing and gives it nothing.
  useEffect(() => {
    if (!running) {
      cancelAnimation(level)
      return
    }
    const left = (TOP_LEVEL - level.value) / (TOP_LEVEL - START_LEVEL)
    // The wait is only for a run that has not begun to rise: the water already up does not
    // wait again after a pause.
    const wait = level.value <= START_LEVEL ? RISE_DELAY_MS : 0
    level.value = withDelay(
      wait,
      withTiming(TOP_LEVEL, { duration: RISE_MS * left, easing: Easing.linear }),
    )
  }, [running, runId])

  // Wide enough to cover the screen from any angle the surface can be turned to.
  const reach = Math.hypot(width, height)
  const span = reach * 2
  const anchor = useAnimatedStyle(() => ({
    transform: [
      { translateX: width / 2 },
      { translateY: height * (1 - level.value) },
      { rotate: `${tilt.value}rad` },
    ],
  }))

  // The splashes show once there is a surface on the screen to break on.
  const rain = useAnimatedStyle(() => ({ opacity: Math.min(1, level.value * 40) }))

  return (
    <View className="absolute inset-0 overflow-hidden" pointerEvents="none" aria-hidden>
      <Animated.View
        style={[{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }, anchor]}
      >
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, rain]}>
          {SPLASHES.map((spot) => (
            <SplashAt key={spot.at} spot={spot} width={width * 1.3} />
          ))}
        </Animated.View>
        <View style={{ position: 'absolute', left: -reach, top: -8 }}>
          <Wave
            span={span}
            depth={reach}
            amp={5}
            phase={0}
            period={4200}
            direction={1}
            fill={STORM.waterBack}
          />
          <Wave
            span={span}
            depth={reach}
            amp={4}
            phase={35}
            period={3000}
            direction={-1}
            fill={STORM.water}
          />
        </View>
      </Animated.View>
    </View>
  )
}
