import * as Haptics from 'expo-haptics'
import { useEffect, useMemo, useRef } from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'

import type { OpeningSceneProps } from '@/components/game/opening-layer'
import { CASINO } from '@/constants/colors'
import { useViewport } from '@/hooks/use-viewport'
import type { RunFigures } from '@/lib/vitals'
import type { OpeningTake } from '@/modes'

// SCRAMBLE's **opening**: a slot machine switched on and played.
//
// The game screen is the casino's red velvet from its first frame, the marquee of bulbs round
// its edge all off and the rows above the dial dark. The bulbs light one after another round the
// circle, and when the ring is closed the rows above the dial flash on like a bulb catching. Then
// the lever on the right is pulled down, and that shuffles the dial: the keys spin like reels and
// stop one after another, and the run begins on the dial they land on.
//
// What stays for the run is the scene's **remains**: the bulbs blinking, odd and even in turn,
// and running round the edge when a hit carries the streak on (`CasinoRemains`); and the lever
// (`LeverOver`), in front of the run and the player's to pull — dragged down and let go it
// shuffles the dial again. When the run is over the bulbs go out one after another, the way they
// came on, and the game-over screen waits for the last of them (`lightsOutLeft`).
//
// The `short` take is for a run dealt again: the same sequence, quickly.

// When each beat lands, in ms from the scene's start, per take: the bulbs begin to light and how
// long the ring takes to close, the flash of the rows above the dial, the lever starts down and
// how long it takes, the reels' clicks as they stop (after the shuffle), and the end.
const BEATS = {
  full: {
    light: 250,
    ring: 1100,
    flash: 1550,
    pull: 2050,
    pullMs: 520,
    clicks: [450, 650, 850],
    done: 4000,
  },
  short: {
    light: 0,
    ring: 320,
    flash: 400,
    pull: 520,
    pullMs: 220,
    clicks: [450],
    done: 1750,
  },
} as const satisfies Record<
  OpeningTake,
  {
    light: number
    ring: number
    flash: number
    pull: number
    pullMs: number
    clicks: readonly number[]
    done: number
  }
>

// The marquee: how far apart the bulbs are, how far in from the edge, and how fast the chase
// goes, as how long one lit stretch holds.
const SPACING = 24
const INSET = 8
const CHASE_MS = 450

// The lever: how long the rod is.
const ROD = 76
// How much of the way down a drag has to take the knob to count as a pull.
const PULLED = 0.7

// How dark the rows above the dial are until the scene lights them.
const BAR_OFF = 0.12

// How long the bulbs take to go out round the circle at the end of a run, and the beat the
// game-over screen waits after the last of them.
const OUT_MS = 1000
const OUT_PAUSE_MS = 200

const AnimatedLine = Animated.createAnimatedComponent(Line)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

function click() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

function clunk() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
}

function flick() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
}

// How far round the screen's edge, clockwise from the top-left, a bulb on that edge stands.
function perimeterAt(
  { x, y }: { x: number; y: number },
  width: number,
  height: number,
): number {
  if (y <= INSET) return x
  if (x >= width - INSET) return width + y
  if (y >= height - INSET) return width + height + (width - x)
  return 2 * width + height + (height - y)
}

// The bulbs round the edge of the screen, split into two sets that take it in turns to shine.
function useBulbs() {
  const { width, height } = useViewport()
  return useMemo(() => {
    const first: { x: number; y: number }[] = []
    const second: { x: number; y: number }[] = []
    const place = (x: number, y: number, at: number) => {
      ;(at % 2 === 0 ? first : second).push({ x, y })
    }
    let at = 0
    for (let x = INSET; x <= width - INSET; x += SPACING) place(x, INSET, at++)
    for (let y = INSET + SPACING; y <= height - INSET; y += SPACING) {
      place(width - INSET, y, at++)
    }
    for (let x = width - INSET - SPACING; x >= INSET; x -= SPACING) {
      place(x, height - INSET, at++)
    }
    for (let y = height - INSET - SPACING; y > INSET; y -= SPACING) place(INSET, y, at++)
    const ordered = [...first, ...second].sort(
      (a, b) => perimeterAt(a, width, height) - perimeterAt(b, width, height),
    )
    return { first, second, ordered, width, height }
  }, [width, height])
}

const HALO_ID = 'casino-halo'

// A set of bulbs: each a hot core in a ring of its own, with a soft light round it. `lit` draws
// them shining; unlit they are the same bulbs gone dim, so the rim of the screen is always a
// row of bulbs and the chase is only which of them are on.
function BulbSet({
  bulbs,
  width,
  height,
  lit,
}: {
  bulbs: readonly { x: number; y: number }[]
  width: number
  height: number
  lit: boolean
}) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id={HALO_ID} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={CASINO.bulb} stopOpacity={0.85} />
          <Stop offset="45%" stopColor={CASINO.bulb} stopOpacity={0.3} />
          <Stop offset="100%" stopColor={CASINO.bulb} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {lit &&
        bulbs.map(({ x, y }) => (
          <Circle key={`h-${x}-${y}`} cx={x} cy={y} r={14} fill={`url(#${HALO_ID})`} />
        ))}
      {bulbs.map(({ x, y }) => (
        <Circle
          key={`b-${x}-${y}`}
          cx={x}
          cy={y}
          r={4.4}
          fill={lit ? CASINO.flash : CASINO.bulbOff}
          stroke={lit ? CASINO.bulb : CASINO.bulbRim}
          strokeWidth={1.6}
        />
      ))}
    </Svg>
  )
}

// How many stretches of the edge the lights go round by, one after another.
const RUNNER_GROUPS = 24
const LAP_MS = 900

// Every marquee on screen, to run together when the streak is hit.
const runners = new Set<() => void>()

// Lights the bulbs one after another round the screen's edge, and lets them go out again.
function runMarquee() {
  runners.forEach((start) => {
    start()
  })
}

// One stretch of the edge. It is lit by the **fill** — the ring closing, nought to one round the
// circle and then staying lit while `solid` is — and put out by `out`, the same way round. It
// is also lit, for a moment, by the lap a hit's streak runs round the edge (`lap`, nought to one
// and on to two for the going out).
function Runner({
  group,
  bulbs,
  lap,
  fill,
  out,
  solid,
  width,
  height,
}: {
  group: number
  bulbs: readonly { x: number; y: number }[]
  lap: SharedValue<number>
  fill: SharedValue<number>
  out: SharedValue<number>
  solid: SharedValue<number>
  width: number
  height: number
}) {
  const style = useAnimatedStyle(() => {
    const reached = Math.min(1, Math.max(0, lap.value * RUNNER_GROUPS - group))
    const running = lap.value > 1 ? reached * (2 - lap.value) : reached
    const filled = Math.min(1, Math.max(0, fill.value * RUNNER_GROUPS - group))
    const gone = Math.min(1, Math.max(0, out.value * RUNNER_GROUPS - group))
    return { opacity: Math.max(running, filled * (1 - gone) * solid.value) }
  })
  return (
    <Animated.View
      style={[{ position: 'absolute', left: 0, top: 0 }, style]}
      pointerEvents="none"
    >
      <BulbSet bulbs={bulbs} width={width} height={height} lit />
    </Animated.View>
  )
}

// The marquee. Every bulb is always there, dim; what lights them is `blink` — the odd set and the
// even set in turn, `blink` of the way — and the fill, the running of the lights round the
// circle. Which set is shining is the wall's clock, so the scene's bulbs and the remains' blink
// in step.
function Marquee({
  blink,
  fill,
  out,
  solid,
}: {
  blink: SharedValue<number>
  fill: SharedValue<number>
  out: SharedValue<number>
  solid: SharedValue<number>
}) {
  const { first, second, ordered, width, height } = useBulbs()
  const lap = useSharedValue(0)
  useEffect(() => {
    const start = () => {
      lap.value = 0
      lap.value = withSequence(
        withTiming(1, { duration: LAP_MS, easing: Easing.linear }),
        withTiming(2, { duration: 500 }),
      )
    }
    runners.add(start)
    return () => {
      runners.delete(start)
    }
  }, [])
  const groups = useMemo(
    () =>
      Array.from({ length: RUNNER_GROUPS }, (_, group) =>
        ordered.filter(
          (_bulb, at) => Math.floor((at * RUNNER_GROUPS) / ordered.length) === group,
        ),
      ),
    [ordered],
  )
  const clock = useSharedValue(Date.now())
  useFrameCallback(() => {
    clock.value = Date.now()
  })
  // One is fully lit as the other goes dark, with a short fade between so a bulb is seen to blink
  // rather than to flicker. Each style reads the clock itself, so the whole of what it needs is a
  // shared value it names.
  const one = useAnimatedStyle(() => {
    const wave = 0.5 + 0.5 * Math.cos((clock.value / CHASE_MS) * Math.PI)
    const turn = Math.min(1, Math.max(0, (wave - 0.3) / 0.4))
    return { opacity: turn * blink.value }
  })
  const two = useAnimatedStyle(() => {
    const wave = 0.5 - 0.5 * Math.cos((clock.value / CHASE_MS) * Math.PI)
    const turn = Math.min(1, Math.max(0, (wave - 0.3) / 0.4))
    return { opacity: turn * blink.value }
  })
  return (
    <View className="absolute inset-0" pointerEvents="none" aria-hidden>
      <View style={{ position: 'absolute', left: 0, top: 0 }}>
        <BulbSet
          bulbs={[...first, ...second]}
          width={width}
          height={height}
          lit={false}
        />
      </View>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, one]}>
        <BulbSet bulbs={first} width={width} height={height} lit />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, two]}>
        <BulbSet bulbs={second} width={width} height={height} lit />
      </Animated.View>
      {groups.map((bulbs, group) => (
        <Runner
          key={group}
          group={group}
          bulbs={bulbs}
          lap={lap}
          fill={fill}
          out={out}
          solid={solid}
          width={width}
          height={height}
        />
      ))}
    </View>
  )
}

// When the bulbs began to go out at the end of the run, so the game-over screen can wait for them.
// Nought while they are not going out.
let outAt = 0

// How long, in ms, until the bulbs have gone out and the beat after them has passed, or nought
// where they are not going out.
export function lightsOutLeft(): number {
  return outAt === 0 ? 0 : Math.max(0, outAt + OUT_MS + OUT_PAUSE_MS - Date.now())
}

// The marquee as the run keeps it, behind the dial: the odd and even bulbs blinking in turn, and
// the lights run round the edge by every hit that carries the streak a step further. When the run
// is over (`finished`) every bulb is lit and they go out one after another.
export function CasinoRemains({
  figures,
  finished,
}: {
  figures: RunFigures
  finished: boolean
}) {
  const blink = useSharedValue(1)
  const fill = useSharedValue(0)
  const out = useSharedValue(0)
  const solid = useSharedValue(1)
  // The streak as it stood when this mounted is not a hit.
  const seen = useRef(figures.streak)
  useEffect(() => {
    if (figures.streak > seen.current) runMarquee()
    seen.current = figures.streak
  }, [figures.streak])

  useEffect(() => {
    if (!finished) {
      outAt = 0
      return
    }
    outAt = Date.now()
    blink.value = withTiming(0, { duration: 120 })
    fill.value = 1
    out.value = 0
    out.value = withTiming(1, { duration: OUT_MS, easing: Easing.linear })
  }, [finished])

  return <Marquee blink={blink} fill={fill} out={out} solid={solid} />
}

// The lever on the right of the screen: a rod from its socket to a knob, the knob pulled down
// through the socket to below it. `pull` is nought up and one pulled. A box of its own, so it is
// all there is to touch when the player may pull it.
const LEVER_W = 56
const LEVER_TOP = 16
const LEVER_H = ROD * 2.9
const LEVER_TRAVEL = ROD * 1.7
// Where down the screen the lever's socket is, as a share of its height.
const SOCKET_AT = 0.34

function useLeverBox() {
  const { height } = useViewport()
  return { top: height * SOCKET_AT - ROD - LEVER_TOP }
}

function LeverDrawing({ pull }: { pull: SharedValue<number> }) {
  const socket = ROD + LEVER_TOP
  const rod = useAnimatedProps(() => ({ y2: LEVER_TOP + pull.value * LEVER_TRAVEL }))
  const knob = useAnimatedProps(() => ({ cy: LEVER_TOP + pull.value * LEVER_TRAVEL }))
  return (
    <Svg width={LEVER_W} height={LEVER_H}>
      <AnimatedLine
        x1={LEVER_W / 2}
        y1={socket}
        x2={LEVER_W / 2}
        stroke={CASINO.rod}
        strokeWidth={6}
        strokeLinecap="round"
        animatedProps={rod}
      />
      <Circle cx={LEVER_W / 2} cy={socket} r={9} fill={CASINO.rod} />
      <AnimatedCircle
        cx={LEVER_W / 2}
        r={13}
        fill={CASINO.knob}
        stroke={CASINO.knobRim}
        strokeWidth={2}
        animatedProps={knob}
      />
    </Svg>
  )
}

// The lever in the scene, pulled for the player.
function SceneLever({ pull }: { pull: SharedValue<number> }) {
  const { top } = useLeverBox()
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', right: 0, top, width: LEVER_W, height: LEVER_H }}
    >
      <LeverDrawing pull={pull} />
    </View>
  )
}

// The lever through the run, in front of everything, and the player's: drag the knob down and let
// go to shuffle the dial. It springs back at once, and is not pulled again until it has — a pull
// is a pull, not a drag held on. Dead while the run is paused or over.
export function LeverOver({
  running,
  onShuffle,
}: {
  running: boolean
  onShuffle: () => void
}) {
  const { top } = useLeverBox()
  const pull = useSharedValue(0)
  const busy = useSharedValue(false)
  const live = useSharedValue(running)

  useEffect(() => {
    live.value = running
  }, [running])

  const pulled = () => {
    clunk()
    onShuffle()
  }

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      if (!live.value || busy.value) return
      pull.value = Math.min(1, Math.max(0, event.translationY / LEVER_TRAVEL))
    })
    .onEnd(() => {
      if (!live.value || busy.value) return
      const thrown = pull.value >= PULLED
      if (thrown) {
        busy.value = true
        scheduleOnRN(pulled)
      }
      pull.value = withTiming(
        0,
        { duration: thrown ? 420 : 200, easing: Easing.out(Easing.cubic) },
        () => {
          busy.value = false
        },
      )
    })

  return (
    <View className="absolute inset-0" pointerEvents="box-none">
      <GestureDetector gesture={gesture}>
        <View
          style={{ position: 'absolute', right: 0, top, width: LEVER_W, height: LEVER_H }}
        >
          <LeverDrawing pull={pull} />
        </View>
      </GestureDetector>
    </View>
  )
}

export function LeverPull({
  take,
  barLight,
  onShuffle,
  onSwitch,
  onDone,
}: OpeningSceneProps) {
  const beats = BEATS[take]
  const blink = useSharedValue(0)
  const fill = useSharedValue(0)
  const out = useSharedValue(0)
  const solid = useSharedValue(1)
  const pull = useSharedValue(0)

  useEffect(() => {
    // Everything dark: the bulbs off, and the rows above the dial with them.
    barLight.value = BAR_OFF
    fill.value = withDelay(
      beats.light,
      withTiming(1, { duration: beats.ring, easing: Easing.linear }),
    )
    // The rows catch like a bulb: on, back, on, a flutter, and steady.
    barLight.value = withDelay(
      beats.flash,
      withSequence(
        withTiming(1, { duration: 40 }),
        withTiming(0.35, { duration: 70 }),
        withTiming(1, { duration: 50 }),
        withTiming(0.6, { duration: 60 }),
        withTiming(1, { duration: 90 }),
      ),
    )
    // The lever goes down and springs back; at the bottom the dial is shuffled and the bulbs
    // start to blink where they had been lit all round.
    pull.value = withSequence(
      withDelay(
        beats.pull,
        withTiming(1, { duration: beats.pullMs, easing: Easing.in(Easing.quad) }),
      ),
      withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }),
    )
    const shuffleAt = beats.pull + beats.pullMs
    blink.value = withDelay(shuffleAt, withTiming(1, { duration: 300 }))
    solid.value = withDelay(shuffleAt, withTiming(0, { duration: 300 }))
    const timers = [
      setTimeout(onSwitch, 0),
      // A tick for every few bulbs as they light.
      ...[0.25, 0.5, 0.75].map((share) =>
        setTimeout(click, beats.light + share * beats.ring),
      ),
      setTimeout(flick, beats.flash),
      setTimeout(() => {
        clunk()
        onShuffle()
      }, shuffleAt),
      ...beats.clicks.map((at) => setTimeout(click, shuffleAt + at)),
      setTimeout(onDone, beats.done),
    ]
    return () => {
      timers.forEach(clearTimeout)
      barLight.value = 1
    }
  }, [])

  return (
    <View className="absolute inset-0" pointerEvents="none">
      <Marquee blink={blink} fill={fill} out={out} solid={solid} />
      <SceneLever pull={pull} />
    </View>
  )
}
