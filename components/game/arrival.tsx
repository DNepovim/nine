import { createContext, use, useEffect, type ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

// The game screen coming in: its pieces one after another rather than all at once — the
// bests, the top bar left to right, the run's figures, the sum, then the dial as a wave
// from its top-left key to its bottom-right one.
//
// One clock for the whole screen rather than an animation per piece, so every piece is on
// the same beat however late it mounted, and replaying is one write. Each piece reads its
// own window of that clock off its `order`.

// Between one piece starting and the next.
const STAGGER_MS = 55
// How long one piece takes to settle.
const SETTLE_MS = 420
// How far a piece travels on its way in. Small: an ease into place, not a fly-in.
const RISE = 10
// Where the dial's wave starts, after everything above it.
export const DIAL_ORDER = 8
// The latest `order` the entrance waits for — the last key of a three-by-three dial. A
// bigger dial's farther keys land with it rather than stretching the whole entrance.
const LAST_ORDER = DIAL_ORDER + 4
const END_MS = LAST_ORDER * STAGGER_MS + SETTLE_MS

const ArrivalClock = createContext<SharedValue<number> | null>(null)

// Holds the clock. `arrived` false parks every piece out of sight, which is free while the
// intro covers the screen; turning it true plays the entrance. A screen that mounts already
// arrived — a run restored on launch — is simply there.
export function ArrivalStage({
  arrived,
  children,
}: {
  arrived: boolean
  children: ReactNode
}) {
  const reduced = useReducedMotion()
  const clock = useSharedValue(arrived ? END_MS : 0)
  useEffect(() => {
    if (!arrived) {
      clock.value = 0
      return
    }
    clock.value = reduced
      ? END_MS
      : withTiming(END_MS, { duration: END_MS, easing: Easing.linear })
  }, [arrived, reduced, clock])
  return <ArrivalClock value={clock}>{children}</ArrivalClock>
}

// One piece of the entrance. `from` is the side it comes in from: the top of the screen
// drops into place, the dial rises into it. Outside a stage — the arcade, the room — it is
// a plain view.
export function Arrival({
  order,
  from,
  className,
  style,
  children,
}: {
  order: number
  from: 'above' | 'below'
  className?: string
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const clock = use(ArrivalClock)
  const sign = from === 'above' ? -1 : 1
  const animated = useAnimatedStyle(() => {
    if (clock === null) return {}
    const start = Math.min(order, LAST_ORDER) * STAGGER_MS
    const local = Math.min(Math.max((clock.value - start) / SETTLE_MS, 0), 1)
    // Ease-out cubic: quick to leave, slow to land.
    const eased = 1 - (1 - local) ** 3
    return {
      opacity: eased,
      transform: [{ translateY: sign * RISE * (1 - eased) }],
    }
  })
  if (clock === null) {
    return (
      <View className={className} style={style}>
        {children}
      </View>
    )
  }
  return (
    <Animated.View className={className} style={[style, animated]}>
      {children}
    </Animated.View>
  )
}
