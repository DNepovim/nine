import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { APP_RED } from '@/constants/colors'
import { mono } from '@/constants/theme'

// Says why a heart just went in Accuracy — the only mode where a hit itself can cost
// a life, via the same under-20%-accuracy rule the debrief line names in Trainee. A
// heart disappearing says *that* one was lost; nothing near it said why until now, so
// a run could bleed lives to wasted moves and read as bad luck instead.
//
// Same rise-and-fade shape as FloatingPoints/FloatingStat, so it reads as one more
// member of the same HUD-float family rather than a new kind of thing appearing.
export function FloatingLifeLoss({ onDone }: { onDone: () => void }) {
  const ty = useSharedValue(0)
  const op = useSharedValue(0)

  useEffect(() => {
    // Timed to match FloatingPoints' own 980ms exactly: the two share one entry in
    // the floats list and one removal, so if this one ran longer it would be cut off
    // mid-fade the instant the points float removed them both.
    op.value = withSequence(
      withTiming(1, { duration: 90 }),
      withTiming(1, { duration: 590 }),
      withTiming(0, { duration: 300 }),
    )
    ty.value = withTiming(-14, { duration: 980, easing: Easing.out(Easing.quad) })
    const t = setTimeout(onDone, 980)
    return () => {
      clearTimeout(t)
    }
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
    opacity: op.value,
  }))

  return (
    <Animated.Text
      selectable={false}
      style={[
        {
          position: 'absolute',
          top: 20,
          left: 0,
          fontFamily: mono,
          fontWeight: '800',
          fontSize: 9,
          letterSpacing: 1,
          color: APP_RED,
        },
        style,
      ]}
    >
      WASTED MOVES
    </Animated.Text>
  )
}
