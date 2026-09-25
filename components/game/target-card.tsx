import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { PieCountdown, TARGET_EXIT_MS } from '@/components/game/pie-countdown'
import { mono } from '@/constants/theme'
import type { DisplayTarget } from '@/types/game'

export function TargetCard({
  target,
  isDark,
  duration,
  par,
  dying = false,
  frozen = false,
  onExpire,
  onExitComplete,
}: {
  target: DisplayTarget
  isDark: boolean
  duration: number
  par?: number
  dying?: boolean
  // The run is paused: hold the clock where it is until play resumes.
  frozen?: boolean
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
    // On game over the target isn't removed from the machine, so it never picks up an
    // exit — drive the freeze-and-shrink straight off the `dying` prop instead.
    if (dying) {
      scale.value = withTiming(0.4, { duration: 500, easing: Easing.in(Easing.quad) })
      opacity.value = withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) })
      return
    }
    if (target.exit === null) return
    // Either exit, the card only fades and holds its size: the movement worth watching
    // is inside the pie, and the fade is what carries the par badge out with it.
    opacity.value = withTiming(
      0,
      { duration: TARGET_EXIT_MS, easing: Easing.in(Easing.quad) },
      (finished) => {
        if (finished) scheduleOnRN(onExitComplete)
      },
    )
  }, [target.exit, dying])

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
        active={target.exit === null && !dying && !frozen}
        duration={duration}
        startProgress={target.startProgress}
        exit={target.exit}
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
