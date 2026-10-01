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

import { HERO_SIZE } from '@/constants/arcade'
import { splinePoint, type Spline } from '@/lib/arcade-layout'

// The hero: a bead of amber with a glow around it, and nothing else.
//
// Abstract on purpose. The app has no characters and no illustration in it, so a creature
// here would be the first — and the thing that has to read at fifteen points while moving is
// a shape rather than a face.
//
// Its position is read off the same spline the way is drawn from, at the same moment and on
// the same thread, so it rides the line rather than crossing it as the way breathes.

const GLOW = HERO_SIZE * 2.2
const CORE = HERO_SIZE * 0.45

// How much the bead swells while it waits at a crossroad. A pulse, not a throb: it is what
// says the hero is waiting for an answer.
const PULSE = 1.07
const PULSE_MS = 760

export function ArcadeHero({
  originX,
  originY,
  spline,
  progress,
  clock,
  standing,
  amber,
  core,
}: {
  // The crossroad the spline below is measured from — the one the hero is leaving on a walk,
  // and the one behind it on a retreat.
  originX: number
  originY: number
  // The way being travelled, or null while the hero stands on its crossroad.
  spline: Spline | null
  // How far along that way it has got. Driven by the screen, which runs it 0 → 1 for a walk
  // and 1 → 0 for a retreat, so one value covers both directions.
  progress: SharedValue<number>
  clock: SharedValue<number>
  standing: boolean
  amber: string
  core: string
}) {
  const pulse = useSharedValue(1)

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

  const style = useAnimatedStyle(() => {
    const at =
      spline === null ? { x: 0, y: 0 } : splinePoint(spline, progress.value, clock.value)
    return {
      transform: [
        { translateX: originX + at.x },
        { translateY: originY + at.y },
        { scale: pulse.value },
      ],
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
          left: -GLOW / 2,
          top: -GLOW / 2,
          width: GLOW,
          height: GLOW,
          borderRadius: GLOW / 2,
          backgroundColor: `${amber}1F`,
        }}
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
  )
}
