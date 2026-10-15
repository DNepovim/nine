import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { APP_RED } from '@/constants/colors'

// The mark beside LIVE: a red dot, breathing.
//
// The one thing on the sessions list that is **happening rather than recorded**. Every
// other row is a plan or a record, and a word alone does not tell those apart from the
// row that is in front of players this minute — a reader scanning the list sees three
// chips and has to read all three. A dot that moves is read before any of them.
//
// Opacity and not scale: a dot that grows moves the chip's text a fraction of a pixel
// with it on each frame, and the label beside a 5px mark is the thing that must not
// shimmer. Slow, and never to nothing — the house rule for a pulse, the same one
// `SkeletonPulse` keeps for the same reason: a mark that blinks out reads as a fault,
// where one that breathes reads as something running.
const SIZE = 5
const BREATH_MS = 900
const BREATH_TO = 0.25

export function LiveDot() {
  const breath = useSharedValue(1)
  const style = useAnimatedStyle(() => ({ opacity: breath.value }))

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(BREATH_TO, { duration: BREATH_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    )
  }, [breath])

  return (
    <Animated.View
      style={[
        {
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          backgroundColor: APP_RED,
        },
        style,
      ]}
    />
  )
}
