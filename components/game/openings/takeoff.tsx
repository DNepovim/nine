import * as Haptics from 'expo-haptics'
import { useEffect, useMemo, useRef } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Ellipse, Line, Path, Polygon } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'

import type { OpeningSceneProps } from '@/components/game/opening-layer'
import { SKY } from '@/constants/colors'
import { useViewport } from '@/hooks/use-viewport'
import {
  DRAG,
  fallMs,
  GRAVITY,
  roadside,
  type Roadside,
  type RoadsideKind,
} from '@/lib/plane'
import type { OpeningTake } from '@/modes'

// LIFTOFF's **opening**: a little plane, as in the arcade games it is an allegory for.
//
// The game screen is a light-blue sky from its first frame, with clouds drifting along the top
// and ground along the foot (`Scenery`, behind the run, for the scene and after it). The plane
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
// How much of the screen is ground, as a share of its height.
const GROUND = 0.07
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

// One cloud: a few circles lumped together on a flat base, `width` wide.
function Cloud({ width }: { width: number }) {
  const height = width * 0.5
  return (
    <Svg width={width} height={height}>
      <Circle cx={width * 0.28} cy={height * 0.62} r={height * 0.34} fill={SKY.cloud} />
      <Circle cx={width * 0.5} cy={height * 0.45} r={height * 0.42} fill={SKY.cloud} />
      <Circle cx={width * 0.74} cy={height * 0.6} r={height * 0.32} fill={SKY.cloud} />
      <Ellipse
        cx={width * 0.5}
        cy={height * 0.72}
        rx={width * 0.33}
        ry={height * 0.2}
        fill={SKY.cloud}
      />
    </Svg>
  )
}

// The clouds, each with its own height, size and speed, drifting left to right and coming back
// round on the far side. Where a cloud stands is the wall's clock, so the scene's clouds and the
// remains' are the same clouds in the same places.
const CLOUDS = [
  { at: 0.03, width: 120, period: 52_000, offset: 0.1 },
  { at: 0.1, width: 80, period: 38_000, offset: 0.45 },
  { at: 0.17, width: 150, period: 66_000, offset: 0.7 },
  { at: 0.07, width: 64, period: 30_000, offset: 0.85 },
  { at: 0.22, width: 96, period: 46_000, offset: 0.3 },
] as const

function Drifter({
  cloud,
  clock,
  screen,
}: {
  cloud: (typeof CLOUDS)[number]
  clock: SharedValue<number>
  screen: number
}) {
  const style = useAnimatedStyle(() => {
    const along = (clock.value / cloud.period + cloud.offset) % 1
    return {
      transform: [{ translateX: along * (screen + 2 * cloud.width) - cloud.width }],
    }
  })
  return (
    <Animated.View style={[{ position: 'absolute', left: 0 }, style]}>
      <Cloud width={cloud.width} />
    </Animated.View>
  )
}

// How fast the ground goes by, in px a second: faster than the clouds, which are further off.
const GROUND_SPEED = 70
// What stands along the ground: how many things on a track how many screens long.
const ROADSIDE_COUNT = 7
const ROADSIDE_SCREENS = 4
// A thing's natural size, which the box it is drawn in has and `scale` multiplies.
const THING = 64
// How wide one tile of the hills is: every wave of them divides it, so the hills come round
// again exactly.
const TILE = 360

const rectPath = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y} h${w} v${h} h${-w} Z`

// One thing that stands on the ground, in a 64 px box with its feet on the foot of it.
function Standing({ kind }: { kind: RoadsideKind }) {
  return (
    <Svg width={THING} height={THING} viewBox="0 0 64 64">
      {kind === 'tree' && (
        <>
          <Path d={rectPath(28, 38, 8, 26)} fill={SKY.trunk} />
          <Circle cx={32} cy={28} r={20} fill={SKY.leaf} />
          <Circle cx={21} cy={37} r={12} fill={SKY.leafDark} />
          <Circle cx={43} cy={37} r={12} fill={SKY.leaf} />
        </>
      )}
      {kind === 'pine' && (
        <>
          <Path d={rectPath(29, 46, 6, 18)} fill={SKY.trunk} />
          <Polygon points="32,4 48,28 16,28" fill={SKY.leafDark} />
          <Polygon points="32,16 52,46 12,46" fill={SKY.leaf} />
        </>
      )}
      {kind === 'house' && (
        <>
          <Path d={rectPath(8, 30, 48, 34)} fill={SKY.wall} />
          <Polygon points="3,33 32,8 61,33" fill={SKY.roof} />
          <Path d={rectPath(26, 44, 12, 20)} fill={SKY.trunk} />
          <Path d={rectPath(12, 38, 10, 10)} fill={SKY.glass} />
          <Path d={rectPath(42, 38, 10, 10)} fill={SKY.glass} />
        </>
      )}
      {kind === 'cow' && (
        <>
          <Path d={rectPath(18, 48, 4, 16)} fill={SKY.spot} />
          <Path d={rectPath(26, 48, 4, 16)} fill={SKY.spot} />
          <Path d={rectPath(40, 48, 4, 16)} fill={SKY.spot} />
          <Path d={rectPath(48, 48, 4, 16)} fill={SKY.spot} />
          <Ellipse cx={34} cy={42} rx={20} ry={11} fill={SKY.cow} />
          <Ellipse cx={26} cy={40} rx={5} ry={4} fill={SKY.spot} />
          <Ellipse cx={42} cy={45} rx={4.5} ry={3.5} fill={SKY.spot} />
          <Ellipse cx={56} cy={34} rx={8} ry={7} fill={SKY.cow} />
          <Circle cx={58} cy={32} r={1.4} fill={SKY.spot} />
          <Path d="M52 28 L50 22 L55 26 Z" fill={SKY.spot} />
          <Path
            d="M14 38 C10 40 10 46 12 50"
            stroke={SKY.spot}
            strokeWidth={2}
            fill="none"
          />
        </>
      )}
    </Svg>
  )
}

function Passer({
  thing,
  clock,
  track,
}: {
  thing: Roadside
  clock: SharedValue<number>
  track: number
}) {
  const size = THING * thing.scale
  const style = useAnimatedStyle(() => {
    const along =
      (((thing.at - (clock.value * GROUND_SPEED) / 1000) % track) + track) % track
    return { transform: [{ translateX: along - size }] }
  })
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: 0, bottom: 0, width: size, height: size },
        style,
      ]}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: THING,
          height: THING,
          transform: [{ scale: thing.scale }],
          transformOrigin: 'left bottom',
        }}
      >
        <Standing kind={thing.kind} />
      </View>
    </Animated.View>
  )
}

// The ground along the foot: soil under a lip of grass with soft hills, all going by, and trees,
// houses and the odd cow standing on it as it does.
function Ground({ clock }: { clock: SharedValue<number> }) {
  const { width, height } = useViewport()
  const depth = height * GROUND
  const track = width * ROADSIDE_SCREENS
  const things = useMemo(() => roadside(11, ROADSIDE_COUNT, track), [track])
  const hills = useMemo(() => {
    const points: string[] = []
    for (let x = 0; x <= width + TILE; x += 8) {
      const y =
        6 +
        3 * Math.sin((x / TILE) * 2 * Math.PI * 9) +
        2 * Math.sin((x / TILE) * 2 * Math.PI * 21 + 1.3)
      points.push(`${x === 0 ? 'M' : 'L'}${x} ${Math.round(y * 10) / 10}`)
    }
    return `${points.join(' ')} L${width + TILE} ${depth} L0 ${depth} Z`
  }, [width, depth])
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: -(((clock.value * GROUND_SPEED) / 1000) % TILE) }],
  }))
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: depth }}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: depth - 8 }}>
        {things.map((thing) => (
          <Passer key={thing.at} thing={thing} clock={clock} track={track} />
        ))}
      </View>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, slide]}>
        <Svg width={width + TILE} height={depth}>
          <Path
            d={`M0 ${depth * 0.55} L${width + TILE} ${depth * 0.55} L${width + TILE} ${depth} L0 ${depth} Z`}
            fill={SKY.soil}
          />
          <Path d={hills} fill={SKY.grass} stroke={SKY.grassEdge} strokeWidth={2} />
        </Svg>
      </Animated.View>
    </View>
  )
}

// The sky's furniture, behind the run: clouds along the top and ground along the foot.
function Scenery() {
  const { width, height } = useViewport()
  const clock = useSharedValue(Date.now())
  useFrameCallback(() => {
    clock.value = Date.now()
  })
  return (
    <View className="absolute inset-0 overflow-hidden" pointerEvents="none" aria-hidden>
      {CLOUDS.map((cloud) => (
        <View
          key={cloud.period}
          style={{ position: 'absolute', left: 0, right: 0, top: height * cloud.at }}
        >
          <Drifter cloud={cloud} clock={clock} screen={width} />
        </View>
      ))}
      <Ground clock={clock} />
    </View>
  )
}

// The behind-the-run layer: the scene's and the remains' alike.
export const SkyUnder = Scenery
export const SkyRemains = Scenery

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

const SPARKS = [0, 1, 2, 3, 4, 5, 6, 7] as const

// The fire of a crash, `boom` of the way through: a ball that swells and fades, with sparks
// thrown out round it and a plume of smoke.
function Explosion({ boom }: { boom: SharedValue<number> }) {
  const ball = useAnimatedStyle(() => ({
    opacity: boom.value === 0 ? 0 : 1 - boom.value * 0.7,
    transform: [{ scale: 0.3 + boom.value * 2.2 }],
  }))
  return (
    <>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: -45,
            top: -45,
            width: 90,
            height: 90,
            borderRadius: 45,
            backgroundColor: SKY.flame,
          },
          ball,
        ]}
      >
        <View
          style={{
            position: 'absolute',
            left: 20,
            top: 20,
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: SKY.fire,
          }}
        />
      </Animated.View>
      {SPARKS.map((spark) => (
        <Spark key={spark} spark={spark} boom={boom} />
      ))}
    </>
  )
}

function Spark({ spark, boom }: { spark: number; boom: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const heading = (spark / SPARKS.length) * 2 * Math.PI
    const reach = 40 + (spark % 3) * 24
    return {
      opacity: boom.value === 0 ? 0 : 1 - boom.value,
      transform: [
        { translateX: Math.cos(heading) * reach * boom.value },
        { translateY: Math.sin(heading) * reach * boom.value - 30 * boom.value },
      ],
    }
  })
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: -3,
          top: -3,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: spark % 2 === 0 ? SKY.fire : SKY.smoke,
        },
        style,
      ]}
    />
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
        <Explosion boom={boom} />
      </Animated.View>
    </View>
  )
}
