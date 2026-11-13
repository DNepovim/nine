import { View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { TakeoffRoadside, THING } from '@/components/game/openings/takeoff-roadside'
import type { Roadside } from '@/lib/plane'

// How fast the ground goes by, in px a second: faster than the clouds, which are further off.
export const GROUND_SPEED = 70

export function TakeoffPasser({
  thing,
  clock,
  track,
}: {
  thing: Roadside
  clock: SharedValue<number>
  track: number
}) {
  const size = THING * thing.scale
  const style = useAnimatedStyle(() => {
    const along =
      (((thing.at - (clock.value * GROUND_SPEED) / 1000) % track) + track) % track
    return { transform: [{ translateX: along - size }] }
  })
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: 0, bottom: 0, width: size, height: size },
        style,
      ]}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: THING,
          height: THING,
          transform: [{ scale: thing.scale }],
          transformOrigin: 'left bottom',
        }}
      >
        <TakeoffRoadside kind={thing.kind} />
      </View>
    </Animated.View>
  )
}
