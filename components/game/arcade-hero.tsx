import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { G, Path } from 'react-native-svg'

import { HERO_SIZE } from '@/constants/arcade'
import { splinePoint, type Spline } from '@/lib/arcade-layout'
import { flamePath } from '@/lib/flame'

const AnimatedPath = Animated.createAnimatedComponent(Path)

// The hero: a flame, and nothing else.
//
// Abstract on purpose — the app has no characters and no illustration in it, so a creature
// here would be the first. A light is also the only mark that can be the brightest thing on
// a sheet of grey ink without needing a second colour, and the only one that can move while
// standing still: the flame flickers at a crossroad, which is what says the run is waiting
// for an answer rather than stopped.
//
// Its position is read off the same spline the way is drawn from, at the same moment and on
// the same thread, so it rides the line rather than crossing it as the way breathes.

// The box the flame is drawn in. Generous: the body reaches about twice the size it is given
// and the lean takes it a quarter of that sideways.
const BOX = HERO_SIZE * 5
const GLOW = HERO_SIZE * 2.4

// How much the whole flame swells while it waits. Small — the flicker is doing the work.
const PULSE = 1.06
const PULSE_MS = 820

// Where the flame is at `t`, which runs 0 → 1 along one way and 1 → 2 on through a second.
function heroAt(
  t: number,
  spline: Spline | null,
  originX: number,
  originY: number,
  through: Spline | null,
  throughX: number,
  throughY: number,
  clockMs: number,
): { x: number; y: number } {
  'worklet'
  if (spline === null) return { x: originX, y: originY }
  if (through !== null && t > 1) {
    const at = splinePoint(through, Math.min(1, t - 1), clockMs)
    return { x: throughX + at.x, y: throughY + at.y }
  }
  const at = splinePoint(spline, Math.max(0, Math.min(1, t)), clockMs)
  return { x: originX + at.x, y: originY + at.y }
}

export function ArcadeHero({
  originX,
  originY,
  spline,
  through,
  throughX,
  throughY,
  progress,
  clock,
  turn,
  standing,
  rocketing,
  amber,
  core,
}: {
  // The crossroad the first spline is measured from — the one the flame is leaving on a
  // walk, and the one behind it on a retreat.
  originX: number
  originY: number
  spline: Spline | null
  // On a strike, the way out of the crossroad being passed through, and where it sits.
  through: Spline | null
  throughX: number
  throughY: number
  // How far along the movement it has got: 0 → 1 for a walk, 1 → 0 for a retreat and
  // 0 → 2 for a strike, so one value covers them all.
  progress: SharedValue<number>
  clock: SharedValue<number>
  // The sheet's turn, taken back out. Fire goes up, whichever way the map is lying.
  turn: SharedValue<number>
  standing: boolean
  rocketing: boolean
  amber: string
  core: string
}) {
  const pulse = useSharedValue(1)
  const blaze = useSharedValue(0)

  useEffect(() => {
    if (!standing) {
      pulse.value = withTiming(1, { duration: 200 })
      return
    }
    pulse.value = withRepeat(
      withTiming(PULSE, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
  }, [standing])

  // Under power it burns taller. Animated rather than switched, because nothing in this app
  // changes between two frames.
  useEffect(() => {
    blaze.value = withTiming(rocketing ? 1 : 0, { duration: 180 })
  }, [rocketing])

  const style = useAnimatedStyle(() => {
    const at = heroAt(
      progress.value,
      spline,
      originX,
      originY,
      through,
      throughX,
      throughY,
      clock.value,
    )
    return {
      transform: [
        { translateX: at.x - BOX / 2 },
        { translateY: at.y - BOX / 2 },
        // About the box's centre, which is the foot of the flame — so taking the sheet's
        // turn back out leaves the fire standing exactly where it stood.
        { rotate: `${-turn.value}rad` },
        { scale: pulse.value * (1 + blaze.value * 0.2) },
      ],
    }
  })

  const body = useAnimatedProps(() => ({
    d: flamePath(HERO_SIZE * (1 + blaze.value * 0.35), clock.value, false),
  }))
  const tongue = useAnimatedProps(() => ({
    d: flamePath(HERO_SIZE * (1 + blaze.value * 0.35), clock.value, true),
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0, width: BOX, height: BOX }, style]}
    >
      <View
        style={{
          position: 'absolute',
          left: (BOX - GLOW) / 2,
          top: BOX / 2 - GLOW * 0.62,
          width: GLOW,
          height: GLOW,
          borderRadius: GLOW / 2,
          backgroundColor: `${amber}26`,
        }}
      />
      <Svg width={BOX} height={BOX}>
        {/* The flame stands at the centre of its box and rises from there, so the point the
            spline hands back is the foot of the fire rather than the middle of it. */}
        <G transform={`translate(${BOX / 2}, ${BOX / 2})`}>
          <AnimatedPath animatedProps={body} fill={amber} />
          <AnimatedPath animatedProps={tongue} fill={core} />
        </G>
      </Svg>
    </Animated.View>
  )
}
