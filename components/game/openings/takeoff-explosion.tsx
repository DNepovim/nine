import { View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { SPARKS, TakeoffSpark } from '@/components/game/openings/takeoff-spark'
import { SKY } from '@/constants/colors'

// The fire of a crash, `boom` of the way through: a ball that swells and fades, with sparks
// thrown out round it and a plume of smoke.
export function TakeoffExplosion({ boom }: { boom: SharedValue<number> }) {
  const ball = useAnimatedStyle(() => ({
    opacity: boom.value === 0 ? 0 : 1 - boom.value * 0.7,
    transform: [{ scale: 0.3 + boom.value * 2.2 }],
  }))
  return (
    <>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: -45,
            top: -45,
            width: 90,
            height: 90,
            borderRadius: 45,
            backgroundColor: SKY.flame,
          },
          ball,
        ]}
      >
        <View
          style={{
            position: 'absolute',
            left: 20,
            top: 20,
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: SKY.fire,
          }}
        />
      </Animated.View>
      {SPARKS.map((spark) => (
        <TakeoffSpark key={spark} spark={spark} boom={boom} />
      ))}
    </>
  )
}
