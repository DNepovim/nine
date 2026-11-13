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

// The marquee: how far apart the bulbs are, how far in from the edge, and how fast the chase
// goes, as how long one lit stretch holds.
const SPACING = 24

const INSET = 8

const CHASE_MS = 450

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
