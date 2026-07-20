import { useEffect } from 'react'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { PieCountdown } from '@/components/game/pie-countdown'
import type { DisplayTarget } from '@/types/game'

export function TargetCard({
  target,
  isDark,
  duration,
  onExpire,
  onExitComplete,
}: {
  target: DisplayTarget
  isDark: boolean
  duration: number
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
    </Animated.View>
  )
}
