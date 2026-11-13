import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { SKY } from '@/constants/colors'

export const SPARKS = [0, 1, 2, 3, 4, 5, 6, 7] as const

export function TakeoffSpark({
  spark,
  boom,
}: {
  spark: number
  boom: SharedValue<number>
}) {
  const style = useAnimatedStyle(() => {
    const heading = (spark / SPARKS.length) * 2 * Math.PI
    const reach = 40 + (spark % 3) * 24
    return {
      opacity: boom.value === 0 ? 0 : 1 - boom.value,
      transform: [
        { translateX: Math.cos(heading) * reach * boom.value },
        { translateY: Math.sin(heading) * reach * boom.value - 30 * boom.value },
      ],
    }
  })
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: -3,
          top: -3,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: spark % 2 === 0 ? SKY.fire : SKY.smoke,
        },
        style,
      ]}
    />
  )
}
