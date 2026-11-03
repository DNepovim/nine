import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { APP_RED, PLANNED_INK } from '@/constants/colors'

// The mark beside a live session: a red dot, breathing.
//
// The one thing on the challenge screens that is **happening rather than recorded**.
// Every other row is a plan or a record, and a word alone does not tell those apart from
// the one that is in front of players this minute. A dot that moves is read before
// anything else on the row.
//
// Opacity and not scale: a dot that grows moves the date a fraction of a pixel with it
// on each frame, and the figure beside a 5px mark is the thing that must not shimmer.
// Slow, and never to nothing — the house rule for a pulse, the same one `SkeletonPulse`
// keeps for the same reason: a mark that blinks out reads as a fault, where one that
// breathes reads as something running.
const SIZE = 5
const BREATH_MS = 900
const BREATH_TO = 0.25

const dot = (size: number, color: string) => ({
  width: size,
  height: size,
  borderRadius: size / 2,
  backgroundColor: color,
})

// `size` for the gallery's tiles, whose corner holds a dot larger than a table row's.
export function LiveDot({ size = SIZE }: { size?: number }) {
  const breath = useSharedValue(1)
  const style = useAnimatedStyle(() => ({ opacity: breath.value }))

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(BREATH_TO, { duration: BREATH_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    )
  }, [breath])

  return <Animated.View style={[dot(size, APP_RED), style]} />
}

// Its still twin: a challenge with a session in the queue. Still, because nothing is
// running yet — a second pulse would make the one that matters harder to find.
export function PlannedDot({ size = SIZE }: { size?: number }) {
  return <View style={dot(size, PLANNED_INK)} />
}
