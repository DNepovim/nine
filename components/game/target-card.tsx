import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { PieCountdown } from '@/components/game/pie-countdown'
import { mono } from '@/constants/theme'
import type { DisplayTarget } from '@/types/game'

export function TargetCard({
  target,
  isDark,
  duration,
  par,
  onExpire,
  onExitComplete,
}: {
  target: DisplayTarget
  isDark: boolean
  duration: number
  par?: number
  onExpire: () => void
  onExitComplete: () => void
}) {
  const scale = useSharedValue(0.6)
  const opacity = useSharedValue(0)

  useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 200 })
    opacity.value = withTiming(1, { duration: 180 })
  }, [])

  useEffect(() => {
    if (!target.exiting) return
    scale.value = withSpring(1.15, { damping: 10, stiffness: 300 })
    opacity.value = withTiming(0, { duration: 250 }, (finished) => {
      if (finished) scheduleOnRN(onExitComplete)
    })
  }, [target.exiting])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: target.position.x,
          top: target.position.y,
        },
        animStyle,
      ]}
    >
      <PieCountdown
        value={target.value}
        isDark={isDark}
        active={!target.exiting}
        duration={duration}
        onComplete={onExpire}
      />
      {par !== undefined && (
        <View
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            backgroundColor: '#6B7280',
            borderRadius: 999,
            paddingHorizontal: 6,
            paddingVertical: 3,
          }}
        >
          <Text
            selectable={false}
            style={{
              fontFamily: mono,
              fontSize: 13,
              fontWeight: '700',
              color: '#FFFFFF',
            }}
          >
            {par}
          </Text>
        </View>
      )}
    </Animated.View>
  )
}
