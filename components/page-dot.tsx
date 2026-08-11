import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { cn } from '@/lib/cn'

// The current dot stretches rather than growing, so the row's height never shifts.
const WIDTH = { rest: 6, active: 20 }
const DURATION = 240

// One dot. Its own file and its own shared value because the width animates:
// defined inside the row's map it would remount on every render and the stretch
// would never play.
//
// Sliding between the widths rather than snapping is what makes a rotation read
// as movement along the row instead of two dots blinking independently.
export function PageDot({
  active,
  filled,
  color,
}: {
  active: boolean
  // False leaves the dot on the muted track colour instead of taking `color`.
  filled: boolean
  color: string
}) {
  const width = useSharedValue(active ? WIDTH.active : WIDTH.rest)
  const widthStyle = useAnimatedStyle(() => ({ width: width.value }))

  useEffect(() => {
    width.value = withTiming(active ? WIDTH.active : WIDTH.rest, {
      duration: DURATION,
      easing: Easing.out(Easing.quad),
    })
  }, [active, width])

  return (
    <Animated.View
      className={cn('h-1.5 rounded-full', !filled && 'bg-muted')}
      style={[widthStyle, filled ? { backgroundColor: color } : null]}
    />
  )
}
