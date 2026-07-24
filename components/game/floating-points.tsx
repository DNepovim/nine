import { useEffect } from 'react'
import { Text } from 'react-native'
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { APP_BLUE, APP_RED } from '@/constants/colors'
import { mono } from '@/constants/theme'

export function FloatingPoints({
  points,
  progress,
  bonus,
  onDone,
}: {
  points: number
  progress: number
  bonus: boolean
  onDone: () => void
}) {
  const ty = useSharedValue(0)
  const op = useSharedValue(0)
  const sc = useSharedValue(bonus ? 0.5 : 0.9)

  useEffect(() => {
    op.value = withSequence(
      withTiming(1, { duration: 90 }),
      withTiming(1, { duration: 550 }),
      withTiming(0, { duration: 300 }),
    )
    ty.value = withSequence(
      withTiming(0, { duration: 240 }), // hold below the block — readable
      withTiming(-20, { duration: 720, easing: Easing.out(Easing.quad) }), // rise into the block
    )
    sc.value = withSequence(
      withSpring(bonus ? 1.3 : 1, { damping: 9, stiffness: 220 }),
      withTiming(bonus ? 1.18 : 1, { duration: 220 }),
    )
    const t = setTimeout(onDone, 980)
    return () => {
      clearTimeout(t)
    }
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { scale: sc.value }],
    opacity: op.value,
  }))
  const color = interpolateColor(progress, [0, 1], [APP_RED, APP_BLUE])

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 24,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        style,
      ]}
    >
      <Text
        selectable={false}
        style={{ fontFamily: mono, fontWeight: '900', fontSize: bonus ? 20 : 15, color }}
      >
        +{points}
      </Text>
      {bonus && (
        <Text
          selectable={false}
          style={{
            fontFamily: mono,
            fontWeight: '900',
            fontSize: 11,
            color: '#E7B44C',
          }}
        >
          ×2
        </Text>
      )}
    </Animated.View>
  )
}
