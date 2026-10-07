import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { cn } from '@/lib/cn'

// One breath, out and back. Slow on purpose: a stand-in that blinks reads as something
// going wrong, where one that breathes reads as something still on its way.
const BREATH_MS = 850

// How far down the breath takes it. Never to nothing — bars that vanish on every other
// beat leave the card looking empty, which is the opposite of what a stand-in is for.
const BREATH_TO = 0.4

// How long it takes to clear once the real thing has arrived. Short, and it overlaps the
// content fading up behind it rather than handing over on an empty card.
const LEAVE_MS = 140

// The group of bars standing in for a card that has not arrived, and the one animation
// over all of them.
//
// The whole group breathes as one rather than a bar at a time: a bar apiece is a worklet
// apiece for the single thing being said — that the app is waiting — and out of phase they
// would read as a list filling in row by row, which is not what is happening.
export function SkeletonPulse({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
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
      className={className}
      exiting={FadeOut.duration(LEAVE_MS)}
      style={style}
    >
      {children}
    </Animated.View>
  )
}

// One bar of a stand-in: where a name, a figure or a label is about to be. The caller
// gives it the height and width of the line it stands in for, which is what keeps a
// loading card the shape of the card that is coming instead of a spinner in an empty one.
export function SkeletonBar({ className }: { className?: string }) {
  return <View className={cn('rounded-sm bg-dim/20', className)} />
}
