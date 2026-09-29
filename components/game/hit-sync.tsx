import { useEffect, useRef, type ReactNode } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

// The sum's own beat. Small on purpose, and this is the ceiling rather than a taste:
// the digits stand 42pt in a row the layout reserves 50 for, so 1.18 is the last size
// that still clears the dial underneath.
const POP_TO = 1.18
const POP_MS = 160

// The sum's half of a hit. Up on the board the target's ring collapses under its number
// and the number swells out of it; down here the sum answers with a beat of its own, so
// the press reads as one event happening at both ends rather than two.
//
// Wraps the digits rather than sitting beside them: the gesture is the number itself
// moving, and there is nothing else to it. Every hit plays this, in every mode.
export function HitSync({ seq, children }: { seq: number; children: ReactNode }) {
  const pop = useSharedValue(1)
  const seen = useRef(seq)

  useEffect(() => {
    // A run starts on whatever seq it inherits, so the first value is the one to sit
    // still for; every change after it is a press that landed.
    if (seq === seen.current) return
    seen.current = seq
    pop.value = withSequence(
      withTiming(POP_TO, { duration: POP_MS, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: POP_MS, easing: Easing.in(Easing.quad) }),
    )
  }, [seq, pop])

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }))

  return <Animated.View style={popStyle}>{children}</Animated.View>
}
