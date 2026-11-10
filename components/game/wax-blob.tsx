import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { LAVA } from '@/constants/colors'
import type { Drift } from '@/lib/target-drift'
import { WAX_LOOP, waxColor, waxPath, waxPoints } from '@/lib/wax'

const AnimatedPath = Animated.createAnimatedComponent(Path)

// How long the wax takes to come alive once the number has first moved, and the pulse a step gives.
const WAKE_MS = 700
const PULSE_MS = 160
const HEAT_MS = 420

// One lump of lava-lamp wax: the `blobs` target form's drawing, behind the card's own disc. Its
// outline breathes on the card's own clock and phase (see `waxPoints`), leans the way the number
// drifts, and is coloured on the scale from purple to pink by how hot the number is — the colour
// follows the number through `heat` rather than jumping, and every step gives it one soft pulse.
//
// `wakeIn` is how long until its number first moves, in ms: the wax is a round, still lump until
// then, so a target taken in its first second is caught before it has begun to go anywhere.
export function WaxBlob({
  size,
  phase,
  heading,
  heat,
  step,
  wakeIn,
  warmMs = HEAT_MS,
  shrink,
}: {
  // The side of the square it is drawn in, in px: the lump is round at a little under half of it.
  size: number
  phase: number
  heading: Drift
  // How hot the number it shows is, nought to one — see `waxHeat`.
  heat: number
  // The reading, to give one pulse each time it changes.
  step: number
  wakeIn: number
  // How long a change of `heat` takes to show, in ms. The opening's lump climbs from purple to pink
  // over its whole rise; a card's follows a step of its number, which is quick.
  warmMs?: number
  // How much of its size it keeps, nought to one, where the lump is a clock — a target's shrinks as
  // its ring runs down. Left out, it keeps all of it.
  shrink?: { readonly value: number }
}) {
  const time = useSharedValue(0)
  const life = useSharedValue(wakeIn > 0 ? 0 : 1)
  const warmth = useSharedValue(heat)
  const pulse = useSharedValue(1)

  useEffect(() => {
    time.value = withRepeat(
      withTiming(WAX_LOOP, { duration: WAX_LOOP * 1000, easing: Easing.linear }),
      -1,
    )
    if (wakeIn > 0) {
      life.value = withDelay(
        wakeIn,
        withTiming(1, { duration: WAKE_MS, easing: Easing.inOut(Easing.quad) }),
      )
    }
  }, [])

  useEffect(() => {
    warmth.value = withTiming(heat, { duration: warmMs, easing: Easing.out(Easing.quad) })
  }, [heat, warmMs])

  useEffect(() => {
    pulse.value = withSequence(
      withTiming(1.1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: PULSE_MS * 2, easing: Easing.inOut(Easing.quad) }),
    )
  }, [step])

  const radius = size * 0.38
  const props = useAnimatedProps(() => ({
    d: waxPath(
      waxPoints({
        cx: size / 2,
        cy: size / 2,
        radius: radius * (shrink === undefined ? 1 : shrink.value),
        time: time.value,
        phase,
        heading,
        life: life.value,
      }),
    ),
    fill: waxColor(warmth.value, 1, LAVA.cool, LAVA.hot),
  }))
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }))

  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <AnimatedPath animatedProps={props} />
      </Svg>
    </Animated.View>
  )
}
