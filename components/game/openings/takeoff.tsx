import * as Haptics from 'expo-haptics'
import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Ellipse, Line, Polygon } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'

import type { OpeningSceneProps } from '@/components/game/opening-layer'
import { TakeoffExplosion } from '@/components/game/openings/takeoff-explosion'
import { GROUND } from '@/components/game/openings/takeoff-ground'
import { SKY } from '@/constants/colors'
import { useViewport } from '@/hooks/use-viewport'
import { DRAG, fallMs, GRAVITY } from '@/lib/plane'
import type { OpeningTake } from '@/modes'

// LIFTOFF's **opening**: a little plane, as in the arcade games it is an allegory for.
//
// The game screen is a light-blue sky from its first frame, with clouds drifting along the top
// and ground along the foot (`TakeoffSky`, behind the run, for the scene and after it). The plane
// comes in from the left edge at the middle of the targets area and flies to the middle of the
// screen — that is the scene. Then the run begins and the plane starts to fall; every press of
// the key lifts it a little, so a quick hand keeps it aloft, and a slow one lets it meet the
// ground, which ends the run however many hearts are left (`PlaneOver`).
//
// The `short` take is for a run dealt again: the same flight, quickly.

const BEATS = {
  full: { fly: 1700, done: 2000 },
  short: { fly: 380, done: 520 },
} as const satisfies Record<OpeningTake, { fly: number; done: number }>

// Where down the screen the plane flies in, and where it begins, as a share of its height: the
// middle of the targets area.
const START_AT = 0.4
// The plane's size.
const PLANE_W = 84
const PLANE_H = 42

// The plane's physics, in px and seconds: how hard the ground pulls, how much the air holds it
// back, and how much one press kicks it up by. A press adds to the way the plane is going
// rather than setting it: about four a second hold it where it is, fewer let it sink, and more
// lift it fast — a hand at twenty a second pins it to the top.
const KICK = 200
// The fastest it may be going up, whatever the rate.
const MAX_CLIMB = 400
// A plane that has just begun is still climbing a little, so the first press is not a race.
const LAUNCH = 300
const CEILING = 0.1
// How long the fire of a crash burns, which is how long the run's last screen waits for it.
const BOOM_MS = 900

// When the last crash happened, so the cinematic of the run that ended with it can wait for the
// fire. Nought for a run that has not crashed.
let crashedAt = 0

// Where the plane is, read off by whoever has to wait for it: its height, its speed up or down,
// and the height at which it meets the ground. Set by the plane on screen, null where there is
// none.
let flight: {
  read: () => { y: number; climb: number; down: boolean }
  ground: number
} | null = null

// How long, in ms, until the plane has crashed and its fire has burnt out: the fire's own time
// where it has already crashed, the fall and then the fire where it is still in the air —
// as when the last heart goes and the plane has to come down — and nought where there is no
// plane to wait for.
export function crashFireLeft(): number {
  if (crashedAt !== 0) return Math.max(0, crashedAt + BOOM_MS - Date.now())
  if (flight === null) return 0
  const { y, climb, down } = flight.read()
  return down ? 0 : fallMs(y, climb, flight.ground) + BOOM_MS
}

// The plane, flying right. Its nose is at the right of the box, its middle in the middle.
function Plane() {
  return (
    <Svg width={PLANE_W} height={PLANE_H} viewBox="0 0 84 42">
      <Polygon points="12,19 3,5 17,7 26,17" fill={SKY.wing} />
      <Ellipse cx={42} cy={21} rx={30} ry={9} fill={SKY.body} />
      <Polygon points="34,21 26,35 42,35 52,21" fill={SKY.wing} />
      <Ellipse cx={48} cy={17} rx={7} ry={4.5} fill={SKY.glass} />
      <Ellipse cx={70} cy={21} rx={3.5} ry={2.5} fill={SKY.trim} />
      <Line
        x1={76}
        y1={9}
        x2={76}
        y2={33}
        stroke={SKY.dark}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
  )
}

// The scene: the plane in from the left edge to the middle of the screen, level and a little
// bobbing, where the run will take it from.
export function Takeoff({ take, onSwitch, onDone }: OpeningSceneProps) {
  const beats = BEATS[take]
  const { width, height } = useViewport()
  const along = useSharedValue(0)

  useEffect(() => {
    along.value = withTiming(1, { duration: beats.fly, easing: Easing.out(Easing.cubic) })
    const timers = [setTimeout(onSwitch, 0), setTimeout(onDone, beats.done)]
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: -PLANE_W + along.value * (width / 2 + PLANE_W / 2) },
      { translateY: Math.sin(along.value * 9) * 4 * (1 - along.value) },
    ],
  }))
  return (
    <View className="absolute inset-0" pointerEvents="none">
      <Animated.View
        style={[
          { position: 'absolute', left: 0, top: height * START_AT - PLANE_H / 2 },
          style,
        ]}
      >
        <Plane />
      </Animated.View>
    </View>
  )
}

// The plane through the run, in front of everything: it falls, and every press of the key —
// the dial's grid changing — kicks it up a little. Held still while the run is paused or over; when it
// meets the ground it bursts into fire and `onEnd` ends the run.
export function PlaneOver({
  running,
  finished,
  runId,
  grid,
  onEnd,
}: {
  running: boolean
  // The run is over: for another reason than the plane — the last heart — in which case the
  // plane is let fall the rest of the way and burst on the ground, and the run's last screen
  // waits for it (`crashFireLeft`).
  finished: boolean
  runId: string
  grid: unknown
  onEnd: () => void
}) {
  const { width, height } = useViewport()
  const x = width / 2
  const ceiling = height * CEILING
  const floor = height * (1 - GROUND)
  const y = useSharedValue(height * START_AT)
  const climb = useSharedValue(-LAUNCH)
  const live = useSharedValue(running)
  const falling = useSharedValue(running)
  const down = useSharedValue(false)
  const boom = useSharedValue(0)

  useEffect(() => {
    live.value = running
    falling.value = running || finished
  }, [running, finished])

  // Where the plane is, for the run's last screen to wait on.
  useEffect(() => {
    flight = {
      read: () => ({ y: y.value, climb: climb.value, down: down.value }),
      ground: floor - PLANE_H / 2,
    }
    return () => {
      flight = null
    }
  }, [floor])

  // A new run starts from where the scene left the plane. `height` is there because the first
  // render may be measured at nought (see `useViewport`), which would seed the plane at the top
  // and leave it there until the next run; a plane already flying is not moved by a resize.
  useEffect(() => {
    crashedAt = 0
    y.value = height * START_AT
    climb.value = -LAUNCH
    down.value = false
    boom.value = 0
  }, [runId])

  useEffect(() => {
    if (!falling.value) y.value = height * START_AT
  }, [height])

  // A press kicks it up: a little more speed upward than it had.
  const seen = useRef(grid)
  useEffect(() => {
    if (seen.current === grid) return
    seen.current = grid
    if (live.value && !down.value) climb.value = Math.max(-MAX_CLIMB, climb.value - KICK)
  }, [grid])

  const crash = () => {
    crashedAt = Date.now()
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
    boom.value = withTiming(1, { duration: BOOM_MS, easing: Easing.out(Easing.quad) })
    onEnd()
  }

  useFrameCallback((frame) => {
    if (!falling.value || down.value) return
    const step = Math.min((frame.timeSincePreviousFrame ?? 16) / 1000, 0.05)
    climb.value += (GRAVITY - climb.value * DRAG) * step
    y.value += climb.value * step
    if (y.value < ceiling) {
      y.value = ceiling
      climb.value = Math.max(climb.value, 0)
    }
    if (y.value + PLANE_H / 2 >= floor) {
      y.value = floor - PLANE_H / 2
      down.value = true
      scheduleOnRN(crash)
    }
  })

  // Nose up as it climbs, nose down as it falls.
  const plane = useAnimatedStyle(() => ({
    opacity: down.value ? 0 : 1,
    transform: [
      { translateX: x - PLANE_W / 2 },
      { translateY: y.value - PLANE_H / 2 },
      { rotate: `${Math.max(-0.5, Math.min(0.8, climb.value / 900))}rad` },
    ],
  }))
  const fire = useAnimatedStyle(() => ({
    transform: [{ translateX: x }, { translateY: y.value }],
  }))
  return (
    <View className="absolute inset-0" pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, plane]}>
        <Plane />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, fire]}>
        <TakeoffExplosion boom={boom} />
      </Animated.View>
    </View>
  )
}
