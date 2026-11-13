import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { TakeoffCloud } from '@/components/game/openings/takeoff-cloud'

// The clouds, each with its own height, size and speed, drifting left to right and coming back
// round on the far side. Where a cloud stands is the wall's clock, so the scene's clouds and the
// remains' are the same clouds in the same places.
export const CLOUDS = [
  { at: 0.03, width: 120, period: 52_000, offset: 0.1 },
  { at: 0.1, width: 80, period: 38_000, offset: 0.45 },
  { at: 0.17, width: 150, period: 66_000, offset: 0.7 },
  { at: 0.07, width: 64, period: 30_000, offset: 0.85 },
  { at: 0.22, width: 96, period: 46_000, offset: 0.3 },
] as const

export function TakeoffDrifter({
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
      <TakeoffCloud width={cloud.width} />
    </Animated.View>
  )
}
