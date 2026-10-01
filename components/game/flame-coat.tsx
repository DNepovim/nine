import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { Path } from 'react-native-svg'

import { tonguePath } from '@/lib/flame'

const AnimatedPath = Animated.createAnimatedComponent(Path)

// How much further a coat reaches, and how much harder it ruffles, under power.
const BLAZE_SWELL = 0.3
const BLAZE_RUFFLE = 0.5

// One coat of the hero's flare.
//
// The flame is four of these stacked, each smaller and ruffled on a finer grain than the one
// under it: a wide halo at a tenth of its strength, an ember wisp, the amber body, and the
// white wick. Four rather than two because what makes a fire look like a fire from above is
// the *edge* — one filled shape, however well shaped, reads as a cut-out, and three nested
// outlines ruffling at different rates read as something burning.
//
// A component per coat rather than a loop inside the hero, because each one builds its own
// path on the UI thread and `useAnimatedProps` is a hook.
export function FlameCoat({
  size,
  radius,
  reach,
  grain,
  amp,
  fill,
  opacity,
  clock,
  pulse,
  blaze,
  tail,
  speed,
}: {
  // The flame's own unit, which every coat is a multiple of.
  size: number
  radius: number
  // How far this coat is drawn out behind at a walk, as a multiple of `size`. The outer
  // coats reach further than the inner ones, so a running flame feathers out behind rather
  // than sliding along as one piece.
  reach: number
  grain: number
  amp: number
  fill: string
  opacity: number
  clock: SharedValue<number>
  // How the flame breathes while it waits, and how hard it is burning.
  pulse: SharedValue<number>
  blaze: SharedValue<number>
  // Which way it is being drawn out, and how far — nought standing, one at a walk, more
  // under power.
  tail: SharedValue<number>
  speed: SharedValue<number>
}) {
  const shape = useAnimatedProps(() => ({
    d: tonguePath(
      size * radius * pulse.value * (1 + blaze.value * BLAZE_SWELL),
      tail.value,
      size * reach * speed.value,
      clock.value,
      grain,
      amp * (1 + blaze.value * BLAZE_RUFFLE),
    ),
  }))

  return <AnimatedPath animatedProps={shape} fill={fill} opacity={opacity} />
}
