import { useEffect, useMemo } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { LeverBulbs } from '@/components/game/openings/lever-bulbs'
import { LeverRunner, RUNNER_GROUPS } from '@/components/game/openings/lever-runner'
import { useViewport } from '@/hooks/use-viewport'

// The marquee: how far in from the edge the frame of bulbs stands, about how far apart the bulbs
// are, and how fast the chase goes, as how long one lit stretch holds.
const SPACING = 24

const INSET = 9

const CHASE_MS = 450

// The bulbs round the edge of the screen, split into two sets that take it in turns to shine.
// A bulb stands in every corner, and each side is divided evenly between its corners, so the
// frame closes without a gap or a doubled bulb; the corner bulbs are drawn larger. The count
// round the circle is even, so odd and even run on unbroken across the seam at the top-left.
function useBulbs() {
  const { width, height } = useViewport()
  return useMemo(() => {
    const w = Math.max(0, width - 2 * INSET)
    const h = Math.max(0, height - 2 * INSET)
    const across = Math.max(1, Math.round(w / SPACING))
    const down = Math.max(1, Math.round(h / SPACING))
    const all: { x: number; y: number; corner: boolean }[] = []
    for (let i = 0; i < across; i++) {
      all.push({ x: INSET + (w * i) / across, y: INSET, corner: i === 0 })
    }
    for (let i = 0; i < down; i++) {
      all.push({ x: INSET + w, y: INSET + (h * i) / down, corner: i === 0 })
    }
    for (let i = 0; i < across; i++) {
      all.push({ x: INSET + w - (w * i) / across, y: INSET + h, corner: i === 0 })
    }
    for (let i = 0; i < down; i++) {
      all.push({ x: INSET, y: INSET + h - (h * i) / down, corner: i === 0 })
    }
    const ordered = all.length % 2 === 0 ? all : all.slice(0, -1)
    return {
      first: ordered.filter((_bulb, at) => at % 2 === 0),
      second: ordered.filter((_bulb, at) => at % 2 === 1),
      ordered,
      width,
      height,
    }
  }, [width, height])
}

const LAP_MS = 900

// Every marquee on screen, to run together when the streak is hit.
const runners = new Set<() => void>()

// Lights the bulbs one after another round the screen's edge, and lets them go out again.
export function runMarquee() {
  runners.forEach((start) => {
    start()
  })
}

// The marquee. Every bulb is always there, dim; what lights them is `blink` — the odd set and the
// even set in turn, `blink` of the way — and the fill, the running of the lights round the
// circle. Which set is shining is the wall's clock, so the scene's bulbs and the remains' blink
// in step.
export function LeverMarquee({
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
        <LeverBulbs
          bulbs={[...first, ...second]}
          width={width}
          height={height}
          lit={false}
        />
      </View>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, one]}>
        <LeverBulbs bulbs={first} width={width} height={height} lit />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, two]}>
        <LeverBulbs bulbs={second} width={width} height={height} lit />
      </Animated.View>
      {groups.map((bulbs, group) => (
        <LeverRunner
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
