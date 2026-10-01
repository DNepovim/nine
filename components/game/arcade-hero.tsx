import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { HERO_SIZE, SPARK_GAP, SPARKS } from '@/constants/arcade'
import { splinePoint, type Spline } from '@/lib/arcade-layout'

// The hero: a bead of amber with a glow around it, and — when a strike sends it through a
// crossroad without stopping — a comet's tail behind it.
//
// Abstract on purpose. The app has no characters and no illustration in it, so a creature
// here would be the first — and the thing that has to read at fifteen points while moving is
// a shape rather than a face.
//
// Its position is read off the same splines the ways are drawn from, at the same moment and
// on the same thread, so it rides the line rather than crossing it as a way breathes.

const GLOW = HERO_SIZE * 2.2
const CORE = HERO_SIZE * 0.45

// How much the bead swells while it waits at a crossroad. A pulse, not a throb: it is what
// says the hero is waiting for an answer.
const PULSE = 1.07
const PULSE_MS = 760

// How long the tail takes to catch light and to go out again. Short, but not instant: a
// comet that appeared between two frames would read as a different object.
const BLAZE_MS = 160

// Where the hero is at `t`, which runs 0 → 1 along one way and 1 → 2 on through a second.
//
// Above its callers, because the worklet transform rewrites each of these into a `const`.
// Shared by the bead and by every spark behind it, so the tail is on the same curve as the
// thing dragging it rather than on a straight line between two points.
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

type Flight = {
  spline: Spline | null
  originX: number
  originY: number
  through: Spline | null
  throughX: number
  throughY: number
  progress: SharedValue<number>
  clock: SharedValue<number>
}

// One spark of the tail, trailing its own distance behind the bead. Module level, because a
// component declared inside another remounts on every render of it — and a spark that
// remounted mid-flight would start its fade again from nothing.
function HeroSpark({
  index,
  blaze,
  amber,
  flight,
}: {
  index: number
  blaze: SharedValue<number>
  amber: string
  flight: Flight
}) {
  const size = HERO_SIZE * (0.78 - index * 0.11)
  const style = useAnimatedStyle(() => {
    const at = heroAt(
      flight.progress.value - (index + 1) * SPARK_GAP,
      flight.spline,
      flight.originX,
      flight.originY,
      flight.through,
      flight.throughX,
      flight.throughY,
      flight.clock.value,
    )
    return {
      opacity: blaze.value * (0.5 - index * 0.07),
      transform: [{ translateX: at.x }, { translateY: at.y }],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }, style]}
    >
      <View
        style={{
          position: 'absolute',
          left: -size / 2,
          top: -size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: amber,
        }}
      />
    </Animated.View>
  )
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
  standing,
  rocketing,
  amber,
  core,
}: {
  // The crossroad the first spline is measured from — the one the hero is leaving on a walk,
  // and the one behind it on a retreat.
  originX: number
  originY: number
  // The way being travelled, or null while the hero stands on its crossroad.
  spline: Spline | null
  // On a strike, the way out of the crossroad being passed through, and where that
  // crossroad sits. Null on every other beat.
  through: Spline | null
  throughX: number
  throughY: number
  // How far along the movement it has got. Driven by the screen, which runs it 0 → 1 for a
  // walk, 1 → 0 for a retreat and 0 → 2 for a strike, so one value covers them all.
  progress: SharedValue<number>
  clock: SharedValue<number>
  standing: boolean
  rocketing: boolean
  amber: string
  core: string
}) {
  const pulse = useSharedValue(1)
  const blaze = useSharedValue(0)
  const flight: Flight = {
    spline,
    originX,
    originY,
    through,
    throughX,
    throughY,
    progress,
    clock,
  }

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

  // The tail catches light for the flight and goes out on landing. Animated rather than
  // switched, because nothing in this app appears or disappears between two frames.
  useEffect(() => {
    blaze.value = withTiming(rocketing ? 1 : 0, { duration: BLAZE_MS })
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
        { translateX: at.x },
        { translateY: at.y },
        // Under power it runs a little hotter and a little bigger — the one thing on the
        // canvas that is allowed to look like it is trying.
        { scale: pulse.value * (1 + blaze.value * 0.22) },
      ],
    }
  })

  const glow = useAnimatedStyle(() => ({
    opacity: 1 + blaze.value * 1.6,
  }))

  return (
    <>
      {Array.from({ length: SPARKS }, (_, index) => (
        <HeroSpark
          key={index}
          index={index}
          blaze={blaze}
          amber={amber}
          flight={flight}
        />
      ))}
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }, style]}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: -GLOW / 2,
              top: -GLOW / 2,
              width: GLOW,
              height: GLOW,
              borderRadius: GLOW / 2,
              backgroundColor: `${amber}1F`,
            },
            glow,
          ]}
        />
        <View
          style={{
            position: 'absolute',
            left: -HERO_SIZE / 2,
            top: -HERO_SIZE / 2,
            width: HERO_SIZE,
            height: HERO_SIZE,
            borderRadius: HERO_SIZE / 2,
            backgroundColor: amber,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: -CORE / 2,
            top: -CORE / 2,
            width: CORE,
            height: CORE,
            borderRadius: CORE / 2,
            backgroundColor: core,
          }}
        />
      </Animated.View>
    </>
  )
}
