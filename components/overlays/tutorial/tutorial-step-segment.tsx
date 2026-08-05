import { useEffect } from 'react'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { cn } from '@/lib/cn'

export type SegmentState = 'done' | 'current' | 'todo'

export const segmentState = (index: number, step: number): SegmentState => {
  if (index < step) return 'done'
  if (index === step) return 'current'
  return 'todo'
}

export function TutorialStepSegment({
  color,
  state,
}: {
  color: string
  state: SegmentState
}) {
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (state !== 'current') {
      cancelAnimation(opacity)
      opacity.value = 1
      return
    }
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
  }, [state])

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      className={cn('h-1.5 flex-1 rounded-full', state === 'todo' && 'bg-muted')}
      style={[state === 'todo' ? null : { backgroundColor: color }, pulseStyle]}
    />
  )
}
