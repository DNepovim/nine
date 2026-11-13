import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { LeverBulbs } from '@/components/game/openings/lever-bulbs'

// How many stretches of the edge the lights go round by, one after another.
export const RUNNER_GROUPS = 24

// One stretch of the edge. It is lit by the **fill** — the ring closing, nought to one round the
// circle and then staying lit while `solid` is — and put out by `out`, the same way round. It
// is also lit, for a moment, by the lap a hit's streak runs round the edge (`lap`, nought to one
// and on to two for the going out).
export function LeverRunner({
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
      <LeverBulbs bulbs={bulbs} width={width} height={height} lit />
    </Animated.View>
  )
}
